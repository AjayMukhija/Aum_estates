<?php
declare(strict_types=1);

/**
 * AUM Estates — Full HTTP Contract & End-to-End Workflow Test Suite (PHP)
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
        $caller = debug_backtrace()[0];
        throw new \AssertionError("Assertion failed: expected {$expStr}, got {$actStr}. {$msg} (called at line {$caller['line']})");
    }
}

function assertTrue($condition, string $msg = '') {
    if (!$condition) {
        throw new \AssertionError("Expected true condition. {$msg}");
    }
}

/**
 * In-process HTTP dispatcher for testing Router, PublicRoutes, and CrmRoutes
 */
function dispatchRequest(PDO $pdo, string $method, string $path, array $options = []): array {
    Router::$exitOnResponse = false;
    Router::$lastStatusCode = 200;

    $server = [
        'REQUEST_METHOD' => strtoupper($method),
        'REQUEST_URI' => $path
    ];
    if (!empty($options['headers'])) {
        foreach ($options['headers'] as $k => $v) {
            $hKey = 'HTTP_' . strtoupper(str_replace('-', '_', $k));
            $server[$hKey] = $v;
        }
    }
    $cookies = $options['cookies'] ?? [];
    if (!empty($options['session_id'])) {
        $cookies[Config::SESSION_COOKIE_NAME] = $options['session_id'];
    }

    $rawBody = '';
    if (isset($options['body'])) {
        $rawBody = is_string($options['body']) ? $options['body'] : json_encode($options['body']);
    }

    // Capture output
    ob_start();
    $router = new Router($pdo, $server, $options['query'] ?? [], $cookies, $rawBody);

    $handled = false;
    $errObj = null;
    try {
        if (str_starts_with($path, '/api/public/')) {
            $handled = PublicRoutes::dispatch($router, $pdo, $method, $path);
        } elseif (str_starts_with($path, '/api/crm/')) {
            $handled = CrmRoutes::dispatch($router, $pdo, $method, $path);
        }
    } catch (\Throwable $e) {
        $errObj = ['error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()];
    }

    $output = ob_get_clean();
    if ($output === '' && $errObj !== null) {
        $output = json_encode($errObj);
    }
    $status = Router::$lastStatusCode;
    $json = json_decode($output, true);

    return [
        'handled' => $handled,
        'status' => $status,
        'output' => $output,
        'json' => $json
    ];
}

/**
 * Creates seeded in-memory database with master store tables
 */
function createTestDb(): PDO {
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON;');

    $sqliteMasterPath = Config::getPaths()['sqlite_file'];
    $pdo->exec("ATTACH DATABASE '{$sqliteMasterPath}' AS master_store");

    $tables = [
        'users', 'sessions', 'locations', 'projects', 'contacts',
        'properties', 'property_private', 'leads', 'buyer_requirements',
        'client_shortlists', 'shortlist_items', 'crm_activities',
        'audit_logs', 'schema_migrations', 'inventory_undo'
    ];
    foreach ($tables as $t) {
        $pdo->exec("CREATE TABLE {$t} AS SELECT * FROM master_store.{$t}");
    }
    $pdo->exec("DETACH DATABASE master_store");

    // Update principal with test credential and add advisor & analyst accounts
    $adminHash = Auth::hashPassword('Test-only-credential-2026!');
    $pdo->prepare('UPDATE users SET password_hash = ?, password_salt = NULL WHERE email = ?')
        ->execute([$adminHash, 'ajay@aumestates.com']);

    $hash = Auth::hashPassword('AdvisorPass@2026!');
    $now = gmdate('Y-m-d\TH:i:s.v\Z');
    $pdo->prepare('INSERT INTO users (user_id, email, full_name, role, password_hash, is_active, created_at) VALUES (2, ?, ?, ?, ?, 1, ?)')
        ->execute(['advisor@aumestates.com', 'Test Advisor', 'advisor', $hash, $now]);
    $pdo->prepare('INSERT INTO users (user_id, email, full_name, role, password_hash, is_active, created_at) VALUES (3, ?, ?, ?, ?, 1, ?)')
        ->execute(['analyst@aumestates.com', 'Test Analyst', 'analyst', $hash, $now]);

    return $pdo;
}

echo "======================================================================\n";
echo "AUM Estates PHP HTTP Contract Test Suite\n";
echo "======================================================================\n\n";

// --------------------------------------------------------------------
// 1. Public Reads Contract
// --------------------------------------------------------------------
$runTest('Public API: /api/public/health and /api/public/properties reads', function () {
    $pdo = createTestDb();

    $res = dispatchRequest($pdo, 'GET', '/api/public/health');
    assertEquals(200, $res['status']);
    assertEquals(true, $res['json']['ok']);
    assertEquals('healthy', $res['json']['status']);

    $props = dispatchRequest($pdo, 'GET', '/api/public/properties');
    assertEquals(200, $props['status']);
    assertEquals(true, $props['json']['ok']);
    assertTrue($props['json']['total'] > 300, "Total properties: {$props['json']['total']}");
    assertTrue(count($props['json']['items']) > 0);

    // Detail of existing property
    $sampleId = $props['json']['items'][0]['property_id'];
    $detail = dispatchRequest($pdo, 'GET', "/api/public/properties/{$sampleId}");
    assertEquals(200, $detail['status']);
    assertEquals($sampleId, $detail['json']['property']['property_id']);

    // 404 for non-existent property
    $missing = dispatchRequest($pdo, 'GET', '/api/public/properties/DOES-NOT-EXIST-999');
    assertEquals(404, $missing['status']);
});

// --------------------------------------------------------------------
// 2. Public Intake Contract & Idempotency
// --------------------------------------------------------------------
$runTest('Public API: /api/public/inquiries idempotency and lead persistence', function () {
    $pdo = createTestDb();

    $payload = [
        'name' => 'Vikram Oberoi',
        'phone' => '+91 98111 22334',
        'email' => 'voberoi@example.com',
        'intent' => 'Buy',
        'budget' => '₹12 Cr',
        'message' => 'Interested in Camellias 4BHK higher floor',
        'source_page' => '/properties/detail.html?id=AUM-WEB-000137',
        'idempotency_key' => 'IDEM-TEST-VO-001'
    ];

    $res1 = dispatchRequest($pdo, 'POST', '/api/public/inquiries', ['body' => $payload]);
    assertEquals(201, $res1['status']);
    assertTrue(!empty($res1['json']['lead_id']));
    $leadId = $res1['json']['lead_id'];

    // Repeated request with same idempotency key must succeed with same lead_id
    $res2 = dispatchRequest($pdo, 'POST', '/api/public/inquiries', ['body' => $payload]);
    assertEquals(200, $res2['status']);
    assertEquals($leadId, $res2['json']['lead_id']);
    assertEquals(true, $res2['json']['idempotent_replay']);

    // Check only 1 lead in database
    $leadCount = (int)$pdo->query("SELECT COUNT(*) AS c FROM leads WHERE idempotency_key = 'IDEM-TEST-VO-001'")->fetch()['c'];
    assertEquals(1, $leadCount, 'Database must have exactly one lead for this idempotency key');
});

// --------------------------------------------------------------------
// 3. Staff Session & Roles
// --------------------------------------------------------------------
$runTest('Staff Auth: Login, session, role checks, and CSRF', function () {
    $pdo = createTestDb();

    // 1. Unauthenticated CRM access is 401
    $unauth = dispatchRequest($pdo, 'GET', '/api/crm/dashboard');
    assertEquals(401, $unauth['status']);

    // 2. Login as Principal
    $login = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'ajay@aumestates.com', 'password' => 'Test-only-credential-2026!']
    ]);
    assertEquals(200, $login['status']);
    assertTrue(!empty($login['json']['csrf_token']));
    assertTrue(!empty($login['json']['session_id']));
    $principalSid = $login['json']['session_id'];
    $csrf = $login['json']['csrf_token'];

    // 3. Authenticated dashboard access
    $dash = dispatchRequest($pdo, 'GET', '/api/crm/dashboard', [
        'session_id' => $principalSid
    ]);
    assertEquals(200, $dash['status']);
    assertEquals(true, $dash['json']['ok']);
    assertTrue(isset($dash['json']['publication_counts']));

    // 4. Login as Analyst (read-only role)
    $analystLogin = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'analyst@aumestates.com', 'password' => 'AdvisorPass@2026!']
    ]);
    assertEquals(200, $analystLogin['status']);
    $analystSid = $analystLogin['json']['session_id'];
    $analystCsrf = $analystLogin['json']['csrf_token'];

    // 5. Analyst trying to create property must be 403 Forbidden
    $badWrite = dispatchRequest($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $analystSid,
        'headers' => ['X-CSRF-Token' => $analystCsrf],
        'body' => ['listing_title' => 'Analyst Test']
    ]);
    assertEquals(403, $badWrite['status']);

    // 6. Mutating write without CSRF token must be 403 Forbidden
    $noCsrf = dispatchRequest($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $principalSid,
        'body' => ['listing_title' => 'No CSRF Test']
    ]);
    assertEquals(403, $noCsrf['status']);
});

// --------------------------------------------------------------------
// 4. Listing Workflow: Draft -> Approval -> Shortlist -> Revocation
// --------------------------------------------------------------------
$runTest('Listing & Shortlist Lifecycle: Draft, Approval, Shortlist sharing and revocation', function () {
    $pdo = createTestDb();

    // Login as advisor
    $advLogin = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'advisor@aumestates.com', 'password' => 'AdvisorPass@2026!']
    ]);
    $advSid = $advLogin['json']['session_id'];
    $advCsrf = $advLogin['json']['csrf_token'];

    // 1. Advisor creates a draft
    $createDraft = dispatchRequest($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'listing_title' => 'Puri The Aravallis Luxury 4 BHK',
            'project_name' => 'Puri The Aravallis',
            'corridor' => 'Golf Course Ext & SPR',
            'sector' => 'Sector 61',
            'category' => 'apartment',
            'price_value' => 6.8,
            'price_unit' => 'Cr',
            'publication_state' => 'pending_approval',
            'area_value' => 3750,
            'area_unit' => 'Sq Ft'
        ]
    ]);
    assertEquals(201, $createDraft['status']);
    $newPropId = $createDraft['json']['property_id'];
    assertTrue(!empty($newPropId));

    // 2. Advisor attempts to approve directly -> MUST be 403 Forbidden
    $advApprove = dispatchRequest($pdo, 'POST', "/api/crm/properties/{$newPropId}/approve", [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf]
    ]);
    assertEquals(403, $advApprove['status']);

    // 3. Principal approves the listing
    $pLogin = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'ajay@aumestates.com', 'password' => 'Test-only-credential-2026!']
    ]);
    $pSid = $pLogin['json']['session_id'];
    $pCsrf = $pLogin['json']['csrf_token'];

    $pApprove = dispatchRequest($pdo, 'POST', "/api/crm/properties/{$newPropId}/approve", [
        'session_id' => $pSid,
        'headers' => ['X-CSRF-Token' => $pCsrf]
    ]);
    assertEquals(200, $pApprove['status']);
    assertEquals('approved_public', $pApprove['json']['publication_state']);

    // 4. Generate client shortlist
    $slCreate = dispatchRequest($pdo, 'POST', '/api/crm/shortlists', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'client_name' => 'Aditya Birla Syndicate',
            'title' => 'Golf Course Road & Ext Mandates',
            'property_ids' => [$newPropId],
            'commentaries' => [
                $newPropId => 'Direct mandate with clean HSVP title and panoramic Aravali views.'
            ]
        ]
    ]);
    assertEquals(201, $slCreate['status']);
    $token = $slCreate['json']['share_token'];
    $slId = $slCreate['json']['shortlist_id'];
    assertTrue(!empty($token));

    // 5. Buyer opens shortlist publicly without login
    $buyerReq = dispatchRequest($pdo, 'GET', "/api/public/shortlists/{$token}");
    assertEquals(200, $buyerReq['status']);
    assertEquals('Aditya Birla Syndicate', $buyerReq['json']['shortlist']['client_name']);
    assertEquals(1, count($buyerReq['json']['shortlist']['items']));
    assertEquals($newPropId, $buyerReq['json']['shortlist']['items'][0]['property_id']);

    // 6. Advisor revokes shortlist
    $slRevoke = dispatchRequest($pdo, 'POST', "/api/crm/shortlists/{$slId}/revoke", [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf]
    ]);
    assertEquals(200, $slRevoke['status']);

    // 7. Buyer now receives 404
    $buyerRevoked = dispatchRequest($pdo, 'GET', "/api/public/shortlists/{$token}");
    assertEquals(404, $buyerRevoked['status']);
});

// --------------------------------------------------------------------
// 5. Tabular Import Contract (CSV / JSON / Dry-run)
// --------------------------------------------------------------------
$runTest('CRM Intake & Importer: Dry-run, role demotion, and batch commit', function () {
    $pdo = createTestDb();

    // 1. Advisor login
    $advLogin = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'advisor@aumestates.com', 'password' => 'AdvisorPass@2026!']
    ]);
    $advSid = $advLogin['json']['session_id'];
    $advCsrf = $advLogin['json']['csrf_token'];

    $csvContent = implode("\n", [
        'property_id,project_name,property_type,listing_title,configuration,area_value,price_value,publication_state,owner_name,exact_unit_no',
        'AUM-IMP-000101,The Camellias,Apartment,Ultra Luxury 4BHK Golf Course,4 BHK,7400,32,approved_public,Rajesh Munjal,Tower 4 Unit 12A',
        'AUM-IMP-000102,DLF Magnolias,Apartment,Magnolias 4BHK Golf View,4 BHK,6500,24,private,Sanjay Singhania,Tower B Unit 802'
    ]);

    // 2. Dry-run preview
    $dryRes = dispatchRequest($pdo, 'POST', '/api/crm/intake/import', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'format' => 'csv',
            'text' => $csvContent,
            'dryRun' => true
        ]
    ]);
    assertEquals(200, $dryRes['status']);
    assertEquals(true, $dryRes['json']['ok']);
    assertEquals(true, $dryRes['json']['dryRun']);
    assertEquals(2, $dryRes['json']['summary']['totalParsed']);
    // Non-principal advisor: approved_public demoted to pending_approval
    assertEquals('pending_approval', $dryRes['json']['preview'][0]['publicRecord']['publication_state']);

    // 3. Commit import
    $commitRes = dispatchRequest($pdo, 'POST', '/api/crm/intake/import', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'format' => 'csv',
            'text' => $csvContent,
            'dryRun' => false
        ]
    ]);
    assertEquals(200, $commitRes['status']);
    assertEquals(true, $commitRes['json']['ok']);
    assertEquals(false, $commitRes['json']['dryRun']);

    // 4. Verify properties and private vault records persisted
    $chk = $pdo->prepare('SELECT p.*, pv.owner_name_cache, pv.exact_unit_or_plot_no FROM properties p JOIN property_private pv ON pv.property_id = p.property_id WHERE p.property_id = ?');
    $chk->execute(['AUM-IMP-000101']);
    $r1 = $chk->fetch(PDO::FETCH_ASSOC);
    assertTrue(!empty($r1), 'Imported property AUM-IMP-000101 must exist');
    assertEquals('pending_approval', $r1['publication_state']);
    assertEquals('Rajesh Munjal', $r1['owner_name_cache']);
    assertEquals('Tower 4 Unit 12A', $r1['exact_unit_or_plot_no']);
});

// --------------------------------------------------------------------
// 6. CRM Leads, Contacts, Requirements, and Matcher Contract
// --------------------------------------------------------------------
$runTest('CRM Leads, Contacts, Activities, and Buyer Matching', function () {
    $pdo = createTestDb();

    // Advisor login
    $advLogin = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'advisor@aumestates.com', 'password' => 'AdvisorPass@2026!']
    ]);
    $advSid = $advLogin['json']['session_id'];
    $advCsrf = $advLogin['json']['csrf_token'];

    // 1. Create Contact
    $cRes = dispatchRequest($pdo, 'POST', '/api/crm/contacts', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'full_name' => 'Vikram Oberoi',
            'phone_primary' => '+91 98111 22334',
            'email_primary' => 'vikram@oberoigroup.test',
            'contact_type' => 'buyer',
            'firm_or_syndicate' => 'Oberoi Family Office'
        ]
    ]);
    assertEquals(201, $cRes['status']);
    $contactId = $cRes['json']['contact_id'];
    assertTrue(!empty($contactId));

    // 2. Create Lead
    $lRes = dispatchRequest($pdo, 'POST', '/api/crm/leads', [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'full_name' => 'Vikram Oberoi',
            'phone' => '+91 98111 22334',
            'contact_id' => $contactId,
            'lead_stage' => 'qualified',
            'priority' => 'high',
            'deal_intent' => 'Buy'
        ]
    ]);
    assertEquals(201, $lRes['status']);
    $leadId = $lRes['json']['lead_id'];
    assertTrue(!empty($leadId));

    // 3. Log Activity
    $actRes = dispatchRequest($pdo, 'POST', "/api/crm/leads/{$leadId}/activities", [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'activity_type' => 'viewing',
            'summary' => 'Initial private viewing at Camellias with family',
            'details' => 'Client expressed interest in high-floor 4 BHK with Aravali views.'
        ]
    ]);
    assertEquals(201, $actRes['status']);

    // 4. Set Buyer Requirements
    $reqRes = dispatchRequest($pdo, 'POST', "/api/crm/leads/{$leadId}/requirements", [
        'session_id' => $advSid,
        'headers' => ['X-CSRF-Token' => $advCsrf],
        'body' => [
            'intent' => 'Buy',
            'target_corridors' => ['Golf Course Road & Extension'],
            'property_types' => ['Apartment'],
            'min_budget_inr' => 150000000,
            'max_budget_inr' => 350000000,
            'min_area_sqft' => 5000,
            'bedrooms' => '4'
        ]
    ]);
    assertEquals(201, $reqRes['status']);

    // 5. Match candidate properties
    $matchRes = dispatchRequest($pdo, 'GET', "/api/crm/leads/{$leadId}/match", [
        'session_id' => $advSid
    ]);
    assertEquals(200, $matchRes['status']);
    assertEquals(true, $matchRes['json']['ok']);
    assertTrue(isset($matchRes['json']['matches']), 'Matches array must be returned');
    assertTrue(count($matchRes['json']['matches']) > 0, 'Should find matching inventory');
    assertTrue($matchRes['json']['matches'][0]['match_score'] > 50, 'Top match should score highly');
});

// --------------------------------------------------------------------
// 7. Frontend UI Contract Parity (crm.js, lead-client.js, shortlist.html)
// --------------------------------------------------------------------
$runTest('Frontend UI Contract Parity: crm.js, lead-client.js, and shortlist.html shapes', function () {
    $pdo = createTestDb();

    // 1. Login returns authenticated + csrfToken (camelCase expected by crm.js)
    $login = dispatchRequest($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'ajay@aumestates.com', 'password' => 'Test-only-credential-2026!']
    ]);
    assertEquals(200, $login['status']);
    assertEquals(true, $login['json']['authenticated']);
    assertTrue(!empty($login['json']['csrfToken']), 'csrfToken must be present for crm.js');
    $sid = $login['json']['session_id'];
    $csrf = $login['json']['csrfToken'];

    // 2. Session check returns authenticated + csrfToken
    $sess = dispatchRequest($pdo, 'GET', '/api/crm/auth/session', ['session_id' => $sid]);
    assertEquals(200, $sess['status']);
    assertEquals(true, $sess['json']['authenticated']);
    assertTrue(!empty($sess['json']['csrfToken']));

    // 3. Dashboard returns crm.js structure
    $dash = dispatchRequest($pdo, 'GET', '/api/crm/dashboard', ['session_id' => $sid]);
    assertEquals(200, $dash['status']);
    assertTrue(isset($dash['json']['inventory']['total_master']) && $dash['json']['inventory']['total_master'] > 300);
    assertTrue(is_array($dash['json']['pipeline']));
    assertTrue(is_array($dash['json']['recentLeads']));
    assertTrue(is_array($dash['json']['pendingApprovals']));
    assertTrue(is_array($dash['json']['reverifyQueue']));

    // 4. Property nested payload { public, private } from crm.js returns item
    $createProp = dispatchRequest($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $sid,
        'headers' => ['X-CSRF-Token' => $csrf],
        'body' => [
            'public' => [
                'publication_state' => 'pending_approval',
                'availability_state' => 'available',
                'transaction_type' => 'Sale',
                'listing_title' => 'DLF Arbour 4 BHK High Floor',
                'project_name' => 'DLF The Arbour',
                'corridor' => 'Golf Course Ext & SPR',
                'area_value' => 3950,
                'area_unit' => 'Sq Ft',
                'price_value' => 7.8,
                'price_unit' => 'Cr'
            ],
            'private' => [
                'owner_name_cache' => 'Karan Mehta',
                'exact_unit_or_plot_no' => 'Tower 2 Unit 1902'
            ]
        ]
    ]);
    assertEquals(201, $createProp['status']);
    assertTrue(!empty($createProp['json']['item']['property_id']));
    $pid = $createProp['json']['item']['property_id'];

    // 5. Property detail returns item & auditHistory
    $detail = dispatchRequest($pdo, 'GET', "/api/crm/properties/{$pid}", ['session_id' => $sid]);
    assertEquals(200, $detail['status']);
    assertEquals($pid, $detail['json']['item']['property_id']);
    assertEquals('Tower 2 Unit 1902', $detail['json']['item']['exact_unit_or_plot_no']);
    assertTrue(is_array($detail['json']['auditHistory']));

    // 6. WhatsApp camelCase payload { rawText, sourceGroup, commit } returns item
    $wa = dispatchRequest($pdo, 'POST', '/api/crm/intake/whatsapp', [
        'session_id' => $sid,
        'headers' => ['X-CSRF-Token' => $csrf],
        'body' => [
            'rawText' => 'DLF The Belaire Sec 54 | 4BHK 3065 sqft | Asking 9.25 Cr | Keys with Rohit 9811045678',
            'sourceGroup' => 'South Delhi Brokers',
            'commit' => true
        ]
    ]);
    assertEquals(200, $wa['status']);
    assertTrue(!empty($wa['json']['item']['property_id']));

    // 7. WhatsApp handoff enquiry without phone (lead-client.js) succeeds, empty {} rejected
    $emptyInq = dispatchRequest($pdo, 'POST', '/api/public/inquiries', ['body' => []]);
    assertEquals(400, $emptyInq['status']);

    $waInq = dispatchRequest($pdo, 'POST', '/api/public/inquiries', [
        'body' => [
            'client_name' => 'Website Visitor',
            'property_id' => $pid,
            'source_channel' => 'inquire_whatsapp',
            'source_page' => '/properties/'
        ]
    ]);
    assertEquals(201, $waInq['status']);
    $waLeadId = $waInq['json']['lead_id'];

    // 8. Lead detail returns lead, requirement, matches, activities
    $leadDetail = dispatchRequest($pdo, 'GET', "/api/crm/leads/{$waLeadId}", ['session_id' => $sid]);
    assertEquals(200, $leadDetail['status']);
    assertEquals($waLeadId, $leadDetail['json']['lead']['lead_id']);
    assertTrue(is_array($leadDetail['json']['matches']));
    assertTrue(isset($leadDetail['json']['requirement']['requirement_id']));

    // 9. Leads, Contacts, Audit Logs all return items[]
    $leadsList = dispatchRequest($pdo, 'GET', '/api/crm/leads', ['session_id' => $sid]);
    assertEquals(200, $leadsList['status']);
    assertTrue(is_array($leadsList['json']['items']) && count($leadsList['json']['items']) > 0);

    $contactsList = dispatchRequest($pdo, 'GET', '/api/crm/contacts', ['session_id' => $sid]);
    assertEquals(200, $contactsList['status']);
    assertTrue(is_array($contactsList['json']['items']));

    $auditList = dispatchRequest($pdo, 'GET', '/api/crm/audit-logs', ['session_id' => $sid]);
    assertEquals(200, $auditList['status']);
    assertTrue(is_array($auditList['json']['items']) && count($auditList['json']['items']) > 0);
});

echo "\n======================================================================\n";
echo "HTTP Contract Test Summary: {$passed} passed, {$failed} failed.\n";
echo "======================================================================\n";

if ($failed > 0) {
    exit(1);
}
