<?php
declare(strict_types=1);

/**
 * AUM Estates — Local development router for PHP's built-in server.
 *
 * Emulates the Hostinger/Apache .htaccess behaviour so the PHP backend can be
 * exercised locally exactly as it will run in production:
 *   - real files are served straight from the docroot
 *   - /api/*            -> front controller
 *   - /shortlist/{token} -> the tokenised client shortlist viewer
 *   - /crm, /crm/*      -> the advisory CRM single-page app
 *   - /properties/detail.html -> front controller, for EVERY visitor, so the
 *                                per-property share metadata is substituted
 *                                into its head (one identical response; see
 *                                SharePreview::renderDossier for why)
 *
 * Usage: php -S 127.0.0.1:8123 -t dist_hostinger_php/public_html scripts/php_dev_router.php
 */

$docRoot = $_SERVER['DOCUMENT_ROOT'] ?: __DIR__;
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . ltrim(rawurldecode($path), '/');

// Never let a traversal sequence escape the document root.
$candidate = realpath($docRoot . $path);
$rootReal = realpath($docRoot);

// 0. Per-property share previews. Mirrors the .htaccess rewrite emitted by
// scripts/package_php_release.js. This must come BEFORE the static-file
// branch, because detail.html exists on disk and would otherwise be served
// directly, leaving the preview path untested locally.
// Load the SAME copy the front controller will, in the same order it resolves
// it: a release bundle carries its own backend_php, and loading the source
// tree's copy as well is a fatal "cannot redeclare class".
foreach ([
    $docRoot . '/../backend_php/domain/share_preview.php',
    $docRoot . '/backend_php/domain/share_preview.php',
    __DIR__ . '/../backend_php/domain/share_preview.php'
] as $sharePreviewFile) {
    if (is_file($sharePreviewFile)) {
        require_once $sharePreviewFile;
        break;
    }
}
if (
    class_exists(\AumEstates\Domain\SharePreview::class, false)
    && rtrim($path, '/') === rtrim(\AumEstates\Domain\SharePreview::DETAIL_PATH, '/')
) {
    require $docRoot . '/index.php';
    return true;
}

// 1. Serve an existing static file directly.
if ($candidate !== false && $rootReal !== false && str_starts_with($candidate, $rootReal) && is_file($candidate)) {
    return false; // let the built-in server handle it (correct MIME types)
}

// 2. Directory index.
if ($candidate !== false && $rootReal !== false && str_starts_with($candidate, $rootReal) && is_dir($candidate)) {
    foreach (['index.html', 'index.php'] as $indexFile) {
        if (is_file($candidate . '/' . $indexFile)) {
            if (str_ends_with($indexFile, '.php')) {
                require $candidate . '/' . $indexFile;
                return true;
            }
            return false;
        }
    }
}

// 3. Everything dynamic goes through the front controller.
require $docRoot . '/index.php';
