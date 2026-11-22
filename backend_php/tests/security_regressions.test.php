<?php
declare(strict_types=1);

/**
 * AUM Estates — Security & Data-Integrity Regression Suite (PHP)
 *
 * Every test here pins a defect found during the pre-production audit of the
 * Node-to-PHP migration. Each one failed before the corresponding fix.
 */

namespace AumEstates\Tests;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../db/migrations.php';
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

use PDO;
use AumEstates\Config;
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
        echo "FAIL\n  Error: " . $e->getMessage() . " in " . basename($e->getFile()) . ":" . $e->getLine() . "\n";
        $failed++;
    }
};

function assertSame2($expected, $actual, string $msg = '')
{
    if ($expected !== $actual) {
        throw new \AssertionError(
            "Expected " . var_export($expected, true) . ", got " . var_export($actual, true) . ". {$msg}"
        );
    }
}

function assertTrue2($cond, string $msg = '')
{
    if (!$cond) {
        throw new \AssertionError("Expected true. {$msg}");
    }
}

function dispatch(PDO $pdo, string $method, string $path, array $options = []): array
{
    Router::$exitOnResponse = false;
    Router::$lastStatusCode = 200;

    $server = [
        'REQUEST_METHOD' => strtoupper($method),
        'REQUEST_URI' => $path,
        'REMOTE_ADDR' => $options['ip'] ?? '203.0.113.9'
    ];
    foreach (($options['headers'] ?? []) as $k => $v) {
        $server['HTTP_' . strtoupper(str_replace('-', '_', $k))] = $v;
    }

    $cookies = $options['cookies'] ?? [];
    if (!empty($options['session_id'])) {
        $cookies[Config::SESSION_COOKIE_NAME] = $options['session_id'];
    }

    $rawBody = isset($options['body'])
        ? (is_string($options['body']) ? $options['body'] : json_encode($options['body']))
        : '';

    $savedServer = $_SERVER;
    $savedGet = $_GET;
    $_SERVER = array_merge($_SERVER, $server);
    $_GET = $options['query'] ?? [];

    ob_start();
    $router = new Router($pdo, $server, $options['query'] ?? [], $cookies, $rawBody);
    $err = null;
    try {
        if (str_starts_with($path, '/api/public/')) {
            PublicRoutes::dispatch($router, $pdo, $method, $path);
        } elseif (str_starts_with($path, '/api/crm/')) {
            CrmRoutes::dispatch($router, $pdo, $method, $path);
        }
    } catch (\Throwable $e) {
        $err = ['error' => $e->getMessage()];
    }
    $output = ob_get_clean();

    $_SERVER = $savedServer;
    $_GET = $savedGet;

    if ($output === '' && $err !== null) {
        $output = json_encode($err);
    }

    return ['status' => Router::$lastStatusCode, 'json' => json_decode($output, true), 'raw' => $output];
}

/**
 * Builds a disposable database carrying the real schema plus the throttling table.
 */
function makeDb(): PDO
{
    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON;');

    $master = Config::getPaths()['sqlite_file'];
    $pdo->exec("ATTACH DATABASE '{$master}' AS master_store");
    $tables = [
        'users', 'sessions', 'locations', 'projects', 'contacts',
        'properties', 'property_private', 'leads', 'buyer_requirements',
        'client_shortlists', 'shortlist_items', 'crm_activities',
        'audit_logs', 'schema_migrations', 'inventory_undo'
    ];
    foreach ($tables as $t) {
        $pdo->exec("CREATE TABLE {$t} AS SELECT * FROM master_store.{$t}");
    }
    $pdo->exec('DETACH DATABASE master_store');

    // The throttling store the credential and intake endpoints depend on.
    $pdo->exec('CREATE TABLE IF NOT EXISTS auth_throttle (
        attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        identifier TEXT NOT NULL,
        attempted_at TEXT NOT NULL
    )');

    $now = gmdate('Y-m-d\TH:i:s.v\Z');
    $pdo->prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE email = ?')
        ->execute([Auth::hashPassword('Principal-Test-2026!'), '', 'ajay@aumestates.com']);
    $pdo->prepare('INSERT INTO users (user_id, email, full_name, role, password_hash, password_salt, is_active, created_at) VALUES (2, ?, ?, ?, ?, ?, 1, ?)')
        ->execute(['advisor@aumestates.com', 'Test Advisor', 'advisor', Auth::hashPassword('Advisor-Test-2026!'), '', $now]);

    return $pdo;
}

function signIn(PDO $pdo, string $email, string $password): array
{
    $r = dispatch($pdo, 'POST', '/api/crm/auth/login', ['body' => ['email' => $email, 'password' => $password]]);
    if (($r['json']['ok'] ?? false) !== true) {
        throw new \RuntimeException('Sign-in failed in fixture: ' . ($r['json']['error'] ?? 'unknown'));
    }
    return ['sid' => $r['json']['session_id'], 'csrf' => $r['json']['csrfToken']];
}

echo "======================================================================\n";
echo "AUM Estates PHP Security & Data-Integrity Regression Suite\n";
echo "======================================================================\n\n";

// ---------------------------------------------------------------------------
$runTest('Login: repeated wrong passwords are throttled with 429', function () {
    $pdo = makeDb();
    $sawThrottle = false;
    for ($i = 0; $i < Auth::LOGIN_MAX_ATTEMPTS + 3; $i++) {
        $r = dispatch($pdo, 'POST', '/api/crm/auth/login', [
            'body' => ['email' => 'ajay@aumestates.com', 'password' => "wrong-{$i}"]
        ]);
        if ($r['status'] === 429) {
            $sawThrottle = true;
            assertTrue2(($r['json']['retry_after_seconds'] ?? 0) > 0, 'A 429 must tell the caller when to retry');
            break;
        }
    }
    assertTrue2($sawThrottle, 'Unlimited password guessing is still possible');
});

// ---------------------------------------------------------------------------
$runTest('Login: throttling does not lock out the correct password within the limit', function () {
    $pdo = makeDb();
    for ($i = 0; $i < 3; $i++) {
        dispatch($pdo, 'POST', '/api/crm/auth/login', [
            'body' => ['email' => 'ajay@aumestates.com', 'password' => 'nope']
        ]);
    }
    $r = dispatch($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'ajay@aumestates.com', 'password' => 'Principal-Test-2026!']
    ]);
    assertSame2(200, $r['status'], 'A genuine sign-in after a few typos must still succeed');
    assertSame2(true, $r['json']['ok']);
});

// ---------------------------------------------------------------------------
$runTest('Login: AUM_ADMIN_PASSWORD is not accepted as a master password', function () {
    $pdo = makeDb();
    putenv('AUM_ADMIN_PASSWORD=SharedSetupPassword123');
    $_ENV['AUM_ADMIN_PASSWORD'] = 'SharedSetupPassword123';
    try {
        $r = dispatch($pdo, 'POST', '/api/crm/auth/login', [
            'body' => ['email' => 'advisor@aumestates.com', 'password' => 'SharedSetupPassword123']
        ]);
        assertSame2(401, $r['status'], 'The environment password must not authenticate an arbitrary account');

        // ...and it must not have overwritten that account's real credential.
        $hash = $pdo->query("SELECT password_hash FROM users WHERE email='advisor@aumestates.com'")->fetchColumn();
        assertTrue2(password_verify('Advisor-Test-2026!', $hash), "The advisor's own password must survive");
    } finally {
        putenv('AUM_ADMIN_PASSWORD');
        unset($_ENV['AUM_ADMIN_PASSWORD']);
    }
});

// ---------------------------------------------------------------------------
$runTest('Login: a credential migrated from Node reports a reset, not a wrong password', function () {
    $pdo = makeDb();
    $pdo->prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE email = ?')
        ->execute([str_repeat('a1', 64), 'legacysalt', 'ajay@aumestates.com']);

    $r = dispatch($pdo, 'POST', '/api/crm/auth/login', [
        'body' => ['email' => 'ajay@aumestates.com', 'password' => 'whatever']
    ]);
    assertSame2(409, $r['status'], 'A migrated credential must be distinguishable from a wrong password');
    assertSame2(true, $r['json']['requires_password_reset'] ?? null);
    assertTrue2(str_contains($r['json']['error'] ?? '', 'setup_admin.php'), 'The error must say how to recover');
});

// ---------------------------------------------------------------------------
$runTest('Login: successful and failed sign-ins are both written to the audit log', function () {
    $pdo = makeDb();
    dispatch($pdo, 'POST', '/api/crm/auth/login', ['body' => ['email' => 'ajay@aumestates.com', 'password' => 'wrong']]);
    signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $actions = $pdo->query("SELECT action FROM audit_logs WHERE entity_type = 'session'")->fetchAll(PDO::FETCH_COLUMN);
    assertTrue2(in_array('login_failed', $actions, true), 'A failed sign-in must be recorded');
    assertTrue2(in_array('advisor_login', $actions, true), 'A successful sign-in must be recorded');
});

// ---------------------------------------------------------------------------
$runTest('Enquiries: the unauthenticated intake endpoint is throttled', function () {
    $pdo = makeDb();
    $sawThrottle = false;
    for ($i = 0; $i < Auth::INQUIRY_MAX_ATTEMPTS + 3; $i++) {
        $r = dispatch($pdo, 'POST', '/api/public/inquiries', [
            'ip' => '198.51.100.7',
            'body' => ['name' => "Flood {$i}", 'phone' => '9' . str_pad((string)$i, 9, '1'), 'message' => 'spam']
        ]);
        if ($r['status'] === 429) {
            $sawThrottle = true;
            break;
        }
    }
    assertTrue2($sawThrottle, 'The public enquiry form can still be used to flood the CRM');
});

// ---------------------------------------------------------------------------
$runTest('Enquiries: a blank e-mail never merges two strangers onto one contact', function () {
    $pdo = makeDb();
    $now = gmdate('Y-m-d\TH:i:s.v\Z');

    // A contact stored with empty-string keys, as older rows and hand edits produce.
    $pdo->prepare("INSERT INTO contacts (contact_id, contact_type, full_name, phone_primary, phone_norm, email, created_at, updated_at)
                   VALUES ('CNT-REG-1', 'seller_owner', 'Unrelated Seller', '9820011122', '9820011122', '', ?, ?)")
        ->execute([$now, $now]);

    $r = dispatch($pdo, 'POST', '/api/public/inquiries', [
        'ip' => '198.51.100.21',
        'body' => ['name' => 'Unrelated Buyer', 'phone' => '9777000111', 'message' => 'Looking for a 3BHK']
    ]);
    assertSame2(201, $r['status']);

    $lead = $r['json']['lead_id'];
    $stmt = $pdo->prepare('SELECT contact_id FROM leads WHERE lead_id = ?');
    $stmt->execute([$lead]);
    $contactId = $stmt->fetchColumn();

    assertTrue2($contactId !== 'CNT-REG-1', "A buyer's enquiry was filed onto an unrelated seller's contact record");
});

// ---------------------------------------------------------------------------
$runTest('Enquiries: a repeat enquirer with the same phone still reuses their own contact', function () {
    $pdo = makeDb();
    $first = dispatch($pdo, 'POST', '/api/public/inquiries', [
        'ip' => '198.51.100.31',
        'body' => ['name' => 'Repeat Caller', 'phone' => '9900112233', 'message' => 'First enquiry']
    ]);
    $second = dispatch($pdo, 'POST', '/api/public/inquiries', [
        'ip' => '198.51.100.31',
        'body' => ['name' => 'Repeat Caller', 'phone' => '9900112233', 'message' => 'Second enquiry']
    ]);

    $get = $pdo->prepare('SELECT contact_id FROM leads WHERE lead_id = ?');
    $get->execute([$first['json']['lead_id']]);
    $c1 = $get->fetchColumn();
    $get->execute([$second['json']['lead_id']]);
    $c2 = $get->fetchColumn();

    assertTrue2($c1 !== null && $c1 !== false && $c1 === $c2, 'Genuine de-duplication by phone number must still work');
});

// ---------------------------------------------------------------------------
$runTest('Contacts: a blank e-mail is stored as NULL rather than an empty string', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $r = dispatch($pdo, 'POST', '/api/crm/contacts', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['full_name' => 'Blank Email Contact', 'phone_primary' => '9812345678', 'email' => '']
    ]);
    assertSame2(201, $r['status']);

    $stmt = $pdo->prepare('SELECT email FROM contacts WHERE contact_id = ?');
    $stmt->execute([$r['json']['contact_id']]);
    assertSame2(null, $stmt->fetchColumn(), "An empty e-mail must be NULL, or it collides with other people's enquiries");
});

// ---------------------------------------------------------------------------
$runTest('Contacts: an unknown contact_type is rejected before it reaches the database', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $r = dispatch($pdo, 'POST', '/api/crm/contacts', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['full_name' => 'Bad Type', 'contact_type' => 'not_a_real_type']
    ]);
    assertSame2(400, $r['status'], 'An invalid contact type must be refused, not stored (MariaDB rejects it with a 500)');
});

// ---------------------------------------------------------------------------
$runTest('Approval: approving a property that does not exist returns 404, not success', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $r = dispatch($pdo, 'POST', '/api/crm/properties/AUM-NO-SUCH-9999/approve', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => []
    ]);
    assertSame2(404, $r['status'], 'Approving a non-existent property must not report success');
});

// ---------------------------------------------------------------------------
$runTest('Shortlists: an undisclosable property is refused instead of silently dropped', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $live = $pdo->query("SELECT property_id FROM properties
                         WHERE publication_state='approved_public' AND availability_state='available'
                         LIMIT 2")->fetchAll(PDO::FETCH_COLUMN);
    assertTrue2(count($live) === 2, 'Fixture needs two shareable properties');

    // Demote one property so it can no longer be disclosed to a client.
    $draftId = $pdo->query("SELECT property_id FROM properties
                            WHERE publication_state='approved_public' AND availability_state='available'
                            LIMIT 1 OFFSET 5")->fetchColumn();
    $pdo->prepare("UPDATE properties SET publication_state='draft' WHERE property_id = ?")->execute([$draftId]);

    $r = dispatch($pdo, 'POST', '/api/crm/shortlists', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['client_name' => 'Regression Client', 'property_ids' => array_merge($live, [$draftId])]
    ]);

    assertSame2(422, $r['status'], 'The advisor must be told, not shown a success while the client sees fewer properties');
    assertTrue2(!empty($r['json']['rejected']), 'The response must name the properties that cannot be shared');
    assertSame2($draftId, $r['json']['rejected'][0]['property_id']);
});

// ---------------------------------------------------------------------------
$runTest('Shortlists: a fully shareable selection still sends, and the client sees every item', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $live = $pdo->query("SELECT property_id FROM properties
                         WHERE publication_state='approved_public' AND availability_state='available'
                         LIMIT 3")->fetchAll(PDO::FETCH_COLUMN);

    $r = dispatch($pdo, 'POST', '/api/crm/shortlists', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['client_name' => 'Happy Path Client', 'property_ids' => $live]
    ]);
    assertSame2(201, $r['status'], 'A clean shortlist must still be created');

    $view = dispatch($pdo, 'GET', '/api/public/shortlists/' . $r['json']['share_token']);
    assertSame2(200, $view['status']);
    assertSame2(count($live), count($view['json']['shortlist']['items']), 'The client must see exactly what was selected');
});

// ---------------------------------------------------------------------------
$runTest('Deployment: the homepage is pinned ahead of the API front controller', function () {
    $root = dirname(__DIR__, 2);
    $htaccess = $root . '/AUM_ESTATES_Website_For_Hostinger/.htaccess';
    assertTrue2(is_file($htaccess), 'Production .htaccess is missing');

    $content = (string)file_get_contents($htaccess);
    assertTrue2(
        (bool)preg_match('/^\s*DirectoryIndex\s+index\.html\s+index\.php/m', $content),
        'public_html holds both index.html and index.php; without an explicit DirectoryIndex the server may answer "/" with the API router'
    );
});

// ---------------------------------------------------------------------------
$runTest('Deployment: HTTPS redirect is ordered ahead of the API rewrites', function () {
    $root = dirname(__DIR__, 2);
    $dist = $root . '/dist_hostinger_php/public_html/.htaccess';
    if (!is_file($dist)) {
        return; // Release bundle not built in this checkout.
    }
    $content = (string)file_get_contents($dist);
    $httpsPos = strpos($content, 'RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI}');
    $apiPos = strpos($content, 'RewriteRule ^api/');

    assertTrue2($httpsPos !== false, 'HTTPS redirect missing from the release .htaccess');
    assertTrue2($apiPos !== false, 'API rewrite missing from the release .htaccess');
    assertTrue2(
        $httpsPos < $apiPos,
        'The API rewrite ends in [L]; placed above the HTTPS redirect it would serve /api/crm/auth/login over plain HTTP'
    );
});

// ---------------------------------------------------------------------------
$runTest('Migration export: no credential PHP cannot verify is shipped', function () {
    $dump = dirname(__DIR__) . '/db/canonical_mariadb_migration.sql';
    if (!is_file($dump)) {
        return; // Dump is git-ignored; only checked when present.
    }
    $content = (string)file_get_contents($dump);
    if (!str_contains($content, 'INSERT INTO `users`')) {
        return;
    }
    assertTrue2(
        !preg_match("/'[0-9a-f]{128}'/", $content),
        'The export still carries a 128-char Node scrypt digest, which PHP cannot verify: nobody could sign in after deployment'
    );
});

// ---------------------------------------------------------------------------
$runTest('Import: the master workbook\'s own wording keeps live listings live', function () {
    // The desk maintains a workbook that states publication intent in prose.
    // If the importer does not understand it, every row falls back to
    // pending_approval and a re-import empties the public catalogue.
    $cases = [
        ['Public (legacy)',     'approved_public'],
        ['Already on website',  'approved_public'],
        ['Not published',       'pending_approval'],
        ['Pending approval',    'pending_approval'],
    ];
    foreach ($cases as [$phrase, $expected]) {
        $res = \AumEstates\Domain\IntakeParser::normalizeImportedRow([
            'property_id' => 'AUM-WEB-000001',
            'listing_title' => 'Test Mandate',
            'website_visibility' => $phrase,
            'transaction_type' => 'Sale'
        ], 'AUM-FALLBACK-1');
        assertSame2($expected, $res['publicRecord']['publication_state'], "workbook wording \"{$phrase}\"");
    }
});

// ---------------------------------------------------------------------------
$runTest('Import: internal source contacts reach the private vault, never the listing', function () {
    $res = \AumEstates\Domain\IntakeParser::normalizeImportedRow([
        'property_id' => 'AUM-WEB-000002',
        'listing_title' => 'Vault Mapping Check',
        'website_visibility' => 'Public (legacy)',
        'source_phone_internal' => '9873933846',
        'source_email_internal' => 'seller@example.org',
        'source_contact_internal' => 'V K Sarin',
        'source_name_internal' => 'Dealer Desk',
        'inventory_source_type' => 'Dealer'
    ], 'AUM-FALLBACK-2');

    $priv = $res['privateRecord'];
    assertSame2('9873933846', $priv['owner_phone_cache'], 'internal phone must be captured');
    assertSame2('seller@example.org', $priv['owner_email_cache'], 'internal e-mail must be captured');
    assertSame2('V K Sarin', $priv['owner_name_cache'], 'internal contact name must be captured');
    assertSame2('Dealer Desk', $priv['broker_name_cache'], 'source name must be captured');
    assertSame2('Dealer', $priv['source_group_name'], 'source type must be captured');

    // None of it may appear in anything the public record exposes.
    $publicBlob = json_encode($res['publicRecord']);
    foreach (['9873933846', 'seller@example.org', 'V K Sarin'] as $secret) {
        assertTrue2(!str_contains($publicBlob, $secret), "\"{$secret}\" must not appear in the public record");
    }
});

// ---------------------------------------------------------------------------
$runTest('Import: plot-only listings keep their area', function () {
    // Plots and land carry a plot area but no built-up area. Without a fallback
    // they publish with no size at all.
    $res = \AumEstates\Domain\IntakeParser::normalizeImportedRow([
        'property_id' => 'AUM-MST-000396',
        'listing_title' => 'Sector 57 Plot',
        'plot_area_value' => '180',
        'plot_area_unit' => 'sq yd',
        'property_type' => 'Plot'
    ], 'AUM-FALLBACK-3');

    assertSame2(180.0, $res['publicRecord']['area_value'], 'plot area must become the listing area');
    assertTrue2(!empty($res['publicRecord']['area_unit']), 'plot area needs a unit');
});

// ---------------------------------------------------------------------------
$runTest('Import: cheque and keys-in-hand wording is quarantined out of public text', function () {
    $res = \AumEstates\Domain\IntakeParser::normalizeImportedRow([
        'property_id' => 'AUM-WEB-000004',
        'listing_title' => 'Quarantine Check',
        'website_visibility' => 'Public (legacy)',
        'price_text' => '\u{20B9}4.25 Cr (cheque flexible)',
        'public_features' => 'Good interiors; cheque flexible.',
        'transaction_type' => 'Sale'
    ], 'AUM-FALLBACK-4');

    $pub = json_encode($res['publicRecord']);
    assertTrue2(!preg_match('/cheque/i', $pub), 'cheque wording must not survive into public fields');

    $priv = $res['privateRecord'];
    assertTrue2(!empty($priv['payment_structure_notes']), 'the removed wording must be preserved in the private vault');

    // And the result must clear the gate that guards publication.
    $chk = \AumEstates\Domain\PrivacyGate::validateAndProjectPublicRecord(
        array_merge($res['publicRecord'], ['availability_state' => 'available'])
    );
    assertTrue2($chk['ok'], 'a quarantined record must pass the privacy gate: ' . implode('; ', $chk['errors']));
});

/**
 * The prose scrubber sentence-cases every clause it keeps, and it was being
 * applied to identifier fields too: every slug became "Aum-web-000001-…" and
 * every url "Https://aumestates.com/…" across all 347 published records. No
 * page on the site read either field, so it shipped invisibly — and a
 * capitalised scheme is not a URL, which the share preview depends on.
 */
$runTest('Projection: slugs and urls survive verbatim, prose is still scrubbed', function () {
    $res = \AumEstates\Domain\PrivacyGate::validateAndProjectPublicRecord([
        'property_id' => 'AUM-WEB-000001',
        'slug' => 'aum-web-000001-vatika-inxt-city-centre-sf',
        'url' => 'https://aumestates.com/properties/detail.html?id=AUM-WEB-000001',
        'listing_title' => 'Vatika INXT City Centre',
        'public_description' => 'broker-listed independent kothi on a 12-metre road',
        'publication_state' => 'approved_public',
        'availability_state' => 'available',
        'transaction_type' => 'Sale'
    ]);

    assertTrue2($res['ok'], 'record must pass the gate: ' . implode('; ', $res['errors']));
    $rec = $res['record'];

    // The gate composes the slug itself, so this pins its CASING, which is
    // what the bug destroyed — not the exact composition.
    assertSame2(
        strtolower((string)$rec['slug']),
        (string)$rec['slug'],
        'slug must stay lowercase, not sentence-cased'
    );
    assertTrue2(
        str_starts_with((string)$rec['slug'], 'aum-web-000001-'),
        'slug must still be built from the property id: ' . $rec['slug']
    );
    assertSame2(
        'https://aumestates.com/properties/detail.html?id=AUM-WEB-000001',
        $rec['url'],
        'url scheme must not be sentence-cased'
    );

    // The identifier bypass must not weaken the scrub it sits beside.
    assertTrue2(
        !preg_match('/broker/i', (string)$rec['public_description']),
        'sourcing provenance must still be stripped from prose'
    );
    assertTrue2(
        str_starts_with((string)$rec['public_description'], 'Independent'),
        'a clause that lost its leading qualifier must still be capitalised'
    );
});

/**
 * properties/detail.html is static HTML filled in by JavaScript, and no
 * link-preview crawler runs JavaScript, so a shared dossier showed the generic
 * site card instead of the property. Every call to action on the site ends in
 * WhatsApp, so that card is the referral.
 */
$runTest('Share preview: a property link previews as that property, for every visitor', function () {
    $sp = \AumEstates\Domain\SharePreview::class;

    // There must be no user-agent branch: Hostinger's CDN caches by URL and
    // varies only on Accept-Encoding, so two responses on one URL get served
    // interchangeably to buyers and crawlers alike.
    assertTrue2(
        !method_exists($sp, 'isCrawler'),
        'share previews must not branch on the user agent behind a CDN that does not vary on it'
    );

    $feed = $sp::locateFeed(null);
    assertTrue2($feed !== null, 'the published feed must be locatable');

    // An unknown id must not fabricate a preview for a withdrawn listing.
    assertTrue2($sp::findRecord($feed, 'AUM-WEB-999999') === null, 'an unknown id must not resolve');
    assertTrue2($sp::findRecord($feed, '../../etc/passwd') === null, 'a traversal sequence must not resolve');

    $rows = json_decode((string)file_get_contents($feed), true);
    assertTrue2(is_array($rows) && count($rows) > 0, 'feed must carry records');
    $row = $rows[0];

    // Reachable by id and by slug, and both must describe the same listing.
    $byId = $sp::findRecord($feed, (string)$row['property_id']);
    $bySlug = $sp::findRecord($feed, (string)$row['slug']);
    assertTrue2($byId !== null, 'lookup by property_id must resolve');
    assertTrue2($bySlug !== null, 'lookup by slug must resolve');
    assertSame2($byId['property_id'], $bySlug['property_id'], 'id and slug must resolve to one listing');

    $meta = $sp::buildMeta($byId);
    assertTrue2(
        str_contains($meta['title'], (string)$row['listing_title']),
        'the card title must name the property, not the site'
    );
    assertTrue2(str_ends_with($meta['title'], '| AUM ESTATES'), 'the card must still be attributed');
    assertTrue2(
        str_starts_with($meta['url'], 'https://aumestates.com/properties/detail.html?id='),
        'the canonical url must point at the dossier: ' . $meta['url']
    );
    assertTrue2(
        str_starts_with($meta['image'], 'https://aumestates.com/'),
        'og:image must be absolute, or no crawler will fetch it'
    );
    assertTrue2(mb_strlen($meta['description']) <= 301, 'description must be truncated for the card');

    // A listing with no photograph of its own falls back to the brand card
    // rather than to a stock image of somewhere else.
    $noPhoto = $sp::buildMeta(array_merge($byId, ['image_file' => null]));
    assertSame2(
        'https://aumestates.com' . $sp::FALLBACK_IMAGE,
        $noPhoto['image'],
        'a listing without a photograph must fall back to the brand card'
    );

    // The response must be the REAL dossier page with metadata substituted,
    // not a stub: a buyer and a crawler receive the same bytes.
    $detail = __DIR__ . '/../../AUM_ESTATES_Website_For_Hostinger/properties/detail.html';
    assertTrue2(is_file($detail), 'the dossier page must exist to substitute into');
    $page = $sp::renderDossier($detail, $meta);
    assertTrue2($page !== null, 'the dossier must render');

    assertTrue2(str_contains($page, 'detail.js'), 'the rendered page must still be the working dossier');
    assertSame2(
        1,
        preg_match_all('/<title>/i', $page),
        'exactly one title must survive substitution'
    );
    assertSame2(
        1,
        preg_match_all('/property="og:title"/i', $page),
        'exactly one og:title must survive substitution'
    );
    assertTrue2(
        str_contains($page, 'content="' . htmlspecialchars($meta['title'], ENT_QUOTES) . '"'),
        'the per-property title must be the one present'
    );
    assertTrue2(
        !str_contains($page, 'Property Particulars | AUM ESTATES Gurgaon'),
        'the generic placeholder metadata must be gone'
    );
});

echo "\n======================================================================\n";
echo "Regression Suite Summary: {$passed} passed, {$failed} failed.\n";
echo "======================================================================\n";

exit($failed > 0 ? 1 : 0);
