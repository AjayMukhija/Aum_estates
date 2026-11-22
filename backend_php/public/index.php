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
require_once __DIR__ . '/../domain/share_preview.php';
require_once __DIR__ . '/../routes/router.php';
require_once __DIR__ . '/../routes/public_routes.php';
require_once __DIR__ . '/../routes/crm_routes.php';

/**
 * Per-property share previews — handled BEFORE the database connection.
 *
 * properties/detail.html is static HTML populated by JavaScript, and no
 * link-preview crawler runs JavaScript, so a shared dossier rendered the
 * generic site card instead of the property. Every call to action on this site
 * ends in WhatsApp, so that card IS the referral.
 *
 * EVERY visitor gets the same response here, deliberately. An earlier version
 * branched on the user agent and served crawlers a metadata-only stub;
 * Hostinger's CDN caches by URL and varies only on Accept-Encoding, so it
 * served whichever copy it cached first to everybody, at random per edge node.
 * One identical response is the only cache-safe shape, and it also fixes the
 * browser tab title and the title Google indexes.
 *
 * This sits above Connection::getPdo() because the preview is built from the
 * published feed on disk and needs no database — it must not fail when the
 * database is unreachable. The published feed has already passed the privacy
 * gate, so this cannot disclose anything the site does not already serve.
 *
 * Any failure falls through to serving the page byte-for-byte as it sits on
 * disk, so the dossier can never be broken by this code.
 */
$previewPath = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/');
if (
    strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
    && $previewPath === rtrim(Domain\SharePreview::DETAIL_PATH, '/')
) {
    $previewStatic = realpath(($_SERVER['DOCUMENT_ROOT'] ?? '') . Domain\SharePreview::DETAIL_PATH);

    if ($previewStatic !== false && is_file($previewStatic)) {
        $previewBody = null;

        try {
            $previewKey = (string)($_GET['id'] ?? $_GET['slug'] ?? '');
            $previewFeed = Domain\SharePreview::locateFeed($_SERVER['DOCUMENT_ROOT'] ?? null);
            $previewRecord = ($previewKey !== '' && $previewFeed !== null)
                ? Domain\SharePreview::findRecord($previewFeed, $previewKey)
                : null;
            // An id that is no longer published keeps the generic metadata
            // rather than having one invented for a withdrawn listing.
            if ($previewRecord !== null) {
                $previewBody = Domain\SharePreview::renderDossier(
                    $previewStatic,
                    Domain\SharePreview::buildMeta($previewRecord)
                );
            }
        } catch (\Throwable $previewError) {
            $previewBody = null;
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: public, max-age=600');
        if ($previewBody !== null) {
            echo $previewBody;
        } else {
            readfile($previewStatic);
        }
        exit;
    }
}

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
