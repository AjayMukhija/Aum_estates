<?php
declare(strict_types=1);

/**
 * AUM Estates — Comprehensive PHP Backend Test Suite
 * Tests: Normalizer, PrivacyGate, SearchEngine, Shortlist, Publisher, and HTTP Contracts.
 */

namespace AumEstates\Tests;

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

use PDO;
use AumEstates\Config;
use AumEstates\Db\Connection;
use AumEstates\Auth\Auth;
use AumEstates\Domain\Normalizer;
use AumEstates\Domain\PrivacyGate;
use AumEstates\Domain\SearchEngine;
use AumEstates\Domain\Shortlist;
use AumEstates\Domain\Publisher;
use AumEstates\Domain\IntakeParser;
use AumEstates\Routes\Router;
use AumEstates\Routes\PublicRoutes;
use AumEstates\Routes\CrmRoutes;

$passed = 0;
$failed = 0;

$runTest = function (string $name, callable $fn) use (&$passed, &$failed) {
    echo "• Running: {$name}... ";
    try {
        $fn();
        echo "PASS\n";
        $passed++;
    } catch (\Throwable $e) {
        echo "FAIL\n  Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
        $failed++;
    }
};

function assertEquals($expected, $actual, string $msg = '') {
    if ($expected !== $actual) {
        $expStr = var_export($expected, true);
        $actStr = var_export($actual, true);
        throw new \AssertionError("Assertion failed: expected {$expStr}, got {$actStr}. {$msg}");
    }
}

function assertTrue($condition, string $msg = '') {
    if (!$condition) {
        throw new \AssertionError("Expected true condition. {$msg}");
    }
}

echo "======================================================================\n";
echo "AUM Estates PHP Backend Test Suite\n";
echo "======================================================================\n\n";

// --------------------------------------------------------------------
// 1. Normalizer Tests
// --------------------------------------------------------------------
$runTest('Normalizer: Area, Price, Rent, and Title', function () {
    assertEquals(4500, Normalizer::normalizeAreaSqFt(500, 'Sq Yards'));
    assertEquals(5445, Normalizer::normalizeAreaSqFt(1, 'Kanal'));
    assertEquals(43560, Normalizer::normalizeAreaSqFt(1, 'Acre'));
    assertEquals(2723, Normalizer::normalizeAreaSqFt(10, 'Marla'));

    assertEquals(75000000, Normalizer::normalizePriceInr(['priceValue' => 7.5, 'priceUnit' => 'Cr']));
    assertEquals(175000000, Normalizer::normalizePriceInr([
        'priceValue' => 3.5,
        'priceUnit' => 'Lakh per sq yd',
        'areaValue' => 500,
        'areaUnit' => 'Sq Yd'
    ]));
    assertEquals(220000, Normalizer::normalizeRentInr([
        'rentValue' => 2.2,
        'rentUnit' => 'Lakh / month',
        'transactionType' => 'Rent'
    ]));

    assertEquals('DLF Camellias 4 BHK', Normalizer::cleanListingTitle('DLF Camellias 4 BHK #104 unit C-102', 'DLF Camellias'));
});

// --------------------------------------------------------------------
// 2. Privacy Gate Tests
// --------------------------------------------------------------------
$runTest('Privacy Gate: Whiteland passes, phone leaks & cheque terms quarantined', function () {
    $whitelandCheck = PrivacyGate::validateAndProjectPublicRecord([
        'property_id' => 'AUM-WEB-900001',
        'publication_state' => 'approved_public',
        'availability_state' => 'available',
        'project_name' => 'Whiteland The Aspen',
        'listing_title' => 'Whiteland The Aspen 4 BHK Residence',
        'locality' => 'Sector 76',
        'city' => 'Gurgaon',
        'property_type' => 'Apartment',
        'transaction_type' => 'Sale',
        'price_value' => 5.4,
        'price_unit' => 'Cr',
        'price_text' => '₹5.4 Cr'
    ]);
    assertTrue($whitelandCheck['ok'], 'Whiteland should pass cleanly without triggering white/black filter');

    // Phone leak
    $mixed = PrivacyGate::scanTextForLeaks('public_description', 'Advisory 9873813595 / Owner 98101 22334');
    assertTrue(count($mixed) > 0, 'Private phone leak must be detected');
    assertEquals('Private Phone Number', $mixed[0]['rule']);

    // Cheque leak
    $badRecord = PrivacyGate::validateAndProjectPublicRecord([
        'property_id' => '<bad-id>',
        'publication_state' => 'approved_public',
        'availability_state' => 'available',
        'listing_title' => 'Test Condo',
        'price_text' => '70% cheque / 30% cash part'
    ]);
    assertEquals(false, $badRecord['ok']);
});

// --------------------------------------------------------------------
// 3. Two-Pass WhatsApp Intake Parser
// --------------------------------------------------------------------
$runTest('Intake Parser: Two-pass WhatsApp specs & quarantine', function () {
    $rawMsg = implode("\n", [
        '🔥 DIRECT INVENTORY — DLF The Camellias, Golf Course Road, Sector 42',
        '4 BHK + Lounge, 7400 Sq Ft, Higher Floor, Tower 4 Flat 11A',
        'Asking 72 Cr (70% cheque, 1% brokerage side)',
        'Keys in hand for inspection. Call Rajesh Khanna +91 98102 33445'
    ]);

    $parsed = IntakeParser::parseWhatsAppBroadcast($rawMsg, ['sourceGroup' => 'GCR Luxury Brokers']);

    assertEquals('Golf Course Road', $parsed['publicDraft']['corridor']);
    assertEquals(7400, $parsed['publicDraft']['area_sqft_norm']);
    assertEquals(720000000, $parsed['publicDraft']['price_inr_norm']);
    assertEquals(0, count(PrivacyGate::scanTextForLeaks('public_description', $parsed['publicDraft']['public_description'] ?? '')));

    assertTrue(str_contains(preg_replace('/\D/', '', (string)$parsed['privateVault']['broker_phone_cache']), '9810233445'));
    assertTrue(str_contains((string)$parsed['privateVault']['commission_terms'], '1% brokerage'));
    assertTrue(str_contains((string)$parsed['privateVault']['payment_structure_notes'], '70% cheque'));
});

// --------------------------------------------------------------------
// 4. In-Memory SQLite Seed & Database Queries
// --------------------------------------------------------------------
$runTest('Database & Search Engine: Dual-surface query isolation', function () {
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON;');

    // Load schema from SQLite master store
    $sqliteMasterPath = Config::getPaths()['sqlite_file'];
    assertTrue(file_exists($sqliteMasterPath), 'Master SQLite file exists');

    // Attach master database and copy records into memory
    $pdo->exec("ATTACH DATABASE '{$sqliteMasterPath}' AS master_store");

    $tables = ['users', 'locations', 'projects', 'contacts', 'properties', 'property_private', 'leads', 'buyer_requirements', 'client_shortlists', 'shortlist_items', 'crm_activities', 'audit_logs', 'schema_migrations'];
    foreach ($tables as $t) {
        $pdo->exec("CREATE TABLE {$t} AS SELECT * FROM master_store.{$t}");
    }
    $pdo->exec("DETACH DATABASE master_store");

    $pubCount = (int)$pdo->query("SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND availability_state = 'available'")->fetch()['c'];
    assertTrue($pubCount > 300, "Expected >300 approved properties in master seed (found {$pubCount})");

    // Public search test
    $gcrRes = SearchEngine::searchPublicProperties($pdo, ['q' => 'GCR']);
    assertTrue($gcrRes['total'] >= 15, "Expected >= 15 GCR results, got {$gcrRes['total']}");

    // Confidential terms MUST NOT leak in public search
    foreach (['Singhania', 'AUM-OFF-000001', '9811001122', 'cheque'] as $secret) {
        $leakCheck = SearchEngine::searchPublicProperties($pdo, ['q' => $secret]);
        assertEquals(0, $leakCheck['total'], "Public search must return 0 for confidential term: {$secret}");
    }

    // CRM Search locates private records
    $crmRes = SearchEngine::searchCrmProperties($pdo, ['q' => 'Singhania']);
    assertTrue($crmRes['total'] >= 1, "CRM search must locate private owner Singhania");
    assertEquals('AUM-OFF-000001', $crmRes['items'][0]['property_id']);
});

// --------------------------------------------------------------------
// 5. Publisher Feed Compilation & Checksums
// --------------------------------------------------------------------
$runTest('Publisher: Compile feeds, checksums, and safety guards', function () {
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $sqliteMasterPath = Config::getPaths()['sqlite_file'];
    $pdo->exec("ATTACH DATABASE '{$sqliteMasterPath}' AS master_store");
    $tables = ['properties', 'projects', 'audit_logs'];
    foreach ($tables as $t) {
        $pdo->exec("CREATE TABLE {$t} AS SELECT * FROM master_store.{$t}");
    }
    $pdo->exec("DETACH DATABASE master_store");

    $result = Publisher::compileFeeds($pdo, ['writeFiles' => false, 'actorLabel' => 'test-runner']);

    assertTrue($result['counts']['publicProperties'] > 300, "Compiled properties count: {$result['counts']['publicProperties']}");
    assertTrue($result['counts']['publicProjects'] > 100, "Compiled projects count: {$result['counts']['publicProjects']}");
    assertEquals(16, $result['counts']['featuredCards'], 'Featured cards count should be 16');

    assertTrue(!empty($result['hashes']['public_inventory.json']));
    assertTrue(!empty($result['hashes']['public_inventory.js']));
    assertTrue(!empty($result['hashes']['projects_local.js']));
    assertTrue(!empty($result['hashes']['approved_properties.js']));
});

// --------------------------------------------------------------------
// 6. Router & Contract Tests
// --------------------------------------------------------------------
$runTest('Router & Dispatch: Public health and permissions', function () {
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $server = [
        'REQUEST_METHOD' => 'GET',
        'REQUEST_URI' => '/api/public/health'
    ];
    $router = new Router($pdo, $server);

    ob_start();
    $handled = PublicRoutes::dispatch($router, $pdo, 'GET', '/api/public/health');
    $output = ob_get_clean();

    assertTrue($handled, 'Health route should be handled');
    $json = json_decode($output, true);
    assertEquals(true, $json['ok']);
    assertEquals('healthy', $json['status']);
});

echo "\n======================================================================\n";
echo "Test Summary: {$passed} passed, {$failed} failed.\n";
echo "======================================================================\n";

if ($failed > 0) {
    exit(1);
}
