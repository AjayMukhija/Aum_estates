<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Static Feed Compiler & Publisher
 * Usage: php backend_php/bin/publish.php [--allow-shrink]
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../domain/normalizer.php';
require_once __DIR__ . '/../domain/privacy_gate.php';
require_once __DIR__ . '/../domain/publisher.php';

use AumEstates\Db\Connection;
use AumEstates\Domain\Publisher;

$options = getopt('', ['allow-shrink']);
$allowShrink = isset($options['allow-shrink']);

try {
    $pdo = Connection::getPdo();
    echo "Publishing static feeds from database...\n";
    $result = Publisher::compileAndPublishStaticFeeds($pdo, [
        'actorLabel' => 'cli-operator',
        'allowShrink' => $allowShrink
    ]);

    echo "Release ID: {$result['releaseId']}\n";
    echo "Published Properties: {$result['counts']['publicProperties']}\n";
    echo "Published Projects: {$result['counts']['publicProjects']}\n";
    echo "Featured Cards: {$result['counts']['featuredCards']}\n";
    echo "Feeds Hash Checksums:\n";
    foreach ($result['hashes'] as $file => $hash) {
        echo "  - {$file}: " . substr($hash, 0, 16) . "...\n";
    }
    echo "Publication complete.\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "Publication aborted: " . $e->getMessage() . "\n");
    exit(1);
}
