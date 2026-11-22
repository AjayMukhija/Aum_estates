<?php
declare(strict_types=1);

namespace AumEstates\Routes;

use PDO;
use AumEstates\Config;
use AumEstates\Auth\Auth;

class Router
{
    public static int $lastStatusCode = 200;
    public static bool $exitOnResponse = true;
    private PDO $pdo;
    private array $server;
    private array $get;
    private array $cookies;
    private ?string $rawBody;

    public function __construct(PDO $pdo, ?array $server = null, ?array $get = null, ?array $cookies = null, ?string $rawBody = null)
    {
        $this->pdo = $pdo;
        $this->server = $server ?? $_SERVER;
        $this->get = $get ?? $_GET;
        $this->cookies = $cookies ?? $_COOKIE;
        $this->rawBody = $rawBody;
    }

    public static function sendJson(int $statusCode, array $data, array $headers = []): void
    {
        self::$lastStatusCode = $statusCode;
        @http_response_code($statusCode);

        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');

            foreach ($headers as $k => $v) {
                header("{$k}: {$v}");
            }
        }

        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    public function getJsonBody(): array
    {
        $raw = $this->rawBody ?? file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        if (strlen($raw) > Config::MAX_BODY_BYTES) {
            self::sendJson(413, ['ok' => false, 'error' => 'Payload too large']);
            self::halt(413);
        }

        $decoded = json_decode($raw, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            self::sendJson(400, ['ok' => false, 'error' => 'Invalid JSON payload: ' . json_last_error_msg()]);
            self::halt(400);
        }

        if (!is_array($decoded)) {
            self::sendJson(400, ['ok' => false, 'error' => 'JSON object or array required']);
            self::halt(400);
        }

        return $decoded;
    }

    private static function halt(int $statusCode): void
    {
        if (self::$exitOnResponse) {
            exit;
        }
        throw new \RuntimeException("HTTP {$statusCode}");
    }

    public function getSession(): ?array
    {
        return Auth::getAuthenticatedSession($this->pdo, $this->server, $this->cookies);
    }

    public function requireAuth(): array
    {
        $session = $this->getSession();
        if (!$session) {
            self::sendJson(401, ['ok' => false, 'error' => 'Authentication required']);
            self::halt(401);
        }
        return $session;
    }

    public function requireCsrf(?array $session = null): void
    {
        $session = $session ?? $this->getSession();
        $method = $this->server['REQUEST_METHOD'] ?? 'GET';
        if (!Auth::verifyCsrf($method, $this->server, $session)) {
            self::sendJson(403, ['ok' => false, 'error' => 'CSRF verification failed or missing token']);
            self::halt(403);
        }
    }

    public function requireRole(array $allowedRoles, ?array $session = null): array
    {
        $sess = $session ?? $this->requireAuth();
        $role = $sess['role'] ?? 'advisor';
        if (!in_array($role, $allowedRoles, true)) {
            self::sendJson(403, [
                'ok' => false,
                'error' => "Action forbidden for role '{$role}'. Permitted roles: " . implode(', ', $allowedRoles)
            ]);
            self::halt(403);
        }
        return $sess;
    }

    public function getMethod(): string
    {
        return strtoupper($this->server['REQUEST_METHOD'] ?? 'GET');
    }

    public function getPath(): string
    {
        $uri = $this->server['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        return rtrim($path, '/') ?: '/';
    }
}
