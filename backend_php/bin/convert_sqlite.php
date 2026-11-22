<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Database Converter: SQLite to MariaDB
 * Usage: php backend_php/bin/convert_sqlite.php [--sqlite path] [--output path] [--password pass]
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../auth/auth.php';
require_once __DIR__ . '/../db/convert_sqlite_to_mariadb.php';

use AumEstates\Config;
use AumEstates\Db\DataMigrator;

$options = getopt('', ['sqlite::', 'output::', 'password::']);
$sqlitePath = $options['sqlite'] ?? Config::getPaths()['sqlite_file'];
$outputPath = $options['output'] ?? (__DIR__ . '/../db/canonical_mariadb_migration.sql');
$newAdminPassword = $options['password'] ?? null;

echo "Converting SQLite ({$sqlitePath}) to MariaDB SQL dump...\n";
$res = DataMigrator::exportSqliteToMariaDbSql($sqlitePath, $outputPath, $newAdminPassword);

echo "Export successful:\n";
echo "Output: {$res['outputPath']}\n";
echo "Table Counts:\n";
foreach ($res['tableCounts'] as $table => $count) {
    echo "  - {$table}: {$count}\n";
}
echo "Total Rows: " . array_sum($res['tableCounts']) . "\n";

if (!empty($res['reissuedCredentials'])) {
    // The SQLite store holds Node scrypt digests that PHP cannot verify. Those
    // accounts were given fresh credentials so the exported database is actually
    // usable. The passwords are written to a git-ignored file rather than printed,
    // so they do not end up in terminal scrollback or CI logs.
    $credsFile = dirname(__DIR__, 2) . '/admin-credentials.json';
    $written = @file_put_contents(
        $credsFile,
        json_encode([
            'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'note' => 'One-time CRM credentials re-issued during the SQLite to MariaDB export. Change them after first sign-in. This file is git-ignored; delete it once the passwords are stored safely.',
            'accounts' => $res['reissuedCredentials']
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
    );
    @chmod($credsFile, 0600);

    echo "\n";
    echo "======================================================================\n";
    echo " ACTION REQUIRED - CRM credentials were re-issued\n";
    echo "======================================================================\n";
    echo " These accounts used the old Node scrypt format, which PHP cannot\n";
    echo " verify. Exporting them unchanged would have produced a CRM nobody\n";
    echo " could sign in to, so each was given a new password:\n\n";
    foreach ($res['reissuedCredentials'] as $acct) {
        echo "   {$acct['email']}  ({$acct['role']})  [{$acct['source']}]\n";
    }
    echo "\n";
    if ($written !== false) {
        echo " Passwords written to: {$credsFile}\n";
        echo " (git-ignored, mode 0600 - not printed here on purpose)\n";
    } else {
        echo " WARNING: could not write {$credsFile}.\n";
        echo " Re-run with --password=<your-password> to set a known credential.\n";
    }
    echo " Change these after first sign-in, then delete that file.\n";
    echo "======================================================================\n";
}
