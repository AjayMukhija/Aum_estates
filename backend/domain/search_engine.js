'use strict';

const { formatPublicPriceDisplay, formatInr } = require('./normalizer');
const { validateAndProjectPublicRecord } = require('./privacy_gate');

const SYNONYM_MAP = {
  gcr: ['gcr', 'golf course road'],
  gcer: ['gcer', 'golf course ext', 'extension', 'spr'],
  spr: ['spr', 'southern peripheral', 'extension'],
  dxp: ['dxp', 'dwarka expressway'],
  kothi: ['kothi', 'villa', 'house', 'independent'],
  villa: ['villa', 'kothi', 'house'],
  floor: ['floor', 'builder floor'],
  floors: ['floors', 'builder floor'],
  huda: ['huda', 'hsvp', 'plot'],
  hsvp: ['hsvp', 'huda', 'plot'],
  sco: ['sco', 'commercial', 'shop', 'plot'],
  '2bhk': ['2bhk', '2 bhk'],
  '3bhk': ['3bhk', '3 bhk'],
  '4bhk': ['4bhk', '4 bhk'],
  '5bhk': ['5bhk', '5 bhk']
};

/**
 * Safely compiles a free-text query string into an SQLite FTS5 MATCH expression
 * with Gurugram domain synonym expansion and prefix matching.
 */
function buildFtsMatchQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return null;
  const cleaned = rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+]/gu, ' ')
    .trim();
  if (!cleaned) return null;

  const rawTokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
  if (rawTokens.length === 0) return null;

  const groups = [];
  for (const tok of rawTokens) {
    const safeTok = tok.replace(/[^a-z0-9]/g, '');
    if (!safeTok) continue;

    if (SYNONYM_MAP[safeTok]) {
      const variants = SYNONYM_MAP[safeTok].map((phrase) =>
        phrase.includes(' ') ? `"${phrase}"` : `"${phrase}"*`
      );
      groups.push(`(${variants.join(' OR ')})`);
    } else if (/^\d+$/.test(safeTok)) {
      groups.push(`"${safeTok}"`);
    } else {
      groups.push(`"${safeTok}"*`);
    }
  }

  return groups.length > 0 ? groups.join(' AND ') : null;
}

function purposeSqlCondition(purpose, alias = 'p') {
  const mode = String(purpose || '').toLowerCase().trim();
  if (!mode || mode === 'all') return { sql: '', params: [] };

  if (mode === 'rent' || mode === 'lease') {
    return {
      sql: `AND (LOWER(${alias}.transaction_type) LIKE '%rent%' OR LOWER(${alias}.transaction_type) LIKE '%lease%')`,
      params: []
    };
  }
  if (mode === 'commercial') {
    return {
      sql: `AND ${alias}.category = 'commercial'`,
      params: []
    };
  }
  if (mode === 'land' || mode === 'plot' || mode === 'plots') {
    return {
      sql: `AND ${alias}.category = 'plot'`,
      params: []
    };
  }
  if (mode === 'buy' || mode === 'sale') {
    return {
      sql: `AND (LOWER(${alias}.transaction_type) LIKE '%sale%' OR (LOWER(${alias}.transaction_type) NOT LIKE '%rent%' AND LOWER(${alias}.transaction_type) NOT LIKE '%lease%'))`,
      params: []
    };
  }
  return { sql: '', params: [] };
}

/**
 * Public Search Engine:
 * Strictly queries ONLY `approved_public` + `available` rows from `properties` and `properties_public_fts`.
 * Zero access to `property_private`. Every row passes through `validateAndProjectPublicRecord`.
 */
function searchPublicProperties(db, params = {}) {
  const {
    q = '',
    purpose = '',
    corridor = '',
    area = '',
    category = '',
    bedrooms = '',
    minBudgetInr = null,
    maxBudgetInr = null,
    minAreaSqFt = null,
    maxAreaSqFt = null,
    includePriceOnRequest = false,
    sort = 'featured',
    limit = 400,
    offset = 0
  } = params;

  const ftsQuery = buildFtsMatchQuery(q);
  const where = [
    "p.publication_state = 'approved_public'",
    "p.availability_state = 'available'"
  ];
  const sqlParams = [];

  let joinFts = '';
  let rankSelect = '0 AS fts_rank';
  if (ftsQuery) {
    joinFts = 'JOIN properties_public_fts fts ON fts.property_id = p.property_id';
    rankSelect = 'bm25(properties_public_fts, 5.0, 4.0, 2.5, 2.5, 2.0, 1.5, 1.0) AS fts_rank';
    where.push('properties_public_fts MATCH ?');
    sqlParams.push(ftsQuery);
  }

  const purposeCond = purposeSqlCondition(purpose, 'p');
  if (purposeCond.sql) {
    where.push(purposeCond.sql.replace(/^AND\s+/i, ''));
    sqlParams.push(...purposeCond.params);
  }

  const locFilter = (corridor || area || '').trim();
  if (locFilter && !['all', 'all areas', 'gurugram', 'gurgaon'].includes(locFilter.toLowerCase())) {
    where.push(`(
      LOWER(p.corridor) = LOWER(?)
      OR LOWER(COALESCE(p.locality, '')) LIKE ?
      OR LOWER(COALESCE(p.sector, '')) LIKE ?
      OR LOWER(COALESCE(p.micro_location, '')) LIKE ?
      OR LOWER(COALESCE(p.city, '')) LIKE ?
    )`);
    const like = `%${locFilter.toLowerCase()}%`;
    sqlParams.push(locFilter, like, like, like, like);
  } else if (locFilter.toLowerCase() === 'gurugram' || locFilter.toLowerCase() === 'gurgaon') {
    where.push("LOWER(COALESCE(p.city, 'gurgaon')) NOT LIKE '%goa%'");
  }

  if (category && category !== 'all') {
    where.push('LOWER(p.category) = LOWER(?)');
    sqlParams.push(String(category).trim());
  }

  if (bedrooms && bedrooms !== 'Any' && bedrooms !== 'all') {
    const bNum = parseInt(String(bedrooms), 10);
    if (Number.isFinite(bNum)) {
      if (String(bedrooms).includes('+')) {
        where.push('p.bedrooms_int >= ?');
        sqlParams.push(bNum);
      } else {
        where.push('p.bedrooms_int = ?');
        sqlParams.push(bNum);
      }
    }
  }

  const isRentMode = String(purpose || '').toLowerCase() === 'rent';
  const priceCol = isRentMode ? 'p.rent_inr_monthly_norm' : 'p.price_inr_norm';

  const minB = minBudgetInr != null && minBudgetInr !== '' ? Number(minBudgetInr) : null;
  const maxB = maxBudgetInr != null && maxBudgetInr !== '' ? Number(maxBudgetInr) : null;
  if (Number.isFinite(minB) || Number.isFinite(maxB)) {
    const budgetParts = [];
    const bParams = [];
    if (Number.isFinite(minB)) {
      budgetParts.push(`${priceCol} >= ?`);
      bParams.push(minB);
    }
    if (Number.isFinite(maxB)) {
      budgetParts.push(`${priceCol} <= ?`);
      bParams.push(maxB);
    }
    const rangeExpr = `(${priceCol} IS NOT NULL AND ${budgetParts.join(' AND ')})`;
    if (includePriceOnRequest) {
      where.push(`(${rangeExpr} OR ${priceCol} IS NULL)`);
    } else {
      where.push(rangeExpr);
    }
    sqlParams.push(...bParams);
  }

  const minA = minAreaSqFt != null && minAreaSqFt !== '' ? Number(minAreaSqFt) : null;
  const maxA = maxAreaSqFt != null && maxAreaSqFt !== '' ? Number(maxAreaSqFt) : null;
  if (Number.isFinite(minA)) {
    where.push('p.area_sqft_norm >= ?');
    sqlParams.push(minA);
  }
  if (Number.isFinite(maxA)) {
    where.push('p.area_sqft_norm <= ?');
    sqlParams.push(maxA);
  }

  let orderBy = 'p.is_featured_approved DESC, COALESCE(p.featured_sort_order, 9999) ASC, p.property_id ASC';
  if (ftsQuery && (!sort || sort === 'featured' || sort === 'relevance')) {
    orderBy = 'fts_rank ASC, p.is_featured_approved DESC, p.property_id ASC';
  } else if (sort === 'price_asc') {
    orderBy = `${priceCol} IS NULL ASC, ${priceCol} ASC, p.property_id ASC`;
  } else if (sort === 'price_desc') {
    orderBy = `${priceCol} IS NULL ASC, ${priceCol} DESC, p.property_id ASC`;
  } else if (sort === 'area_desc') {
    orderBy = 'p.area_sqft_norm IS NULL ASC, p.area_sqft_norm DESC, p.property_id ASC';
  } else if (sort === 'name' || sort === 'name_asc') {
    orderBy = 'LOWER(p.listing_title) ASC';
  } else if (sort === 'location') {
    orderBy = 'LOWER(p.corridor) ASC, LOWER(COALESCE(p.locality, p.sector, p.city)) ASC';
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const countRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM properties p
    ${joinFts}
    ${whereClause}
  `).get(...sqlParams);

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const rows = db.prepare(`
    SELECT p.*, ${rankSelect}
    FROM properties p
    ${joinFts}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...sqlParams, safeLimit, safeOffset);

  const items = [];
  for (const row of rows) {
    const projected = validateAndProjectPublicRecord(row);
    if (projected.ok) {
      items.push({
        ...projected.record,
        display_price: formatPublicPriceDisplay(row),
        is_featured_approved: Boolean(row.is_featured_approved)
      });
    }
  }

  // Compute live facets across approved_public + available mandates
  const corridorFacets = db.prepare(`
    SELECT corridor, COUNT(*) AS count
    FROM properties
    WHERE publication_state = 'approved_public' AND availability_state = 'available'
    GROUP BY corridor
    ORDER BY count DESC
  `).all();

  const categoryFacets = db.prepare(`
    SELECT category, COUNT(*) AS count
    FROM properties
    WHERE publication_state = 'approved_public' AND availability_state = 'available'
    GROUP BY category
    ORDER BY count DESC
  `).all();

  return {
    total: countRow.total,
    items,
    facets: {
      corridors: corridorFacets,
      categories: categoryFacets
    }
  };
}

function getPublicPropertyById(db, propertyId) {
  const row = db.prepare(`
    SELECT * FROM properties
    WHERE property_id = ?
      AND publication_state = 'approved_public'
      AND availability_state = 'available'
  `).get(propertyId);
  if (!row) return null;
  const projected = validateAndProjectPublicRecord(row);
  if (!projected.ok) return null;
  return {
    ...projected.record,
    display_price: formatPublicPriceDisplay(row),
    is_featured_approved: Boolean(row.is_featured_approved)
  };
}

/**
 * Authenticated Advisor CRM Master Search:
 * Searches across ALL publication/availability states and joins `property_private` + `properties_crm_fts`.
 */
function searchCrmProperties(db, params = {}) {
  const {
    q = '',
    publicationState = '',
    availabilityState = '',
    corridor = '',
    category = '',
    purpose = '',
    reverifyDueOnly = false,
    minBudgetInr = null,
    maxBudgetInr = null,
    sort = 'updated_desc',
    limit = 200,
    offset = 0
  } = params;

  const ftsQuery = buildFtsMatchQuery(q);
  const where = ['1 = 1'];
  const sqlParams = [];

  let joinFts = '';
  let rankSelect = '0 AS fts_rank';
  if (ftsQuery) {
    joinFts = 'JOIN properties_crm_fts fts ON fts.property_id = p.property_id';
    rankSelect = 'bm25(properties_crm_fts, 3.0, 5.0, 4.0, 5.0, 3.0, 2.0) AS fts_rank';
    where.push('properties_crm_fts MATCH ?');
    sqlParams.push(ftsQuery);
  }

  if (publicationState && publicationState !== 'all') {
    where.push('p.publication_state = ?');
    sqlParams.push(publicationState);
  }
  if (availabilityState && availabilityState !== 'all') {
    where.push('p.availability_state = ?');
    sqlParams.push(availabilityState);
  }
  if (corridor && corridor !== 'all') {
    where.push('p.corridor = ?');
    sqlParams.push(corridor);
  }
  if (category && category !== 'all') {
    where.push('p.category = ?');
    sqlParams.push(category);
  }

  const purposeCond = purposeSqlCondition(purpose, 'p');
  if (purposeCond.sql) {
    where.push(purposeCond.sql.replace(/^AND\s+/i, ''));
    sqlParams.push(...purposeCond.params);
  }

  if (reverifyDueOnly === true || reverifyDueOnly === '1' || reverifyDueOnly === 'true') {
    // Flag items whose next_reverify_due is <= 30 days from today or verification_state = 'needs_confirmation'
    where.push("(p.verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (p.next_reverify_due IS NOT NULL AND p.next_reverify_due <= date('now', '+30 days')))");
  }

  if (minBudgetInr != null && minBudgetInr !== '') {
    where.push('COALESCE(pv.internal_floor_price_inr, p.price_inr_norm) >= ?');
    sqlParams.push(Number(minBudgetInr));
  }
  if (maxBudgetInr != null && maxBudgetInr !== '') {
    where.push('COALESCE(pv.internal_floor_price_inr, p.price_inr_norm) <= ?');
    sqlParams.push(Number(maxBudgetInr));
  }

  let orderBy = `
    CASE p.publication_state
      WHEN 'pending_approval' THEN 0
      WHEN 'private_off_market' THEN 1
      WHEN 'draft' THEN 2
      WHEN 'approved_public' THEN 3
      ELSE 4
    END ASC,
    p.updated_at DESC,
    p.property_id ASC
  `;
  if (ftsQuery && (!sort || sort === 'relevance' || sort === 'updated_desc')) {
    orderBy = 'fts_rank ASC, p.updated_at DESC';
  } else if (sort === 'price_desc') {
    orderBy = 'p.price_inr_norm IS NULL ASC, p.price_inr_norm DESC';
  } else if (sort === 'price_asc') {
    orderBy = 'p.price_inr_norm IS NULL ASC, p.price_inr_norm ASC';
  } else if (sort === 'id_asc') {
    orderBy = 'p.property_id ASC';
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const countRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM properties p
    LEFT JOIN property_private pv ON pv.property_id = p.property_id
    ${joinFts}
    ${whereClause}
  `).get(...sqlParams);

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const rows = db.prepare(`
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
      pv.internal_advisor_notes,
      ${rankSelect}
    FROM properties p
    LEFT JOIN property_private pv ON pv.property_id = p.property_id
    ${joinFts}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...sqlParams, safeLimit, safeOffset);

  const items = rows.map((r) => ({
    ...r,
    display_price: formatPublicPriceDisplay(r),
    floor_price_display: r.internal_floor_price_inr ? formatInr(r.internal_floor_price_inr) : null,
    things_to_confirm: safeParseJsonArray(r.things_to_confirm)
  }));

  return { total: countRow.total, items };
}

function safeParseJsonArray(str) {
  if (Array.isArray(str)) return str;
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Buyer Requirement Auto-Matcher:
 * Scores available mandates (both Public + Off-Market Private Vault when allowed) from 0 to 100
 * with transparent advisor-facing match reasons.
 */
function matchPropertiesForRequirement(db, spec) {
  const corridors = safeParseJsonArray(spec.corridors_json ?? spec.corridors).map((s) => String(s).toLowerCase());
  const sectors = safeParseJsonArray(spec.sectors_json ?? spec.sectors).map((s) => String(s).toLowerCase());
  const categories = safeParseJsonArray(spec.categories_json ?? spec.categories).map((s) => String(s).toLowerCase());
  const intent = String(spec.intent || 'Buy').toLowerCase();
  const includeOffMarket = spec.include_off_market !== 0 && spec.include_off_market !== false;

  const allowedPubStates = includeOffMarket
    ? "('approved_public', 'private_off_market')"
    : "('approved_public')";

  const candidates = db.prepare(`
    SELECT
      p.*,
      pv.internal_floor_price_inr,
      pv.owner_name_cache,
      pv.broker_name_cache,
      pv.exact_unit_or_plot_no
    FROM properties p
    LEFT JOIN property_private pv ON pv.property_id = p.property_id
    WHERE p.publication_state IN ${allowedPubStates}
      AND p.availability_state = 'available'
  `).all();

  const scored = [];
  const isRent = intent === 'rent' || intent === 'lease';

  for (const c of candidates) {
    const tx = String(c.transaction_type || '').toLowerCase();
    if (isRent && !tx.includes('rent') && !tx.includes('lease')) continue;
    if (!isRent && (tx.includes('rent') || tx.includes('lease')) && !tx.includes('sale')) continue;

    let score = 0;
    const reasons = [];

    // 1. Category fit (up to 25 pts)
    if (categories.length > 0) {
      if (categories.includes(String(c.category || '').toLowerCase())) {
        score += 25;
        reasons.push(`Category match (${c.category})`);
      } else {
        continue; // Hard filter on incompatible asset class when explicitly specified
      }
    } else {
      score += 15;
    }

    // 2. Corridor / Sector fit (up to 30 pts)
    const candCorridor = String(c.corridor || '').toLowerCase();
    const candSector = String(c.sector || '').toLowerCase();
    const candLocality = String(c.locality || '').toLowerCase();
    if (corridors.length > 0 || sectors.length > 0) {
      const corridorHit = corridors.some((cr) => candCorridor === cr || candLocality.includes(cr));
      const sectorHit = sectors.some((sc) => candSector.includes(sc) || candLocality.includes(sc));
      if (sectorHit && corridorHit) {
        score += 30;
        reasons.push(`Exact sector & corridor (${c.sector || c.corridor})`);
      } else if (corridorHit || sectorHit) {
        score += 26;
        reasons.push(`Target micro-market (${c.corridor})`);
      } else {
        continue;
      }
    } else {
      score += 15;
    }

    // 3. Budget fit including internal floor price intelligence (up to 25 pts)
    const askPrice = isRent ? c.rent_inr_monthly_norm : c.price_inr_norm;
    const floorPrice = !isRent ? c.internal_floor_price_inr : null;
    const minB = spec.min_budget_inr ? Number(spec.min_budget_inr) : null;
    const maxB = spec.max_budget_inr ? Number(spec.max_budget_inr) : null;

    if (minB || maxB) {
      if (askPrice != null) {
        const aboveMin = !minB || askPrice >= minB * 0.85;
        const belowMax = !maxB || askPrice <= maxB;
        const nearMaxWithFloor = maxB && floorPrice && floorPrice <= maxB && askPrice <= maxB * 1.12;
        const slightlyStretch = maxB && askPrice <= maxB * 1.12;

        if (aboveMin && belowMax) {
          score += 25;
          reasons.push(`Within budget (${formatPublicPriceDisplay(c)})`);
        } else if (aboveMin && nearMaxWithFloor) {
          score += 22;
          reasons.push(`Negotiable floor price fits budget (Ask ${formatPublicPriceDisplay(c)})`);
        } else if (aboveMin && slightlyStretch) {
          score += 12;
          reasons.push(`+10% stretch option (${formatPublicPriceDisplay(c)})`);
        } else {
          continue;
        }
      } else {
        // Price on request in matching corridor & category remains a candidate at lower certainty
        score += 10;
        reasons.push('Price on request — confirm live quote');
      }
    } else {
      score += 15;
    }

    // 4. Bedrooms & Area fit (up to 12 pts)
    if (spec.min_bedrooms) {
      if (c.bedrooms_int && c.bedrooms_int >= Number(spec.min_bedrooms)) {
        score += 7;
        reasons.push(`${c.bedrooms_int} BHK configuration`);
      } else if (c.bedrooms_int && c.bedrooms_int < Number(spec.min_bedrooms)) {
        continue;
      }
    } else {
      score += 5;
    }

    if (spec.min_area_sqft && c.area_sqft_norm) {
      if (c.area_sqft_norm >= Number(spec.min_area_sqft)) {
        score += 5;
        reasons.push(`${c.area_value} ${c.area_unit || 'Sq Ft'}`);
      } else if (c.area_sqft_norm < Number(spec.min_area_sqft) * 0.85) {
        continue;
      }
    } else {
      score += 3;
    }

    // 5. Facing & Verification bonus (up to 8 pts)
    if (spec.preferred_facing && c.facing) {
      if (c.facing.toLowerCase().includes(String(spec.preferred_facing).toLowerCase())) {
        score += 4;
        reasons.push(`${c.facing} facing`);
      }
    }
    if (c.verification_state === 'verified_direct' || c.verification_state === 'recently_reverified') {
      score += 4;
      reasons.push(c.publication_state === 'private_off_market' ? 'Direct Off-Market Vault' : 'Recently re-verified');
    }

    scored.push({
      property_id: c.property_id,
      listing_title: c.listing_title,
      project_name: c.project_name,
      corridor: c.corridor,
      locality: c.locality,
      sector: c.sector,
      category: c.category,
      configuration: c.configuration,
      area_label: c.area_value ? `${c.area_value} ${c.area_unit || ''}`.trim() : null,
      display_price: formatPublicPriceDisplay(c),
      publication_state: c.publication_state,
      verification_state: c.verification_state,
      image_file: c.image_file,
      match_score: Math.min(100, score),
      match_reasons: reasons
    });
  }

  scored.sort((a, b) => b.match_score - a.match_score || a.property_id.localeCompare(b.property_id));
  return scored.slice(0, 30);
}

module.exports = {
  buildFtsMatchQuery,
  searchPublicProperties,
  getPublicPropertyById,
  searchCrmProperties,
  matchPropertiesForRequirement
};
