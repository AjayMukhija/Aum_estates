<?php
declare(strict_types=1);

namespace AumEstates\Db;

use PDO;
use PDOException;
use AumEstates\Config;

final class Connection
{
    private static ?PDO $instance = null;

    public static function getPdo(?array $config = null): PDO
    {
        if (self::$instance !== null && $config === null) {
            return self::$instance;
        }

        $cfg = $config ?? Config::getDatabaseConfig();
        $driver = $cfg['driver'] ?? 'mysql';

        if ($driver === 'sqlite') {
            $path = $cfg['sqlite_path'] ?? Config::getPaths()['sqlite_file'];
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0700, true);
            }
            $dsn = "sqlite:{$path}";
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON;');
            $pdo->exec('PRAGMA busy_timeout = 5000;');
        } else {
            $host = $cfg['host'] ?? '127.0.0.1';
            $port = $cfg['port'] ?? 3306;
            $dbName = $cfg['database'] ?? 'aum_crm';
            $charset = $cfg['charset'] ?? 'utf8mb4';
            $user = $cfg['username'] ?? 'root';
            $pass = $cfg['password'] ?? '';

            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset} COLLATE utf8mb4_unicode_ci"
            ];

            try {
                $pdo = new PDO($dsn, $user, $pass, $options);
            } catch (PDOException $e) {
                // If database doesn't exist, try connecting to server root to create it (for development/setup)
                if (str_contains($e->getMessage(), 'Unknown database')) {
                    $rootDsn = "mysql:host={$host};port={$port};charset={$charset}";
                    $rootPdo = new PDO($rootDsn, $user, $pass, $options);
                    $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET {$charset} COLLATE utf8mb4_unicode_ci;");
                    $pdo = new PDO($dsn, $user, $pass, $options);
                } else {
                    throw $e;
                }
            }
        }

        if ($config === null) {
            self::$instance = $pdo;
        }

        return $pdo;
    }

    public static function setInstance(?PDO $pdo): void
    {
        self::$instance = $pdo;
    }

    /**
     * Executes a callback within a database transaction.
     * Supports optional post-commit and post-rollback lifecycle hooks.
     */
    public static function withTransaction(PDO $pdo, callable $callback)
    {
        $isNested = $pdo->inTransaction();
        if (!$isNested) {
            $pdo->beginTransaction();
        }

        try {
            $result = $callback($pdo);
            if (!$isNested) {
                $pdo->commit();
            }
            return $result;
        } catch (\Throwable $e) {
            if (!$isNested && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Records an immutable audit log entry.
     */
    public static function recordAuditLog(PDO $pdo, array $data): int
    {
        $stmt = $pdo->prepare('
            INSERT INTO audit_logs (
                actor_user_id, actor_label, entity_type, entity_id, action, summary, before_json, after_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $actorUserId = isset($data['actorUserId']) ? (int)$data['actorUserId'] : (isset($data['actor_user_id']) ? (int)$data['actor_user_id'] : null);
        $actorLabel = $data['actorLabel'] ?? $data['actor_label'] ?? 'system';
        $entityType = $data['entityType'] ?? $data['entity_type'] ?? 'unknown';
        $entityId = (string)($data['entityId'] ?? $data['entity_id'] ?? '');
        $action = $data['action'] ?? '';
        $summary = $data['summary'] ?? null;
        $beforeJson = isset($data['before']) ? (is_string($data['before']) ? $data['before'] : json_encode($data['before'], JSON_UNESCAPED_SLASHES)) : null;
        $afterJson = isset($data['after']) ? (is_string($data['after']) ? $data['after'] : json_encode($data['after'], JSON_UNESCAPED_SLASHES)) : null;
        $createdAt = gmdate('Y-m-d\TH:i:s.v\Z');

        $stmt->execute([
            $actorUserId,
            $actorLabel,
            $entityType,
            $entityId,
            $action,
            $summary,
            $beforeJson,
            $afterJson,
            $createdAt
        ]);

        return (int)$pdo->lastInsertId();
    }

    /**
     * Generates a safe prefixed sequence identifier, e.g. SL-2026-0001 or LEAD-2026-0001
     */
    public static function allocatePrefixedId(PDO $pdo, string $table, string $idColumn, string $prefix): string
    {
        $likePattern = "{$prefix}-%";
        $stmt = $pdo->prepare("SELECT {$idColumn} FROM {$table} WHERE {$idColumn} LIKE ? ORDER BY {$idColumn} DESC LIMIT 1");
        $stmt->execute([$likePattern]);
        $row = $stmt->fetch();

        $nextSeq = 1;
        if ($row && isset($row[$idColumn])) {
            $parts = explode('-', (string)$row[$idColumn]);
            $lastNum = (int)end($parts);
            if ($lastNum > 0) {
                $nextSeq = $lastNum + 1;
            }
        }

        return sprintf('%s-%04d', $prefix, $nextSeq);
    }
}
