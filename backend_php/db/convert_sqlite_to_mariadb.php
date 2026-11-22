<?php
declare(strict_types=1);

namespace AumEstates\Db;

use PDO;
use AumEstates\Config;
use AumEstates\Auth\Auth;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/connection.php';
require_once __DIR__ . '/../auth/auth.php';

final class DataMigrator
{
    private const TABLES = [
        'users',
        'locations',
        'projects',
        'contacts',
        'properties',
        'property_private',
        'leads',
        'buyer_requirements',
        'client_shortlists',
        'shortlist_items',
        'crm_activities',
        'audit_logs',
        'schema_migrations',
        'inventory_undo'
    ];

    /**
     * Reads all data from the SQLite database and generates a clean, safe MariaDB SQL import file.
     */
    public static function exportSqliteToMariaDbSql(string $sqlitePath, string $outputPath, ?string $newAdminPassword = null): array
    {
        // Credentials re-issued during this export, returned so the operator can
        // record them. See the users-table handling below for why this is required.
        $reissued = [];

        if (!file_exists($sqlitePath)) {
            throw new \RuntimeException("SQLite database not found at: {$sqlitePath}");
        }

        $sqlite = new PDO("sqlite:{$sqlitePath}", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        $schemaFile = __DIR__ . '/schema.mariadb.sql';
        if (!file_exists($schemaFile)) {
            throw new \RuntimeException("MariaDB schema not found at: {$schemaFile}");
        }

        $sql = [];
        $sql[] = "-- ==============================================================================";
        $sql[] = "-- AUM Estates — MariaDB Export from SQLite Master Store";
        $sql[] = "-- Generated: " . gmdate('Y-m-d\TH:i:s\Z');
        $sql[] = "-- ==============================================================================\n";
        $sql[] = file_get_contents($schemaFile);
        $sql[] = "\nSET FOREIGN_KEY_CHECKS = 0;\n";

        $stats = [];

        foreach (self::TABLES as $table) {
            // Check if table exists in SQLite
            $chk = $sqlite->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
            $chk->execute([$table]);
            if (!$chk->fetch()) {
                $stats[$table] = 0;
                continue;
            }

            $rows = $sqlite->query("SELECT * FROM {$table}")->fetchAll();
            $stats[$table] = count($rows);
            if (empty($rows)) {
                continue;
            }

            $sql[] = "-- Table: {$table} (" . count($rows) . " rows)";
            $columns = array_keys($rows[0]);
            $colList = implode(', ', array_map(fn($c) => "`{$c}`", $columns));

            $batchSize = 50;
            for ($i = 0; $i < count($rows); $i += $batchSize) {
                $batch = array_slice($rows, $i, $batchSize);
                $valueStrings = [];

                foreach ($batch as $row) {
                    // Accounts in the SQLite master store hold Node scrypt digests
                    // (128 hex chars). PHP cannot verify those, so exporting them
                    // unchanged produces a database nobody can sign in to. Re-issue a
                    // PHP password_hash credential for every such account instead of
                    // shipping one that is guaranteed to fail.
                    if ($table === 'users' && Auth::isLegacyScryptHash($row['password_hash'] ?? null)) {
                        $issued = $newAdminPassword ?? self::generatePassword();
                        $row['password_hash'] = Auth::hashPassword($issued);
                        $row['password_salt'] = '';
                        $reissued[] = [
                            'email' => $row['email'] ?? '(unknown)',
                            'role' => $row['role'] ?? 'advisor',
                            'password' => $issued,
                            'source' => $newAdminPassword !== null ? 'operator-supplied' : 'generated'
                        ];
                    }

                    $vals = [];
                    foreach ($columns as $col) {
                        $v = $row[$col] ?? null;
                        if ($v === null) {
                            $vals[] = 'NULL';
                        } elseif (is_int($v) || is_float($v)) {
                            $vals[] = (string)$v;
                        } else {
                            // Safe escape for SQL dump
                            $escaped = str_replace(["\\", "'", "\0", "\n", "\r"], ["\\\\", "\\'", "\\0", "\\n", "\\r"], (string)$v);
                            $vals[] = "'{$escaped}'";
                        }
                    }
                    $valueStrings[] = '(' . implode(', ', $vals) . ')';
                }

                $sql[] = "INSERT INTO `{$table}` ({$colList}) VALUES\n  " . implode(",\n  ", $valueStrings) . ";";
            }
            $sql[] = "";
        }

        $sql[] = "SET FOREIGN_KEY_CHECKS = 1;\n";

        file_put_contents($outputPath, implode("\n", $sql));

        return [
            'outputPath' => $outputPath,
            'tableCounts' => $stats,
            'reissuedCredentials' => $reissued
        ];
    }

    /**
     * Generates a readable but high-entropy one-time password for a re-issued account.
     */
    private static function generatePassword(): string
    {
        return 'Aum-' . bin2hex(random_bytes(9)) . '-26';
    }

    /**
     * Reconciles counts between source SQLite and target MariaDB
     */
    public static function reconcile(PDO $sqlite, PDO $mariaDb): array
    {
        $report = [];
        foreach (self::TABLES as $table) {
            $sCount = 0;
            $chk = $sqlite->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
            $chk->execute([$table]);
            if ($chk->fetch()) {
                $sCount = (int)$sqlite->query("SELECT COUNT(*) AS c FROM {$table}")->fetch()['c'];
            }

            $mCount = 0;
            try {
                $mCount = (int)$mariaDb->query("SELECT COUNT(*) AS c FROM {$table}")->fetch()['c'];
            } catch (\Throwable $e) {
                $mCount = -1; // table missing
            }

            $report[$table] = [
                'sqlite' => $sCount,
                'mariadb' => $mCount,
                'match' => ($sCount === $mCount)
            ];
        }
        return $report;
    }
}
