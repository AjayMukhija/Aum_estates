<?php
declare(strict_types=1);

namespace AumEstates\Auth;

use PDO;
use AumEstates\Config;

final class Auth
{
    /**
     * Hashes a password using PHP's standard password_hash (bcrypt / argon2id)
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    /**
     * True when the stored credential is a legacy Node scrypt hash (128 hex chars
     * produced by crypto.scryptSync) rather than a PHP password_hash digest.
     *
     * PHP has no scrypt primitive matching Node's N/r/p parameters, so such a
     * credential can never be verified here. It must be re-provisioned instead of
     * being reported as a wrong password, which would look like an account lockout.
     */
    public static function isLegacyScryptHash(?string $hash): bool
    {
        if ($hash === null || $hash === '') {
            return false;
        }
        return strlen($hash) === 128 && ctype_xdigit($hash);
    }

    /**
     * Verifies a password against a PHP password_hash digest.
     * Legacy Node scrypt credentials are not verifiable and always fail here;
     * callers must use isLegacyScryptHash() to report that case accurately.
     */
    public static function verifyPassword(string $password, string $expectedHash, ?string $salt = null): bool
    {
        if ($password === '' || $expectedHash === '') {
            return false;
        }

        if (str_starts_with($expectedHash, '$')) {
            return password_verify($password, $expectedHash);
        }

        return false;
    }

    /**
     * Parse raw cookie string or retrieve from $_COOKIE
     */
    public static function parseCookies(?string $cookieHeader): array
    {
        $out = [];
        if (!$cookieHeader) {
            return $out;
        }
        $parts = explode(';', $cookieHeader);
        foreach ($parts as $part) {
            $part = trim($part);
            $idx = strpos($part, '=');
            if ($idx === false || $idx === 0) {
                continue;
            }
            $key = trim(substr($part, 0, $idx));
            $val = trim(substr($part, $idx + 1));
            $out[$key] = urldecode($val);
        }
        return $out;
    }

    /**
     * Creates a new session in MariaDB/MySQL or SQLite
     */
    public static function createSession(PDO $pdo, int $userId, ?string $ipAddress = null): array
    {
        // Opportunistically purge expired sessions
        $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
        $delStmt = $pdo->prepare('DELETE FROM sessions WHERE expires_at < ?');
        $delStmt->execute([$nowIso]);

        $sessionId = bin2hex(random_bytes(32));
        $csrfToken = bin2hex(random_bytes(24));
        $expiresAt = gmdate('Y-m-d\TH:i:s.v\Z', time() + (Config::SESSION_TTL_HOURS * 3600));

        $stmt = $pdo->prepare('
            INSERT INTO sessions (session_id, user_id, csrf_token, expires_at, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$sessionId, $userId, $csrfToken, $expiresAt, $ipAddress, $nowIso]);

        return [
            'sessionId' => $sessionId,
            'csrfToken' => $csrfToken,
            'expiresAt' => $expiresAt
        ];
    }

    /**
     * Retrieves the current authenticated session from cookies or x-aum-session header
     */
    public static function getAuthenticatedSession(PDO $pdo, array $server = [], array $cookies = []): ?array
    {
        $cookieSid = $cookies[Config::SESSION_COOKIE_NAME] ?? null;
        if (!$cookieSid && !empty($server['HTTP_COOKIE'])) {
            $parsed = self::parseCookies($server['HTTP_COOKIE']);
            $cookieSid = $parsed[Config::SESSION_COOKIE_NAME] ?? null;
        }

        $headerSid = $server['HTTP_X_AUM_SESSION'] ?? null;
        $sid = $cookieSid ?: $headerSid;
        if (!$sid) {
            return null;
        }

        $stmt = $pdo->prepare('
            SELECT
                s.session_id,
                s.csrf_token,
                s.expires_at,
                u.user_id,
                u.email,
                u.full_name,
                u.role,
                u.is_active
            FROM sessions s
            JOIN users u ON u.user_id = s.user_id
            WHERE s.session_id = ?
        ');
        $stmt->execute([$sid]);
        $row = $stmt->fetch();

        if (!$row || empty($row['is_active'])) {
            return null;
        }

        $nowTs = time();
        $expTs = strtotime($row['expires_at']) ?: 0;
        if ($expTs < $nowTs) {
            $del = $pdo->prepare('DELETE FROM sessions WHERE session_id = ?');
            $del->execute([$sid]);
            return null;
        }

        $row['user_id'] = (int)$row['user_id'];
        $row['is_active'] = (int)$row['is_active'];
        $row['authenticationMethod'] = $cookieSid ? 'cookie' : 'header';

        return $row;
    }

    /**
     * Destroys an existing session
     */
    public static function destroySession(PDO $pdo, array $server = [], array $cookies = []): void
    {
        $cookieSid = $cookies[Config::SESSION_COOKIE_NAME] ?? null;
        if (!$cookieSid && !empty($server['HTTP_COOKIE'])) {
            $parsed = self::parseCookies($server['HTTP_COOKIE']);
            $cookieSid = $parsed[Config::SESSION_COOKIE_NAME] ?? null;
        }
        $sid = $cookieSid ?: ($server['HTTP_X_AUM_SESSION'] ?? null);
        if ($sid) {
            $stmt = $pdo->prepare('DELETE FROM sessions WHERE session_id = ?');
            $stmt->execute([$sid]);
        }
    }

    /**
     * Formats a standard Set-Cookie header string
     */
    public static function buildSessionCookie(string $sessionId, int $maxAgeSeconds): string
    {
        $parts = [
            Config::SESSION_COOKIE_NAME . '=' . rawurlencode($sessionId),
            'Path=/',
            'HttpOnly',
            'SameSite=Strict',
            'Max-Age=' . $maxAgeSeconds
        ];

        if (Config::isSecureCookie()) {
            $parts[] = 'Secure';
        }

        return implode('; ', $parts);
    }

    /**
     * Verifies CSRF token on mutating requests
     */
    public static function verifyCsrf(string $method, array $server, ?array $session): bool
    {
        if (!$session) {
            return false;
        }
        $m = strtoupper($method);
        if (in_array($m, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return true;
        }

        // Header-authenticated CLI/cron/script requests bypass CSRF
        if (($session['authenticationMethod'] ?? '') === 'header' &&
            isset($server['HTTP_X_AUM_SESSION']) &&
            $server['HTTP_X_AUM_SESSION'] === $session['session_id']) {
            return true;
        }

        // Cookie-authenticated requests must provide valid X-CSRF-Token
        $provided = $server['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!$provided || !is_string($provided)) {
            return false;
        }

        return hash_equals($session['csrf_token'], $provided);
    }

    /**
     * Throttling for credential endpoints.
     *
     * PHP-FPM serves each request in a separate process, so an in-memory bucket
     * (as the former Node server used) cannot work. Attempts are therefore counted
     * in the database, which every worker shares.
     */
    public const LOGIN_MAX_ATTEMPTS = 10;
    public const LOGIN_WINDOW_SECONDS = 900;   // 15 minutes
    public const INQUIRY_MAX_ATTEMPTS = 12;
    public const INQUIRY_WINDOW_SECONDS = 600; // 10 minutes

    public static function clientIp(array $server = []): string
    {
        $ip = $server['REMOTE_ADDR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
        return substr((string)$ip, 0, 45);
    }

    /**
     * Records one attempt and reports whether the caller is now over the limit.
     * Returns ['allowed' => bool, 'retryAfter' => int seconds].
     */
    public static function registerAttempt(PDO $pdo, string $scope, string $identifier, int $maxAttempts, int $windowSeconds): array
    {
        $now = time();
        $windowStart = gmdate('Y-m-d\TH:i:s.v\Z', $now - $windowSeconds);
        $key = substr($identifier, 0, 190);

        try {
            // Opportunistic pruning keeps the table small without a scheduled job.
            $pdo->prepare('DELETE FROM auth_throttle WHERE attempted_at < ?')
                ->execute([gmdate('Y-m-d\TH:i:s.v\Z', $now - 86400)]);

            $stmt = $pdo->prepare('SELECT COUNT(*) FROM auth_throttle WHERE scope = ? AND identifier = ? AND attempted_at >= ?');
            $stmt->execute([$scope, $key, $windowStart]);
            $count = (int)$stmt->fetchColumn();

            if ($count >= $maxAttempts) {
                $oldest = $pdo->prepare('SELECT attempted_at FROM auth_throttle WHERE scope = ? AND identifier = ? AND attempted_at >= ? ORDER BY attempted_at ASC LIMIT 1');
                $oldest->execute([$scope, $key, $windowStart]);
                $oldestAt = (string)$oldest->fetchColumn();
                $retryAfter = $oldestAt ? max(1, ($windowSeconds - ($now - (strtotime($oldestAt) ?: $now)))) : $windowSeconds;
                return ['allowed' => false, 'retryAfter' => (int)$retryAfter];
            }

            $pdo->prepare('INSERT INTO auth_throttle (scope, identifier, attempted_at) VALUES (?, ?, ?)')
                ->execute([$scope, $key, gmdate('Y-m-d\TH:i:s.v\Z', $now)]);
        } catch (\Throwable $e) {
            // A throttling table that is missing or unwritable must never deny service.
            return ['allowed' => true, 'retryAfter' => 0];
        }

        return ['allowed' => true, 'retryAfter' => 0];
    }

    /**
     * Clears recorded attempts once a credential check succeeds.
     */
    public static function clearAttempts(PDO $pdo, string $scope, string $identifier): void
    {
        try {
            $pdo->prepare('DELETE FROM auth_throttle WHERE scope = ? AND identifier = ?')
                ->execute([$scope, substr($identifier, 0, 190)]);
        } catch (\Throwable $e) {
            // Non-fatal.
        }
    }
}
