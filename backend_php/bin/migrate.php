<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Database Migration Runner
 * Usage: php backend_php/bin/migrate.php
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../db/migrations.php';
require_once __DIR__ . '/../domain/normalizer.php';

use AumEstates\Db\Connection;
use AumEstates\Db\Migrations;

try {
    $pdo = Connection::getPdo();
    echo "Running schema migrations...\n";
    $changed = Migrations::migrate($pdo);
    if ($changed) {
        echo "Migrations applied successfully.\n";
    } else {
        echo "Database schema is already up to date.\n";
    }
} catch (\Throwable $e) {
    fwrite(STDERR, "Migration failed: " . $e->getMessage() . "\n");
    exit(1);
}
