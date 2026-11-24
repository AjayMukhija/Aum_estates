<?php
declare(strict_types=1);

namespace AumEstates\Routes;

use PDO;
use AumEstates\Config;
use AumEstates\Auth\Auth;
use AumEstates\Db\Connection;
use AumEstates\Domain\Normalizer;
use AumEstates\Domain\PrivacyGate;
use AumEstates\Domain\SearchEngine;
use AumEstates\Domain\Shortlist;
use AumEstates\Domain\Publisher;
use AumEstates\Domain\IntakeParser;

final class CrmRoutes
{
    public static function dispatch(Router $router, PDO $pdo, string $method, string $path): bool
    {
        // --------------------------------------------------------------------
        // Auth Routes
        // --------------------------------------------------------------------

        if ($path === '/api/crm/auth/login' && $method === 'POST') {
            $body = $router->getJsonBody();
            $email = trim(Normalizer::cleanWhitespace($body['email'] ?? '') ?? '');
            $password = (string)($body['password'] ?? '');
            $clientIp = Auth::clientIp($_SERVER);

            if (!$email || !$password) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Email and password are required']);
                return true;
            }

            // Throttle by IP and by account so neither a single source nor a single
            // account can be subjected to unlimited password guessing.
            foreach ([['login_ip', $clientIp], ['login_user', mb_strtolower($email, 'UTF-8')]] as [$scope, $ident]) {
                $gate = Auth::registerAttempt($pdo, $scope, $ident, Auth::LOGIN_MAX_ATTEMPTS, Auth::LOGIN_WINDOW_SECONDS);
                if (!$gate['allowed']) {
                    Router::sendJson(429, [
                        'ok' => false,
                        'error' => 'Too many sign-in attempts. Please wait before trying again.',
                        'retry_after_seconds' => $gate['retryAfter']
                    ], ['Retry-After' => (string)$gate['retryAfter']]);
                    return true;
                }
            }

            $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND is_active = 1');
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user) {
                // Spend comparable time on an unknown account so response timing
                // does not reveal which e-mail addresses exist.
                password_verify($password, '$2y$12$usuallyinvalidhashusuallyinvalidhashusuallyinvalidhashuuuuuu');
                Router::sendJson(401, ['ok' => false, 'error' => 'Invalid email or password']);
                return true;
            }

            // An account carried over from the Node/SQLite system stores a scrypt
            // digest PHP cannot verify. Say so plainly instead of reporting a wrong
            // password, which would look like an unexplained lockout.
            if (Auth::isLegacyScryptHash($user['password_hash'] ?? null)) {
                Connection::recordAuditLog($pdo, [
                    'actorLabel' => $user['email'],
                    'entityType' => 'session',
                    'entityId' => (string)$user['user_id'],
                    'action' => 'login_blocked_legacy_credential',
                    'summary' => "Sign-in blocked for {$user['email']}: credential predates the PHP migration and must be reset"
                ]);
                Router::sendJson(409, [
                    'ok' => false,
                    'error' => 'This account was migrated from the previous system and its password must be reset before sign-in. Run: php backend_php/bin/setup_admin.php --email=' . $user['email'],
                    'requires_password_reset' => true
                ]);
                return true;
            }

            if (!Auth::verifyPassword($password, $user['password_hash'], $user['password_salt'] ?? null)) {
                Connection::recordAuditLog($pdo, [
                    'actorLabel' => $user['email'],
                    'entityType' => 'session',
                    'entityId' => (string)$user['user_id'],
                    'action' => 'login_failed',
                    'summary' => "Failed CRM sign-in for {$user['email']} from {$clientIp}"
                ]);
                Router::sendJson(401, ['ok' => false, 'error' => 'Invalid email or password']);
                return true;
            }

            // Upgrade the stored digest if PHP's preferred algorithm has moved on.
            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?')
                    ->execute([Auth::hashPassword($password), (int)$user['user_id']]);
            }

            Auth::clearAttempts($pdo, 'login_ip', $clientIp);
            Auth::clearAttempts($pdo, 'login_user', mb_strtolower($email, 'UTF-8'));

            $session = Auth::createSession($pdo, (int)$user['user_id'], $clientIp);

            Connection::recordAuditLog($pdo, [
                'actorUserId' => (int)$user['user_id'],
                'actorLabel' => $user['email'],
                'entityType' => 'session',
                'entityId' => substr($session['sessionId'], 0, 12),
                'action' => 'advisor_login',
                'summary' => "{$user['full_name']} signed into the CRM from {$clientIp}"
            ]);
            $cookieHeader = Auth::buildSessionCookie($session['sessionId'], Config::SESSION_TTL_HOURS * 3600);

            Router::sendJson(200, [
                'ok' => true,
                'authenticated' => true,
                'user' => [
                    'user_id' => (int)$user['user_id'],
                    'email' => $user['email'],
                    'full_name' => $user['full_name'],
                    'role' => $user['role']
                ],
                'csrfToken' => $session['csrfToken'],
                'csrf_token' => $session['csrfToken'],
                'session_id' => $session['sessionId']
            ], ['Set-Cookie' => $cookieHeader]);
            return true;
        }

        if ($path === '/api/crm/auth/logout' && $method === 'POST') {
            $router->destroySession();
            $expiredCookie = Auth::buildSessionCookie('', 0);
            Router::sendJson(200, ['ok' => true], ['Set-Cookie' => $expiredCookie]);
            return true;
        }

        if ($path === '/api/crm/auth/session' && $method === 'GET') {
            $session = $router->getSession();
            if (!$session) {
                Router::sendJson(401, ['ok' => false, 'authenticated' => false, 'error' => 'Not authenticated']);
                return true;
            }

            Router::sendJson(200, [
                'ok' => true,
                'authenticated' => true,
                'user' => [
                    'user_id' => (int)$session['user_id'],
                    'email' => $session['email'],
                    'full_name' => $session['full_name'],
                    'role' => $session['role']
                ],
                'csrfToken' => $session['csrf_token'],
                'csrf_token' => $session['csrf_token']
            ]);
            return true;
        }

        // --------------------------------------------------------------------
        // All subsequent CRM endpoints require valid authentication!
        // --------------------------------------------------------------------
        if (!str_starts_with($path, '/api/crm/')) {
            return false;
        }

        $session = $router->requireAuth();
        $userRole = $session['role'];
        $userId = (int)$session['user_id'];
        $userLabel = $session['full_name'];

        // Enforce CSRF on mutating methods
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $router->requireCsrf($session);
        }

        // --------------------------------------------------------------------
        // Dashboard
        // --------------------------------------------------------------------
        if ($path === '/api/crm/dashboard' && $method === 'GET') {
            $pubCounts = $pdo->query('SELECT publication_state, COUNT(*) as c FROM properties GROUP BY publication_state')->fetchAll();
            $availCounts = $pdo->query('SELECT availability_state, COUNT(*) as c FROM properties GROUP BY availability_state')->fetchAll();
            $leadCounts = $pdo->query('SELECT stage, COUNT(*) as count FROM leads GROUP BY stage')->fetchAll();

            $thirtyDaysAhead = gmdate('Y-m-d', strtotime('+30 days'));
            $invStmt = $pdo->prepare("
                SELECT
                    COUNT(*) AS total_master,
                    SUM(CASE WHEN publication_state = 'approved_public' AND availability_state = 'available' THEN 1 ELSE 0 END) AS live_public,
                    SUM(CASE WHEN publication_state = 'private_off_market' AND availability_state = 'available' THEN 1 ELSE 0 END) AS off_market,
                    SUM(CASE WHEN publication_state = 'pending_approval' THEN 1 ELSE 0 END) AS pending_approval,
                    SUM(CASE WHEN availability_state IN ('sold', 'leased', 'under_offer') THEN 1 ELSE 0 END) AS closed_or_offer,
                    SUM(CASE WHEN verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (next_reverify_due IS NOT NULL AND next_reverify_due <= ?) THEN 1 ELSE 0 END) AS reverify_due
                FROM properties
            ");
            $invStmt->execute([$thirtyDaysAhead]);
            $invRaw = $invStmt->fetch() ?: [];
            $inventory = [
                'total_master' => (int)($invRaw['total_master'] ?? 0),
                'live_public' => (int)($invRaw['live_public'] ?? 0),
                'off_market' => (int)($invRaw['off_market'] ?? 0),
                'pending_approval' => (int)($invRaw['pending_approval'] ?? 0),
                'closed_or_offer' => (int)($invRaw['closed_or_offer'] ?? 0),
                'reverify_due' => (int)($invRaw['reverify_due'] ?? 0)
            ];

            $pipeline = array_map(fn($r) => [
                'stage' => $r['stage'],
                'count' => (int)$r['count']
            ], $leadCounts);

            $recentLeads = $pdo->query('
                SELECT lead_id, lead_title, client_name, client_phone, stage, priority, intent,
                       preferred_location, budget_text, source_channel, primary_property_id, created_at
                FROM leads
                ORDER BY created_at DESC
                LIMIT 8
            ')->fetchAll();

            $pendingApprovals = $pdo->query("
                SELECT p.property_id, p.listing_title, p.project_name, p.corridor, p.category,
                       p.price_text, p.price_inr_norm, pv.broker_name_cache, pv.broker_phone_cache,
                       pv.source_group_name, p.created_at
                FROM properties p
                LEFT JOIN property_private pv ON pv.property_id = p.property_id
                WHERE p.publication_state = 'pending_approval'
                ORDER BY p.updated_at DESC
                LIMIT 10
            ")->fetchAll();

            $revQueueStmt = $pdo->prepare("
                SELECT property_id, listing_title, corridor, category, last_verified, next_reverify_due, verification_status
                FROM properties
                WHERE availability_state = 'available'
                  AND (verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (next_reverify_due IS NOT NULL AND next_reverify_due <= ?))
                ORDER BY COALESCE(next_reverify_due, '1970-01-01') ASC
                LIMIT 10
            ");
            $revQueueStmt->execute([$thirtyDaysAhead]);
            $reverifyQueue = $revQueueStmt->fetchAll();

            $recentActivities = $pdo->query('
                SELECT a.*, u.full_name AS actor_name
                FROM crm_activities a
                LEFT JOIN users u ON u.user_id = a.actor_user_id
                ORDER BY a.activity_id DESC
                LIMIT 10
            ')->fetchAll();

            Router::sendJson(200, [
                'ok' => true,
                'inventory' => $inventory,
                'pipeline' => $pipeline,
                'recentLeads' => $recentLeads,
                'pendingApprovals' => $pendingApprovals,
                'reverifyQueue' => $reverifyQueue,
                'publication_counts' => array_column($pubCounts, 'c', 'publication_state'),
                'availability_counts' => array_column($availCounts, 'c', 'availability_state'),
                'lead_counts' => array_column($leadCounts, 'count', 'stage'),
                'reverify_due_count' => $inventory['reverify_due'],
                'recent_activities' => $recentActivities
            ]);
            return true;
        }

        // --------------------------------------------------------------------
        // Properties CRUD & Management
        // --------------------------------------------------------------------
        if ($path === '/api/crm/properties' && $method === 'GET') {
            $res = SearchEngine::searchCrmProperties($pdo, $_GET);
            Router::sendJson(200, [
                'ok' => true,
                'total' => $res['total'],
                'items' => $res['items']
            ]);
            return true;
        }

        if ($path === '/api/crm/properties' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();

            try {
                $saved = Connection::withTransaction($pdo, fn(PDO $db) => self::upsertPropertyMaster($db, $body, $session, null));
                Router::sendJson(201, [
                    'ok' => true,
                    'property_id' => $saved['public']['property_id'],
                    'item' => $saved['public']
                ]);
            } catch (\Throwable $e) {
                $code = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int)$e->getCode() : 400;
                Router::sendJson($code, ['ok' => false, 'error' => $e->getMessage()]);
            }
            return true;
        }

        // Property detail & actions: /api/crm/properties/{id}
        if (preg_match('#^/api/crm/properties/([A-Za-z0-9-]+)(?:/(approve|reverify))?$#', $path, $m)) {
            $propId = $m[1];
            $action = $m[2] ?? null;

            // Approve action
            if ($action === 'approve' && $method === 'POST') {
                $router->requireRole(['principal'], $session);

                $chk = $pdo->prepare('SELECT * FROM properties WHERE property_id = ?');
                $chk->execute([$propId]);
                $current = $chk->fetch();
                if (!$current) {
                    Router::sendJson(404, ['ok' => false, 'error' => "Property not found: {$propId}"]);
                    return true;
                }
                if ($current['publication_state'] === 'archived') {
                    Router::sendJson(409, [
                        'ok' => false,
                        'error' => "Property {$propId} is archived. Restore it to draft before approving it for the public catalogue."
                    ]);
                    return true;
                }

                // Validate through the Fiduciary Privacy Gate before allowing approved_public
                // so a draft carrying leaked phone numbers, commission terms, or cheque notes
                // cannot enter approved_public and poison the static feed publisher.
                $gateCheck = PrivacyGate::validateAndProjectPublicRecord(array_merge($current, [
                    'publication_state' => 'approved_public',
                    'availability_state' => 'available'
                ]));
                if (!$gateCheck['ok']) {
                    Router::sendJson(422, [
                        'ok' => false,
                        'error' => "Fiduciary Privacy Gate blocked public approval:\n" . implode("\n", $gateCheck['errors']),
                        'validationErrors' => $gateCheck['errors']
                    ]);
                    return true;
                }

                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
                $up = $pdo->prepare('
                    UPDATE properties
                    SET publication_state = \'approved_public\',
                        approved_by_user_id = ?,
                        approved_at = ?,
                        updated_at = ?
                    WHERE property_id = ?
                ');
                $up->execute([$userId, $nowIso, $nowIso, $propId]);

                Connection::recordAuditLog($pdo, [
                    'actorUserId' => $userId,
                    'actorLabel' => $userLabel,
                    'entityType' => 'property',
                    'entityId' => $propId,
                    'action' => 'approve_property',
                    'summary' => "Approved property {$propId} for public catalogue"
                ]);

                Router::sendJson(200, ['ok' => true, 'property_id' => $propId, 'publication_state' => 'approved_public']);
                return true;
            }

            // Re-verify action
            if ($action === 'reverify' && $method === 'POST') {
                $router->requireRole(['principal', 'advisor'], $session);

                $chk = $pdo->prepare('SELECT 1 FROM properties WHERE property_id = ?');
                $chk->execute([$propId]);
                if (!$chk->fetch()) {
                    Router::sendJson(404, ['ok' => false, 'error' => "Property not found: {$propId}"]);
                    return true;
                }

                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
                $today = gmdate('Y-m-d');
                $nextDue = gmdate('Y-m-d', strtotime('+120 days'));

                $up = $pdo->prepare('
                    UPDATE properties
                    SET verification_state = \'recently_reverified\',
                        verification_status = \'Recently re-verified\',
                        last_verified = ?,
                        next_reverify_due = ?,
                        updated_at = ?
                    WHERE property_id = ?
                ');
                $up->execute([$today, $nextDue, $nowIso, $propId]);

                Connection::recordAuditLog($pdo, [
                    'actorUserId' => $userId,
                    'actorLabel' => $userLabel,
                    'entityType' => 'property',
                    'entityId' => $propId,
                    'action' => 'reverify_property',
                    'summary' => "Re-verified property {$propId} (next due {$nextDue})"
                ]);

                Router::sendJson(200, [
                    'ok' => true,
                    'property_id' => $propId,
                    'verification_state' => 'recently_reverified',
                    'verification_status' => 'Recently re-verified',
                    'last_verified' => $today,
                    'next_reverify_due' => $nextDue
                ]);
                return true;
            }

            // GET single property detail
            if (!$action && $method === 'GET') {
                $stmt = $pdo->prepare('
                    SELECT p.*, pv.*
                    FROM properties p
                    LEFT JOIN property_private pv ON pv.property_id = p.property_id
                    WHERE p.property_id = ?
                ');
                $stmt->execute([$propId]);
                $prop = $stmt->fetch();

                if (!$prop) {
                    Router::sendJson(404, ['ok' => false, 'error' => 'Property not found']);
                    return true;
                }

                $prop['display_price'] = Normalizer::formatPublicPriceDisplay($prop);
                $prop['floor_price_display'] = !empty($prop['internal_floor_price_inr']) ? Normalizer::formatInr($prop['internal_floor_price_inr']) : null;

                $auditStmt = $pdo->prepare('SELECT * FROM audit_logs WHERE entity_type = \'property\' AND entity_id = ? ORDER BY audit_id DESC LIMIT 20');
                $auditStmt->execute([$propId]);
                $audit = $auditStmt->fetchAll();

                Router::sendJson(200, [
                    'ok' => true,
                    'item' => $prop,
                    'property' => $prop,
                    'auditHistory' => $audit,
                    'audit' => $audit
                ]);
                return true;
            }

            // PUT / PATCH update property
            if (!$action && in_array($method, ['PUT', 'PATCH'], true)) {
                $router->requireRole(['principal', 'advisor'], $session);
                $body = $router->getJsonBody();

                try {
                    $saved = Connection::withTransaction($pdo, fn(PDO $db) => self::upsertPropertyMaster($db, $body, $session, $propId));
                    Router::sendJson(200, [
                        'ok' => true,
                        'property_id' => $propId,
                        'item' => $saved['public']
                    ]);
                } catch (\Throwable $e) {
                    $code = ($e->getCode() >= 400 && $e->getCode() < 500) ? (int)$e->getCode() : 400;
                    Router::sendJson($code, ['ok' => false, 'error' => $e->getMessage()]);
                }
                return true;
            }
        }

        // --------------------------------------------------------------------
        // CRM Intake (WhatsApp & Tabular Import)
        // --------------------------------------------------------------------
        if ($path === '/api/crm/intake/whatsapp' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();
            $rawText = trim($body['rawText'] ?? $body['raw_text'] ?? $body['message'] ?? '');

            if (!$rawText) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Message text is required']);
                return true;
            }

            try {
                $parsed = IntakeParser::parseWhatsAppBroadcast($rawText, [
                    'sourceGroup' => $body['sourceGroup'] ?? $body['source_group'] ?? 'WhatsApp Broadcast Intake'
                ]);
            } catch (\Throwable $e) {
                Router::sendJson(400, ['ok' => false, 'error' => $e->getMessage()]);
                return true;
            }

            // If commit is requested, save directly as draft via upsertPropertyMaster
            if (!empty($body['commit'])) {
                $draft = $parsed['publicDraft'];
                $vault = $parsed['privateVault'];
                $propId = Connection::allocatePrefixedId($pdo, 'properties', 'property_id', 'AUM-DRF');

                $saved = Connection::withTransaction($pdo, function (PDO $db) use ($propId, $draft, $vault, $session) {
                    return self::upsertPropertyMaster(
                        $db,
                        [
                            'public' => array_merge($draft, ['property_id' => $propId, 'publication_state' => 'pending_approval']),
                            'private' => $vault
                        ],
                        $session,
                        null
                    );
                });

                $parsed['property_id'] = $propId;
                $parsed['item'] = $saved['public'];
            }

            Router::sendJson(200, array_merge(['ok' => true], $parsed));
            return true;
        }

        // Tabular & Spreadsheet Import: /api/crm/intake/import
        if ($path === '/api/crm/intake/import' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();

            try {
                $rawRows = IntakeParser::parseImportPayload([
                    'format' => $body['format'] ?? '',
                    'contentBase64' => $body['contentBase64'] ?? $body['content_base64'] ?? '',
                    'text' => $body['text'] ?? null
                ]);
            } catch (\Throwable $e) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Malformed import payload: ' . $e->getMessage()]);
                return true;
            }

            if (empty($rawRows)) {
                Router::sendJson(400, ['ok' => false, 'error' => 'No data rows found in import file']);
                return true;
            }

            $existingIds = [];
            $stmt = $pdo->query('SELECT property_id FROM properties');
            while ($row = $stmt->fetch(PDO::FETCH_COLUMN)) {
                $existingIds[$row] = true;
            }

            $countStmt = $pdo->query('SELECT COUNT(*) FROM properties');
            $nextNum = (int)$countStmt->fetchColumn() + 500;

            $normalizedBatch = [];
            $issues = [];
            $seenBatchIds = [];

            $idx = 0;
            foreach ($rawRows as $rawRow) {
                $idx++;
                $nextNum++;
                $fallbackId = sprintf('AUM-IMP-%06d', $nextNum);
                $res = IntakeParser::normalizeImportedRow($rawRow, $fallbackId);
                $pub = $res['publicRecord'];
                $priv = $res['privateRecord'];

                if (!preg_match(Config::PROPERTY_ID_REGEX, $pub['property_id'])) {
                    $issues[] = "Row #{$idx}: Invalid property_id \"{$pub['property_id']}\"";
                    continue;
                }
                if (isset($seenBatchIds[$pub['property_id']])) {
                    $issues[] = "Row #{$idx}: Duplicate property_id \"{$pub['property_id']}\" inside file";
                    continue;
                }
                $seenBatchIds[$pub['property_id']] = true;

                if ($pub['publication_state'] === 'approved_public' && $session['role'] !== 'principal') {
                    $pub['publication_state'] = 'pending_approval';
                }

                if ($pub['publication_state'] === 'approved_public') {
                    $chk = PrivacyGate::validateAndProjectPublicRecord(array_merge($pub, ['availability_state' => 'available']));
                    if (!$chk['ok']) {
                        $pub['publication_state'] = 'pending_approval';
                        $firstErr = $chk['errors'][0] ?? 'Privacy gate check failed';
                        $issues[] = "Row #{$idx} ({$pub['property_id']}) demoted to pending_approval: {$firstErr}";
                    }
                }

                $normalizedBatch[] = [
                    'isUpdate' => isset($existingIds[$pub['property_id']]),
                    'publicRecord' => $pub,
                    'privateRecord' => $priv
                ];
            }

            $summary = [
                'totalParsed' => count($rawRows),
                'validRecords' => count($normalizedBatch),
                'newCount' => count(array_filter($normalizedBatch, fn($x) => !$x['isUpdate'])),
                'updateCount' => count(array_filter($normalizedBatch, fn($x) => $x['isUpdate'])),
                'privateVaultPopulated' => count(array_filter($normalizedBatch, fn($x) =>
                    !empty($x['privateRecord']['owner_name_cache']) ||
                    !empty($x['privateRecord']['owner_phone_cache']) ||
                    !empty($x['privateRecord']['broker_phone_cache']) ||
                    !empty($x['privateRecord']['payment_structure_notes'])
                )),
                'issues' => $issues
            ];

            $dryRun = ($body['dryRun'] ?? $body['dry_run'] ?? true) !== false;
            if ($dryRun) {
                Router::sendJson(200, [
                    'ok' => true,
                    'dryRun' => true,
                    'summary' => $summary,
                    'preview' => array_slice($normalizedBatch, 0, 8)
                ]);
                return true;
            }

            if (count($normalizedBatch) !== count($rawRows)) {
                Router::sendJson(422, [
                    'ok' => false,
                    'error' => 'Import contains invalid rows; no changes committed',
                    'summary' => $summary
                ]);
                return true;
            }

            Connection::withTransaction($pdo, function (PDO $db) use ($normalizedBatch, $session) {
                foreach ($normalizedBatch as $entry) {
                    self::upsertPropertyMaster(
                        $db,
                        ['public' => $entry['publicRecord'], 'private' => $entry['privateRecord']],
                        $session,
                        $entry['isUpdate'] ? $entry['publicRecord']['property_id'] : null
                    );
                }
            });

            Router::sendJson(200, ['ok' => true, 'dryRun' => false, 'summary' => $summary]);
            return true;
        }

        // --------------------------------------------------------------------
        // Contacts
        // --------------------------------------------------------------------
        if ($path === '/api/crm/contacts' && $method === 'GET') {
            $type = $_GET['type'] ?? '';
            $q = trim((string)($_GET['q'] ?? ''));

            $where = ['1 = 1'];
            $params = [];
            if ($type && $type !== 'all') {
                $where[] = 'contact_type = ?';
                $params[] = $type;
            }
            if ($q) {
                $where[] = '(LOWER(full_name) LIKE ? OR phone_norm LIKE ? OR LOWER(COALESCE(email, \'\')) LIKE ?)';
                $params[] = "%{$q}%";
                $params[] = "%{$q}%";
                $params[] = "%{$q}%";
            }

            $stmt = $pdo->prepare("
                SELECT c.*,
                       (SELECT COUNT(*) FROM property_private pv WHERE pv.owner_contact_id = c.contact_id OR pv.broker_contact_id = c.contact_id) AS linked_properties,
                       (SELECT COUNT(*) FROM leads l WHERE l.contact_id = c.contact_id) AS linked_leads
                FROM contacts c
                WHERE " . implode(' AND ', $where) . "
                ORDER BY c.updated_at DESC
                LIMIT 200
            ");
            $stmt->execute($params);
            $items = $stmt->fetchAll();
            Router::sendJson(200, ['ok' => true, 'items' => $items, 'contacts' => $items]);
            return true;
        }

        if ($path === '/api/crm/contacts' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();

            $name = Normalizer::cleanWhitespace($body['full_name'] ?? '');
            if (!$name) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Full name is required']);
                return true;
            }

            // Every free-text key is normalised to NULL when blank. An empty string
            // here would later collide with unrelated people during enquiry
            // de-duplication, so '' must never reach the contacts table.
            $contactType = Normalizer::cleanWhitespace((string)($body['contact_type'] ?? '')) ?? 'buyer';
            if (!in_array($contactType, Config::CONTACT_TYPES, true)) {
                Router::sendJson(400, [
                    'ok' => false,
                    'error' => "Unknown contact type '{$contactType}'. Permitted: " . implode(', ', Config::CONTACT_TYPES)
                ]);
                return true;
            }

            $contactId = Connection::allocatePrefixedId($pdo, 'contacts', 'contact_id', 'CNT');
            $phone = Normalizer::cleanWhitespace($body['phone_primary'] ?? null);
            $phoneNorm = $phone ? substr(preg_replace('/\D/', '', $phone), -10) : null;
            if ($phoneNorm === '') {
                $phoneNorm = null;
            }
            $contactEmail = Normalizer::cleanWhitespace($body['email'] ?? null);
            $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

            $stmt = $pdo->prepare('
                INSERT INTO contacts (
                    contact_id, contact_type, full_name, firm_or_syndicate, phone_primary,
                    phone_norm, email, city, preferred_channel, trust_tier, private_notes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([
                $contactId,
                $contactType,
                $name,
                Normalizer::cleanWhitespace($body['firm_or_syndicate'] ?? null),
                $phone,
                $phoneNorm,
                $contactEmail,
                Normalizer::cleanWhitespace($body['city'] ?? null) ?? 'Gurgaon',
                Normalizer::cleanWhitespace($body['preferred_channel'] ?? null) ?? 'whatsapp',
                Normalizer::cleanWhitespace($body['trust_tier'] ?? null) ?? 'standard',
                Normalizer::cleanWhitespace($body['private_notes'] ?? null),
                $nowIso,
                $nowIso
            ]);

            Connection::recordAuditLog($pdo, [
                'actorUserId' => $userId,
                'actorLabel' => $userLabel,
                'entityType' => 'contact',
                'entityId' => $contactId,
                'action' => 'create_contact',
                'summary' => "Added {$contactType} contact: {$name}"
            ]);

            Router::sendJson(201, ['ok' => true, 'contact_id' => $contactId]);
            return true;
        }

        if (preg_match('#^/api/crm/contacts/([A-Za-z0-9-]+)$#', $path, $m) && in_array($method, ['PUT', 'PATCH'], true)) {
            $router->requireRole(['principal', 'advisor'], $session);
            $contactId = $m[1];
            $body = $router->getJsonBody();

            $chk = $pdo->prepare('SELECT * FROM contacts WHERE contact_id = ?');
            $chk->execute([$contactId]);
            $existingContact = $chk->fetch();
            if (!$existingContact) {
                Router::sendJson(404, ['ok' => false, 'error' => "Contact not found: {$contactId}"]);
                return true;
            }

            $name = array_key_exists('full_name', $body)
                ? Normalizer::cleanWhitespace((string)$body['full_name'])
                : $existingContact['full_name'];
            if (!$name) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Full name is required']);
                return true;
            }

            $contactType = array_key_exists('contact_type', $body)
                ? (Normalizer::cleanWhitespace((string)$body['contact_type']) ?? $existingContact['contact_type'])
                : $existingContact['contact_type'];
            if (!in_array($contactType, Config::CONTACT_TYPES, true)) {
                Router::sendJson(400, [
                    'ok' => false,
                    'error' => "Unknown contact type '{$contactType}'. Permitted: " . implode(', ', Config::CONTACT_TYPES)
                ]);
                return true;
            }

            $phone = array_key_exists('phone_primary', $body)
                ? Normalizer::cleanWhitespace($body['phone_primary'])
                : $existingContact['phone_primary'];
            $phoneNorm = $phone ? substr(preg_replace('/\D/', '', $phone), -10) : null;
            if ($phoneNorm === '') {
                $phoneNorm = null;
            }
            $contactEmail = array_key_exists('email', $body)
                ? Normalizer::cleanWhitespace($body['email'])
                : $existingContact['email'];
            $firm = array_key_exists('firm_or_syndicate', $body)
                ? Normalizer::cleanWhitespace($body['firm_or_syndicate'])
                : (array_key_exists('firm_name', $body) ? Normalizer::cleanWhitespace($body['firm_name']) : $existingContact['firm_or_syndicate']);
            $trustTier = array_key_exists('trust_tier', $body)
                ? (Normalizer::cleanWhitespace($body['trust_tier']) ?? $existingContact['trust_tier'])
                : $existingContact['trust_tier'];
            $notes = array_key_exists('private_notes', $body)
                ? Normalizer::cleanWhitespace($body['private_notes'])
                : $existingContact['private_notes'];
            $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

            $up = $pdo->prepare('
                UPDATE contacts
                SET contact_type = ?, full_name = ?, firm_or_syndicate = ?, phone_primary = ?,
                    phone_norm = ?, email = ?, trust_tier = ?, private_notes = ?, updated_at = ?
                WHERE contact_id = ?
            ');
            $up->execute([$contactType, $name, $firm, $phone, $phoneNorm, $contactEmail, $trustTier, $notes, $nowIso, $contactId]);

            $chk->execute([$contactId]);
            $updatedContact = $chk->fetch();

            Connection::recordAuditLog($pdo, [
                'actorUserId' => $userId,
                'actorLabel' => $userLabel,
                'entityType' => 'contact',
                'entityId' => $contactId,
                'action' => 'update_contact',
                'summary' => "Updated {$contactType} contact: {$name}"
            ]);

            Router::sendJson(200, ['ok' => true, 'contact_id' => $contactId, 'contact' => $updatedContact]);
            return true;
        }

        // --------------------------------------------------------------------
        // Leads & Pipeline
        // --------------------------------------------------------------------
        if ($path === '/api/crm/leads' && $method === 'GET') {
            $stage = $_GET['stage'] ?? '';
            $q = trim((string)($_GET['q'] ?? ''));

            $where = ['1 = 1'];
            $params = [];
            if ($stage && $stage !== 'all') {
                $where[] = 'l.stage = ?';
                $params[] = $stage;
            }
            if ($q) {
                $where[] = '(LOWER(l.client_name) LIKE ? OR LOWER(l.lead_title) LIKE ? OR l.client_phone LIKE ?)';
                $params[] = "%{$q}%";
                $params[] = "%{$q}%";
                $params[] = "%{$q}%";
            }

            $stmt = $pdo->prepare("
                SELECT l.*, p.listing_title AS primary_property_title, c.firm_or_syndicate, u.full_name AS assigned_to_name
                FROM leads l
                LEFT JOIN properties p ON p.property_id = l.primary_property_id
                LEFT JOIN contacts c ON c.contact_id = l.contact_id
                LEFT JOIN users u ON u.user_id = l.assigned_user_id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY l.updated_at DESC
                LIMIT 200
            ");
            $stmt->execute($params);
            $leads = $stmt->fetchAll();
            Router::sendJson(200, ['ok' => true, 'items' => $leads, 'leads' => $leads]);
            return true;
        }

        if ($path === '/api/crm/leads' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();
            $clientName = Normalizer::cleanWhitespace($body['client_name'] ?? $body['full_name'] ?? '');
            if (!$clientName) {
                Router::sendJson(400, ['ok' => false, 'error' => 'client_name is required']);
                return true;
            }

            $leadId = Connection::allocatePrefixedId($pdo, 'leads', 'lead_id', 'LEAD-2026');
            $intent = Normalizer::cleanWhitespace($body['intent'] ?? $body['deal_intent'] ?? 'Buy') ?: 'Buy';
            $prefLoc = Normalizer::cleanWhitespace($body['preferred_location'] ?? 'Gurugram') ?: 'Gurugram';
            $leadTitle = Normalizer::cleanWhitespace($body['lead_title'] ?? "{$clientName} — {$intent} ({$prefLoc})");

            $stage = in_array($body['stage'] ?? $body['lead_stage'] ?? '', Config::LEAD_STAGES, true) ? ($body['stage'] ?? $body['lead_stage']) : 'new_inquiry';
            $priority = in_array($body['priority'] ?? '', ['high', 'normal', 'low'], true) ? $body['priority'] : 'normal';
            $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

            Connection::withTransaction($pdo, function (PDO $db) use (
                $leadId, $leadTitle, $clientName, $body, $stage, $priority, $intent, $prefLoc,
                $userId, $userLabel, $nowIso
            ) {
                $insLead = $db->prepare('
                    INSERT INTO leads (
                        lead_id, contact_id, lead_title, client_name, client_phone, client_email,
                        stage, priority, intent, preferred_location, budget_text,
                        source_channel, assigned_user_id, inquiry_message, next_followup_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
                $insLead->execute([
                    $leadId,
                    $body['contact_id'] ?? null,
                    $leadTitle,
                    $clientName,
                    Normalizer::cleanWhitespace($body['phone'] ?? $body['client_phone'] ?? ''),
                    Normalizer::cleanWhitespace($body['email'] ?? $body['client_email'] ?? ''),
                    $stage,
                    $priority,
                    $intent,
                    $prefLoc,
                    Normalizer::cleanWhitespace($body['budget_text'] ?? ''),
                    Normalizer::cleanWhitespace($body['source_channel'] ?? 'advisor_desk') ?: 'advisor_desk',
                    $userId,
                    Normalizer::cleanWhitespace($body['inquiry_message'] ?? ''),
                    Normalizer::cleanWhitespace($body['next_followup_at'] ?? ''),
                    $nowIso,
                    $nowIso
                ]);

                $reqId = Connection::allocatePrefixedId($db, 'buyer_requirements', 'requirement_id', 'REQ-2026');
                $insReq = $db->prepare('
                    INSERT INTO buyer_requirements (
                        requirement_id, lead_id, contact_id, intent, corridors_json, categories_json,
                        min_bedrooms, min_budget_inr, max_budget_inr, min_area_sqft, include_off_market,
                        must_have_notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                ');
                $insReq->execute([
                    $reqId,
                    $leadId,
                    $body['contact_id'] ?? null,
                    $intent,
                    json_encode($body['corridors'] ?? [], JSON_UNESCAPED_SLASHES),
                    json_encode($body['categories'] ?? [], JSON_UNESCAPED_SLASHES),
                    !empty($body['min_bedrooms']) ? (int)$body['min_bedrooms'] : null,
                    !empty($body['min_budget_inr']) ? (int)$body['min_budget_inr'] : null,
                    !empty($body['max_budget_inr']) ? (int)$body['max_budget_inr'] : null,
                    !empty($body['min_area_sqft']) ? (int)$body['min_area_sqft'] : null,
                    Normalizer::cleanWhitespace($body['inquiry_message'] ?? ''),
                    $nowIso,
                    $nowIso
                ]);

                $insAct = $db->prepare('
                    INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id, created_at)
                    VALUES (?, \'lead_created\', ?, ?, ?)
                ');
                $insAct->execute([$leadId, "Lead registered by {$userLabel}", $userId, $nowIso]);

                Connection::recordAuditLog($db, [
                    'actorUserId' => $userId,
                    'actorLabel' => $userLabel,
                    'entityType' => 'lead',
                    'entityId' => $leadId,
                    'action' => 'create_lead',
                    'summary' => "Registered lead {$leadId} ({$clientName})"
                ]);
            });

            $itemStmt = $pdo->prepare('SELECT * FROM leads WHERE lead_id = ?');
            $itemStmt->execute([$leadId]);
            $createdLead = $itemStmt->fetch();

            Router::sendJson(201, ['ok' => true, 'lead_id' => $leadId, 'item' => $createdLead]);
            return true;
        }

        // Lead detail: /api/crm/leads/{id}
        if (preg_match('#^/api/crm/leads/([A-Za-z0-9-]+)(?:/(activities|requirements?|match))?$#', $path, $m)) {
            $leadId = $m[1];
            $sub = $m[2] ?? null;

            if ($sub === 'activities' && $method === 'POST') {
                $router->requireRole(['principal', 'advisor'], $session);
                $body = $router->getJsonBody();
                $summary = Normalizer::cleanWhitespace($body['summary'] ?? '');
                if (!$summary) {
                    Router::sendJson(400, ['ok' => false, 'error' => 'Activity summary is required']);
                    return true;
                }

                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
                $ins = $pdo->prepare('
                    INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ');
                $ins->execute([$leadId, $body['activity_type'] ?? 'note', $summary, $userId, $nowIso]);
                Router::sendJson(201, ['ok' => true]);
                return true;
            }

            if (str_starts_with((string)$sub, 'requirement') && in_array($method, ['POST', 'PUT'], true)) {
                $router->requireRole(['principal', 'advisor'], $session);
                $body = $router->getJsonBody();
                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

                $existingReqStmt = $pdo->prepare('SELECT requirement_id FROM buyer_requirements WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1');
                $existingReqStmt->execute([$leadId]);
                $existingReq = $existingReqStmt->fetch();

                if ($existingReq) {
                    $reqId = $existingReq['requirement_id'];
                    $upReq = $pdo->prepare('
                        UPDATE buyer_requirements SET
                            intent = ?, corridors_json = ?, sectors_json = ?, categories_json = ?,
                            min_bedrooms = ?, min_budget_inr = ?, max_budget_inr = ?, min_area_sqft = ?,
                            max_area_sqft = ?, preferred_facing = ?, include_off_market = ?,
                            must_have_notes = ?, updated_at = ?
                        WHERE requirement_id = ?
                    ');
                    $upReq->execute([
                        $body['intent'] ?? 'Buy',
                        json_encode($body['corridors'] ?? [], JSON_UNESCAPED_SLASHES),
                        json_encode($body['sectors'] ?? [], JSON_UNESCAPED_SLASHES),
                        json_encode($body['categories'] ?? [], JSON_UNESCAPED_SLASHES),
                        !empty($body['min_bedrooms']) ? (int)$body['min_bedrooms'] : null,
                        !empty($body['min_budget_inr']) ? (int)$body['min_budget_inr'] : null,
                        !empty($body['max_budget_inr']) ? (int)$body['max_budget_inr'] : null,
                        !empty($body['min_area_sqft']) ? (int)$body['min_area_sqft'] : null,
                        !empty($body['max_area_sqft']) ? (int)$body['max_area_sqft'] : null,
                        $body['preferred_facing'] ?? null,
                        isset($body['include_off_market']) ? (int)(bool)$body['include_off_market'] : 1,
                        $body['must_have_notes'] ?? null,
                        $nowIso,
                        $reqId
                    ]);
                } else {
                    $reqId = Connection::allocatePrefixedId($pdo, 'buyer_requirements', 'requirement_id', 'REQ-2026');
                    $ins = $pdo->prepare('
                        INSERT INTO buyer_requirements (
                            requirement_id, lead_id, intent, corridors_json, sectors_json, categories_json,
                            min_bedrooms, min_budget_inr, max_budget_inr, min_area_sqft, max_area_sqft,
                            preferred_facing, include_off_market, must_have_notes, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ');
                    $ins->execute([
                        $reqId,
                        $leadId,
                        $body['intent'] ?? 'Buy',
                        json_encode($body['corridors'] ?? [], JSON_UNESCAPED_SLASHES),
                        json_encode($body['sectors'] ?? [], JSON_UNESCAPED_SLASHES),
                        json_encode($body['categories'] ?? [], JSON_UNESCAPED_SLASHES),
                        !empty($body['min_bedrooms']) ? (int)$body['min_bedrooms'] : null,
                        !empty($body['min_budget_inr']) ? (int)$body['min_budget_inr'] : null,
                        !empty($body['max_budget_inr']) ? (int)$body['max_budget_inr'] : null,
                        !empty($body['min_area_sqft']) ? (int)$body['min_area_sqft'] : null,
                        !empty($body['max_area_sqft']) ? (int)$body['max_area_sqft'] : null,
                        $body['preferred_facing'] ?? null,
                        isset($body['include_off_market']) ? (int)(bool)$body['include_off_market'] : 1,
                        $body['must_have_notes'] ?? null,
                        $nowIso,
                        $nowIso
                    ]);
                }

                $savedReqStmt = $pdo->prepare('SELECT * FROM buyer_requirements WHERE requirement_id = ?');
                $savedReqStmt->execute([$reqId]);
                $savedReq = $savedReqStmt->fetch();
                $matches = $savedReq ? SearchEngine::matchPropertiesForRequirement($pdo, $savedReq) : [];

                Router::sendJson(201, ['ok' => true, 'requirement_id' => $reqId, 'requirement' => $savedReq, 'matches' => $matches]);
                return true;
            }

            if ($sub === 'match' && in_array($method, ['GET', 'POST'], true)) {
                $reqStmt = $pdo->prepare('SELECT * FROM buyer_requirements WHERE lead_id = ? ORDER BY requirement_id DESC LIMIT 1');
                $reqStmt->execute([$leadId]);
                $req = $reqStmt->fetch();

                if (!$req) {
                    Router::sendJson(200, ['ok' => true, 'matches' => []]);
                    return true;
                }

                $matches = SearchEngine::matchPropertiesForRequirement($pdo, $req);
                Router::sendJson(200, ['ok' => true, 'matches' => $matches]);
                return true;
            }

            if (!$sub && $method === 'GET') {
                $stmt = $pdo->prepare('
                    SELECT l.*, c.full_name AS contact_name, c.phone_primary AS contact_phone,
                           u.full_name AS assigned_to_name
                    FROM leads l
                    LEFT JOIN contacts c ON c.contact_id = l.contact_id
                    LEFT JOIN users u ON u.user_id = l.assigned_user_id
                    WHERE l.lead_id = ?
                ');
                $stmt->execute([$leadId]);
                $lead = $stmt->fetch();
                if (!$lead) {
                    Router::sendJson(404, ['ok' => false, 'error' => 'Lead not found']);
                    return true;
                }

                $actStmt = $pdo->prepare('
                    SELECT a.*, u.full_name AS actor_name
                    FROM crm_activities a
                    LEFT JOIN users u ON u.user_id = a.actor_user_id
                    WHERE a.lead_id = ?
                    ORDER BY a.activity_id DESC
                ');
                $actStmt->execute([$leadId]);
                $activities = $actStmt->fetchAll();

                $reqStmt = $pdo->prepare('SELECT * FROM buyer_requirements WHERE lead_id = ? ORDER BY updated_at DESC, requirement_id DESC LIMIT 1');
                $reqStmt->execute([$leadId]);
                $requirement = $reqStmt->fetch() ?: null;

                $matches = $requirement ? SearchEngine::matchPropertiesForRequirement($pdo, $requirement) : [];

                if (!empty($lead['selected_questions_json'])) {
                    $decodedQ = json_decode((string)$lead['selected_questions_json'], true);
                    $lead['selected_questions'] = is_array($decodedQ) ? $decodedQ : [];
                } else {
                    $lead['selected_questions'] = [];
                }

                $slStmt = $pdo->prepare('SELECT * FROM client_shortlists WHERE lead_id = ? ORDER BY created_at DESC');
                $slStmt->execute([$leadId]);
                $shortlists = $slStmt->fetchAll();

                Router::sendJson(200, [
                    'ok' => true,
                    'lead' => $lead,
                    'activities' => $activities,
                    'requirement' => $requirement,
                    'matches' => $matches,
                    'shortlists' => $shortlists
                ]);
                return true;
            }

            if (!$sub && in_array($method, ['PATCH', 'PUT'], true)) {
                $router->requireRole(['principal', 'advisor'], $session);
                $body = $router->getJsonBody();

                $currStmt = $pdo->prepare('SELECT * FROM leads WHERE lead_id = ?');
                $currStmt->execute([$leadId]);
                $curr = $currStmt->fetch();
                if (!$curr) {
                    Router::sendJson(404, ['ok' => false, 'error' => 'Lead not found']);
                    return true;
                }

                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
                $up = $pdo->prepare('
                    UPDATE leads SET
                        stage = COALESCE(?, stage),
                        priority = COALESCE(?, priority),
                        assigned_user_id = COALESCE(?, assigned_user_id),
                        next_followup_at = COALESCE(?, next_followup_at),
                        lost_reason = COALESCE(?, lost_reason),
                        updated_at = ?
                    WHERE lead_id = ?
                ');
                $up->execute([
                    $body['stage'] ?? null,
                    $body['priority'] ?? null,
                    isset($body['assigned_user_id']) ? (int)$body['assigned_user_id'] : null,
                    $body['next_followup_at'] ?? null,
                    $body['lost_reason'] ?? null,
                    $nowIso,
                    $leadId
                ]);

                Router::sendJson(200, ['ok' => true, 'lead_id' => $leadId]);
                return true;
            }
        }

        // Direct requirement match endpoint: POST /api/crm/requirements/match
        if ($path === '/api/crm/requirements/match' && $method === 'POST') {
            $body = $router->getJsonBody();
            $matches = SearchEngine::matchPropertiesForRequirement($pdo, $body);
            Router::sendJson(200, ['ok' => true, 'matches' => $matches]);
            return true;
        }

        // --------------------------------------------------------------------
        // Shortlists
        // --------------------------------------------------------------------
        if ($path === '/api/crm/shortlists' && $method === 'GET') {
            $stmt = $pdo->query('
                SELECT
                    cs.*,
                    u.full_name AS created_by_name,
                    (SELECT COUNT(*) FROM shortlist_items si WHERE si.shortlist_id = cs.shortlist_id) AS item_count
                FROM client_shortlists cs
                LEFT JOIN users u ON u.user_id = cs.created_by_user_id
                ORDER BY cs.created_at DESC
                LIMIT 100
            ');
            Router::sendJson(200, ['ok' => true, 'shortlists' => $stmt->fetchAll()]);
            return true;
        }

        if ($path === '/api/crm/shortlists' && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $body = $router->getJsonBody();

            $clientName = Normalizer::cleanWhitespace($body['client_name'] ?? '');
            $title = Normalizer::cleanWhitespace($body['title'] ?? ($clientName ? "Exclusive Selection for {$clientName}" : 'Private Dossier'));
            $propIds = (array)($body['property_ids'] ?? []);

            if (empty($clientName)) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Client name is required']);
                return true;
            }
            if (empty($propIds)) {
                Router::sendJson(400, ['ok' => false, 'error' => 'Select at least one property for the client shortlist']);
                return true;
            }
            if (count($propIds) > 30) {
                Router::sendJson(400, ['ok' => false, 'error' => 'A shortlist may contain at most 30 properties']);
                return true;
            }

            $introNote = Normalizer::cleanWhitespace($body['advisor_intro_note'] ?? null);
            $commentaries = (array)($body['commentaries'] ?? []);
            try {
                Shortlist::assertClientText('title', $title);
                Shortlist::assertClientText('client_name', $clientName);
                Shortlist::assertClientText('advisor_intro_note', $introNote);
                foreach ($commentaries as $cText) {
                    Shortlist::assertClientText('advisor_commentary', (string)$cText);
                }
            } catch (\Throwable $e) {
                Router::sendJson(422, ['ok' => false, 'error' => $e->getMessage()]);
                return true;
            }

            $leadId = Normalizer::cleanWhitespace($body['lead_id'] ?? null);
            $contactId = Normalizer::cleanWhitespace($body['contact_id'] ?? null);

            // Verify up front that every chosen property can actually be disclosed.
            // The client viewer silently skips anything that fails the privacy gate,
            // so without this check an advisor is told the shortlist was sent while
            // the client quietly receives fewer properties than were selected.
            $rejected = [];
            $accepted = [];
            foreach ($propIds as $idx => $rawPid) {
                $pid = Normalizer::cleanWhitespace((string)$rawPid);
                if (!$pid) {
                    continue;
                }
                $pStmt = $pdo->prepare('SELECT * FROM properties WHERE property_id = ?');
                $pStmt->execute([$pid]);
                $pRow = $pStmt->fetch();
                if (!$pRow) {
                    $rejected[] = ['property_id' => $pid, 'reason' => 'No such property'];
                    continue;
                }
                $candidate = $pRow;
                $candidate['advisor_commentary'] = $commentaries[$pid] ?? null;
                try {
                    Shortlist::projectShortlistItem($candidate);
                    $accepted[] = $pid;
                } catch (\Throwable $e) {
                    $rejected[] = ['property_id' => $pid, 'reason' => $e->getMessage()];
                }
            }

            if (!empty($rejected)) {
                Router::sendJson(422, [
                    'ok' => false,
                    'error' => 'Some selected properties cannot be disclosed to a client. Remove or correct them, then send again.',
                    'rejected' => $rejected,
                    'shareable' => $accepted
                ]);
                return true;
            }

            $propIds = $accepted;

            $shortlistId = Connection::allocatePrefixedId($pdo, 'client_shortlists', 'shortlist_id', 'SL-2026');
            $shareToken = bin2hex(random_bytes(16)); // 32 chars URL-safe hex
            $expiresAt = gmdate('Y-m-d\TH:i:s.v\Z', strtotime('+30 days'));
            $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

            Connection::withTransaction($pdo, function (PDO $db) use (
                $shortlistId, $shareToken, $leadId, $contactId, $title, $clientName,
                $introNote, $userId, $expiresAt, $nowIso, $propIds, $commentaries, $userLabel
            ) {
                $insSl = $db->prepare('
                    INSERT INTO client_shortlists (
                        shortlist_id, share_token, lead_id, contact_id, title, client_name,
                        advisor_intro_note, created_by_user_id, is_active, expires_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ');
                $insSl->execute([
                    $shortlistId,
                    $shareToken,
                    $leadId,
                    $contactId,
                    $title,
                    $clientName,
                    $introNote,
                    $userId,
                    $expiresAt,
                    $nowIso
                ]);

                $insItem = $db->prepare('
                    INSERT INTO shortlist_items (shortlist_id, property_id, sort_order, advisor_commentary)
                    VALUES (?, ?, ?, ?)
                ');

                foreach ($propIds as $idx => $pid) {
                    $cText = $commentaries[$pid] ?? null;
                    $insItem->execute([$shortlistId, (string)$pid, $idx + 1, Normalizer::cleanWhitespace($cText)]);
                }

                if ($leadId) {
                    $upLead = $db->prepare("
                        UPDATE leads
                        SET stage = CASE WHEN stage IN ('new_inquiry', 'qualified') THEN 'shortlist_shared' ELSE stage END,
                            updated_at = ?
                        WHERE lead_id = ?
                    ");
                    $upLead->execute([$nowIso, $leadId]);

                    $insAct = $db->prepare('
                        INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    ');
                    $insAct->execute([$leadId, 'shortlist_sent', "Generated private shortlist \"{$title}\" (" . count($propIds) . " properties)", $userId, $nowIso]);
                }

                Connection::recordAuditLog($db, [
                    'actorUserId' => $userId,
                    'actorLabel' => $userLabel,
                    'entityType' => 'shortlist',
                    'entityId' => $shortlistId,
                    'action' => 'create_shortlist',
                    'summary' => "Created shortlist {$shortlistId} for {$clientName} (" . count($propIds) . " items)"
                ]);
            });

            $shareUrl = Config::getPublicOrigin() . "/shortlist/{$shareToken}";
            Router::sendJson(201, [
                'ok' => true,
                'shortlist_id' => $shortlistId,
                'share_token' => $shareToken,
                'share_url' => $shareUrl,
                'expires_at' => $expiresAt
            ]);
            return true;
        }

        // Revoke shortlist: POST /api/crm/shortlists/{id}/revoke
        if (preg_match('#^/api/crm/shortlists/([A-Za-z0-9-]+)/revoke$#', $path, $m) && $method === 'POST') {
            $router->requireRole(['principal', 'advisor'], $session);
            $slId = $m[1];

            $chk = $pdo->prepare('SELECT 1 FROM client_shortlists WHERE shortlist_id = ?');
            $chk->execute([$slId]);
            if (!$chk->fetch()) {
                Router::sendJson(404, ['ok' => false, 'error' => 'Shortlist not found']);
                return true;
            }

            $up = $pdo->prepare('UPDATE client_shortlists SET is_active = 0 WHERE shortlist_id = ?');
            $up->execute([$slId]);

            Connection::recordAuditLog($pdo, [
                'actorUserId' => $userId,
                'actorLabel' => $userLabel,
                'entityType' => 'shortlist',
                'entityId' => $slId,
                'action' => 'revoke_shortlist',
                'summary' => "Revoked shortlist {$slId}"
            ]);

            Router::sendJson(200, ['ok' => true, 'shortlist_id' => $slId, 'revoked' => true]);
            return true;
        }

        // --------------------------------------------------------------------
        // Publish static feeds
        // --------------------------------------------------------------------
        if ($path === '/api/crm/publish' && $method === 'POST') {
            $router->requireRole(['principal'], $session); // Strictly principal only!
            $body = $router->getJsonBody();
            $allowShrink = !empty($body['allow_shrink']) || !empty($body['allowShrink']);

            try {
                $res = Publisher::compileAndPublishStaticFeeds($pdo, [
                    'actorUserId' => $userId,
                    'actorLabel' => $userLabel,
                    'allowShrink' => $allowShrink
                ]);
                Router::sendJson(200, array_merge(['ok' => true, 'release' => $res], $res));
            } catch (\Throwable $e) {
                Router::sendJson(400, ['ok' => false, 'error' => $e->getMessage()]);
            }
            return true;
        }

        // --------------------------------------------------------------------
        // Audit Logs
        // --------------------------------------------------------------------
        if ($path === '/api/crm/audit-logs' && $method === 'GET') {
            $limit = min(max((int)($_GET['limit'] ?? 50), 1), 200);
            $stmt = $pdo->prepare("SELECT * FROM audit_logs ORDER BY audit_id DESC LIMIT {$limit}");
            $stmt->execute();
            $logs = $stmt->fetchAll();
            Router::sendJson(200, ['ok' => true, 'items' => $logs, 'logs' => $logs]);
            return true;
        }

        return false;
    }

    /**
     * Upsert property master and private vault records with fiduciary validation
     */
    public static function upsertPropertyMaster(PDO $db, array $payload, array $actor, ?string $existingId = null): array
    {
        $existing = null;
        if ($existingId) {
            $stmt = $db->prepare('
                SELECT p.*, pv.owner_contact_id, pv.owner_name_cache, pv.owner_phone_cache, pv.owner_email_cache,
                       pv.broker_contact_id, pv.broker_name_cache, pv.broker_phone_cache, pv.source_group_name,
                       pv.exact_unit_or_plot_no, pv.internal_floor_price_inr, pv.commission_terms,
                       pv.payment_structure_notes, pv.title_deed_verified, pv.encumbrance_notes,
                       pv.raw_whatsapp_text, pv.internal_advisor_notes
                FROM properties p
                LEFT JOIN property_private pv ON pv.property_id = p.property_id
                WHERE p.property_id = ?
            ');
            $stmt->execute([$existingId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
            if (!$existing) {
                throw new \RuntimeException("Property not found: {$existingId}", 404);
            }
        }

        $pubIn = $payload['public'] ?? $payload;
        $privIn = $payload['private'] ?? $payload['_private'] ?? $payload;

        $propId = $existingId
            ?: (Normalizer::cleanWhitespace((string)($pubIn['property_id'] ?? ''))
                ?: Connection::allocatePrefixedId($db, 'properties', 'property_id', ($pubIn['publication_state'] ?? '') === 'private_off_market' ? 'AUM-OFF' : 'AUM-WEB'));

        if (!preg_match(Config::PROPERTY_ID_REGEX, $propId)) {
            throw new \RuntimeException("Invalid property_id format: \"{$propId}\"", 400);
        }

        if (!$existingId) {
            $chk = $db->prepare('SELECT 1 FROM properties WHERE property_id = ?');
            $chk->execute([$propId]);
            if ($chk->fetch()) {
                throw new \RuntimeException("Property ID already exists: {$propId}", 409);
            }
        }

        $pickVal = fn($obj, $key, $fallback = null) => array_key_exists($key, $obj) && $obj[$key] !== null ? $obj[$key] : ($fallback ?? null);

        $pubState = $pickVal($pubIn, 'publication_state', $existing['publication_state'] ?? 'draft');
        if (!in_array($pubState, Config::PUBLICATION_STATES, true)) {
            throw new \RuntimeException("Invalid publication_state: {$pubState}", 400);
        }
        if ($pubState === 'approved_public' && ($actor['role'] ?? '') !== 'principal') {
            throw new \RuntimeException('Principal approval is required to create or change a public mandate', 403);
        }

        $availState = $pickVal($pubIn, 'availability_state', $existing['availability_state'] ?? 'available');
        if (!in_array($availState, Config::AVAILABILITY_STATES, true)) {
            throw new \RuntimeException("Invalid availability_state: {$availState}", 400);
        }

        $projectName = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'project_name', $existing['project_name'] ?? ''));
        $rawTitle = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'listing_title', $existing['listing_title'] ?? ''));
        if (!$rawTitle && !$projectName) {
            throw new \RuntimeException('Either listing_title or project_name is required', 400);
        }
        $listingTitle = Normalizer::cleanListingTitle($rawTitle ?: 'Gurugram Property Mandate', $projectName);

        $pickNullable = fn($obj, $key, $fallback = null) => array_key_exists($key, $obj) ? $obj[$key] : ($fallback ?? null);

        $areaValueRaw = $pickNullable($pubIn, 'area_value', $existing['area_value'] ?? null);
        if ($areaValueRaw !== null && $areaValueRaw !== '' && (!is_numeric($areaValueRaw) || (float)$areaValueRaw < 0)) {
            throw new \RuntimeException('area_value must be a non-negative number', 400);
        }
        $areaValue = ($areaValueRaw !== null && $areaValueRaw !== '') ? (float)$areaValueRaw : null;
        $areaUnit = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'area_unit', $existing['area_unit'] ?? ''));
        $areaSqFtNorm = Normalizer::normalizeAreaSqFt($areaValue, $areaUnit);

        $transactionType = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'transaction_type', $existing['transaction_type'] ?? 'Sale')) ?: 'Sale';
        $priceValueRaw = $pickNullable($pubIn, 'price_value', $existing['price_value'] ?? null);
        if ($priceValueRaw !== null && $priceValueRaw !== '' && (!is_numeric($priceValueRaw) || (float)$priceValueRaw < 0)) {
            throw new \RuntimeException('price_value must be a non-negative number', 400);
        }
        $priceValue = ($priceValueRaw !== null && $priceValueRaw !== '') ? (float)$priceValueRaw : null;
        $priceUnit = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'price_unit', $existing['price_unit'] ?? ''));
        $priceText = Normalizer::cleanWhitespace((string)$pickNullable($pubIn, 'price_text', $existing['price_text'] ?? ''));

        // If the advisor edited price_value or price_unit in the CRM form without manually changing
        // the old price_text label, refresh price_text so the website does not keep showing the stale label.
        if ($existing && array_key_exists('price_value', $pubIn)) {
            $oldPriceVal = ($existing['price_value'] !== null && $existing['price_value'] !== '') ? (float)$existing['price_value'] : null;
            $oldPriceUnit = Normalizer::cleanWhitespace((string)($existing['price_unit'] ?? ''));
            $oldPriceText = Normalizer::cleanWhitespace((string)($existing['price_text'] ?? ''));
            if (($priceValue !== $oldPriceVal || $priceUnit !== $oldPriceUnit) && $priceText === $oldPriceText) {
                $priceText = ($priceValue !== null && $priceValue > 0)
                    ? trim('₹' . $priceValue . ($priceUnit ? " {$priceUnit}" : ' Cr'))
                    : null;
            }
        }

        $rentValueRaw = $pickNullable($pubIn, 'rent_value', $existing['rent_value'] ?? null);
        if ($rentValueRaw !== null && $rentValueRaw !== '' && (!is_numeric($rentValueRaw) || (float)$rentValueRaw < 0)) {
            throw new \RuntimeException('rent_value must be a non-negative number', 400);
        }
        $rentValue = ($rentValueRaw !== null && $rentValueRaw !== '') ? (float)$rentValueRaw : null;
        $rentUnit = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'rent_unit', $existing['rent_unit'] ?? ''));

        $priceInrNorm = Normalizer::normalizePriceInr([
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'priceText' => $priceText,
            'transactionType' => $transactionType,
            'areaValue' => $areaValue,
            'areaUnit' => $areaUnit,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);
        $rentInrNorm = Normalizer::normalizeRentInr([
            'rentValue' => $rentValue,
            'rentUnit' => $rentUnit,
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'transactionType' => $transactionType,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);

        $configuration = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'configuration', $existing['configuration'] ?? ''));
        $bedrooms = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'bedrooms', $existing['bedrooms'] ?? ''));
        $bedroomsInt = Normalizer::parseBedroomsInt($bedrooms ?: null, $configuration ?: null, $listingTitle);

        $mergedPublic = [
            'property_id' => $propId,
            'publication_state' => $pubState,
            'availability_state' => $availState,
            'project_id' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'project_id', $existing['project_id'] ?? '')) ?: null,
            'project_name' => $projectName ?: null,
            'location_id' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'location_id', $existing['location_id'] ?? '')) ?: null,
            'city' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'city', $existing['city'] ?? 'Gurgaon')) ?: 'Gurgaon',
            'locality' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'locality', $existing['locality'] ?? '')) ?: null,
            'sector' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'sector', $existing['sector'] ?? '')) ?: null,
            'micro_location' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'micro_location', $existing['micro_location'] ?? '')) ?: null,
            'property_type' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'property_type', $existing['property_type'] ?? 'Apartment')) ?: 'Apartment',
            'transaction_type' => $transactionType,
            'listing_title' => $listingTitle,
            'configuration' => $configuration ?: null,
            'bedrooms' => $bedrooms ?: ($bedroomsInt ? (string)$bedroomsInt : null),
            'bedrooms_int' => $bedroomsInt,
            'bathrooms' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'bathrooms', $existing['bathrooms'] ?? '')) ?: null,
            'area_value' => $areaValue,
            'area_unit' => $areaUnit ?: null,
            'area_sqft_norm' => $areaSqFtNorm,
            'floor_label' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'floor_label', $existing['floor_label'] ?? '')) ?: null,
            'total_floors' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'total_floors', $existing['total_floors'] ?? '')) ?: null,
            'facing' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'facing', $existing['facing'] ?? '')) ?: null,
            'road_width' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'road_width', $existing['road_width'] ?? '')) ?: null,
            'furnishing' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'furnishing', $existing['furnishing'] ?? '')) ?: null,
            'possession_status' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'possession_status', $existing['possession_status'] ?? '')) ?: null,
            'price_value' => $priceValue,
            'price_unit' => $priceUnit ?: null,
            'price_text' => $priceText ?: null,
            'price_inr_norm' => $priceInrNorm,
            'rent_value' => $rentValue,
            'rent_unit' => $rentUnit ?: null,
            'rent_inr_monthly_norm' => $rentInrNorm,
            'key_features' => Normalizer::cleanWhitespace((string)$pickNullable($pubIn, 'key_features', $existing['key_features'] ?? '')) ?: null,
            'public_description' => Normalizer::cleanWhitespace((string)$pickNullable($pubIn, 'public_description', $existing['public_description'] ?? '')) ?: null,
            'public_features' => array_key_exists('public_features', $pubIn)
                ? (Normalizer::cleanWhitespace((string)$pubIn['public_features']) ?: null)
                : (array_key_exists('key_features', $pubIn)
                    ? (Normalizer::cleanWhitespace((string)$pubIn['key_features']) ?: null)
                    : (Normalizer::cleanWhitespace((string)($existing['public_features'] ?? '')) ?: null)),
            'image_label' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'image_label', $existing['image_label'] ?? 'Representative Reference Photograph')) ?: 'Representative Reference Photograph',
            'verification_status' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'verification_status', $existing['verification_status'] ?? 'Availability to be confirmed')) ?: 'Availability to be confirmed',
            'verification_state' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'verification_state', $existing['verification_state'] ?? 'needs_confirmation')) ?: 'needs_confirmation',
            'last_verified' => Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'last_verified', $existing['last_verified'] ?? gmdate('Y-m-d'))) ?: gmdate('Y-m-d'),
            'things_to_confirm' => is_array($pickVal($pubIn, 'things_to_confirm', null))
                ? json_encode($pubIn['things_to_confirm'], JSON_UNESCAPED_SLASHES)
                : ($existing['things_to_confirm'] ?? '["Exact unit & floor availability","Current asking price & complete cost breakdown"]'),
            'is_featured_approved' => !empty($pickVal($pubIn, 'is_featured_approved', $existing['is_featured_approved'] ?? 0)) ? 1 : 0
        ];

        $mergedPublic['category'] = Normalizer::cleanWhitespace((string)($pubIn['category'] ?? '')) ?: Normalizer::classifyCategory($mergedPublic);
        $mergedPublic['corridor'] = Normalizer::cleanWhitespace((string)($pubIn['corridor'] ?? '')) ?: Normalizer::classifyCorridor($mergedPublic);
        $mergedPublic['image_file'] = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'image_file', $existing['image_file'] ?? '')) ?: Normalizer::resolveRepresentativeImage($mergedPublic);
        $mergedPublic['next_reverify_due'] = gmdate('Y-m-d', strtotime('+120 days', strtotime($mergedPublic['last_verified'])));
        $mergedPublic['slug'] = Normalizer::cleanWhitespace((string)$pickVal($pubIn, 'slug', $existing['slug'] ?? '')) ?: Normalizer::slugify("{$propId}-{$listingTitle}");
        $mergedPublic['url'] = "https://aumestates.com/properties/detail.html?id=" . rawurlencode($propId);

        // Fiduciary privacy validation if approved_public
        if ($mergedPublic['publication_state'] === 'approved_public') {
            $chk = PrivacyGate::validateAndProjectPublicRecord(array_merge($mergedPublic, ['availability_state' => 'available']));
            if (!$chk['ok']) {
                $err = new \RuntimeException("Fiduciary Privacy Gate blocked public approval:\n" . implode("\n", $chk['errors']), 422);
                throw $err;
            }
        }

        $rawFloor = $pickNullable($privIn, 'internal_floor_price_inr', $existing['internal_floor_price_inr'] ?? null);
        $floorInr = null;
        if ($rawFloor !== null && $rawFloor !== '' && is_numeric($rawFloor)) {
            $fn = (float)$rawFloor;
            if ($fn > 0) {
                $floorInr = $fn < 500 ? (int)round($fn * 1e7) : (int)round($fn);
            }
        }

        $mergedPrivate = [
            'property_id' => $propId,
            'owner_contact_id' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'owner_contact_id', $existing['owner_contact_id'] ?? '')) ?: null,
            'owner_name_cache' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'owner_name_cache', $existing['owner_name_cache'] ?? '')) ?: null,
            'owner_phone_cache' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'owner_phone_cache', $existing['owner_phone_cache'] ?? '')) ?: null,
            'owner_email_cache' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'owner_email_cache', $existing['owner_email_cache'] ?? '')) ?: null,
            'broker_contact_id' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'broker_contact_id', $existing['broker_contact_id'] ?? '')) ?: null,
            'broker_name_cache' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'broker_name_cache', $existing['broker_name_cache'] ?? '')) ?: null,
            'broker_phone_cache' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'broker_phone_cache', $existing['broker_phone_cache'] ?? '')) ?: null,
            'source_group_name' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'source_group_name', $existing['source_group_name'] ?? '')) ?: null,
            'exact_unit_or_plot_no' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'exact_unit_or_plot_no', $existing['exact_unit_or_plot_no'] ?? '')) ?: null,
            'internal_floor_price_inr' => $floorInr,
            'commission_terms' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'commission_terms', $existing['commission_terms'] ?? '')) ?: null,
            'payment_structure_notes' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'payment_structure_notes', $existing['payment_structure_notes'] ?? '')) ?: null,
            'title_deed_verified' => !empty($pickVal($privIn, 'title_deed_verified', $existing['title_deed_verified'] ?? 0)) ? 1 : 0,
            'encumbrance_notes' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'encumbrance_notes', $existing['encumbrance_notes'] ?? '')) ?: null,
            'raw_whatsapp_text' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'raw_whatsapp_text', $existing['raw_whatsapp_text'] ?? '')) ?: null,
            'internal_advisor_notes' => Normalizer::cleanWhitespace((string)$pickVal($privIn, 'internal_advisor_notes', $existing['internal_advisor_notes'] ?? '')) ?: null
        ];

        $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
        $approvedBy = $mergedPublic['publication_state'] === 'approved_public'
            ? ($existing['approved_by_user_id'] ?? $actor['user_id'] ?? null)
            : null;
        $approvedAt = $mergedPublic['publication_state'] === 'approved_public'
            ? ($existing['approved_at'] ?? $nowIso)
            : null;

        if ($existingId) {
            $upProp = $db->prepare('
                UPDATE properties SET
                    publication_state = ?, availability_state = ?, project_id = ?, project_name = ?,
                    location_id = ?, city = ?, locality = ?, sector = ?, micro_location = ?, corridor = ?,
                    property_type = ?, category = ?, transaction_type = ?, listing_title = ?, configuration = ?,
                    bedrooms = ?, bedrooms_int = ?, bathrooms = ?, area_value = ?, area_unit = ?, area_sqft_norm = ?,
                    floor_label = ?, total_floors = ?, facing = ?, road_width = ?, furnishing = ?,
                    possession_status = ?, price_value = ?, price_unit = ?, price_text = ?, price_inr_norm = ?,
                    rent_value = ?, rent_unit = ?, rent_inr_monthly_norm = ?, key_features = ?, public_description = ?,
                    public_features = ?, image_label = ?, image_file = ?, verification_status = ?, verification_state = ?,
                    last_verified = ?, next_reverify_due = ?, things_to_confirm = ?, is_featured_approved = ?,
                    slug = ?, approved_by_user_id = ?, approved_at = ?, updated_at = ?
                WHERE property_id = ?
            ');
            $upProp->execute([
                $mergedPublic['publication_state'], $mergedPublic['availability_state'], $mergedPublic['project_id'], $mergedPublic['project_name'],
                $mergedPublic['location_id'], $mergedPublic['city'], $mergedPublic['locality'], $mergedPublic['sector'], $mergedPublic['micro_location'], $mergedPublic['corridor'],
                $mergedPublic['property_type'], $mergedPublic['category'], $mergedPublic['transaction_type'], $mergedPublic['listing_title'], $mergedPublic['configuration'],
                $mergedPublic['bedrooms'], $mergedPublic['bedrooms_int'], $mergedPublic['bathrooms'], $mergedPublic['area_value'], $mergedPublic['area_unit'], $mergedPublic['area_sqft_norm'],
                $mergedPublic['floor_label'], $mergedPublic['total_floors'], $mergedPublic['facing'], $mergedPublic['road_width'], $mergedPublic['furnishing'],
                $mergedPublic['possession_status'], $mergedPublic['price_value'], $mergedPublic['price_unit'], $mergedPublic['price_text'], $mergedPublic['price_inr_norm'],
                $mergedPublic['rent_value'], $mergedPublic['rent_unit'], $mergedPublic['rent_inr_monthly_norm'], $mergedPublic['key_features'], $mergedPublic['public_description'],
                $mergedPublic['public_features'], $mergedPublic['image_label'], $mergedPublic['image_file'], $mergedPublic['verification_status'], $mergedPublic['verification_state'],
                $mergedPublic['last_verified'], $mergedPublic['next_reverify_due'], $mergedPublic['things_to_confirm'], $mergedPublic['is_featured_approved'],
                $mergedPublic['slug'], $approvedBy, $approvedAt, $nowIso,
                $propId
            ]);

            if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
                $upPriv = $db->prepare('
                    INSERT OR REPLACE INTO property_private (
                        property_id, owner_contact_id, owner_name_cache, owner_phone_cache, owner_email_cache,
                        broker_contact_id, broker_name_cache, broker_phone_cache, source_group_name,
                        exact_unit_or_plot_no, internal_floor_price_inr, commission_terms,
                        payment_structure_notes, title_deed_verified, encumbrance_notes,
                        raw_whatsapp_text, internal_advisor_notes, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
            } else {
                $upPriv = $db->prepare('
                    INSERT INTO property_private (
                        property_id, owner_contact_id, owner_name_cache, owner_phone_cache, owner_email_cache,
                        broker_contact_id, broker_name_cache, broker_phone_cache, source_group_name,
                        exact_unit_or_plot_no, internal_floor_price_inr, commission_terms,
                        payment_structure_notes, title_deed_verified, encumbrance_notes,
                        raw_whatsapp_text, internal_advisor_notes, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        owner_contact_id = VALUES(owner_contact_id),
                        owner_name_cache = VALUES(owner_name_cache),
                        owner_phone_cache = VALUES(owner_phone_cache),
                        owner_email_cache = VALUES(owner_email_cache),
                        broker_contact_id = VALUES(broker_contact_id),
                        broker_name_cache = VALUES(broker_name_cache),
                        broker_phone_cache = VALUES(broker_phone_cache),
                        source_group_name = VALUES(source_group_name),
                        exact_unit_or_plot_no = VALUES(exact_unit_or_plot_no),
                        internal_floor_price_inr = VALUES(internal_floor_price_inr),
                        commission_terms = VALUES(commission_terms),
                        payment_structure_notes = VALUES(payment_structure_notes),
                        title_deed_verified = VALUES(title_deed_verified),
                        encumbrance_notes = VALUES(encumbrance_notes),
                        raw_whatsapp_text = VALUES(raw_whatsapp_text),
                        internal_advisor_notes = VALUES(internal_advisor_notes),
                        updated_at = VALUES(updated_at)
                ');
            }
            $upPriv->execute([
                $propId, $mergedPrivate['owner_contact_id'], $mergedPrivate['owner_name_cache'], $mergedPrivate['owner_phone_cache'], $mergedPrivate['owner_email_cache'],
                $mergedPrivate['broker_contact_id'], $mergedPrivate['broker_name_cache'], $mergedPrivate['broker_phone_cache'], $mergedPrivate['source_group_name'],
                $mergedPrivate['exact_unit_or_plot_no'], $mergedPrivate['internal_floor_price_inr'], $mergedPrivate['commission_terms'],
                $mergedPrivate['payment_structure_notes'], $mergedPrivate['title_deed_verified'], $mergedPrivate['encumbrance_notes'],
                $mergedPrivate['raw_whatsapp_text'], $mergedPrivate['internal_advisor_notes'], $nowIso
            ]);
        } else {
            $insProp = $db->prepare('
                INSERT INTO properties (
                    property_id, publication_state, availability_state, project_id, project_name,
                    location_id, city, locality, sector, micro_location, corridor, property_type,
                    category, transaction_type, listing_title, configuration, bedrooms, bedrooms_int,
                    bathrooms, area_value, area_unit, area_sqft_norm, floor_label, total_floors,
                    facing, road_width, furnishing, possession_status, price_value, price_unit,
                    price_text, price_inr_norm, rent_value, rent_unit, rent_inr_monthly_norm,
                    key_features, public_description, public_features, image_label, image_file,
                    verification_status, verification_state, last_verified, next_reverify_due,
                    things_to_confirm, is_featured_approved, slug, approved_by_user_id,
                    approved_at, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?
                )
            ');
            $insProp->execute([
                $propId, $mergedPublic['publication_state'], $mergedPublic['availability_state'], $mergedPublic['project_id'], $mergedPublic['project_name'],
                $mergedPublic['location_id'], $mergedPublic['city'], $mergedPublic['locality'], $mergedPublic['sector'], $mergedPublic['micro_location'], $mergedPublic['corridor'],
                $mergedPublic['property_type'], $mergedPublic['category'], $mergedPublic['transaction_type'], $mergedPublic['listing_title'], $mergedPublic['configuration'],
                $mergedPublic['bedrooms'], $mergedPublic['bedrooms_int'], $mergedPublic['bathrooms'], $mergedPublic['area_value'], $mergedPublic['area_unit'], $mergedPublic['area_sqft_norm'],
                $mergedPublic['floor_label'], $mergedPublic['total_floors'], $mergedPublic['facing'], $mergedPublic['road_width'], $mergedPublic['furnishing'],
                $mergedPublic['possession_status'], $mergedPublic['price_value'], $mergedPublic['price_unit'], $mergedPublic['price_text'], $mergedPublic['price_inr_norm'],
                $mergedPublic['rent_value'], $mergedPublic['rent_unit'], $mergedPublic['rent_inr_monthly_norm'], $mergedPublic['key_features'], $mergedPublic['public_description'],
                $mergedPublic['public_features'], $mergedPublic['image_label'], $mergedPublic['image_file'], $mergedPublic['verification_status'], $mergedPublic['verification_state'],
                $mergedPublic['last_verified'], $mergedPublic['next_reverify_due'], $mergedPublic['things_to_confirm'], $mergedPublic['is_featured_approved'],
                $mergedPublic['slug'], $approvedBy, $approvedAt, $nowIso, $nowIso
            ]);

            $insPriv = $db->prepare('
                INSERT INTO property_private (
                    property_id, owner_contact_id, owner_name_cache, owner_phone_cache, owner_email_cache,
                    broker_contact_id, broker_name_cache, broker_phone_cache, source_group_name,
                    exact_unit_or_plot_no, internal_floor_price_inr, commission_terms,
                    payment_structure_notes, title_deed_verified, encumbrance_notes,
                    raw_whatsapp_text, internal_advisor_notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $insPriv->execute([
                $propId, $mergedPrivate['owner_contact_id'], $mergedPrivate['owner_name_cache'], $mergedPrivate['owner_phone_cache'], $mergedPrivate['owner_email_cache'],
                $mergedPrivate['broker_contact_id'], $mergedPrivate['broker_name_cache'], $mergedPrivate['broker_phone_cache'], $mergedPrivate['source_group_name'],
                $mergedPrivate['exact_unit_or_plot_no'], $mergedPrivate['internal_floor_price_inr'], $mergedPrivate['commission_terms'],
                $mergedPrivate['payment_structure_notes'], $mergedPrivate['title_deed_verified'], $mergedPrivate['encumbrance_notes'],
                $mergedPrivate['raw_whatsapp_text'], $mergedPrivate['internal_advisor_notes'], $nowIso
            ]);
        }

        Connection::recordAuditLog($db, [
            'actorUserId' => $actor['user_id'] ?? null,
            'actorLabel' => $actor['full_name'] ?? $actor['email'] ?? 'operator',
            'entityType' => 'property',
            'entityId' => $propId,
            'action' => $existingId ? 'update_property' : 'create_property',
            'summary' => ($existingId ? 'Updated' : 'Created') . " property {$propId} ({$listingTitle})",
            'before' => $existing,
            'after' => $mergedPublic
        ]);

        return ['public' => $mergedPublic, 'private' => $mergedPrivate];
    }
}
