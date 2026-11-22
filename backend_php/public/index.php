<?php
declare(strict_types=1);

/**
 * AUM Estates — PHP Front Controller
 */

namespace AumEstates;

use AumEstates\Db\Connection;
use AumEstates\Routes\Router;
use AumEstates\Routes\PublicRoutes;
use AumEstates\Routes\CrmRoutes;

// Security headers on all dynamic responses
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'");

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

try {
    $pdo = Connection::getPdo();
    $router = new Router($pdo);
    $method = $router->getMethod();
    $path = $router->getPath();

    // 1. Dispatch Public API
    if (str_starts_with($path, '/api/public/')) {
        if (PublicRoutes::dispatch($router, $pdo, $method, $path)) {
            exit;
        }
    }

    // 2. Dispatch CRM API
    if (str_starts_with($path, '/api/crm/')) {
        if (CrmRoutes::dispatch($router, $pdo, $method, $path)) {
            exit;
        }
    }

    // 3. Fallback for /api/* unknown endpoints
    if (str_starts_with($path, '/api/')) {
        Router::sendJson(404, ['ok' => false, 'error' => "API endpoint not found: {$method} {$path}"]);
        exit;
    }

    // 4. Tokenized Shortlist Viewer (/shortlist/{token})
    if (preg_match('#^/shortlist/([A-Za-z0-9_-]{12,64})/?$#', $path)) {
        $paths = Config::getPaths();
        $shortlistHtml = $paths['crm_ui_dir'] . '/shortlist.html';
        if (file_exists($shortlistHtml)) {
            header('Content-Type: text/html; charset=utf-8');
            readfile($shortlistHtml);
            exit;
        }
    }

    // 5. CRM Single-Page App (/crm and /crm/*)
    if ($path === '/crm' || str_starts_with($path, '/crm/')) {
        $paths = Config::getPaths();
        $sub = preg_replace('#^/crm/?#', '', $path);
        $sub = rawurldecode($sub);
        $file = $paths['crm_ui_dir'] . '/' . ($sub ?: 'index.html');

        // Resolve and confirm the target really sits inside the CRM asset directory
        // before reading it, so no traversal sequence can reach application source.
        $resolved = realpath($file);
        $crmRoot = realpath($paths['crm_ui_dir']);
        if ($resolved === false || $crmRoot === false || !str_starts_with($resolved, $crmRoot . DIRECTORY_SEPARATOR)) {
            $resolved = false;
        }
        $file = $resolved !== false ? $resolved : '';

        if ($file !== '' && file_exists($file) && !is_dir($file)) {
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            $mimes = [
                'html' => 'text/html; charset=utf-8',
                'css' => 'text/css; charset=utf-8',
                'js' => 'application/javascript; charset=utf-8',
                'json' => 'application/json; charset=utf-8',
                'svg' => 'image/svg+xml'
            ];
            header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
            readfile($file);
            exit;
        }

        // SPA fallback to crm-ui/index.html
        $crmIndex = $paths['crm_ui_dir'] . '/index.html';
        if (file_exists($crmIndex)) {
            header('Content-Type: text/html; charset=utf-8');
            readfile($crmIndex);
            exit;
        }
    }

    // 6. Static site fallback.
    // public_html contains both index.html (the website) and index.php (this front
    // controller). If the web server's DirectoryIndex prefers index.php, '/' arrives
    // here and must still return the homepage rather than a bare 404.
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $staticRoot = ($docRoot && is_dir($docRoot)) ? realpath($docRoot) : realpath(__DIR__);
    if ($staticRoot !== false) {
        $relative = ltrim(rawurldecode($path), '/');
        $candidates = [];
        if ($relative === '') {
            $candidates[] = $staticRoot . '/index.html';
        } else {
            $candidates[] = $staticRoot . '/' . $relative;
            $candidates[] = $staticRoot . '/' . $relative . '/index.html';
            $candidates[] = $staticRoot . '/' . $relative . '.html';
        }

        foreach ($candidates as $candidate) {
            $resolved = realpath($candidate);
            if ($resolved === false || !is_file($resolved)) {
                continue;
            }
            if (!str_starts_with($resolved, $staticRoot . DIRECTORY_SEPARATOR) && $resolved !== $staticRoot) {
                continue;
            }
            // Only ever hand back ordinary site content from this fallback.
            $ext = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
            $allowed = [
                'html' => 'text/html; charset=utf-8',
                'css' => 'text/css; charset=utf-8',
                'js' => 'application/javascript; charset=utf-8',
                'json' => 'application/json; charset=utf-8',
                'svg' => 'image/svg+xml',
                'xml' => 'application/xml; charset=utf-8',
                'txt' => 'text/plain; charset=utf-8',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'webp' => 'image/webp',
                'avif' => 'image/avif',
                'ico' => 'image/x-icon',
                'woff2' => 'font/woff2'
            ];
            if (!isset($allowed[$ext])) {
                continue;
            }
            header('Content-Type: ' . $allowed[$ext]);
            readfile($resolved);
            exit;
        }
    }

    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo "404 Not Found";
} catch (\Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'Internal Server Error',
        'message' => (getenv('AUM_ENV') === 'development') ? $e->getMessage() : 'An unexpected error occurred'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
