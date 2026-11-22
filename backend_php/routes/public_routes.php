<?php
declare(strict_types=1);

namespace AumEstates\Routes;

use PDO;
use AumEstates\Config;
use AumEstates\Db\Connection;
use AumEstates\Domain\Normalizer;
use AumEstates\Domain\PrivacyGate;
use AumEstates\Domain\SearchEngine;
use AumEstates\Domain\Shortlist;

final class PublicRoutes
{
    public static function dispatch(Router $router, PDO $pdo, string $method, string $path): bool
    {
        // 1. Health check
        if ($path === '/api/public/health' && $method === 'GET') {
            $cfg = Config::getDatabaseConfig();
            $cnt = 0;
            try {
                $stmt = $pdo->query("SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND availability_state = 'available'");
                $cnt = (int)($stmt ? $stmt->fetchColumn() : 0);
            } catch (\Throwable $e) {
                // Table might not exist yet in an unmigrated or mock test db
                $cnt = 0;
            }
            Router::sendJson(200, [
                'ok' => true,
                'status' => 'healthy',
                'publicMandates' => $cnt,
                'timestamp' => gmdate('Y-m-d\TH:i:s.v\Z'),
                'version' => Config::APP_VERSION,
                'database' => $cfg['driver']
            ]);
            return true;
        }

        // 2. Public Properties search
        if ($path === '/api/public/properties' && $method === 'GET') {
            $params = $_GET;
            if (empty($params['purpose']) && !empty($params['mode'])) {
                $params['purpose'] = $params['mode'];
            }
            if (empty($params['category']) && !empty($params['type'])) {
                $params['category'] = $params['type'];
            }
            if (empty($params['bedrooms']) && !empty($params['beds'])) {
                $params['bedrooms'] = $params['beds'];
            }

            $res = SearchEngine::searchPublicProperties($pdo, $params);
            Router::sendJson(200, [
                'ok' => true,
                'total' => $res['total'],
                'items' => $res['items']
            ]);
            return true;
        }

        // 3. Public Property Detail: /api/public/properties/{id}
        if (preg_match('#^/api/public/properties/([A-Za-z0-9-]+)$#', $path, $m) && $method === 'GET') {
            $propId = $m[1];
            $stmt = $pdo->prepare("
                SELECT * FROM properties
                WHERE property_id = ?
                  AND publication_state = 'approved_public'
                  AND availability_state = 'available'
            ");
            $stmt->execute([$propId]);
            $row = $stmt->fetch();

            if (!$row) {
                Router::sendJson(404, ['ok' => false, 'error' => 'Property not found or unavailable']);
                return true;
            }

            $projected = PrivacyGate::validateAndProjectPublicRecord($row);
            if (!$projected['ok']) {
                Router::sendJson(500, ['ok' => false, 'error' => 'Internal presentation error']);
                return true;
            }

            Router::sendJson(200, [
                'ok' => true,
                'property' => $projected['record']
            ]);
            return true;
        }

        // 4. Public Projects
        if ($path === '/api/public/projects' && $method === 'GET') {
            $stmt = $pdo->query("
                SELECT
                    project_id, project_name, city, locality, sector, micro_location, corridor,
                    project_type, status, description, key_amenities, price_band_text, image_file,
                    is_new_project_curated, slug, last_verified
                FROM projects
                WHERE publication_state = 'approved_public'
                ORDER BY is_new_project_curated DESC, COALESCE(curated_sort_order, 9999) ASC, project_id ASC
            ");
            $rows = $stmt->fetchAll();

            $projects = array_map(function ($p) {
                $p['is_new_project_curated'] = (bool)$p['is_new_project_curated'];
                return $p;
            }, $rows);

            Router::sendJson(200, [
                'ok' => true,
                'projects' => $projects
            ]);
            return true;
        }

        // 5. Public Inquiries Intake
        if ($path === '/api/public/inquiries' && $method === 'POST') {
            // This endpoint is unauthenticated and writes contacts, leads and
            // requirements, so it has to be throttled or it becomes a way to flood
            // the CRM with junk records.
            $clientIp = \AumEstates\Auth\Auth::clientIp($_SERVER);
            $gate = \AumEstates\Auth\Auth::registerAttempt(
                $pdo,
                'inquiry_ip',
                $clientIp,
                \AumEstates\Auth\Auth::INQUIRY_MAX_ATTEMPTS,
                \AumEstates\Auth\Auth::INQUIRY_WINDOW_SECONDS
            );
            if (!$gate['allowed']) {
                Router::sendJson(429, [
                    'ok' => false,
                    'error' => 'Too many enquiries from this connection. Please wait a few minutes, or call the advisory desk directly.',
                    'retry_after_seconds' => $gate['retryAfter']
                ], ['Retry-After' => (string)$gate['retryAfter']]);
                return true;
            }

            $body = $router->getJsonBody();

            $clientName = Normalizer::cleanWhitespace($body['client_name'] ?? $body['name'] ?? $body['fullName'] ?? null) ?: 'Website Visitor';
            $clientPhone = Normalizer::cleanWhitespace($body['client_phone'] ?? $body['phone'] ?? $body['mobile'] ?? null);
            $clientEmail = Normalizer::cleanWhitespace($body['client_email'] ?? $body['email'] ?? null);
            $intent = Normalizer::cleanWhitespace($body['intent'] ?? 'Buy') ?: 'Buy';
            $situation = Normalizer::cleanWhitespace($body['situation'] ?? null);
            $budget = Normalizer::cleanWhitespace($body['budget_text'] ?? $body['budget'] ?? null);
            $location = Normalizer::cleanWhitespace($body['preferred_location'] ?? $body['location'] ?? null) ?: 'Gurugram';
            $message = Normalizer::cleanWhitespace($body['inquiry_message'] ?? $body['message'] ?? $body['notes'] ?? null);
            $sourceChannel = Normalizer::cleanWhitespace($body['source_channel'] ?? $body['action'] ?? null) ?: 'website';
            $sourcePage = Normalizer::cleanWhitespace($body['source_page'] ?? $body['page'] ?? $body['source'] ?? null) ?: 'web';
            $primaryPropertyId = Normalizer::cleanWhitespace($body['primary_property_id'] ?? $body['property_id'] ?? $body['propertyId'] ?? null);
            $idempotencyKey = Normalizer::cleanWhitespace($body['idempotency_key'] ?? $body['idempotencyKey'] ?? null);
            $selectedQuestions = is_array($body['selected_questions'] ?? null) ? array_slice($body['selected_questions'], 0, 12) : [];
            $savedIds = is_array($body['saved_property_ids'] ?? null) ? array_slice($body['saved_property_ids'], 0, 10) : [];

            // Phone normalization
            $phoneNorm = null;
            if ($clientPhone) {
                $digits = preg_replace('/\D/', '', $clientPhone);
                if (strlen($digits) >= 10) {
                    $phoneNorm = substr($digits, -10);
                }
            }

            if (!$phoneNorm && !$clientEmail && !$message && !$primaryPropertyId) {
                Router::sendJson(400, [
                    'ok' => false,
                    'error' => 'An enquiry needs a phone number, an email address, a message, or a property reference.'
                ]);
                return true;
            }

            // Check idempotency replay
            if ($idempotencyKey) {
                $chkStmt = $pdo->prepare('SELECT lead_id FROM leads WHERE idempotency_key = ?');
                $chkStmt->execute([$idempotencyKey]);
                $existing = $chkStmt->fetch();
                if ($existing) {
                    Router::sendJson(200, [
                        'ok' => true,
                        'lead_id' => $existing['lead_id'],
                        'idempotent_replay' => true
                    ]);
                    return true;
                }
            }

            // Validate primaryPropertyId exists so FK never errors on stale external ID
            $validProp = null;
            if ($primaryPropertyId) {
                $pStmt = $pdo->prepare('SELECT property_id, listing_title, corridor FROM properties WHERE property_id = ?');
                $pStmt->execute([$primaryPropertyId]);
                $validProp = $pStmt->fetch() ?: null;
            }
            $resolvedPropId = $validProp ? $validProp['property_id'] : null;

            $leadId = Connection::withTransaction($pdo, function (PDO $db) use (
                $clientName, $clientPhone, $phoneNorm, $clientEmail, $intent, $situation, $budget,
                $location, $message, $sourceChannel, $sourcePage, $resolvedPropId, $validProp,
                $idempotencyKey, $selectedQuestions, $savedIds
            ) {
                // Resolve or create contact
                $contactId = null;

                // Match only on keys the enquirer actually supplied. Passing '' for a
                // missing key used to match any contact stored with an empty phone or
                // e-mail, filing one person's enquiry onto an unrelated contact.
                $matchSql = [];
                $matchParams = [];
                if ($phoneNorm !== null && $phoneNorm !== '') {
                    $matchSql[] = "(phone_norm IS NOT NULL AND phone_norm <> '' AND phone_norm = ?)";
                    $matchParams[] = $phoneNorm;
                }
                if ($clientEmail !== null && $clientEmail !== '') {
                    $matchSql[] = "(email IS NOT NULL AND email <> '' AND LOWER(email) = LOWER(?))";
                    $matchParams[] = $clientEmail;
                }

                if (!empty($matchSql)) {
                    $cStmt = $db->prepare('SELECT contact_id FROM contacts WHERE ' . implode(' OR ', $matchSql) . ' LIMIT 1');
                    $cStmt->execute($matchParams);
                    $cRow = $cStmt->fetch();
                    if ($cRow) {
                        $contactId = $cRow['contact_id'];
                    }
                }

                if (!$contactId && ($phoneNorm || $clientEmail)) {
                    $contactId = Connection::allocatePrefixedId($db, 'contacts', 'contact_id', 'CNT-WEB');
                    $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');
                    $cType = (stripos($intent, 'sell') !== false || stripos($intent, 'lease out') !== false) ? 'seller_owner' : 'buyer';
                    $insContact = $db->prepare('
                        INSERT INTO contacts (
                            contact_id, contact_type, full_name, phone_primary, phone_norm,
                            email, preferred_channel, trust_tier, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ');
                    $insContact->execute([
                        $contactId,
                        $cType,
                        $clientName,
                        $clientPhone,
                        $phoneNorm,
                        $clientEmail,
                        'whatsapp',
                        'standard',
                        $nowIso,
                        $nowIso
                    ]);
                }

                $newLeadId = Connection::allocatePrefixedId($db, 'leads', 'lead_id', 'LEAD-2026');
                $titleTopic = $validProp
                    ? "{$validProp['listing_title']} ({$validProp['property_id']})"
                    : "{$intent} · {$location}";
                $leadTitle = mb_substr("{$clientName} — {$titleTopic}", 0, 140, 'UTF-8');
                $priority = ($clientPhone || !empty($selectedQuestions) || !empty($savedIds)) ? 'high' : 'normal';
                $nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

                $insLead = $db->prepare('
                    INSERT INTO leads (
                        lead_id, contact_id, lead_title, client_name, client_phone, client_email,
                        stage, priority, intent, situation, preferred_location, budget_text, source_channel,
                        source_page, primary_property_id, inquiry_message, selected_questions_json,
                        saved_property_ids_json, idempotency_key, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
                $insLead->execute([
                    $newLeadId,
                    $contactId,
                    $leadTitle,
                    $clientName,
                    $clientPhone,
                    $clientEmail,
                    'new_inquiry',
                    $priority,
                    $intent,
                    $situation,
                    $location,
                    $budget,
                    $sourceChannel,
                    $sourcePage,
                    $resolvedPropId,
                    $message,
                    json_encode($selectedQuestions, JSON_UNESCAPED_SLASHES),
                    json_encode($savedIds, JSON_UNESCAPED_SLASHES),
                    $idempotencyKey,
                    $nowIso,
                    $nowIso
                ]);

                // Automatically scaffold a buyer requirement record so 1-click Auto-Match works immediately
                if (!preg_match('/sell|lease out/i', $intent)) {
                    $reqId = Connection::allocatePrefixedId($db, 'buyer_requirements', 'requirement_id', 'REQ-2026');
                    $initialCorridors = $validProp ? [$validProp['corridor']] : [];
                    $mustHave = implode(' · ', array_filter([
                        $budget ? "Stated budget: {$budget}" : null,
                        $message
                    ])) ?: null;
                    $insReq = $db->prepare('
                        INSERT INTO buyer_requirements (
                            requirement_id, lead_id, contact_id, intent, corridors_json,
                            include_off_market, must_have_notes, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
                    ');
                    $insReq->execute([
                        $reqId,
                        $newLeadId,
                        $contactId,
                        $intent,
                        json_encode($initialCorridors, JSON_UNESCAPED_SLASHES),
                        $mustHave,
                        $nowIso,
                        $nowIso
                    ]);
                }

                // Create activity
                $insAct = $db->prepare('
                    INSERT INTO crm_activities (lead_id, contact_id, property_id, activity_type, summary, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ');
                $insAct->execute([
                    $newLeadId,
                    $contactId,
                    $resolvedPropId,
                    'website_inquiry',
                    "Website enquiry submitted via {$sourcePage}: \"" . ($message ?: $sourceChannel) . "\"",
                    $nowIso
                ]);

                return $newLeadId;
            });

            Router::sendJson(201, [
                'ok' => true,
                'lead_id' => $leadId
            ]);
            return true;
        }

        // 6. Public Tokenized Client Shortlist: /api/public/shortlists/{token}
        if (preg_match('#^/api/public/shortlists/([A-Za-z0-9_-]{12,64})$#', $path, $m) && $method === 'GET') {
            $token = $m[1];
            $stmt = $pdo->prepare('SELECT * FROM client_shortlists WHERE share_token = ?');
            $stmt->execute([$token]);
            $sl = $stmt->fetch();

            if (!$sl || empty($sl['is_active'])) {
                Router::sendJson(404, ['ok' => false, 'error' => 'Private shortlist not found or revoked']);
                return true;
            }

            if (!empty($sl['expires_at'])) {
                $expTs = strtotime($sl['expires_at']) ?: 0;
                if ($expTs < time()) {
                    Router::sendJson(410, ['ok' => false, 'error' => 'This private shortlist link has expired']);
                    return true;
                }
            }

            // Increment view count
            $upStmt = $pdo->prepare('
                UPDATE client_shortlists
                SET view_count = view_count + 1,
                    last_viewed_at = ?
                WHERE shortlist_id = ?
            ');
            $upStmt->execute([gmdate('Y-m-d\TH:i:s.v\Z'), $sl['shortlist_id']]);

            // Fetch shortlist items
            $itemStmt = $pdo->prepare('
                SELECT
                    si.sort_order,
                    si.advisor_commentary,
                    si.match_score,
                    p.*
                FROM shortlist_items si
                JOIN properties p ON p.property_id = si.property_id
                WHERE si.shortlist_id = ?
                ORDER BY si.sort_order ASC, p.property_id ASC
            ');
            $itemStmt->execute([$sl['shortlist_id']]);
            $rawItems = $itemStmt->fetchAll();

            $projectedItems = [];
            foreach ($rawItems as $raw) {
                try {
                    $projectedItems[] = Shortlist::projectShortlistItem($raw);
                } catch (\Throwable $e) {
                    // Items that became unavailable or unsafe stop being disclosed
                    continue;
                }
            }

            Router::sendJson(200, [
                'ok' => true,
                'shortlist' => [
                    'shortlist_id' => $sl['shortlist_id'],
                    'title' => $sl['title'],
                    'client_name' => $sl['client_name'],
                    'advisor_intro_note' => $sl['advisor_intro_note'],
                    'expires_at' => $sl['expires_at'],
                    'created_at' => $sl['created_at'],
                    'view_count' => (int)$sl['view_count'] + 1,
                    'items' => $projectedItems
                ]
            ]);
            return true;
        }

        return false;
    }
}
