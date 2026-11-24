<?php
declare(strict_types=1);

namespace AumEstates\Domain;

use PDO;
use AumEstates\Config;
use AumEstates\Db\Connection;

final class Publisher
{
    public static function sha256(string $content): string
    {
        return hash('sha256', $content);
    }

    /**
     * Atomically writes content to a target file using a temporary file and atomic rename.
     */
    public static function writeAtomic(string $target, string $content): void
    {
        $dir = dirname($target);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $temp = "{$target}.tmp." . getmypid() . '.' . bin2hex(random_bytes(6));
        $bytes = file_put_contents($temp, $content, LOCK_EX);
        if ($bytes === false) {
            throw new \RuntimeException("Failed to write temporary file: {$temp}");
        }

        if (!rename($temp, $target)) {
            @unlink($temp);
            throw new \RuntimeException("Failed to atomically rename {$temp} to {$target}");
        }
    }

    private static function restoreJournal(array $journal): void
    {
        foreach ($journal['entries'] ?? [] as $entry) {
            $target = $entry['target'];
            $before = $entry['before'];
            if ($before === null) {
                if (file_exists($target)) {
                    @unlink($target);
                }
            } else {
                if (file_exists($before)) {
                    $content = file_get_contents($before);
                    if (!file_exists($target) || file_get_contents($target) !== $content) {
                        self::writeAtomic($target, $content);
                    }
                }
            }
        }
    }

    /**
     * Acquires publisher file lock and recovers uncommitted journal if previous process crashed.
     */
    public static function withReleaseLock(string $releasesDir, callable $fn, ?callable $isCommitted = null)
    {
        if (!is_dir($releasesDir)) {
            mkdir($releasesDir, 0700, true);
        }
        $lockFile = $releasesDir . '/.publisher.lock';

        // An advisory flock is used rather than the presence of a lock file plus a
        // posix_kill liveness probe. The posix extension is commonly disabled on
        // shared hosting, and without it the previous logic treated every existing
        // lock as stale and stole it, so two concurrent publishers could interleave
        // their file promotions. flock is released by the OS if a process dies, so
        // it is both correct under concurrency and self-healing after a crash.
        $lockHandle = @fopen($lockFile, 'c');
        if ($lockHandle === false) {
            throw new \RuntimeException("Unable to open publisher lock file: {$lockFile}");
        }

        if (!flock($lockHandle, LOCK_EX | LOCK_NB)) {
            fclose($lockHandle);
            throw new \RuntimeException('Another publisher is active; retry after it finishes');
        }

        ftruncate($lockHandle, 0);
        fwrite($lockHandle, (string)getmypid());
        fflush($lockHandle);

        try {
            $journalPath = $releasesDir . '/pending.json';
            if (file_exists($journalPath)) {
                $raw = file_get_contents($journalPath);
                $journal = json_decode($raw, true);
                if (is_array($journal)) {
                    $committed = $isCommitted ? $isCommitted($journal['releaseId'] ?? '') : false;
                    if (!$committed) {
                        self::restoreJournal($journal);
                    }
                }
                @unlink($journalPath);
            }

            return $fn();
        } finally {
            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
            @unlink($lockFile);
        }
    }

    /**
     * Promotes a batch of target files with rollback journal protection.
     */
    public static function publishBatch(string $releasesDir, string $releaseId, array $targets, ?callable $afterPromotion = null): array
    {
        $snapshotDir = $releasesDir . '/' . $releaseId;
        if (!is_dir($snapshotDir)) {
            mkdir($snapshotDir, 0700, true);
        }

        $entries = [];
        foreach ($targets as $index => [$target, $content]) {
            $before = file_exists($target) ? "{$snapshotDir}/{$index}.before" : null;
            if ($before) {
                copy($target, $before);
            }
            $next = "{$snapshotDir}/{$index}.next";
            file_put_contents($next, $content, LOCK_EX);
            $entries[] = [
                'target' => $target,
                'before' => $before,
                'next' => $next
            ];
        }

        $journalPath = $releasesDir . '/pending.json';
        self::writeAtomic($journalPath, json_encode(['releaseId' => $releaseId, 'entries' => $entries], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        try {
            foreach ($entries as $entry) {
                self::writeAtomic($entry['target'], file_get_contents($entry['next']));
            }

            if ($afterPromotion) {
                $afterPromotion();
            }

            self::writeAtomic("{$snapshotDir}/snapshot.json", json_encode(['releaseId' => $releaseId, 'entries' => $entries], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            @unlink($journalPath);

            return ['ok' => true];
        } catch (\Throwable $e) {
            try {
                self::restoreJournal(['entries' => $entries]);
                @unlink($journalPath);
            } catch (\Throwable $restoreError) {
                throw new \RuntimeException($e->getMessage() . '; recovery pending: ' . $restoreError->getMessage(), 0, $e);
            }
            throw $e;
        }
    }

    /**
     * Compiles and publishes all static feeds strictly from the Master Database
     * through the Fiduciary Privacy Gate.
     */
    public static function compileFeeds(PDO $pdo, array $options = []): array
    {
        $paths = Config::getPaths();
        $actorUserId = $options['actorUserId'] ?? $options['actor_user_id'] ?? null;
        $actorLabel = $options['actorLabel'] ?? $options['actor_label'] ?? 'system';
        $allowShrink = !empty($options['allowShrink']) || !empty($options['allow_shrink']);
        $writeFiles = $options['writeFiles'] ?? $options['write_files'] ?? true;
        $releasesDir = $options['releasesDir'] ?? $paths['releases_dir'];
        $hostingerDataDir = $options['hostingerDataDir'] ?? $paths['hostinger_data_dir'];

        // 1. Fetch candidate public mandates
        $stmt = $pdo->query("
            SELECT * FROM properties
            WHERE publication_state = 'approved_public'
              AND availability_state = 'available'
            ORDER BY property_id ASC
        ");
        $rows = $stmt->fetchAll();

        if (count($rows) === 0 && !$allowShrink) {
            throw new \RuntimeException('Publication aborted: 0 approved_public + available mandates found (empty export protection)');
        }

        // Anti-truncation threshold
        $existingPubJson = $hostingerDataDir . '/public_inventory.json';
        if (!$allowShrink && file_exists($existingPubJson)) {
            $prevData = @json_decode((string)file_get_contents($existingPubJson), true);
            if (is_array($prevData) && count($prevData) >= 20 && count($rows) < (int)floor(count($prevData) * 0.8)) {
                $prevCount = count($prevData);
                $candCount = count($rows);
                throw new \RuntimeException("Publication aborted by anti-truncation guard: candidate count ({$candCount}) dropped >20% below current published count ({$prevCount}). Pass allowShrink=true to confirm bulk archival.");
            }
        }

        // 2. Validate & project every public mandate BEFORE writing
        $publicRecords = [];
        $allErrors = [];
        $seenIds = [];

        foreach ($rows as $row) {
            $pid = $row['property_id'];
            if (isset($seenIds[$pid])) {
                $allErrors[] = "Duplicate property_id in export set: {$pid}";
                continue;
            }
            $seenIds[$pid] = true;

            $check = PrivacyGate::validateAndProjectPublicRecord($row);
            if (!$check['ok']) {
                foreach ($check['errors'] as $err) {
                    $allErrors[] = $err;
                }
            } else {
                $publicRecords[] = $check['record'];
            }
        }

        // 3. Build & scan approved public projects feed
        $pStmt = $pdo->query("
            SELECT * FROM projects
            WHERE publication_state = 'approved_public'
            ORDER BY is_new_project_curated DESC, COALESCE(curated_sort_order, 9999) ASC, project_id ASC
        ");
        $projectRows = $pStmt->fetchAll();

        $publicProjects = [];
        foreach ($projectRows as $p) {
            $dto = [
                'project_id' => $p['project_id'],
                'project_name' => $p['project_name'],
                'city' => $p['city'],
                'locality' => $p['locality'],
                'sector' => $p['sector'],
                'micro_location' => $p['micro_location'],
                'corridor' => $p['corridor'],
                'project_type' => $p['project_type'],
                'status' => $p['status'],
                'description' => $p['description'],
                'key_amenities' => $p['key_amenities'],
                'price_band_text' => $p['price_band_text'],
                'image_file' => $p['image_file'],
                'public_visibility' => 'YES',
                'is_new_project_curated' => (bool)$p['is_new_project_curated'],
                'slug' => $p['slug'],
                'last_verified' => $p['last_verified']
            ];

            foreach ($dto as $k => $v) {
                if (is_string($v)) {
                    $leaks = PrivacyGate::scanTextForLeaks("project.{$p['project_id']}.{$k}", $v);
                    foreach ($leaks as $l) {
                        $allErrors[] = "[PROJECT PRIVACY LEAK] {$p['project_id']}.{$k}: {$l['rule']} ({$l['excerpt']})";
                    }
                }
            }
            $publicProjects[] = $dto;
        }

        // 4. Build & validate featured approved properties feed
        $featuredRows = array_filter($rows, fn($r) => (int)($r['is_featured_approved'] ?? 0) === 1);
        usort($featuredRows, function ($a, $b) {
            $sa = (int)($a['featured_sort_order'] ?? 999);
            $sb = (int)($b['featured_sort_order'] ?? 999);
            return $sa <=> $sb;
        });

        $recordById = [];
        foreach ($publicRecords as $pr) {
            $recordById[$pr['property_id']] = $pr;
        }

        $publicFeatured = [];
        foreach ($featuredRows as $r) {
            $pid = $r['property_id'];
            if (!isset($recordById[$pid])) {
                continue;
            }
            $matchingPub = $recordById[$pid];
            $effectivePrice = Normalizer::formatPublicPriceDisplay($r);

            $locParts = array_values(array_unique(array_filter([$r['locality'] ?? null, $r['sector'] ?? null, $r['city'] ?? null])));
            $featureList = array_values(array_filter([
                $r['configuration'] ?? null,
                !empty($r['area_value']) ? trim("{$r['area_value']} " . ($r['area_unit'] ?? '')) : null
            ]));

            $catLabel = 'Residential';
            if (($r['category'] ?? '') === 'commercial') {
                $catLabel = 'Commercial';
            } elseif (($r['category'] ?? '') === 'plot') {
                $catLabel = 'Plot';
            }

            $card = [
                'property_id' => $pid,
                'name' => $matchingPub['listing_title'],
                'location' => implode(', ', $locParts),
                'type' => $r['property_type'],
                'description' => $matchingPub['public_description'] ?: (PrivacyGate::stripSourcingProvenance($r['key_features'] ?? null) ?: ''),
                'price_text' => $effectivePrice,
                'price_value' => preg_replace('/^₹/', '', $effectivePrice),
                'features' => implode(' · ', $featureList),
                'image' => (Normalizer::isGenericPlaceholderImage($r['image_file'] ?? null) || empty($r['image_file']))
                    ? null
                    : ('assets/property-images/' . $r['image_file']),
                'transaction_type' => $r['transaction_type'] ?: 'Sale',
                'category' => $catLabel,
                'slug' => $matchingPub['slug'],
                'image_label' => $r['image_label'] ?: 'Representative image'
            ];

            $verbatimCardFields = ['property_id', 'slug', 'image', 'price_value'];
            foreach ($card as $k => $v) {
                if (is_string($v) && !in_array($k, $verbatimCardFields, true)) {
                    $card[$k] = Normalizer::normalizePublicVocabulary($v);
                }
            }

            foreach ($card as $k => $v) {
                if (is_string($v)) {
                    $leaks = PrivacyGate::scanTextForLeaks("featured.{$pid}.{$k}", $v);
                    foreach ($leaks as $l) {
                        $allErrors[] = "[FEATURED PRIVACY LEAK] {$pid}.{$k}: {$l['rule']} ({$l['excerpt']})";
                    }
                }
            }
            $publicFeatured[] = $card;
        }

        if (!empty($allErrors)) {
            $top10 = implode("\n- ", array_slice($allErrors, 0, 10));
            $count = count($allErrors);
            throw new \DomainException("Fiduciary Privacy Gate blocked publication with {$count} error(s):\n- {$top10}");
        }

        $jsonFlags = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
        $inventoryJsonStr = json_encode($publicRecords, $jsonFlags) . "\n";
        $inventoryJsStr = "window.AUM_PUBLIC_INVENTORY = " . json_encode($publicRecords, $jsonFlags) . ";\n";
        $projectsJsStr = "window.AUM_PROJECTS_LOCAL = " . json_encode($publicProjects, $jsonFlags) . ";\n";
        $featuredJsStr = "window.AUM_APPROVED_PROPERTIES = " . json_encode($publicFeatured, $jsonFlags) . ";\n";

        $datePart = gmdate('Y-m-d\TH-i-s');
        $randPart = bin2hex(random_bytes(4));
        $releaseId = "REL-{$datePart}-{$randPart}";

        $hashes = [
            'public_inventory.json' => self::sha256($inventoryJsonStr),
            'public_inventory.js' => self::sha256($inventoryJsStr),
            'projects_local.js' => self::sha256($projectsJsStr),
            'approved_properties.js' => self::sha256($featuredJsStr)
        ];

        $writtenTargets = [];

        if ($writeFiles) {
            $targets = [
                [$hostingerDataDir . '/public_inventory.json', $inventoryJsonStr],
                [$hostingerDataDir . '/public_inventory.js', $inventoryJsStr],
                [$hostingerDataDir . '/projects_local.js', $projectsJsStr],
                [$hostingerDataDir . '/approved_properties.js', $featuredJsStr]
            ];
            $writtenTargets[] = $hostingerDataDir;

            // Optional secondary targets
            $root = $paths['root'];
            $conceptDir = $root . '/AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/data';
            if (is_dir(dirname($conceptDir))) {
                $targets[] = [$conceptDir . '/public_inventory.json', $inventoryJsonStr];
                $targets[] = [$conceptDir . '/public_inventory.js', $inventoryJsStr];
                $writtenTargets[] = $conceptDir;
            }

            $gridDir = $root . '/aum-grid-local-baseline-2026-10-27/dist/data';
            if (is_dir(dirname($gridDir))) {
                $targets[] = [$gridDir . '/public_inventory.json', $inventoryJsonStr];
                $targets[] = [$gridDir . '/public_inventory.js', $inventoryJsStr];
                $writtenTargets[] = $gridDir;
            }

            $v16Dir = $root . '/AUM_Estates_Brand_Study_v16_Local/dist';
            if (is_dir($v16Dir)) {
                $targets[] = [$v16Dir . '/public_inventory.js', $inventoryJsStr];
                $writtenTargets[] = $v16Dir;
            }

            $manifest = [
                'release_id' => $releaseId,
                'published_at' => gmdate('Y-m-d\TH:i:s.v\Z'),
                'actor' => $actorLabel,
                'counts' => [
                    'public_properties' => count($publicRecords),
                    'public_projects' => count($publicProjects),
                    'featured_cards' => count($publicFeatured)
                ],
                'sha256' => $hashes,
                'targets' => $writtenTargets
            ];

            $targets[] = [$releasesDir . "/{$releaseId}_manifest.json", json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)];
            $targets[] = [$releasesDir . '/latest_manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)];

            self::publishBatch($releasesDir, $releaseId, $targets, function () use ($pdo, $actorUserId, $actorLabel, $releaseId, $publicRecords, $manifest) {
                Connection::recordAuditLog($pdo, [
                    'actorUserId' => $actorUserId,
                    'actorLabel' => $actorLabel,
                    'entityType' => 'release',
                    'entityId' => $releaseId,
                    'action' => 'publish_static_feeds',
                    'summary' => "Published " . count($publicRecords) . " approved properties",
                    'after' => $manifest
                ]);
            });
        }

        return [
            'releaseId' => $releaseId,
            'counts' => [
                'publicProperties' => count($publicRecords),
                'publicProjects' => count($publicProjects),
                'featuredCards' => count($publicFeatured)
            ],
            'hashes' => $hashes,
            'writtenTargets' => $writtenTargets
        ];
    }

    public static function compileAndPublishStaticFeeds(PDO $pdo, array $options = []): array
    {
        $writeFiles = $options['writeFiles'] ?? $options['write_files'] ?? true;
        if (!$writeFiles) {
            return self::compileFeeds($pdo, $options);
        }

        $releasesDir = $options['releasesDir'] ?? Config::getPaths()['releases_dir'];

        return Connection::withTransaction($pdo, function (PDO $db) use ($releasesDir, $options) {
            return self::withReleaseLock(
                $releasesDir,
                fn() => self::compileFeeds($db, $options),
                function (string $releaseId) use ($db): bool {
                    $stmt = $db->prepare("SELECT 1 FROM audit_logs WHERE entity_type='release' AND entity_id=? AND action='publish_static_feeds'");
                    $stmt->execute([$releaseId]);
                    return (bool)$stmt->fetch();
                }
            );
        });
    }
}
