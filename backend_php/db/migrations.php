<?php
declare(strict_types=1);

namespace AumEstates\Db;

use PDO;
use AumEstates\Domain\Normalizer;

final class Migrations
{
    public static function migrate(PDO $pdo): bool
    {
        $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at VARCHAR(32) NOT NULL)');

        $migrations = [
            1 => function (PDO $db) {
                $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'sqlite') {
                    $db->exec('CREATE TABLE IF NOT EXISTS inventory_undo (
                        change_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        property_id TEXT NOT NULL,
                        before_json TEXT NULL,
                        after_json TEXT NOT NULL,
                        undone INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL
                    )');
                } else {
                    $db->exec('CREATE TABLE IF NOT EXISTS inventory_undo (
                        change_id INT AUTO_INCREMENT PRIMARY KEY,
                        property_id VARCHAR(64) NOT NULL,
                        before_json LONGTEXT NULL,
                        after_json LONGTEXT NOT NULL,
                        undone TINYINT(1) NOT NULL DEFAULT 0,
                        created_at VARCHAR(32) NOT NULL
                    )');
                }

                $fixes = [
                    ['AUM-WEB-000142', 'AUM-WEB-000137', 'Arbour'],
                    ['AUM-WEB-000095', 'AUM-WEB-000169', 'Quartier']
                ];
                foreach ($fixes as [$wrong, $correct, $expected]) {
                    $stmt = $db->prepare('SELECT * FROM properties WHERE property_id = ?');
                    $stmt->execute([$wrong]);
                    $row = $stmt->fetch();
                    if ($row && !empty($row['is_featured_approved']) && str_contains((string)($row['featured_card_override_json'] ?? ''), $expected)) {
                        $cStmt = $db->prepare('SELECT 1 FROM properties WHERE property_id = ?');
                        $cStmt->execute([$correct]);
                        if ($cStmt->fetch()) {
                            $up1 = $db->prepare('UPDATE properties SET is_featured_approved = 1, featured_sort_order = ? WHERE property_id = ?');
                            $up1->execute([$row['featured_sort_order'], $correct]);
                            $up2 = $db->prepare('UPDATE properties SET is_featured_approved = 0, featured_card_override_json = NULL WHERE property_id = ?');
                            $up2->execute([$wrong]);
                        }
                    }
                }

                $expiryDate = gmdate('Y-m-d\TH:i:s.v\Z', strtotime('+30 days'));
                $db->prepare('UPDATE client_shortlists SET expires_at = ? WHERE expires_at IS NULL')->execute([$expiryDate]);
            },
            2 => function (PDO $db) {
                $stmt = $db->query('SELECT property_id, listing_title, project_name FROM properties');
                $rows = $stmt->fetchAll();
                $upKeep = $db->prepare('UPDATE property_private SET exact_unit_or_plot_no = COALESCE(exact_unit_or_plot_no, ?) WHERE property_id = ?');
                $upProp = $db->prepare('UPDATE properties SET listing_title = ?, slug = ? WHERE property_id = ?');

                foreach ($rows as $row) {
                    $title = Normalizer::cleanListingTitle($row['listing_title'], $row['project_name']);
                    if ($title !== $row['listing_title']) {
                        $upKeep->execute([$row['listing_title'], $row['property_id']]);
                        $slug = Normalizer::slugify("{$row['property_id']}-{$title}");
                        $upProp->execute([$title, $slug, $row['property_id']]);
                    }
                }

                $db->exec("UPDATE property_private SET title_deed_verified = 0 WHERE source_group_name = 'Master Workbook v13 (10 Oct 2026)' AND encumbrance_notes IS NULL");

                $db->exec("UPDATE properties SET publication_state='archived', is_featured_approved=0
                    WHERE property_id IN (SELECT property_id FROM property_private WHERE owner_email_cache='vsinghania@example.org' OR raw_whatsapp_text LIKE 'Elevate Hines Sec 59 | 3395 sqft%')
                    AND property_id IN ('AUM-OFF-000001','AUM-DRF-000001')");

                $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'sqlite') {
                    $db->exec("UPDATE leads SET stage='closed_lost', lead_title='[DEMO] ' || lead_title WHERE client_email='s.malhotra@example.org' AND lead_id='LEAD-2026-0001' AND lead_title NOT LIKE '[DEMO]%'");
                    $db->exec("UPDATE contacts SET trust_tier='demo_fixture', full_name='[DEMO] ' || full_name WHERE (email IN ('vsinghania@example.org','s.malhotra@example.org') OR (contact_id='CNT-BRK-001' AND phone_norm='9810277310')) AND full_name NOT LIKE '[DEMO]%'");
                } else {
                    $db->exec("UPDATE leads SET stage='closed_lost', lead_title=CONCAT('[DEMO] ', lead_title) WHERE client_email='s.malhotra@example.org' AND lead_id='LEAD-2026-0001' AND lead_title NOT LIKE '[DEMO]%'");
                    $db->exec("UPDATE contacts SET trust_tier='demo_fixture', full_name=CONCAT('[DEMO] ', full_name) WHERE (email IN ('vsinghania@example.org','s.malhotra@example.org') OR (contact_id='CNT-BRK-001' AND phone_norm='9810277310')) AND full_name NOT LIKE '[DEMO]%'");
                }
            },
            3 => function (PDO $db) {
                $setTitle = $db->prepare('UPDATE properties SET listing_title = ?, slug = ? WHERE property_id = ?');
                $keepUnit = $db->prepare('UPDATE property_private SET exact_unit_or_plot_no = COALESCE(exact_unit_or_plot_no, ?) WHERE property_id = ?');
                $setFloor = $db->prepare('UPDATE properties SET floor_label = ? WHERE property_id = ?');
                $setDesc = $db->prepare('UPDATE properties SET public_description = ? WHERE property_id = ?');

                // 3a
                $stmt = $db->query('SELECT property_id, listing_title, public_description, project_name FROM properties');
                foreach ($stmt->fetchAll() as $row) {
                    if (!Normalizer::containsUnitCode($row['listing_title']) && !Normalizer::containsUnitCode($row['public_description'])) {
                        continue;
                    }
                    $keepUnit->execute([$row['listing_title'], $row['property_id']]);
                    if (Normalizer::containsUnitCode($row['listing_title'])) {
                        $title = Normalizer::cleanListingTitle($row['listing_title'], $row['project_name']);
                        $setTitle->execute([$title, Normalizer::slugify("{$row['property_id']}-{$title}"), $row['property_id']]);
                    }
                    if (Normalizer::containsUnitCode($row['public_description'])) {
                        $desc = Normalizer::stripUnitCodes($row['public_description']);
                        if ($desc && !preg_match('/^[A-Z0-9]/', $desc)) {
                            $fullStmt = $db->prepare('SELECT * FROM properties WHERE property_id = ?');
                            $fullStmt->execute([$row['property_id']]);
                            $full = $fullStmt->fetch();
                            $rebuilt = Normalizer::composePublicDescription($full);
                            $parts = array_filter(array_map(fn($p) => Normalizer::cleanWhitespace($p), array_slice(explode(';', $desc), 1)));
                            $residual = implode('; ', $parts);
                            $combined = Normalizer::cleanWhitespace(implode(' ', array_filter([$rebuilt, $residual])));
                            $desc = $combined ?: $rebuilt;
                        }
                        $setDesc->execute([$desc ?: null, $row['property_id']]);
                    }
                }

                // 3b
                $stmt = $db->query('SELECT property_id, listing_title, floor_label, project_name FROM properties');
                foreach ($stmt->fetchAll() as $row) {
                    $marker = Normalizer::extractFloorMarker($row['listing_title']);
                    if (!$marker) {
                        continue;
                    }
                    $title = Normalizer::cleanListingTitle(Normalizer::stripFloorMarker($row['listing_title']), $row['project_name']);
                    $setTitle->execute([$title, Normalizer::slugify("{$row['property_id']}-{$title}"), $row['property_id']]);
                    if (empty($row['floor_label'])) {
                        $setFloor->execute([$marker, $row['property_id']]);
                    }
                }

                // 3c
                $stmt = $db->query("SELECT * FROM properties WHERE public_description IS NULL OR TRIM(public_description) = ''");
                foreach ($stmt->fetchAll() as $row) {
                    $desc = Normalizer::composePublicDescription($row);
                    if ($desc) {
                        $setDesc->execute([$desc, $row['property_id']]);
                    }
                }

                // 3d
                $live = $db->query("SELECT property_id, listing_title, floor_label, project_name FROM properties WHERE publication_state='approved_public'")->fetchAll();
                $groups = [];
                foreach ($live as $row) {
                    $key = mb_strtolower(Normalizer::cleanWhitespace($row['listing_title']) ?? '', 'UTF-8');
                    $groups[$key][] = $row;
                }
                foreach ($groups as $rows) {
                    if (count($rows) < 2) {
                        continue;
                    }
                    foreach ($rows as $row) {
                        $suffix = Normalizer::formatFloorLabel($row['floor_label']);
                        if (!$suffix || str_contains(mb_strtolower($row['listing_title'], 'UTF-8'), mb_strtolower($suffix, 'UTF-8'))) {
                            continue;
                        }
                        $title = Normalizer::cleanListingTitle("{$row['listing_title']} · {$suffix}", $row['project_name']);
                        $setTitle->execute([$title, Normalizer::slugify("{$row['property_id']}-{$title}"), $row['property_id']]);
                    }
                }
            },
            4 => function (PDO $db) {
                $db->exec("UPDATE properties SET image_file = 'sukoon-asya-project-photo.jpg' WHERE image_file = 'sukoon-asya-project-photo.png'");
            },
            5 => function (PDO $db) {
                // Shared throttling store for credential and intake endpoints.
                // PHP-FPM gives every request its own process, so the counter has to
                // live somewhere all workers can see.
                $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'sqlite') {
                    $db->exec('CREATE TABLE IF NOT EXISTS auth_throttle (
                        attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scope TEXT NOT NULL,
                        identifier TEXT NOT NULL,
                        attempted_at TEXT NOT NULL
                    )');
                } else {
                    $db->exec('CREATE TABLE IF NOT EXISTS auth_throttle (
                        attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        scope VARCHAR(32) NOT NULL,
                        identifier VARCHAR(190) NOT NULL,
                        attempted_at VARCHAR(32) NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
                }
                try {
                    $db->exec('CREATE INDEX idx_auth_throttle_lookup ON auth_throttle (scope, identifier, attempted_at)');
                } catch (\Throwable $e) {
                    // Index already present (re-run against a partially migrated database).
                }
            },
            6 => function (PDO $db) {
                // Empty-string contact keys make two unrelated people collide during
                // enquiry de-duplication. Normalise the legacy rows to NULL.
                $db->exec("UPDATE contacts SET email = NULL WHERE email IS NOT NULL AND TRIM(email) = ''");
                $db->exec("UPDATE contacts SET phone_norm = NULL WHERE phone_norm IS NOT NULL AND TRIM(phone_norm) = ''");
            }
        ];

        $changed = false;
        foreach ($migrations as $version => $run) {
            $chk = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
            $chk->execute([$version]);
            if ($chk->fetch()) {
                continue;
            }

            Connection::withTransaction($pdo, function (PDO $db) use ($version, $run) {
                $run($db);
                $ins = $db->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
                $ins->execute([$version, gmdate('Y-m-d\TH:i:s.v\Z')]);
            });
            $changed = true;
        }

        return $changed;
    }
}
