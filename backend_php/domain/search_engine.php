<?php
declare(strict_types=1);

namespace AumEstates\Domain;

use PDO;

final class SearchEngine
{
    private const SYNONYM_MAP = [
        'gcr' => ['gcr', 'golf course road'],
        'gcer' => ['gcer', 'golf course ext', 'extension', 'spr'],
        'spr' => ['spr', 'southern peripheral', 'extension'],
        'dxp' => ['dxp', 'dwarka expressway'],
        'kothi' => ['kothi', 'villa', 'house', 'independent'],
        'villa' => ['villa', 'kothi', 'house'],
        'floor' => ['floor', 'builder floor'],
        'floors' => ['floors', 'builder floor'],
        'huda' => ['huda', 'hsvp', 'plot'],
        'hsvp' => ['hsvp', 'huda', 'plot'],
        'sco' => ['sco', 'commercial', 'shop', 'plot'],
        '2bhk' => ['2bhk', '2 bhk'],
        '3bhk' => ['3bhk', '3 bhk'],
        '4bhk' => ['4bhk', '4 bhk'],
        '5bhk' => ['5bhk', '5 bhk']
    ];

    public static function expandSearchTokens(?string $rawQuery): array
    {
        if (!$rawQuery || !is_string($rawQuery)) {
            return [];
        }
        $cleaned = mb_strtolower(trim($rawQuery), 'UTF-8');
        $cleaned = preg_replace('/[^\p{L}\p{N}\s+]+/u', ' ', $cleaned);
        $rawTokens = array_slice(array_filter(preg_split('/\s+/u', $cleaned)), 0, 8);
        if (empty($rawTokens)) {
            return [];
        }

        $tokenVariants = [];
        foreach ($rawTokens as $tok) {
            $safeTok = preg_replace('/[^a-z0-9]/', '', $tok);
            if (!$safeTok) {
                continue;
            }
            if (isset(self::SYNONYM_MAP[$safeTok])) {
                $tokenVariants[] = self::SYNONYM_MAP[$safeTok];
            } else {
                $tokenVariants[] = [$safeTok];
            }
        }
        return $tokenVariants;
    }

    private static function purposeSqlCondition(?string $purpose, string $alias = 'p'): array
    {
        $mode = mb_strtolower(trim((string)($purpose ?? '')), 'UTF-8');
        if (!$mode || $mode === 'all') {
            return ['sql' => '', 'params' => []];
        }

        if ($mode === 'rent' || $mode === 'lease') {
            return [
                'sql' => "AND (LOWER({$alias}.transaction_type) LIKE '%rent%' OR LOWER({$alias}.transaction_type) LIKE '%lease%')",
                'params' => []
            ];
        }
        if ($mode === 'commercial') {
            return [
                'sql' => "AND {$alias}.category = 'commercial'",
                'params' => []
            ];
        }
        if ($mode === 'land' || $mode === 'plot' || $mode === 'plots') {
            return [
                'sql' => "AND {$alias}.category = 'plot'",
                'params' => []
            ];
        }
        if ($mode === 'buy' || $mode === 'sale') {
            return [
                'sql' => "AND (LOWER({$alias}.transaction_type) LIKE '%sale%' OR (LOWER({$alias}.transaction_type) NOT LIKE '%rent%' AND LOWER({$alias}.transaction_type) NOT LIKE '%lease%'))",
                'params' => []
            ];
        }
        return ['sql' => '', 'params' => []];
    }

    /**
     * Public Search Engine:
     * Strictly queries ONLY approved_public + available rows.
     * Zero access to property_private. Every row passes through validateAndProjectPublicRecord.
     */
    public static function searchPublicProperties(PDO $pdo, array $params = []): array
    {
        $q = trim((string)($params['q'] ?? ''));
        $purpose = $params['purpose'] ?? '';
        $corridor = $params['corridor'] ?? '';
        $area = $params['area'] ?? '';
        $category = $params['category'] ?? '';
        $bedrooms = $params['bedrooms'] ?? '';
        $minBudgetInr = $params['minBudgetInr'] ?? $params['min_budget_inr'] ?? null;
        $maxBudgetInr = $params['maxBudgetInr'] ?? $params['max_budget_inr'] ?? null;
        $minAreaSqFt = $params['minAreaSqFt'] ?? $params['min_area_sqft'] ?? null;
        $maxAreaSqFt = $params['maxAreaSqFt'] ?? $params['max_area_sqft'] ?? null;
        $includePriceOnRequest = !empty($params['includePriceOnRequest']) || !empty($params['include_price_on_request']);
        $sort = $params['sort'] ?? 'featured';
        $limit = (int)($params['limit'] ?? 400);
        $offset = (int)($params['offset'] ?? 0);

        $where = [
            "p.publication_state = 'approved_public'",
            "p.availability_state = 'available'"
        ];
        $sqlParams = [];

        // Text query filters
        $tokenGroups = self::expandSearchTokens($q);
        if (!empty($tokenGroups)) {
            foreach ($tokenGroups as $group) {
                $groupOr = [];
                foreach ($group as $variant) {
                    $groupOr[] = "(
                        LOWER(p.listing_title) LIKE ?
                        OR LOWER(p.project_name) LIKE ?
                        OR LOWER(p.corridor) LIKE ?
                        OR LOWER(COALESCE(p.locality, '')) LIKE ?
                        OR LOWER(COALESCE(p.sector, '')) LIKE ?
                        OR LOWER(COALESCE(p.micro_location, '')) LIKE ?
                        OR LOWER(p.category) LIKE ?
                        OR LOWER(COALESCE(p.configuration, '')) LIKE ?
                        OR LOWER(COALESCE(p.public_description, '')) LIKE ?
                        OR LOWER(COALESCE(p.key_features, '')) LIKE ?
                    )";
                    $like = "%{$variant}%";
                    for ($i = 0; $i < 10; $i++) {
                        $sqlParams[] = $like;
                    }
                }
                $where[] = '(' . implode(' OR ', $groupOr) . ')';
            }
        }

        $purposeCond = self::purposeSqlCondition($purpose, 'p');
        if ($purposeCond['sql']) {
            $where[] = preg_replace('/^AND\s+/i', '', $purposeCond['sql']);
        }

        $locFilter = trim("{$corridor} {$area}");
        if ($locFilter && !in_array(mb_strtolower($locFilter, 'UTF-8'), ['all', 'all areas', 'gurugram', 'gurgaon'], true)) {
            $where[] = "(
                LOWER(p.corridor) = LOWER(?)
                OR LOWER(COALESCE(p.locality, '')) LIKE ?
                OR LOWER(COALESCE(p.sector, '')) LIKE ?
                OR LOWER(COALESCE(p.micro_location, '')) LIKE ?
                OR LOWER(COALESCE(p.city, '')) LIKE ?
            )";
            $like = '%' . mb_strtolower($locFilter, 'UTF-8') . '%';
            $sqlParams[] = $locFilter;
            $sqlParams[] = $like;
            $sqlParams[] = $like;
            $sqlParams[] = $like;
            $sqlParams[] = $like;
        } elseif (mb_strtolower($locFilter, 'UTF-8') === 'gurugram' || mb_strtolower($locFilter, 'UTF-8') === 'gurgaon') {
            $where[] = "LOWER(COALESCE(p.city, 'gurgaon')) NOT LIKE '%goa%'";
        }

        if ($category && $category !== 'all') {
            $where[] = 'LOWER(p.category) = LOWER(?)';
            $sqlParams[] = trim((string)$category);
        }

        if ($bedrooms && $bedrooms !== 'Any' && $bedrooms !== 'all') {
            $bNum = (int)$bedrooms;
            if ($bNum > 0) {
                if (str_contains((string)$bedrooms, '+')) {
                    $where[] = 'p.bedrooms_int >= ?';
                    $sqlParams[] = $bNum;
                } else {
                    $where[] = 'p.bedrooms_int = ?';
                    $sqlParams[] = $bNum;
                }
            }
        }

        $isRentMode = mb_strtolower((string)$purpose, 'UTF-8') === 'rent';
        $priceCol = $isRentMode ? 'p.rent_inr_monthly_norm' : 'p.price_inr_norm';

        $minB = ($minBudgetInr !== null && $minBudgetInr !== '' && is_numeric($minBudgetInr)) ? (float)$minBudgetInr : null;
        $maxB = ($maxBudgetInr !== null && $maxBudgetInr !== '' && is_numeric($maxBudgetInr)) ? (float)$maxBudgetInr : null;
        if ($minB !== null || $maxB !== null) {
            $budgetParts = [];
            $bParams = [];
            if ($minB !== null) {
                $budgetParts[] = "{$priceCol} >= ?";
                $bParams[] = $minB;
            }
            if ($maxB !== null) {
                $budgetParts[] = "{$priceCol} <= ?";
                $bParams[] = $maxB;
            }
            $rangeExpr = "({$priceCol} IS NOT NULL AND " . implode(' AND ', $budgetParts) . ")";
            if ($includePriceOnRequest) {
                $where[] = "({$rangeExpr} OR {$priceCol} IS NULL)";
            } else {
                $where[] = $rangeExpr;
            }
            foreach ($bParams as $bp) {
                $sqlParams[] = $bp;
            }
        }

        $minA = ($minAreaSqFt !== null && $minAreaSqFt !== '' && is_numeric($minAreaSqFt)) ? (float)$minAreaSqFt : null;
        $maxA = ($maxAreaSqFt !== null && $maxAreaSqFt !== '' && is_numeric($maxAreaSqFt)) ? (float)$maxAreaSqFt : null;
        if ($minA !== null) {
            $where[] = 'p.area_sqft_norm >= ?';
            $sqlParams[] = $minA;
        }
        if ($maxA !== null) {
            $where[] = 'p.area_sqft_norm <= ?';
            $sqlParams[] = $maxA;
        }

        // Sorting
        $orderBy = 'p.is_featured_approved DESC, COALESCE(p.featured_sort_order, 9999) ASC, p.property_id ASC';
        if ($sort === 'price_desc') {
            $orderBy = "{$priceCol} IS NULL ASC, {$priceCol} DESC, p.property_id ASC";
        } elseif ($sort === 'price_asc') {
            $orderBy = "{$priceCol} IS NULL ASC, {$priceCol} ASC, p.property_id ASC";
        } elseif ($sort === 'newest') {
            $orderBy = 'p.created_at DESC, p.property_id ASC';
        } elseif ($sort === 'area_desc') {
            $orderBy = 'p.area_sqft_norm IS NULL ASC, p.area_sqft_norm DESC, p.property_id ASC';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM properties p {$whereClause}");
        $countStmt->execute($sqlParams);
        $total = (int)$countStmt->fetch()['total'];

        $safeLimit = min(max($limit, 1), 500);
        $safeOffset = max($offset, 0);

        $query = "
            SELECT p.*
            FROM properties p
            {$whereClause}
            ORDER BY {$orderBy}
            LIMIT {$safeLimit} OFFSET {$safeOffset}
        ";
        $stmt = $pdo->prepare($query);
        $stmt->execute($sqlParams);
        $rows = $stmt->fetchAll();

        $items = [];
        foreach ($rows as $row) {
            $projected = PrivacyGate::validateAndProjectPublicRecord($row);
            if ($projected['ok']) {
                $items[] = $projected['record'];
            }
        }

        return ['total' => $total, 'items' => $items];
    }

    /**
     * Advisor CRM Search Engine:
     * Full access across draft, pending_approval, approved_public, private_off_market, archived.
     * Searches private vault fields (owner name, broker name, exact unit, notes).
     */
    public static function searchCrmProperties(PDO $pdo, array $params = []): array
    {
        $q = trim((string)($params['q'] ?? ''));
        $publicationState = $params['publicationState'] ?? $params['publication_state'] ?? '';
        $availabilityState = $params['availabilityState'] ?? $params['availability_state'] ?? '';
        $corridor = $params['corridor'] ?? '';
        $category = $params['category'] ?? '';
        $purpose = $params['purpose'] ?? '';
        $reverifyDueOnly = !empty($params['reverifyDueOnly']) || !empty($params['reverify_due_only']);
        $minBudgetInr = $params['minBudgetInr'] ?? $params['min_budget_inr'] ?? null;
        $maxBudgetInr = $params['maxBudgetInr'] ?? $params['max_budget_inr'] ?? null;
        $sort = $params['sort'] ?? 'updated_desc';
        $limit = (int)($params['limit'] ?? 200);
        $offset = (int)($params['offset'] ?? 0);

        $where = ['1 = 1'];
        $sqlParams = [];

        $tokenGroups = self::expandSearchTokens($q);
        if (!empty($tokenGroups)) {
            foreach ($tokenGroups as $group) {
                $groupOr = [];
                foreach ($group as $variant) {
                    $groupOr[] = "(
                        LOWER(p.property_id) LIKE ?
                        OR LOWER(p.listing_title) LIKE ?
                        OR LOWER(p.project_name) LIKE ?
                        OR LOWER(p.corridor) LIKE ?
                        OR LOWER(COALESCE(p.locality, '')) LIKE ?
                        OR LOWER(COALESCE(p.sector, '')) LIKE ?
                        OR LOWER(COALESCE(pv.owner_name_cache, '')) LIKE ?
                        OR LOWER(COALESCE(pv.owner_phone_cache, '')) LIKE ?
                        OR LOWER(COALESCE(pv.broker_name_cache, '')) LIKE ?
                        OR LOWER(COALESCE(pv.broker_phone_cache, '')) LIKE ?
                        OR LOWER(COALESCE(pv.exact_unit_or_plot_no, '')) LIKE ?
                        OR LOWER(COALESCE(pv.internal_advisor_notes, '')) LIKE ?
                        OR LOWER(COALESCE(pv.payment_structure_notes, '')) LIKE ?
                        OR LOWER(COALESCE(pv.raw_whatsapp_text, '')) LIKE ?
                    )";
                    $like = "%{$variant}%";
                    for ($i = 0; $i < 14; $i++) {
                        $sqlParams[] = $like;
                    }
                }
                $where[] = '(' . implode(' OR ', $groupOr) . ')';
            }
        }

        if ($publicationState && $publicationState !== 'all') {
            $where[] = 'p.publication_state = ?';
            $sqlParams[] = $publicationState;
        }
        if ($availabilityState && $availabilityState !== 'all') {
            $where[] = 'p.availability_state = ?';
            $sqlParams[] = $availabilityState;
        }
        if ($corridor && $corridor !== 'all') {
            $where[] = 'p.corridor = ?';
            $sqlParams[] = $corridor;
        }
        if ($category && $category !== 'all') {
            $where[] = 'p.category = ?';
            $sqlParams[] = $category;
        }

        $purposeCond = self::purposeSqlCondition($purpose, 'p');
        if ($purposeCond['sql']) {
            $where[] = preg_replace('/^AND\s+/i', '', $purposeCond['sql']);
        }

        if ($reverifyDueOnly) {
            $thirtyDaysAhead = gmdate('Y-m-d', strtotime('+30 days'));
            $where[] = "(p.verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (p.next_reverify_due IS NOT NULL AND p.next_reverify_due <= ?))";
            $sqlParams[] = $thirtyDaysAhead;
        }

        if ($minBudgetInr !== null && $minBudgetInr !== '' && is_numeric($minBudgetInr)) {
            $where[] = 'COALESCE(pv.internal_floor_price_inr, p.price_inr_norm) >= ?';
            $sqlParams[] = (float)$minBudgetInr;
        }
        if ($maxBudgetInr !== null && $maxBudgetInr !== '' && is_numeric($maxBudgetInr)) {
            $where[] = 'COALESCE(pv.internal_floor_price_inr, p.price_inr_norm) <= ?';
            $sqlParams[] = (float)$maxBudgetInr;
        }

        $orderBy = "
            CASE p.publication_state
                WHEN 'pending_approval' THEN 0
                WHEN 'private_off_market' THEN 1
                WHEN 'draft' THEN 2
                WHEN 'approved_public' THEN 3
                ELSE 4
            END ASC,
            p.updated_at DESC,
            p.property_id ASC
        ";
        if ($sort === 'price_desc') {
            $orderBy = 'p.price_inr_norm IS NULL ASC, p.price_inr_norm DESC';
        } elseif ($sort === 'price_asc') {
            $orderBy = 'p.price_inr_norm IS NULL ASC, p.price_inr_norm ASC';
        } elseif ($sort === 'id_asc') {
            $orderBy = 'p.property_id ASC';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) AS total
            FROM properties p
            LEFT JOIN property_private pv ON pv.property_id = p.property_id
            {$whereClause}
        ");
        $countStmt->execute($sqlParams);
        $total = (int)$countStmt->fetch()['total'];

        $safeLimit = min(max($limit, 1), 500);
        $safeOffset = max($offset, 0);

        $query = "
            SELECT
                p.*,
                pv.owner_contact_id,
                pv.owner_name_cache,
                pv.owner_phone_cache,
                pv.owner_email_cache,
                pv.broker_contact_id,
                pv.broker_name_cache,
                pv.broker_phone_cache,
                pv.source_group_name,
                pv.exact_unit_or_plot_no,
                pv.internal_floor_price_inr,
                pv.commission_terms,
                pv.payment_structure_notes,
                pv.title_deed_verified,
                pv.encumbrance_notes,
                pv.raw_whatsapp_text,
                pv.internal_advisor_notes
            FROM properties p
            LEFT JOIN property_private pv ON pv.property_id = p.property_id
            {$whereClause}
            ORDER BY {$orderBy}
            LIMIT {$safeLimit} OFFSET {$safeOffset}
        ";
        $stmt = $pdo->prepare($query);
        $stmt->execute($sqlParams);
        $rows = $stmt->fetchAll();

        $items = [];
        foreach ($rows as $r) {
            $r['display_price'] = Normalizer::formatPublicPriceDisplay($r);
            $r['floor_price_display'] = !empty($r['internal_floor_price_inr']) ? Normalizer::formatInr($r['internal_floor_price_inr']) : null;
            $r['things_to_confirm'] = is_string($r['things_to_confirm'] ?? null)
                ? (json_decode($r['things_to_confirm'], true) ?: [])
                : ($r['things_to_confirm'] ?? []);
            $items[] = $r;
        }

        return ['total' => $total, 'items' => $items];
    }

    /**
     * Buyer Requirement Auto-Matcher:
     * Scores available mandates (Public + Off-Market Vault when allowed) from 0 to 100
     */
    public static function matchPropertiesForRequirement(PDO $pdo, array $spec): array
    {
        $parseArr = function ($val): array {
            if (is_array($val)) return $val;
            if (!$val) return [];
            $dec = json_decode((string)$val, true);
            return is_array($dec) ? $dec : [];
        };

        $corridors = array_map(fn($s) => mb_strtolower((string)$s, 'UTF-8'), $parseArr($spec['corridors_json'] ?? $spec['corridors'] ?? []));
        $sectors = array_map(fn($s) => mb_strtolower((string)$s, 'UTF-8'), $parseArr($spec['sectors_json'] ?? $spec['sectors'] ?? []));
        $categories = array_map(fn($s) => mb_strtolower((string)$s, 'UTF-8'), $parseArr($spec['categories_json'] ?? $spec['categories'] ?? []));
        $intent = mb_strtolower((string)($spec['intent'] ?? 'Buy'), 'UTF-8');
        $includeOffMarket = !empty($spec['include_off_market']);

        $allowedPubStates = $includeOffMarket
            ? "('approved_public', 'private_off_market')"
            : "('approved_public')";

        $stmt = $pdo->query("
            SELECT
                p.*,
                pv.internal_floor_price_inr,
                pv.owner_name_cache,
                pv.broker_name_cache,
                pv.exact_unit_or_plot_no
            FROM properties p
            LEFT JOIN property_private pv ON pv.property_id = p.property_id
            WHERE p.publication_state IN {$allowedPubStates}
              AND p.availability_state = 'available'
        ");
        $candidates = $stmt->fetchAll();

        $scored = [];
        $isRent = $intent === 'rent' || $intent === 'lease';

        foreach ($candidates as $c) {
            $tx = mb_strtolower((string)($c['transaction_type'] ?? ''), 'UTF-8');
            if ($isRent && !str_contains($tx, 'rent') && !str_contains($tx, 'lease')) {
                continue;
            }
            if (!$isRent && (str_contains($tx, 'rent') || str_contains($tx, 'lease')) && !str_contains($tx, 'sale')) {
                continue;
            }

            $score = 0;
            $reasons = [];

            // 1. Category fit (up to 25 pts)
            if (!empty($categories)) {
                if (in_array(mb_strtolower((string)($c['category'] ?? ''), 'UTF-8'), $categories, true)) {
                    $score += 25;
                    $reasons[] = "Category match ({$c['category']})";
                } else {
                    continue;
                }
            } else {
                $score += 15;
            }

            // 2. Corridor / Sector fit (up to 30 pts)
            $candCorridor = mb_strtolower((string)($c['corridor'] ?? ''), 'UTF-8');
            $candSector = mb_strtolower((string)($c['sector'] ?? ''), 'UTF-8');
            $candLocality = mb_strtolower((string)($c['locality'] ?? ''), 'UTF-8');

            if (!empty($corridors) || !empty($sectors)) {
                $corridorHit = false;
                foreach ($corridors as $cr) {
                    if ($candCorridor === $cr || str_contains($candLocality, $cr)) {
                        $corridorHit = true;
                        break;
                    }
                }
                $sectorHit = false;
                foreach ($sectors as $sc) {
                    if ($candSector === $sc || str_contains($candLocality, $sc)) {
                        $sectorHit = true;
                        break;
                    }
                }

                if ($sectorHit && $corridorHit) {
                    $score += 30;
                    $locLabel = $c['sector'] ?: $c['corridor'];
                    $reasons[] = "Exact sector & corridor ({$locLabel})";
                } elseif ($corridorHit || $sectorHit) {
                    $score += 26;
                    $reasons[] = "Target micro-market ({$c['corridor']})";
                } else {
                    continue;
                }
            } else {
                $score += 15;
            }

            // 3. Budget fit (up to 25 pts)
            $askPrice = $isRent ? ($c['rent_inr_monthly_norm'] ?? null) : ($c['price_inr_norm'] ?? null);
            $floorPrice = !$isRent ? ($c['internal_floor_price_inr'] ?? null) : null;
            $minB = !empty($spec['min_budget_inr']) ? (float)$spec['min_budget_inr'] : null;
            $maxB = !empty($spec['max_budget_inr']) ? (float)$spec['max_budget_inr'] : null;

            if ($minB !== null || $maxB !== null) {
                if ($askPrice !== null) {
                    $aboveMin = $minB === null || $askPrice >= ($minB * 0.85);
                    $belowMax = $maxB === null || $askPrice <= $maxB;
                    $nearMaxWithFloor = $maxB !== null && $floorPrice !== null && $floorPrice <= $maxB && $askPrice <= ($maxB * 1.12);
                    $slightlyStretch = $maxB !== null && $askPrice <= ($maxB * 1.12);

                    $dispPrice = Normalizer::formatPublicPriceDisplay($c);
                    if ($aboveMin && $belowMax) {
                        $score += 25;
                        $reasons[] = "Within budget ({$dispPrice})";
                    } elseif ($aboveMin && $nearMaxWithFloor) {
                        $score += 22;
                        $reasons[] = "Negotiable floor price fits budget (Ask {$dispPrice})";
                    } elseif ($aboveMin && $slightlyStretch) {
                        $score += 12;
                        $reasons[] = "+10% stretch option ({$dispPrice})";
                    } else {
                        continue;
                    }
                } else {
                    $score += 10;
                    $reasons[] = 'Price on request — confirm live quote';
                }
            } else {
                $score += 15;
            }

            // 4. Bedrooms & Area fit (up to 12 pts)
            if (!empty($spec['min_bedrooms'])) {
                $minBed = (int)$spec['min_bedrooms'];
                $cBed = (int)($c['bedrooms_int'] ?? 0);
                if ($cBed >= $minBed) {
                    $score += 7;
                    $reasons[] = "{$cBed} BHK configuration";
                } elseif ($cBed > 0 && $cBed < $minBed) {
                    continue;
                }
            } else {
                $score += 5;
            }

            if (!empty($spec['min_area_sqft']) && !empty($c['area_sqft_norm'])) {
                $minA = (float)$spec['min_area_sqft'];
                $cA = (float)$c['area_sqft_norm'];
                if ($cA >= $minA) {
                    $score += 5;
                    $unit = $c['area_unit'] ?: 'Sq Ft';
                    $reasons[] = "{$c['area_value']} {$unit}";
                } elseif ($cA < ($minA * 0.85)) {
                    continue;
                }
            } else {
                $score += 3;
            }

            // 5. Facing & Verification bonus (up to 8 pts)
            if (!empty($spec['preferred_facing']) && !empty($c['facing'])) {
                if (str_contains(mb_strtolower((string)$c['facing'], 'UTF-8'), mb_strtolower((string)$spec['preferred_facing'], 'UTF-8'))) {
                    $score += 4;
                    $reasons[] = "{$c['facing']} facing";
                }
            }
            if (in_array($c['verification_state'] ?? '', ['verified_direct', 'recently_reverified'], true)) {
                $score += 4;
                $reasons[] = ($c['publication_state'] === 'private_off_market') ? 'Direct Off-Market Vault' : 'Recently re-verified';
            }

            $scored[] = [
                'property_id' => $c['property_id'],
                'listing_title' => $c['listing_title'],
                'project_name' => $c['project_name'],
                'corridor' => $c['corridor'],
                'locality' => $c['locality'],
                'sector' => $c['sector'],
                'category' => $c['category'],
                'configuration' => $c['configuration'],
                'area_label' => $c['area_value'] ? trim("{$c['area_value']} " . ($c['area_unit'] ?? '')) : null,
                'display_price' => Normalizer::formatPublicPriceDisplay($c),
                'publication_state' => $c['publication_state'],
                'verification_state' => $c['verification_state'],
                'image_file' => $c['image_file'],
                'match_score' => min(100, $score),
                'match_reasons' => $reasons
            ];
        }

        usort($scored, function ($a, $b) {
            if ($b['match_score'] !== $a['match_score']) {
                return $b['match_score'] <=> $a['match_score'];
            }
            return strcmp($a['property_id'], $b['property_id']);
        });

        return array_slice($scored, 0, 30);
    }
}
