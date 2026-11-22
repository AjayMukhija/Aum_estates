<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Inventory Importer
 *
 * Imports the master inventory workbook (.xlsx) or a CSV export into the master
 * database, through the same normaliser, quarantine and privacy gate the CRM's
 * own import endpoint uses.
 *
 * Dry run is the default. Nothing is written unless --commit is passed.
 *
 * Usage:
 *   php backend_php/bin/import_inventory.php --file=path/to/Master_Inventory.xlsx
 *   php backend_php/bin/import_inventory.php --file=... --commit
 *   php backend_php/bin/import_inventory.php --file=... --commit --actor="Ajay Mukhija"
 *
 * Options:
 *   --file=PATH     Workbook or CSV to import (required).
 *   --commit        Write the changes. Without it, this only reports.
 *   --actor=NAME    Name recorded in the audit log (default: cli-operator).
 *   --limit=N       Process only the first N rows (useful for a spot check).
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../auth/auth.php';
require_once __DIR__ . '/../domain/normalizer.php';
require_once __DIR__ . '/../domain/privacy_gate.php';
require_once __DIR__ . '/../domain/search_engine.php';
require_once __DIR__ . '/../domain/shortlist.php';
require_once __DIR__ . '/../domain/publisher.php';
require_once __DIR__ . '/../domain/intake_parser.php';
require_once __DIR__ . '/../routes/router.php';
require_once __DIR__ . '/../routes/public_routes.php';
require_once __DIR__ . '/../routes/crm_routes.php';

use PDO;
use AumEstates\Config;
use AumEstates\Db\Connection;
use AumEstates\Domain\IntakeParser;
use AumEstates\Domain\PrivacyGate;
use AumEstates\Routes\CrmRoutes;

$options = getopt('', ['file:', 'commit', 'actor::', 'limit::']);
$file = $options['file'] ?? null;
$commit = isset($options['commit']);
$actor = $options['actor'] ?? 'cli-operator';
$limit = isset($options['limit']) ? max(1, (int)$options['limit']) : null;

if (!$file || !is_file($file)) {
    fwrite(STDERR, "Provide an existing file: --file=path/to/workbook.xlsx\n");
    exit(1);
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$buffer = (string)file_get_contents($file);

try {
    if ($ext === 'xlsx') {
        $rows = IntakeParser::parseXlsxBuffer($buffer);
    } else {
        $rows = IntakeParser::parseImportPayload(['format' => $ext, 'text' => $buffer]);
    }
} catch (\Throwable $e) {
    fwrite(STDERR, "Could not read {$file}: " . $e->getMessage() . "\n");
    exit(1);
}

if (empty($rows)) {
    fwrite(STDERR, "No data rows found in {$file}\n");
    exit(1);
}
if ($limit !== null) {
    $rows = array_slice($rows, 0, $limit);
}

$pdo = Connection::getPdo();

$existing = [];
foreach ($pdo->query('SELECT property_id, publication_state FROM properties') as $r) {
    $existing[$r['property_id']] = $r['publication_state'];
}

$batch = [];
$issues = [];
$seen = [];
$states = [];
$transitions = [];
$vaultCount = 0;
$idx = 0;
$nextNum = count($existing) + 500;

foreach ($rows as $raw) {
    $idx++;
    $nextNum++;
    $res = IntakeParser::normalizeImportedRow($raw, sprintf('AUM-IMP-%06d', $nextNum));
    $pub = $res['publicRecord'];
    $priv = $res['privateRecord'];

    if (!preg_match(Config::PROPERTY_ID_REGEX, $pub['property_id'])) {
        $issues[] = "Row #{$idx}: invalid property_id \"{$pub['property_id']}\"";
        continue;
    }
    if (isset($seen[$pub['property_id']])) {
        $issues[] = "Row #{$idx}: duplicate property_id \"{$pub['property_id']}\" inside the file";
        continue;
    }
    $seen[$pub['property_id']] = true;

    // A record headed for the public catalogue must clear the privacy gate.
    // If it cannot, it is held at pending_approval rather than published.
    if ($pub['publication_state'] === 'approved_public') {
        $chk = PrivacyGate::validateAndProjectPublicRecord(array_merge($pub, ['availability_state' => 'available']));
        if (!$chk['ok']) {
            $pub['publication_state'] = 'pending_approval';
            $issues[] = "Row #{$idx} ({$pub['property_id']}) held at pending_approval: " . ($chk['errors'][0] ?? 'privacy gate check failed');
        }
    }

    $isUpdate = isset($existing[$pub['property_id']]);
    $states[$pub['publication_state']] = ($states[$pub['publication_state']] ?? 0) + 1;

    if ($isUpdate) {
        $was = $existing[$pub['property_id']];
        $now = $pub['publication_state'];
        if ($was !== $now) {
            $key = "{$was} -> {$now}";
            $transitions[$key] = ($transitions[$key] ?? 0) + 1;
        }
    }
    if ($priv['owner_phone_cache'] || $priv['owner_email_cache'] || $priv['broker_name_cache'] || $priv['payment_structure_notes']) {
        $vaultCount++;
    }

    $batch[] = ['isUpdate' => $isUpdate, 'publicRecord' => $pub, 'privateRecord' => $priv];
}

$new = count(array_filter($batch, fn($b) => !$b['isUpdate']));
$upd = count(array_filter($batch, fn($b) => $b['isUpdate']));

echo "======================================================================\n";
echo ($commit ? " IMPORT (committing)" : " IMPORT DRY RUN (nothing will be written)") . "\n";
echo "======================================================================\n";
echo "Source        : {$file}\n";
echo "Rows parsed   : " . count($rows) . "\n";
echo "Valid records : " . count($batch) . "\n";
echo "  new         : {$new}\n";
echo "  updates     : {$upd}\n";
echo "Private vault populated on {$vaultCount} record(s)\n\n";

echo "Resulting publication state:\n";
foreach ($states as $state => $count) {
    printf("  %-20s %d\n", $state, $count);
}

if (!empty($transitions)) {
    echo "\nState changes for existing records:\n";
    foreach ($transitions as $t => $c) {
        printf("  %-40s %d\n", $t, $c);
    }
}

// Anything currently public that this file does not mention would be left
// untouched, not removed. Say so explicitly, because a shrinking catalogue is
// the failure mode that matters most here.
$missing = array_diff(array_keys($existing), array_keys($seen));
if (!empty($missing)) {
    echo "\nIn the database but absent from this file (left untouched, not removed): " . count($missing) . "\n";
    foreach (array_slice($missing, 0, 10) as $m) {
        echo "  - {$m} ({$existing[$m]})\n";
    }
}

if (!empty($issues)) {
    echo "\nNotes (" . count($issues) . "):\n";
    foreach (array_slice($issues, 0, 20) as $i) {
        echo "  - {$i}\n";
    }
    if (count($issues) > 20) {
        echo "  ... and " . (count($issues) - 20) . " more\n";
    }
}

if (!$commit) {
    echo "\nDry run complete. Re-run with --commit to apply.\n";
    exit(0);
}

$actorRecord = ['user_id' => null, 'full_name' => $actor, 'role' => 'principal'];

try {
    Connection::withTransaction($pdo, function (PDO $db) use ($batch, $actorRecord) {
        foreach ($batch as $entry) {
            CrmRoutes::upsertPropertyMaster(
                $db,
                ['public' => $entry['publicRecord'], 'private' => $entry['privateRecord']],
                $actorRecord,
                $entry['isUpdate'] ? $entry['publicRecord']['property_id'] : null
            );
        }
    });
} catch (\Throwable $e) {
    fwrite(STDERR, "\nImport aborted and rolled back: " . $e->getMessage() . "\n");
    exit(1);
}

$finalPublic = (int)$pdo->query("SELECT COUNT(*) FROM properties WHERE publication_state='approved_public' AND availability_state='available'")->fetchColumn();
$finalTotal = (int)$pdo->query('SELECT COUNT(*) FROM properties')->fetchColumn();

echo "\nImport committed.\n";
echo "  Properties in master database : {$finalTotal}\n";
echo "  Live on the public catalogue  : {$finalPublic}\n";
echo "\nNext: php backend_php/bin/publish.php  (compiles the public feeds)\n";
