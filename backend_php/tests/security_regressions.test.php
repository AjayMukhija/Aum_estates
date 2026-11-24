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

// ---------------------------------------------------------------------------
// Account provisioning: bin/setup_admin.php
// ---------------------------------------------------------------------------

/**
 * Runs the provisioner against a throwaway SQLite file so the test never
 * touches the real master store. Returns [exitCode, stdout, stderr].
 */
function runProvisioner(string $dbFile, array $args, array $env = []): array
{
    $script = __DIR__ . '/../bin/setup_admin.php';
    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script);
    foreach ($args as $a) {
        $cmd .= ' ' . escapeshellarg($a);
    }

    // Config::loadEnv() only fills in keys the environment does not already
    // carry, so setting these here keeps the child off the real master store
    // even on a machine that has backend_php/.env.
    $envVars = array_merge(getenv(), [
        'AUM_DB_DRIVER' => 'sqlite',
        'AUM_DB_PATH' => $dbFile,
        'AUM_DB_DIR' => dirname($dbFile)
    ], $env);

    $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($cmd, $descriptors, $pipes, null, $envVars);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return [proc_close($proc), $out, $err];
}

function provisionerFixture(): string
{
    $file = tempnam(sys_get_temp_dir(), 'aum_provision_') . '.sqlite';
    $pdo = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, full_name TEXT, role TEXT, password_hash TEXT, password_salt TEXT NOT NULL DEFAULT \'\', is_active INTEGER DEFAULT 1, created_at TEXT)');
    $pdo->exec('CREATE TABLE sessions (session_id TEXT PRIMARY KEY, user_id INTEGER, csrf_token TEXT, expires_at TEXT, ip_address TEXT, created_at TEXT)');
    $pdo->exec('CREATE TABLE audit_logs (audit_id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, actor_label TEXT, entity_type TEXT, entity_id TEXT, action TEXT, summary TEXT, before_json TEXT, after_json TEXT, created_at TEXT)');
    $pdo->exec("INSERT INTO users (email, full_name, role, password_hash, created_at) VALUES ('ajay@aumestates.com', 'Ajay Mukhija', 'principal', 'ORIGINAL-HASH', '2026-01-01')");
    $pdo->exec("INSERT INTO sessions (session_id, user_id, csrf_token, expires_at, created_at) VALUES ('live-session', 1, 'c', '2099-01-01', '2026-01-01')");
    return $file;
}

$runTest('Provisioner: an unrecognised flag is refused instead of rotating the credential', function () {
    $db = provisionerFixture();
    try {
        // --help used to fall through to "no password supplied, generate one",
        // so asking for usage silently reset the principal's sign-in.
        foreach ([['--help'], ['--generte'], []] as $args) {
            [$code, , ] = runProvisioner($db, $args);
            assertTrue2($code !== 1, 'the provisioner must not fail hard on ' . json_encode($args));
        }
        $pdo = new PDO('sqlite:' . $db, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $hash = $pdo->query('SELECT password_hash FROM users WHERE user_id = 1')->fetchColumn();
        assertSame2('ORIGINAL-HASH', $hash, 'no argument short of an explicit password source may rotate the credential');
    } finally {
        @unlink($db);
    }
});

$runTest('Provisioner: a rotation revokes the account\'s open sessions', function () {
    $db = provisionerFixture();
    try {
        [$code, $out, $err] = runProvisioner($db, [], ['AUM_ADMIN_PASSWORD' => 'a-sufficiently-long-password']);
        assertSame2(0, $code, 'provisioning must succeed: ' . $err);
        $pdo = new PDO('sqlite:' . $db, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        assertTrue2(
            $pdo->query('SELECT password_hash FROM users WHERE user_id = 1')->fetchColumn() !== 'ORIGINAL-HASH',
            'the password must actually change'
        );
        assertSame2(
            0,
            (int)$pdo->query('SELECT COUNT(*) FROM sessions WHERE user_id = 1')->fetchColumn(),
            'a cookie stolen before the rotation must not outlive it'
        );
        assertTrue2(
            (int)$pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'rotate_credential'")->fetchColumn() === 1,
            'the rotation must be auditable'
        );
    } finally {
        @unlink($db);
    }
});

$runTest('Provisioner: a generated password is written owner-only, never printed', function () {
    $db = provisionerFixture();
    $credFile = dirname($db) . '/admin-credentials.json';
    @unlink($credFile);
    try {
        [$code, $out, $err] = runProvisioner($db, ['--generate']);
        assertSame2(0, $code, 'generation must succeed: ' . $err);
        assertTrue2(is_file($credFile), 'the generated credential must be saved somewhere the operator can read it');

        $saved = json_decode((string)file_get_contents($credFile), true);
        assertTrue2(is_array($saved) && !empty($saved['password']), 'the credentials file must carry the password');
        assertTrue2(
            !str_contains($out . $err, $saved['password']),
            'the password must not reach stdout, where shared-host scrollback and shell history keep it'
        );
        assertSame2('0600', substr(sprintf('%o', fileperms($credFile)), -4), 'the credentials file must be owner-only');
    } finally {
        @unlink($db);
        @unlink($credFile);
    }
});

// ---------------------------------------------------------------------------
$runTest('Contacts: sequential creation skips CNT-OWN/CNT-WEB collisions and PUT updates existing contacts', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    // Master DB contains CNT-0001, CNT-OWN-001..152, CNT-WEB-0001..0002.
    // Creating two contacts sequentially used to fail on the 2nd insert with UNIQUE constraint failed: contacts.contact_id (CNT-0002).
    $c1 = dispatch($pdo, 'POST', '/api/crm/contacts', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['full_name' => 'Sequential Contact 1', 'phone_primary' => '9811000001', 'contact_type' => 'buyer']
    ]);
    assertSame2(201, $c1['status'], '1st contact creation must succeed');

    $c2 = dispatch($pdo, 'POST', '/api/crm/contacts', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['full_name' => 'Sequential Contact 2', 'phone_primary' => '9811000002', 'contact_type' => 'seller_owner']
    ]);
    assertSame2(201, $c2['status'], '2nd contact creation must not collide with CNT-0002');
    assertTrue2($c1['json']['contact_id'] !== $c2['json']['contact_id'], 'Each contact must receive a unique ID');

    // Update the contact via PUT /api/crm/contacts/{id}
    $upd = dispatch($pdo, 'PUT', '/api/crm/contacts/' . $c2['json']['contact_id'], [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => ['full_name' => 'Updated Seller Owner', 'firm_or_syndicate' => 'AUM Test Holdings', 'trust_tier' => 'verified']
    ]);
    assertSame2(200, $upd['status'], 'PUT /api/crm/contacts/{id} must succeed');
    assertSame2('Updated Seller Owner', $upd['json']['contact']['full_name']);
    assertSame2('AUM Test Holdings', $upd['json']['contact']['firm_or_syndicate']);
});

// ---------------------------------------------------------------------------
$runTest('Properties: 6-digit ID allocation, price_text auto-refresh, public_features sync, and nullable floor price clearing', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $create = dispatch($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => [
            'listing_title' => 'Sector 65 Luxury Residence',
            'transaction_type' => 'Sale',
            'property_type' => 'Apartment',
            'micro_market' => 'Sector 65',
            'price_value' => 4.5,
            'price_unit' => 'Cr',
            'price_text' => '₹4.5 Cr',
            'key_features' => 'Park facing; 2 car parks',
            'internal_floor_price_inr' => 42000000
        ]
    ]);
    assertSame2(201, $create['status']);
    $pid = $create['json']['property_id'];
    assertTrue2((bool)preg_match('/^AUM-WEB-\d{6}$/', $pid), "Property ID must use 6-digit padding, got {$pid}");

    // Now update price_value to 5.25 without changing price_text, update key_features, and clear internal_floor_price_inr.
    $update = dispatch($pdo, 'PUT', '/api/crm/properties/' . $pid, [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => [
            'price_value' => 5.25,
            'price_unit' => 'Cr',
            'price_text' => '₹4.5 Cr', // stale text sent by form when advisor only edits numeric price
            'key_features' => 'Corner unit; private lift lobby; 3 car parks',
            'internal_floor_price_inr' => ''
        ]
    ]);
    assertSame2(200, $update['status']);

    $detail = dispatch($pdo, 'GET', '/api/crm/properties/' . $pid, [
        'session_id' => $s['sid']
    ]);
    assertSame2(200, $detail['status']);
    assertSame2('₹5.25 Cr', $detail['json']['property']['price_text'], 'Stale price_text must refresh when numeric price changes');
    assertSame2('Corner unit; private lift lobby; 3 car parks', $detail['json']['property']['public_features'], 'public_features must sync with key_features');
    assertSame2(null, $detail['json']['property']['internal_floor_price_inr'], 'Clearing internal_floor_price_inr must set NULL in DB');
});

// ---------------------------------------------------------------------------
$runTest('Reverify: unknown ID returns 404, valid ID advances next_reverify_due by 120 days and exits dashboard queue', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $missing = dispatch($pdo, 'POST', '/api/crm/properties/AUM-NO-SUCH-0000/reverify', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']]
    ]);
    assertSame2(404, $missing['status']);

    // Force a property into the reverify queue
    $pid = $pdo->query("SELECT property_id FROM properties WHERE availability_state='available' LIMIT 1")->fetchColumn();
    $pdo->prepare("UPDATE properties SET next_reverify_due = '2026-01-01' WHERE property_id = ?")->execute([$pid]);

    $rev = dispatch($pdo, 'POST', "/api/crm/properties/{$pid}/reverify", [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']]
    ]);
    assertSame2(200, $rev['status']);
    assertTrue2($rev['json']['next_reverify_due'] > gmdate('Y-m-d', strtotime('+60 days')), 'next_reverify_due must be pushed beyond the 30-day dashboard window');

    $dash = dispatch($pdo, 'GET', '/api/crm/dashboard', ['session_id' => $s['sid']]);
    $queuedIds = array_column($dash['json']['reverifyQueue'] ?? [], 'property_id');
    assertTrue2(!in_array($pid, $queuedIds, true), 'Reverified property must leave the dashboard reverifyQueue immediately');
});

// ---------------------------------------------------------------------------
$runTest('Approval: POST /api/crm/properties/{id}/approve blocks drafts containing leaked phone or cheque notes with 422', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $create = dispatch($pdo, 'POST', '/api/crm/properties', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => [
            'listing_title' => 'Unscrubbed Draft Mandate',
            'transaction_type' => 'Sale',
            'public_description' => 'Call owner directly at 9811223344 for cash/cheque deal',
            'publication_state' => 'draft'
        ]
    ]);
    $pid = $create['json']['property_id'];

    $approve = dispatch($pdo, 'POST', "/api/crm/properties/{$pid}/approve", [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']]
    ]);
    assertSame2(422, $approve['status'], 'Approving a draft with leaked phone/cheque prose must fail with 422');
});

// ---------------------------------------------------------------------------
$runTest('Shortlists: leaked phone in advisor note returns 422 (not 500) and revoking unknown shortlist returns 404', function () {
    $pdo = makeDb();
    $s = signIn($pdo, 'ajay@aumestates.com', 'Principal-Test-2026!');

    $live = $pdo->query("SELECT property_id FROM properties WHERE publication_state='approved_public' AND availability_state='available' LIMIT 1")->fetchAll(PDO::FETCH_COLUMN);

    $bad = dispatch($pdo, 'POST', '/api/crm/shortlists', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']],
        'body' => [
            'client_name' => 'Client Leak Test',
            'advisor_intro_note' => 'Call seller directly on 9810098100',
            'property_ids' => $live
        ]
    ]);
    assertSame2(422, $bad['status'], 'Privacy violation in shortlist note must return 422 instead of 500');

    $rev = dispatch($pdo, 'POST', '/api/crm/shortlists/SHL-9999/revoke', [
        'session_id' => $s['sid'],
        'headers' => ['x-csrf-token' => $s['csrf']]
    ]);
    assertSame2(404, $rev['status'], 'Revoking non-existent shortlist must return 404');
});

// ---------------------------------------------------------------------------
$runTest('IntakeParser: multi-line quoted CSV cells and XLSX self-closing empty styled cells preserve column alignment', function () {
    $csv = "property_id,listing_title,public_description,price_text\n"
         . "AUM-CSV-000001,\"Magnolias Duplex\",\"Line 1 description\nLine 2 description\",\"₹28 Cr\"\n";
    $rows = \AumEstates\Domain\IntakeParser::parseCsvText($csv);
    assertSame2(1, count($rows), 'Multi-line quoted CSV row must parse as 1 record, not split across lines');
    assertSame2('₹28 Cr', $rows[0]['price_text']);

    // Build a minimal XLSX zip with a self-closing styled cell <c r="B2" s="1"/> between A2 and C2
    $tmpZip = tempnam(sys_get_temp_dir(), 'aum_xlsx_') . '.xlsx';
    $zip = new \ZipArchive();
    $zip->open($tmpZip, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
    $zip->addFromString('xl/sharedStrings.xml', '<?xml version="1.0"?><sst><si><t>ColA</t></si><si><t>ColB</t></si><si><t>ColC</t></si><si><t>ValA</t></si><si><t>ValC</t></si></sst>');
    $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet><sheetData>'
        . '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
        . '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"/><c r="C2" t="s"><v>4</v></c></row>'
        . '</sheetData></worksheet>');
    $zip->close();

    try {
        $xlsxRows = \AumEstates\Domain\IntakeParser::parseXlsxBuffer((string)file_get_contents($tmpZip));
        assertSame2(1, count($xlsxRows));
        assertSame2('ValA', $xlsxRows[0]['ColA']);
        assertSame2('', $xlsxRows[0]['ColB'], 'Self-closing empty styled cell B2 must remain empty');
        assertSame2('ValC', $xlsxRows[0]['ColC'], 'Cell C2 must not be swallowed by self-closing cell B2');
    } finally {
        @unlink($tmpZip);
    }
});

// ---------------------------------------------------------------------------
$runTest('Enquiries: public inquiry scaffolds corridor and budget range into buyer_requirements', function () {
    $pdo = makeDb();
    $r = dispatch($pdo, 'POST', '/api/public/inquiries', [
        'ip' => '198.51.100.88',
        'body' => [
            'name' => 'Budget Buyer',
            'phone' => '9811998877',
            'configuration' => '4 BHK',
            'location' => 'Golf Course Road',
            'budget' => '₹5 Cr – ₹10 Cr',
            'message' => 'Looking for ready move apartment'
        ]
    ]);
    assertSame2(201, $r['status']);
    $stmt = $pdo->prepare('SELECT corridors_json, min_budget_inr, max_budget_inr FROM buyer_requirements WHERE lead_id = ?');
    $stmt->execute([$r['json']['lead_id']]);
    $req = $stmt->fetch();
    assertSame2(['Golf Course Road'], json_decode($req['corridors_json'], true));
    assertSame2(50000000.0, (float)$req['min_budget_inr']);
    assertSame2(100000000.0, (float)$req['max_budget_inr']);
});

echo "\n======================================================================\n";
echo "Regression Suite Summary: {$passed} passed, {$failed} failed.\n";
echo "======================================================================\n";

exit($failed > 0 ? 1 : 0);
