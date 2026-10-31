#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  PATHS,
  SERVER_CONFIG,
  OFFICIAL_WHATSAPP,
  PUBLICATION_STATES,
  AVAILABILITY_STATES,
  LEAD_STAGES,
  CONTACT_TYPES,
  ALLOWED_PUBLIC_FIELDS
} = require('./config');
const {
  openDatabase,
  withTransaction,
  syncPropertyFts,
  rebuildAllFts,
  recordAuditLog
} = require('./db/connection');
const { seedDatabaseIfEmpty, addDaysIso } = require('./db/seed');
const {
  verifyPassword,
  createSession,
  getAuthenticatedSession,
  destroySession,
  buildSessionCookie,
  verifyCsrf
} = require('./auth');
const {
  cleanWhitespace,
  slugify,
  normalizeAreaSqFt,
  normalizePriceInr,
  normalizeRentInr,
  cleanListingTitle,
  formatPublicPriceDisplay,
  classifyCategory,
  classifyCorridor,
  resolveRepresentativeImage,
  parseBedroomsInt
} = require('./domain/normalizer');
const {
  PROPERTY_ID_REGEX,
  validateAndProjectPublicRecord
} = require('./domain/privacy_gate');
const {
  searchPublicProperties,
  getPublicPropertyById,
  searchCrmProperties,
  matchPropertiesForRequirement
} = require('./domain/search_engine');
const {
  parseWhatsAppBroadcast,
  parseImportPayload,
  normalizeImportedRow
} = require('./domain/intake_parser');
const { compileAndPublishStaticFeeds } = require('./domain/publisher');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 262144) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Strictly contains static file resolution inside `baseDir`.
 * Rejects traversal (`..`), dotfiles (`.git`, `.env`, `.htaccess`), `backups`, and out-of-root symlinks.
 */
function resolveSafeStaticFile(baseDir, relativeUrlPath) {
  if (!baseDir || !fs.existsSync(baseDir)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(relativeUrlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const segments = decoded.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.startsWith('.')) return null;
    if (seg.toLowerCase() === 'backups' || seg.toLowerCase() === 'private_master_store') return null;
    if (/\.(?:bak|backup|md|txt|jsonl|sqlite|db)$/i.test(seg)) return null;
  }

  const realBase = fs.realpathSync(baseDir);
  let candidate = path.resolve(realBase, segments.join(path.sep));
  if (candidate !== realBase && !candidate.startsWith(realBase + path.sep)) {
    return null;
  }

  if (!fs.existsSync(candidate)) return null;
  const stat = fs.statSync(candidate);
  if (stat.isDirectory()) {
    candidate = path.join(candidate, 'index.html');
    if (!fs.existsSync(candidate)) return null;
  }

  const realCandidate = fs.realpathSync(candidate);
  if (realCandidate !== realBase && !realCandidate.startsWith(realBase + path.sep)) {
    return null;
  }
  if (!fs.statSync(realCandidate).isFile()) return null;
  return realCandidate;
}

function serveStaticFile(res, filePath, cacheControl = 'no-cache') {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl
  });
  fs.createReadStream(filePath).pipe(res);
}

function allocateNextPropertyId(db, prefix = 'AUM-WEB') {
  const rows = db.prepare('SELECT property_id FROM properties WHERE property_id LIKE ?').all(`${prefix}-%`);
  let maxNum = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const r of rows) {
    const m = String(r.property_id).match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `${prefix}-${String(maxNum + 1).padStart(6, '0')}`;
}

function allocatePrefixedId(db, table, col, prefix) {
  const rows = db.prepare(`SELECT ${col} AS id FROM ${table} WHERE ${col} LIKE ?`).all(`${prefix}-%`);
  let maxNum = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const r of rows) {
    const m = String(r.id).match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
}

function normalizePhoneDigits(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function upsertPropertyMaster(db, payload, actor, existingId = null) {
  const existing = existingId
    ? db.prepare(`
        SELECT p.*, pv.owner_contact_id, pv.owner_name_cache, pv.owner_phone_cache, pv.owner_email_cache,
               pv.broker_contact_id, pv.broker_name_cache, pv.broker_phone_cache, pv.source_group_name,
               pv.exact_unit_or_plot_no, pv.internal_floor_price_inr, pv.commission_terms,
               pv.payment_structure_notes, pv.title_deed_verified, pv.encumbrance_notes,
               pv.raw_whatsapp_text, pv.internal_advisor_notes
        FROM properties p
        LEFT JOIN property_private pv ON pv.property_id = p.property_id
        WHERE p.property_id = ?
      `).get(existingId)
    : null;

  if (existingId && !existing) {
    throw Object.assign(new Error(`Property not found: ${existingId}`), { statusCode: 404 });
  }

  const pubIn = payload.public || payload;
  const privIn = payload.private || payload._private || {};

  const propertyId = existingId
    || cleanWhitespace(pubIn.property_id)
    || allocateNextPropertyId(db, pubIn.publication_state === 'private_off_market' ? 'AUM-OFF' : 'AUM-WEB');

  if (!PROPERTY_ID_REGEX.test(propertyId)) {
    throw Object.assign(new Error(`Invalid property_id format: "${propertyId}"`), { statusCode: 400 });
  }
  if (!existingId) {
    const clash = db.prepare('SELECT 1 FROM properties WHERE property_id = ?').get(propertyId);
    if (clash) throw Object.assign(new Error(`Property ID already exists: ${propertyId}`), { statusCode: 409 });
  }

  const pickVal = (obj, key, fallback) => (obj[key] !== undefined ? obj[key] : fallback);

  const publicationState = pickVal(pubIn, 'publication_state', existing?.publication_state || 'draft');
  if (!PUBLICATION_STATES.has(publicationState)) {
    throw Object.assign(new Error(`Invalid publication_state: ${publicationState}`), { statusCode: 400 });
  }

  const availabilityState = pickVal(pubIn, 'availability_state', existing?.availability_state || 'available');
  if (!AVAILABILITY_STATES.has(availabilityState)) {
    throw Object.assign(new Error(`Invalid availability_state: ${availabilityState}`), { statusCode: 400 });
  }

  const projectName = cleanWhitespace(pickVal(pubIn, 'project_name', existing?.project_name));
  const rawTitle = cleanWhitespace(pickVal(pubIn, 'listing_title', existing?.listing_title));
  if (!rawTitle && !projectName) {
    throw Object.assign(new Error('Either listing_title or project_name is required'), { statusCode: 400 });
  }
  const listingTitle = cleanListingTitle(rawTitle, projectName);

  const areaValueRaw = pickVal(pubIn, 'area_value', existing?.area_value);
  const areaValue = areaValueRaw != null && areaValueRaw !== '' ? Number(areaValueRaw) : null;
  if (areaValue != null && (!Number.isFinite(areaValue) || areaValue < 0)) {
    throw Object.assign(new Error('area_value must be a non-negative number'), { statusCode: 400 });
  }
  const areaUnit = cleanWhitespace(pickVal(pubIn, 'area_unit', existing?.area_unit));
  const areaSqFtNorm = normalizeAreaSqFt(areaValue, areaUnit);

  const transactionType = cleanWhitespace(pickVal(pubIn, 'transaction_type', existing?.transaction_type)) || 'Sale';
  const priceValueRaw = pickVal(pubIn, 'price_value', existing?.price_value);
  const priceValue = priceValueRaw != null && priceValueRaw !== '' ? Number(priceValueRaw) : null;
  if (priceValue != null && (!Number.isFinite(priceValue) || priceValue < 0)) {
    throw Object.assign(new Error('price_value must be a non-negative number'), { statusCode: 400 });
  }
  const priceUnit = cleanWhitespace(pickVal(pubIn, 'price_unit', existing?.price_unit));
  const priceText = cleanWhitespace(pickVal(pubIn, 'price_text', existing?.price_text));

  const rentValueRaw = pickVal(pubIn, 'rent_value', existing?.rent_value);
  const rentValue = rentValueRaw != null && rentValueRaw !== '' ? Number(rentValueRaw) : null;
  if (rentValue != null && (!Number.isFinite(rentValue) || rentValue < 0)) {
    throw Object.assign(new Error('rent_value must be a non-negative number'), { statusCode: 400 });
  }
  const rentUnit = cleanWhitespace(pickVal(pubIn, 'rent_unit', existing?.rent_unit));

  const priceInrNorm = normalizePriceInr({
    priceValue,
    priceUnit,
    priceText,
    transactionType,
    areaValue,
    areaUnit,
    areaSqFtNorm
  });
  const rentInrNorm = normalizeRentInr({
    rentValue,
    rentUnit,
    priceValue,
    priceUnit,
    transactionType,
    areaSqFtNorm
  });

  const configuration = cleanWhitespace(pickVal(pubIn, 'configuration', existing?.configuration));
  const bedrooms = cleanWhitespace(pickVal(pubIn, 'bedrooms', existing?.bedrooms));
  const bedroomsInt = parseBedroomsInt(bedrooms, configuration, listingTitle);

  const mergedPublic = {
    property_id: propertyId,
    publication_state: publicationState,
    availability_state: availabilityState,
    project_id: cleanWhitespace(pickVal(pubIn, 'project_id', existing?.project_id)),
    project_name: projectName,
    location_id: cleanWhitespace(pickVal(pubIn, 'location_id', existing?.location_id)),
    city: cleanWhitespace(pickVal(pubIn, 'city', existing?.city)) || 'Gurgaon',
    locality: cleanWhitespace(pickVal(pubIn, 'locality', existing?.locality)),
    sector: cleanWhitespace(pickVal(pubIn, 'sector', existing?.sector)),
    micro_location: cleanWhitespace(pickVal(pubIn, 'micro_location', existing?.micro_location)),
    property_type: cleanWhitespace(pickVal(pubIn, 'property_type', existing?.property_type)) || 'Apartment',
    transaction_type: transactionType,
    listing_title: listingTitle,
    configuration,
    bedrooms: bedrooms || (bedroomsInt ? String(bedroomsInt) : null),
    bedrooms_int: bedroomsInt,
    bathrooms: cleanWhitespace(pickVal(pubIn, 'bathrooms', existing?.bathrooms)),
    area_value: areaValue,
    area_unit: areaUnit,
    area_sqft_norm: areaSqFtNorm,
    floor_label: cleanWhitespace(pickVal(pubIn, 'floor_label', existing?.floor_label)),
    total_floors: cleanWhitespace(pickVal(pubIn, 'total_floors', existing?.total_floors)),
    facing: cleanWhitespace(pickVal(pubIn, 'facing', existing?.facing)),
    road_width: cleanWhitespace(pickVal(pubIn, 'road_width', existing?.road_width)),
    furnishing: cleanWhitespace(pickVal(pubIn, 'furnishing', existing?.furnishing)),
    possession_status: cleanWhitespace(pickVal(pubIn, 'possession_status', existing?.possession_status)),
    price_value: priceValue,
    price_unit: priceUnit,
    price_text: priceText,
    price_inr_norm: priceInrNorm,
    rent_value: rentValue,
    rent_unit: rentUnit,
    rent_inr_monthly_norm: rentInrNorm,
    key_features: cleanWhitespace(pickVal(pubIn, 'key_features', existing?.key_features)),
    public_description: cleanWhitespace(pickVal(pubIn, 'public_description', existing?.public_description)),
    public_features: cleanWhitespace(pickVal(pubIn, 'public_features', existing?.public_features)),
    image_label: cleanWhitespace(pickVal(pubIn, 'image_label', existing?.image_label)) || 'Representative Reference Photograph',
    verification_status: cleanWhitespace(pickVal(pubIn, 'verification_status', existing?.verification_status)) || 'Availability to be confirmed',
    verification_state: cleanWhitespace(pickVal(pubIn, 'verification_state', existing?.verification_state)) || 'needs_confirmation',
    last_verified: cleanWhitespace(pickVal(pubIn, 'last_verified', existing?.last_verified)) || new Date().toISOString().slice(0, 10),
    things_to_confirm: Array.isArray(pubIn.things_to_confirm)
      ? JSON.stringify(pubIn.things_to_confirm)
      : (existing?.things_to_confirm || '["Exact unit & floor availability","Current asking price & complete cost breakdown"]'),
    is_featured_approved: pubIn.is_featured_approved !== undefined
      ? (pubIn.is_featured_approved ? 1 : 0)
      : (existing?.is_featured_approved || 0)
  };

  mergedPublic.category = cleanWhitespace(pubIn.category) || classifyCategory(mergedPublic);
  mergedPublic.corridor = cleanWhitespace(pubIn.corridor) || classifyCorridor(mergedPublic);
  mergedPublic.image_file = cleanWhitespace(pickVal(pubIn, 'image_file', existing?.image_file)) || resolveRepresentativeImage(mergedPublic);
  mergedPublic.next_reverify_due = addDaysIso(mergedPublic.last_verified, 120);
  mergedPublic.slug = cleanWhitespace(pickVal(pubIn, 'slug', existing?.slug)) || slugify(`${propertyId}-${listingTitle}`);
  mergedPublic.url = `https://aumestates.com/properties/detail.html?id=${encodeURIComponent(propertyId)}`;

  // FIDUCIARY FIREWALL: If record is approved_public (even if temporarily under_offer/sold), validate public fields for leaks!
  if (mergedPublic.publication_state === 'approved_public') {
    const check = validateAndProjectPublicRecord({
      ...mergedPublic,
      availability_state: 'available'
    });
    if (!check.ok) {
      const err = new Error(`Fiduciary Privacy Gate blocked public approval:\n${check.errors.join('\n')}`);
      err.statusCode = 422;
      err.validationErrors = check.errors;
      throw err;
    }
  }

  const rawFloor = pickVal(privIn, 'internal_floor_price_inr', existing?.internal_floor_price_inr);
  let floorInr = null;
  if (rawFloor != null && rawFloor !== '') {
    const fn = Number(rawFloor);
    if (Number.isFinite(fn) && fn > 0) {
      floorInr = fn < 500 ? Math.round(fn * 1e7) : Math.round(fn);
    }
  }

  const mergedPrivate = {
    property_id: propertyId,
    owner_contact_id: cleanWhitespace(pickVal(privIn, 'owner_contact_id', existing?.owner_contact_id)),
    owner_name_cache: cleanWhitespace(pickVal(privIn, 'owner_name_cache', existing?.owner_name_cache)),
    owner_phone_cache: cleanWhitespace(pickVal(privIn, 'owner_phone_cache', existing?.owner_phone_cache)),
    owner_email_cache: cleanWhitespace(pickVal(privIn, 'owner_email_cache', existing?.owner_email_cache)),
    broker_contact_id: cleanWhitespace(pickVal(privIn, 'broker_contact_id', existing?.broker_contact_id)),
    broker_name_cache: cleanWhitespace(pickVal(privIn, 'broker_name_cache', existing?.broker_name_cache)),
    broker_phone_cache: cleanWhitespace(pickVal(privIn, 'broker_phone_cache', existing?.broker_phone_cache)),
    source_group_name: cleanWhitespace(pickVal(privIn, 'source_group_name', existing?.source_group_name)),
    exact_unit_or_plot_no: cleanWhitespace(pickVal(privIn, 'exact_unit_or_plot_no', existing?.exact_unit_or_plot_no)),
    internal_floor_price_inr: floorInr,
    commission_terms: cleanWhitespace(pickVal(privIn, 'commission_terms', existing?.commission_terms)),
    payment_structure_notes: cleanWhitespace(pickVal(privIn, 'payment_structure_notes', existing?.payment_structure_notes)),
    title_deed_verified: privIn.title_deed_verified !== undefined
      ? (privIn.title_deed_verified ? 1 : 0)
      : (existing?.title_deed_verified || 0),
    encumbrance_notes: cleanWhitespace(pickVal(privIn, 'encumbrance_notes', existing?.encumbrance_notes)),
    raw_whatsapp_text: cleanWhitespace(pickVal(privIn, 'raw_whatsapp_text', existing?.raw_whatsapp_text)),
    internal_advisor_notes: cleanWhitespace(pickVal(privIn, 'internal_advisor_notes', existing?.internal_advisor_notes))
  };

  const nowIso = new Date().toISOString();
  const approvedBy = mergedPublic.publication_state === 'approved_public'
    ? (existing?.approved_by_user_id || actor.userId || null)
    : existing?.approved_by_user_id || null;
  const approvedAt = mergedPublic.publication_state === 'approved_public'
    ? (existing?.approved_at || nowIso)
    : existing?.approved_at || null;

  withTransaction(db, () => {
    if (!existing) {
      db.prepare(`
        INSERT INTO properties (
          property_id, publication_state, availability_state, project_id, project_name,
          location_id, city, locality, sector, micro_location, corridor,
          property_type, category, transaction_type, listing_title, configuration,
          bedrooms, bedrooms_int, bathrooms, area_value, area_unit, area_sqft_norm,
          floor_label, total_floors, facing, road_width, furnishing, possession_status,
          price_value, price_unit, price_text, price_inr_norm,
          rent_value, rent_unit, rent_inr_monthly_norm,
          key_features, public_description, public_features,
          image_file, image_label, verification_status, verification_state,
          last_verified, next_reverify_due, things_to_confirm,
          is_featured_approved, slug, url, approved_by_user_id, approved_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        mergedPublic.property_id, mergedPublic.publication_state, mergedPublic.availability_state,
        mergedPublic.project_id, mergedPublic.project_name, mergedPublic.location_id,
        mergedPublic.city, mergedPublic.locality, mergedPublic.sector, mergedPublic.micro_location, mergedPublic.corridor,
        mergedPublic.property_type, mergedPublic.category, mergedPublic.transaction_type,
        mergedPublic.listing_title, mergedPublic.configuration, mergedPublic.bedrooms, mergedPublic.bedrooms_int, mergedPublic.bathrooms,
        mergedPublic.area_value, mergedPublic.area_unit, mergedPublic.area_sqft_norm,
        mergedPublic.floor_label, mergedPublic.total_floors, mergedPublic.facing, mergedPublic.road_width,
        mergedPublic.furnishing, mergedPublic.possession_status,
        mergedPublic.price_value, mergedPublic.price_unit, mergedPublic.price_text, mergedPublic.price_inr_norm,
        mergedPublic.rent_value, mergedPublic.rent_unit, mergedPublic.rent_inr_monthly_norm,
        mergedPublic.key_features, mergedPublic.public_description, mergedPublic.public_features,
        mergedPublic.image_file, mergedPublic.image_label, mergedPublic.verification_status, mergedPublic.verification_state,
        mergedPublic.last_verified, mergedPublic.next_reverify_due, mergedPublic.things_to_confirm,
        mergedPublic.is_featured_approved, mergedPublic.slug, mergedPublic.url,
        approvedBy, approvedAt, nowIso, nowIso
      );
    } else {
      db.prepare(`
        UPDATE properties SET
          publication_state = ?, availability_state = ?, project_id = ?, project_name = ?,
          location_id = ?, city = ?, locality = ?, sector = ?, micro_location = ?, corridor = ?,
          property_type = ?, category = ?, transaction_type = ?, listing_title = ?, configuration = ?,
          bedrooms = ?, bedrooms_int = ?, bathrooms = ?, area_value = ?, area_unit = ?, area_sqft_norm = ?,
          floor_label = ?, total_floors = ?, facing = ?, road_width = ?, furnishing = ?, possession_status = ?,
          price_value = ?, price_unit = ?, price_text = ?, price_inr_norm = ?,
          rent_value = ?, rent_unit = ?, rent_inr_monthly_norm = ?,
          key_features = ?, public_description = ?, public_features = ?,
          image_file = ?, image_label = ?, verification_status = ?, verification_state = ?,
          last_verified = ?, next_reverify_due = ?, things_to_confirm = ?,
          is_featured_approved = ?, slug = ?, url = ?, approved_by_user_id = ?, approved_at = ?, updated_at = ?
        WHERE property_id = ?
      `).run(
        mergedPublic.publication_state, mergedPublic.availability_state, mergedPublic.project_id, mergedPublic.project_name,
        mergedPublic.location_id, mergedPublic.city, mergedPublic.locality, mergedPublic.sector, mergedPublic.micro_location, mergedPublic.corridor,
        mergedPublic.property_type, mergedPublic.category, mergedPublic.transaction_type, mergedPublic.listing_title, mergedPublic.configuration,
        mergedPublic.bedrooms, mergedPublic.bedrooms_int, mergedPublic.bathrooms, mergedPublic.area_value, mergedPublic.area_unit, mergedPublic.area_sqft_norm,
        mergedPublic.floor_label, mergedPublic.total_floors, mergedPublic.facing, mergedPublic.road_width, mergedPublic.furnishing, mergedPublic.possession_status,
        mergedPublic.price_value, mergedPublic.price_unit, mergedPublic.price_text, mergedPublic.price_inr_norm,
        mergedPublic.rent_value, mergedPublic.rent_unit, mergedPublic.rent_inr_monthly_norm,
        mergedPublic.key_features, mergedPublic.public_description, mergedPublic.public_features,
        mergedPublic.image_file, mergedPublic.image_label, mergedPublic.verification_status, mergedPublic.verification_state,
        mergedPublic.last_verified, mergedPublic.next_reverify_due, mergedPublic.things_to_confirm,
        mergedPublic.is_featured_approved, mergedPublic.slug, mergedPublic.url,
        approvedBy, approvedAt, nowIso,
        propertyId
      );
    }

    db.prepare(`
      INSERT OR REPLACE INTO property_private (
        property_id, owner_contact_id, owner_name_cache, owner_phone_cache, owner_email_cache,
        broker_contact_id, broker_name_cache, broker_phone_cache, source_group_name,
        exact_unit_or_plot_no, internal_floor_price_inr, commission_terms,
        payment_structure_notes, title_deed_verified, encumbrance_notes,
        raw_whatsapp_text, internal_advisor_notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      propertyId,
      mergedPrivate.owner_contact_id, mergedPrivate.owner_name_cache, mergedPrivate.owner_phone_cache, mergedPrivate.owner_email_cache,
      mergedPrivate.broker_contact_id, mergedPrivate.broker_name_cache, mergedPrivate.broker_phone_cache, mergedPrivate.source_group_name,
      mergedPrivate.exact_unit_or_plot_no, mergedPrivate.internal_floor_price_inr, mergedPrivate.commission_terms,
      mergedPrivate.payment_structure_notes, mergedPrivate.title_deed_verified, mergedPrivate.encumbrance_notes,
      mergedPrivate.raw_whatsapp_text, mergedPrivate.internal_advisor_notes, nowIso
    );

    syncPropertyFts(db, propertyId);

    recordAuditLog(db, {
      actorUserId: actor.userId,
      actorLabel: actor.label,
      entityType: 'property',
      entityId: propertyId,
      action: existing ? 'update_property' : 'create_property',
      summary: `${existing ? 'Updated' : 'Created'} ${propertyId} (${mergedPublic.listing_title}) [${mergedPublic.publication_state} / ${mergedPublic.availability_state}]`,
      before: existing ? { publication_state: existing.publication_state, availability_state: existing.availability_state, price_text: existing.price_text, price_value: existing.price_value } : null,
      after: { publication_state: mergedPublic.publication_state, availability_state: mergedPublic.availability_state, price_text: mergedPublic.price_text, price_value: mergedPublic.price_value }
    });
  });

  return searchCrmProperties(db, { q: '', limit: 1 }).items.find((x) => x.property_id === propertyId)
    || db.prepare('SELECT * FROM properties WHERE property_id = ?').get(propertyId);
}

function createAppServer(db, options = {}) {
  const rateBuckets = new Map();

  function checkRateLimit(key, maxReqs, windowMs) {
    const now = Date.now();
    const arr = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (arr.length >= maxReqs) return false;
    arr.push(now);
    rateBuckets.set(key, arr);
    return true;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = urlObj.pathname;
      const query = Object.fromEntries(urlObj.searchParams.entries());
      const clientIp = req.socket?.remoteAddress || '127.0.0.1';

      // ======================================================================
      // 1. PUBLIC BUYER & SHORTLIST API (/api/public/*)
      // ======================================================================
      if (pathname === '/api/public/health' && req.method === 'GET') {
        const cnt = db.prepare(
          "SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND availability_state = 'available'"
        ).get();
        return sendJson(res, 200, {
          ok: true,
          publicMandates: cnt.c,
          timestamp: new Date().toISOString()
        });
      }

      if (pathname === '/api/public/properties' && req.method === 'GET') {
        const result = searchPublicProperties(db, {
          q: query.q || '',
          purpose: query.purpose || query.mode || '',
          corridor: query.corridor || '',
          area: query.area || query.location || '',
          category: query.category || query.type || '',
          bedrooms: query.bedrooms || query.beds || '',
          minBudgetInr: query.minBudgetInr,
          maxBudgetInr: query.maxBudgetInr,
          minAreaSqFt: query.minAreaSqFt,
          maxAreaSqFt: query.maxAreaSqFt,
          includePriceOnRequest: query.includePriceOnRequest === '1' || query.includePriceOnRequest === 'true',
          sort: query.sort || 'featured',
          limit: query.limit || 400,
          offset: query.offset || 0
        });
        return sendJson(res, 200, { ok: true, ...result });
      }

      const pubPropMatch = pathname.match(/^\/api\/public\/properties\/([A-Za-z0-9-]+)$/);
      if (pubPropMatch && req.method === 'GET') {
        const item = getPublicPropertyById(db, pubPropMatch[1]);
        if (!item) return sendJson(res, 404, { ok: false, error: 'Property dossier not found or unavailable' });
        return sendJson(res, 200, { ok: true, item });
      }

      if (pathname === '/api/public/projects' && req.method === 'GET') {
        const onlyCurated = query.curated === '1' || query.curated === 'true';
        const rows = db.prepare(`
          SELECT project_id, project_name, city, locality, sector, micro_location, corridor,
                 project_type, status, description, key_amenities, price_band_text,
                 image_file, is_new_project_curated, slug, last_verified
          FROM projects
          WHERE publication_state = 'approved_public'
            ${onlyCurated ? 'AND is_new_project_curated = 1' : ''}
          ORDER BY is_new_project_curated DESC, COALESCE(curated_sort_order, 9999) ASC, project_id ASC
        `).all();
        return sendJson(res, 200, { ok: true, total: rows.length, items: rows });
      }

      // Tokenized Shareable Client Shortlist JSON (Fiduciary-safe projection: allows private_off_market items included in shortlist, strips 100% of property_private!)
      const pubShortlistMatch = pathname.match(/^\/api\/public\/shortlists\/([A-Za-z0-9_-]{12,64})$/);
      if (pubShortlistMatch && req.method === 'GET') {
        const token = pubShortlistMatch[1];
        const sl = db.prepare(`
          SELECT * FROM client_shortlists
          WHERE share_token = ? AND is_active = 1
        `).get(token);

        if (!sl) return sendJson(res, 404, { ok: false, error: 'Shortlist not found or expired' });
        if (sl.expires_at && new Date(sl.expires_at).getTime() < Date.now()) {
          return sendJson(res, 410, { ok: false, error: 'This private shortlist link has expired' });
        }

        db.prepare(`
          UPDATE client_shortlists
          SET view_count = view_count + 1,
              last_viewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE shortlist_id = ?
        `).run(sl.shortlist_id);

        const itemRows = db.prepare(`
          SELECT p.*, si.sort_order, si.advisor_commentary, si.match_score
          FROM shortlist_items si
          JOIN properties p ON p.property_id = si.property_id
          WHERE si.shortlist_id = ?
          ORDER BY si.sort_order ASC
        `).all(sl.shortlist_id);

        // Strictly project ONLY ALLOWED_PUBLIC_FIELDS + advisor's client-facing commentary
        const safeItems = itemRows.map((row) => {
          const dto = {};
          for (const f of ALLOWED_PUBLIC_FIELDS) {
            if (f === 'things_to_confirm') {
              try {
                dto[f] = JSON.parse(row.things_to_confirm || '[]');
              } catch {
                dto[f] = [];
              }
            } else if (f === 'status') {
              dto[f] = row.availability_state === 'available' ? 'Available' : row.availability_state;
            } else {
              dto[f] = row[f] ?? null;
            }
          }
          dto.display_price = formatPublicPriceDisplay(row);
          dto.is_off_market_curated = row.publication_state === 'private_off_market';
          dto.advisor_commentary = row.advisor_commentary || null;
          dto.match_score = row.match_score || null;
          return dto;
        });

        return sendJson(res, 200, {
          ok: true,
          shortlist: {
            title: sl.title,
            client_name: sl.client_name,
            advisor_intro_note: sl.advisor_intro_note,
            created_at: sl.created_at,
            items: safeItems
          }
        });
      }

      // Durable Website Lead & Enquiry Capture
      if (pathname === '/api/public/inquiries' && req.method === 'POST') {
        if (!checkRateLimit(`inq:${clientIp}`, 30, 60000)) {
          return sendJson(res, 429, { ok: false, error: 'Too many requests; please wait a moment.' });
        }
        const body = await readJsonBody(req);

        const idempKey = cleanWhitespace(body.idempotency_key);
        if (idempKey) {
          const existingLead = db.prepare('SELECT lead_id FROM leads WHERE idempotency_key = ?').get(idempKey);
          if (existingLead) {
            return sendJson(res, 200, { ok: true, deduplicated: true, lead_id: existingLead.lead_id });
          }
        }

        const clientName = cleanWhitespace(body.client_name || body.name) || 'Website Visitor';
        const clientPhone = cleanWhitespace(body.client_phone || body.phone);
        const phoneNorm = normalizePhoneDigits(clientPhone);
        const clientEmail = cleanWhitespace(body.client_email || body.email);
        const intent = cleanWhitespace(body.intent || body.purpose) || 'Buy';
        const situation = cleanWhitespace(body.situation);
        const preferredLocation = cleanWhitespace(body.preferred_location || body.location) || 'Gurugram';
        const budgetText = cleanWhitespace(body.budget_text || body.budget);
        const message = cleanWhitespace(body.message || body.inquiry_message);
        const primaryPropId = cleanWhitespace(body.property_id);
        const sourceChannel = cleanWhitespace(body.source_channel || body.action) || 'website';
        const sourcePage = cleanWhitespace(body.source_page || body.source) || 'web';
        const selectedQuestions = Array.isArray(body.selected_questions) ? body.selected_questions.slice(0, 12) : [];
        const savedIds = Array.isArray(body.saved_property_ids) ? body.saved_property_ids.slice(0, 10) : [];

        // Validate primaryPropId exists so FK never errors on stale external ID
        const validProp = primaryPropId
          ? db.prepare('SELECT property_id, listing_title, corridor FROM properties WHERE property_id = ?').get(primaryPropId)
          : null;

        const created = withTransaction(db, () => {
          let contactId = null;
          if (phoneNorm) {
            const found = db.prepare('SELECT contact_id FROM contacts WHERE phone_norm = ?').get(phoneNorm);
            if (found) {
              contactId = found.contact_id;
            } else {
              contactId = allocatePrefixedId(db, 'contacts', 'contact_id', 'CNT-WEB');
              db.prepare(`
                INSERT INTO contacts (contact_id, contact_type, full_name, phone_primary, phone_norm, email, city, preferred_channel)
                VALUES (?, ?, ?, ?, ?, ?, 'Gurgaon', 'whatsapp')
              `).run(
                contactId,
                intent.toLowerCase().includes('sell') || intent.toLowerCase().includes('lease out') ? 'seller_owner' : 'buyer',
                clientName,
                clientPhone,
                phoneNorm,
                clientEmail
              );
            }
          }

          const leadId = allocatePrefixedId(db, 'leads', 'lead_id', 'LEAD-2026');
          const titleTopic = validProp
            ? `${validProp.listing_title} (${validProp.property_id})`
            : `${intent} · ${preferredLocation}`;
          const leadTitle = `${clientName} — ${titleTopic}`.slice(0, 140);

          db.prepare(`
            INSERT INTO leads (
              lead_id, contact_id, lead_title, client_name, client_phone, client_email,
              stage, priority, intent, situation, preferred_location, budget_text,
              source_channel, source_page, primary_property_id, inquiry_message,
              selected_questions_json, saved_property_ids_json, idempotency_key
            ) VALUES (?, ?, ?, ?, ?, ?, 'new_inquiry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            leadId,
            contactId,
            leadTitle,
            clientName,
            clientPhone,
            clientEmail,
            clientPhone || selectedQuestions.length > 0 || savedIds.length > 0 ? 'high' : 'normal',
            intent,
            situation,
            preferredLocation,
            budgetText,
            sourceChannel,
            sourcePage,
            validProp ? validProp.property_id : null,
            message,
            JSON.stringify(selectedQuestions),
            JSON.stringify(savedIds),
            idempKey
          );

          // Automatically scaffold a buyer requirement record so 1-click Auto-Match works immediately
          if (!/sell|lease out/i.test(intent)) {
            const reqId = allocatePrefixedId(db, 'buyer_requirements', 'requirement_id', 'REQ-2026');
            const initialCorridors = validProp ? [validProp.corridor] : [];
            db.prepare(`
              INSERT INTO buyer_requirements (
                requirement_id, lead_id, contact_id, intent, corridors_json, include_off_market, must_have_notes
              ) VALUES (?, ?, ?, ?, ?, 1, ?)
            `).run(
              reqId,
              leadId,
              contactId,
              intent,
              JSON.stringify(initialCorridors),
              [budgetText ? `Stated budget: ${budgetText}` : null, message].filter(Boolean).join(' · ') || null
            );
          }

          db.prepare(`
            INSERT INTO crm_activities (lead_id, contact_id, property_id, activity_type, summary, metadata_json)
            VALUES (?, ?, ?, 'website_inquiry', ?, ?)
          `).run(
            leadId,
            contactId,
            validProp ? validProp.property_id : null,
            `Inbound ${sourceChannel} enquiry from ${sourcePage}${validProp ? ` regarding ${validProp.property_id}` : ''}.`,
            JSON.stringify({ selectedQuestions, savedIds, budgetText, preferredLocation })
          );

          return { leadId, contactId };
        });

        const waText = message || `Hello AUM ESTATES, I am inquiring regarding ${validProp ? `${validProp.listing_title} (Ref: ${validProp.property_id})` : `${intent} options in ${preferredLocation}`}.`;
        return sendJson(res, 201, {
          ok: true,
          lead_id: created.leadId,
          whatsapp_url: `https://wa.me/${OFFICIAL_WHATSAPP}?text=${encodeURIComponent(waText)}`
        });
      }

      // ======================================================================
      // 2. ADVISOR CRM AUTHENTICATION (/api/crm/auth/*)
      // ======================================================================
      if (pathname === '/api/crm/auth/login' && req.method === 'POST') {
        if (!checkRateLimit(`login:${clientIp}`, 15, 60000)) {
          return sendJson(res, 429, { ok: false, error: 'Too many login attempts. Try again in a minute.' });
        }
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1').get(email);
        if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
          return sendJson(res, 401, { ok: false, error: 'Invalid advisor email or password' });
        }

        const sess = createSession(db, user.user_id, clientIp);
        recordAuditLog(db, {
          actorUserId: user.user_id,
          actorLabel: user.email,
          entityType: 'session',
          entityId: sess.sessionId.slice(0, 12),
          action: 'advisor_login',
          summary: `${user.full_name} signed into CRM`
        });

        return sendJson(
          res,
          200,
          {
            ok: true,
            user: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role },
            csrfToken: sess.csrfToken,
            sessionId: sess.sessionId
          },
          { 'Set-Cookie': buildSessionCookie(sess.sessionId, SERVER_CONFIG.sessionTtlHours * 3600) }
        );
      }

      if (pathname === '/api/crm/auth/logout' && req.method === 'POST') {
        destroySession(db, req);
        return sendJson(
          res,
          200,
          { ok: true },
          { 'Set-Cookie': buildSessionCookie('', 0) }
        );
      }

      if (pathname === '/api/crm/auth/session' && req.method === 'GET') {
        const sess = getAuthenticatedSession(db, req);
        if (!sess) return sendJson(res, 200, { ok: true, authenticated: false });
        return sendJson(res, 200, {
          ok: true,
          authenticated: true,
          user: { user_id: sess.user_id, email: sess.email, full_name: sess.full_name, role: sess.role },
          csrfToken: sess.csrf_token
        });
      }

      // ======================================================================
      // 3. PROTECTED ADVISOR CRM API (/api/crm/*)
      // ======================================================================
      if (pathname.startsWith('/api/crm/')) {
        const session = getAuthenticatedSession(db, req);
        if (!session) {
          return sendJson(res, 401, { ok: false, error: 'Authentication required' });
        }
        if (!verifyCsrf(req, session)) {
          return sendJson(res, 403, { ok: false, error: 'Invalid or missing CSRF token' });
        }
        const actor = { userId: session.user_id, label: session.email, name: session.full_name, role: session.role };

        // Dashboard Overview
        if (pathname === '/api/crm/dashboard' && req.method === 'GET') {
          const invCounts = db.prepare(`
            SELECT
              COUNT(*) AS total_master,
              SUM(CASE WHEN publication_state = 'approved_public' AND availability_state = 'available' THEN 1 ELSE 0 END) AS live_public,
              SUM(CASE WHEN publication_state = 'private_off_market' AND availability_state = 'available' THEN 1 ELSE 0 END) AS off_market,
              SUM(CASE WHEN publication_state = 'pending_approval' THEN 1 ELSE 0 END) AS pending_approval,
              SUM(CASE WHEN availability_state IN ('sold', 'leased', 'under_offer') THEN 1 ELSE 0 END) AS closed_or_offer,
              SUM(CASE WHEN verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (next_reverify_due IS NOT NULL AND next_reverify_due <= date('now', '+30 days')) THEN 1 ELSE 0 END) AS reverify_due
            FROM properties
          `).get();

          const stageCounts = db.prepare(`
            SELECT stage, COUNT(*) AS count
            FROM leads
            GROUP BY stage
          `).all();

          const recentLeads = db.prepare(`
            SELECT lead_id, lead_title, client_name, client_phone, stage, priority, intent, preferred_location, budget_text, source_channel, primary_property_id, created_at
            FROM leads
            ORDER BY created_at DESC
            LIMIT 8
          `).all();

          const pendingItems = db.prepare(`
            SELECT p.property_id, p.listing_title, p.project_name, p.corridor, p.category, p.price_text, p.price_inr_norm,
                   pv.broker_name_cache, pv.broker_phone_cache, pv.source_group_name, p.created_at
            FROM properties p
            LEFT JOIN property_private pv ON pv.property_id = p.property_id
            WHERE p.publication_state = 'pending_approval'
            ORDER BY p.updated_at DESC
            LIMIT 10
          `).all();

          const reverifyQueue = db.prepare(`
            SELECT property_id, listing_title, corridor, category, last_verified, next_reverify_due, verification_status
            FROM properties
            WHERE availability_state = 'available'
              AND (verification_state IN ('needs_confirmation', 'stale_reverify_due') OR (next_reverify_due IS NOT NULL AND next_reverify_due <= date('now', '+30 days')))
            ORDER BY COALESCE(next_reverify_due, '1970-01-01') ASC
            LIMIT 10
          `).all();

          let latestRelease = null;
          const latestManifestPath = path.join(PATHS.releasesDir, 'latest_manifest.json');
          if (fs.existsSync(latestManifestPath)) {
            try {
              latestRelease = JSON.parse(fs.readFileSync(latestManifestPath, 'utf8'));
            } catch {}
          }

          return sendJson(res, 200, {
            ok: true,
            inventory: invCounts,
            pipeline: stageCounts,
            recentLeads,
            pendingApprovals: pendingItems,
            reverifyQueue,
            latestRelease
          });
        }

        // Master Properties Search & Create
        if (pathname === '/api/crm/properties' && req.method === 'GET') {
          const result = searchCrmProperties(db, {
            q: query.q || '',
            publicationState: query.publicationState || '',
            availabilityState: query.availabilityState || '',
            corridor: query.corridor || '',
            category: query.category || '',
            purpose: query.purpose || '',
            reverifyDueOnly: query.reverifyDueOnly,
            minBudgetInr: query.minBudgetInr,
            maxBudgetInr: query.maxBudgetInr,
            sort: query.sort || 'updated_desc',
            limit: query.limit || 150,
            offset: query.offset || 0
          });
          return sendJson(res, 200, { ok: true, ...result });
        }

        if (pathname === '/api/crm/properties' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const saved = upsertPropertyMaster(db, body, actor, null);
          return sendJson(res, 201, { ok: true, item: saved });
        }

        // Single Property Detail / Update / Approve / Reverify
        const crmPropActionMatch = pathname.match(/^\/api\/crm\/properties\/([A-Za-z0-9-]+)(?:\/(approve|reverify))?$/);
        if (crmPropActionMatch) {
          const propId = crmPropActionMatch[1];
          const subAction = crmPropActionMatch[2];

          if (!subAction && req.method === 'GET') {
            const found = searchCrmProperties(db, { limit: 1, q: '' });
            const row = db.prepare(`
              SELECT p.*, pv.owner_contact_id, pv.owner_name_cache, pv.owner_phone_cache, pv.owner_email_cache,
                     pv.broker_contact_id, pv.broker_name_cache, pv.broker_phone_cache, pv.source_group_name,
                     pv.exact_unit_or_plot_no, pv.internal_floor_price_inr, pv.commission_terms,
                     pv.payment_structure_notes, pv.title_deed_verified, pv.encumbrance_notes,
                     pv.raw_whatsapp_text, pv.internal_advisor_notes
              FROM properties p
              LEFT JOIN property_private pv ON pv.property_id = p.property_id
              WHERE p.property_id = ?
            `).get(propId);
            if (!row) return sendJson(res, 404, { ok: false, error: 'Property not found' });

            const history = db.prepare(`
              SELECT * FROM audit_logs
              WHERE entity_type = 'property' AND entity_id = ?
              ORDER BY created_at DESC LIMIT 20
            `).all(propId);

            const inquiries = db.prepare(`
              SELECT lead_id, client_name, client_phone, stage, created_at
              FROM leads WHERE primary_property_id = ?
              ORDER BY created_at DESC LIMIT 10
            `).all(propId);

            return sendJson(res, 200, {
              ok: true,
              item: {
                ...row,
                display_price: formatPublicPriceDisplay(row)
              },
              auditHistory: history,
              linkedLeads: inquiries
            });
          }

          if (!subAction && (req.method === 'PUT' || req.method === 'PATCH')) {
            const body = await readJsonBody(req);
            const updated = upsertPropertyMaster(db, body, actor, propId);
            return sendJson(res, 200, { ok: true, item: updated });
          }

          if (subAction === 'approve' && req.method === 'POST') {
            const updated = upsertPropertyMaster(
              db,
              { public: { publication_state: 'approved_public' } },
              actor,
              propId
            );
            return sendJson(res, 200, { ok: true, item: updated });
          }

          if (subAction === 'reverify' && req.method === 'POST') {
            const today = new Date().toISOString().slice(0, 10);
            const updated = upsertPropertyMaster(
              db,
              {
                public: {
                  last_verified: today,
                  verification_state: 'verified_direct',
                  verification_status: 'Recently re-verified'
                }
              },
              actor,
              propId
            );
            return sendJson(res, 200, { ok: true, item: updated });
          }
        }

        // Two-Pass WhatsApp Broadcast Intake
        if (pathname === '/api/crm/intake/whatsapp' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const parsed = parseWhatsAppBroadcast(body.rawText, { sourceGroup: body.sourceGroup });

          if (!body.commit) {
            return sendJson(res, 200, { ok: true, committed: false, ...parsed });
          }

          const draftId = allocateNextPropertyId(db, 'AUM-DRF');
          const saved = upsertPropertyMaster(
            db,
            {
              public: { ...parsed.publicDraft, property_id: draftId, publication_state: 'pending_approval' },
              private: parsed.privateVault
            },
            actor,
            null
          );
          return sendJson(res, 201, { ok: true, committed: true, item: saved, quarantineSummary: parsed.quarantineSummary });
        }

        // Master Spreadsheet (.xlsx / .csv / .tsv / .json) Importer with Dry-Run Validation
        if (pathname === '/api/crm/intake/import' && req.method === 'POST') {
          const body = await readJsonBody(req, 10 * 1024 * 1024); // 10 MB cap for Excel workbooks
          const rawRows = parseImportPayload({
            format: body.format,
            contentBase64: body.contentBase64,
            text: body.text
          });

          if (rawRows.length === 0) {
            return sendJson(res, 400, { ok: false, error: 'No data rows found in import file' });
          }

          const existingIds = new Set(
            db.prepare('SELECT property_id FROM properties').all().map((r) => r.property_id)
          );
          let nextNum = db.prepare("SELECT COUNT(*) AS c FROM properties").get().c + 500;

          const normalizedBatch = [];
          const issues = [];
          const seenBatchIds = new Set();

          rawRows.forEach((rawRow, idx) => {
            const fallbackId = `AUM-IMP-${String(++nextNum).padStart(6, '0')}`;
            const { publicRecord, privateRecord } = normalizeImportedRow(rawRow, fallbackId);

            if (!PROPERTY_ID_REGEX.test(publicRecord.property_id)) {
              issues.push(`Row #${idx + 1}: Invalid property_id "${publicRecord.property_id}"`);
              return;
            }
            if (seenBatchIds.has(publicRecord.property_id)) {
              issues.push(`Row #${idx + 1}: Duplicate property_id "${publicRecord.property_id}" inside file`);
              return;
            }
            seenBatchIds.add(publicRecord.property_id);

            // If row asks for approved_public, verify privacy gate passes; otherwise demote to pending_approval
            if (publicRecord.publication_state === 'approved_public') {
              const check = validateAndProjectPublicRecord({
                ...publicRecord,
                availability_state: 'available'
              });
              if (!check.ok) {
                publicRecord.publication_state = 'pending_approval';
                issues.push(`Row #${idx + 1} (${publicRecord.property_id}) demoted to pending_approval: ${check.errors[0]}`);
              }
            }

            normalizedBatch.push({
              isUpdate: existingIds.has(publicRecord.property_id),
              publicRecord,
              privateRecord
            });
          });

          const summary = {
            totalParsed: rawRows.length,
            validRecords: normalizedBatch.length,
            newCount: normalizedBatch.filter((x) => !x.isUpdate).length,
            updateCount: normalizedBatch.filter((x) => x.isUpdate).length,
            privateVaultPopulated: normalizedBatch.filter(
              (x) => x.privateRecord.owner_name_cache || x.privateRecord.owner_phone_cache || x.privateRecord.broker_phone_cache || x.privateRecord.payment_structure_notes
            ).length,
            issues
          };

          if (body.dryRun !== false) {
            return sendJson(res, 200, {
              ok: true,
              dryRun: true,
              summary,
              preview: normalizedBatch.slice(0, 8)
            });
          }

          for (const entry of normalizedBatch) {
            upsertPropertyMaster(
              db,
              { public: entry.publicRecord, private: entry.privateRecord },
              actor,
              entry.isUpdate ? entry.publicRecord.property_id : null
            );
          }

          return sendJson(res, 200, { ok: true, dryRun: false, summary });
        }

        // Contacts Directory
        if (pathname === '/api/crm/contacts' && req.method === 'GET') {
          const typeFilter = query.type && query.type !== 'all' ? query.type : null;
          const qText = (query.q || '').trim().toLowerCase();
          const where = ['1 = 1'];
          const params = [];
          if (typeFilter) {
            where.push('c.contact_type = ?');
            params.push(typeFilter);
          }
          if (qText) {
            where.push("(LOWER(c.full_name) LIKE ? OR LOWER(COALESCE(c.firm_or_syndicate, '')) LIKE ? OR COALESCE(c.phone_primary, '') LIKE ?)");
            const like = `%${qText}%`;
            params.push(like, like, like);
          }
          const items = db.prepare(`
            SELECT
              c.*,
              (SELECT COUNT(*) FROM property_private pv WHERE pv.owner_contact_id = c.contact_id OR pv.broker_contact_id = c.contact_id) AS linked_properties,
              (SELECT COUNT(*) FROM leads l WHERE l.contact_id = c.contact_id) AS linked_leads
            FROM contacts c
            WHERE ${where.join(' AND ')}
            ORDER BY c.updated_at DESC
            LIMIT 200
          `).all(...params);
          return sendJson(res, 200, { ok: true, items });
        }

        if (pathname === '/api/crm/contacts' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const fullName = cleanWhitespace(body.full_name);
          if (!fullName) return sendJson(res, 400, { ok: false, error: 'full_name is required' });
          const cType = CONTACT_TYPES.has(body.contact_type) ? body.contact_type : 'buyer';
          const contactId = allocatePrefixedId(db, 'contacts', 'contact_id', 'CNT');
          const phonePrimary = cleanWhitespace(body.phone_primary);

          db.prepare(`
            INSERT INTO contacts (
              contact_id, contact_type, full_name, firm_or_syndicate, phone_primary, phone_norm,
              email, city, preferred_channel, trust_tier, private_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            contactId,
            cType,
            fullName,
            cleanWhitespace(body.firm_or_syndicate),
            phonePrimary,
            normalizePhoneDigits(phonePrimary),
            cleanWhitespace(body.email),
            cleanWhitespace(body.city) || 'Gurgaon',
            cleanWhitespace(body.preferred_channel) || 'whatsapp',
            cleanWhitespace(body.trust_tier) || 'standard',
            cleanWhitespace(body.private_notes)
          );

          recordAuditLog(db, {
            actorUserId: actor.userId,
            actorLabel: actor.label,
            entityType: 'contact',
            entityId: contactId,
            action: 'create_contact',
            summary: `Added ${cType} contact: ${fullName}`
          });

          const created = db.prepare('SELECT * FROM contacts WHERE contact_id = ?').get(contactId);
          return sendJson(res, 201, { ok: true, item: created });
        }

        // Leads & Deal Pipeline
        if (pathname === '/api/crm/leads' && req.method === 'GET') {
          const stageFilter = query.stage && query.stage !== 'all' ? query.stage : null;
          const items = db.prepare(`
            SELECT l.*, p.listing_title AS primary_property_title
            FROM leads l
            LEFT JOIN properties p ON p.property_id = l.primary_property_id
            ${stageFilter ? 'WHERE l.stage = ?' : ''}
            ORDER BY l.updated_at DESC
            LIMIT 200
          `).all(...(stageFilter ? [stageFilter] : []));
          return sendJson(res, 200, { ok: true, items, stages: LEAD_STAGES });
        }

        if (pathname === '/api/crm/leads' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const clientName = cleanWhitespace(body.client_name);
          if (!clientName) return sendJson(res, 400, { ok: false, error: 'client_name is required' });
          const leadId = allocatePrefixedId(db, 'leads', 'lead_id', 'LEAD-2026');
          const intent = cleanWhitespace(body.intent) || 'Buy';
          const prefLoc = cleanWhitespace(body.preferred_location) || 'Gurugram';
          const leadTitle = cleanWhitespace(body.lead_title) || `${clientName} — ${intent} (${prefLoc})`;

          withTransaction(db, () => {
            db.prepare(`
              INSERT INTO leads (
                lead_id, lead_title, client_name, client_phone, client_email,
                stage, priority, intent, preferred_location, budget_text,
                source_channel, assigned_user_id, inquiry_message, next_followup_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              leadId,
              leadTitle,
              clientName,
              cleanWhitespace(body.client_phone),
              cleanWhitespace(body.client_email),
              LEAD_STAGES.includes(body.stage) ? body.stage : 'new_inquiry',
              ['high', 'normal', 'low'].includes(body.priority) ? body.priority : 'normal',
              intent,
              prefLoc,
              cleanWhitespace(body.budget_text),
              cleanWhitespace(body.source_channel) || 'advisor_desk',
              actor.userId,
              cleanWhitespace(body.inquiry_message),
              cleanWhitespace(body.next_followup_at)
            );

            const reqId = allocatePrefixedId(db, 'buyer_requirements', 'requirement_id', 'REQ-2026');
            db.prepare(`
              INSERT INTO buyer_requirements (
                requirement_id, lead_id, intent, corridors_json, categories_json,
                min_bedrooms, min_budget_inr, max_budget_inr, min_area_sqft, include_off_market, must_have_notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
              reqId,
              leadId,
              intent,
              JSON.stringify(Array.isArray(body.corridors) ? body.corridors : []),
              JSON.stringify(Array.isArray(body.categories) ? body.categories : []),
              body.min_bedrooms ? Number(body.min_bedrooms) : null,
              body.min_budget_inr ? Number(body.min_budget_inr) : null,
              body.max_budget_inr ? Number(body.max_budget_inr) : null,
              body.min_area_sqft ? Number(body.min_area_sqft) : null,
              cleanWhitespace(body.inquiry_message)
            );

            db.prepare(`
              INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id)
              VALUES (?, 'lead_created', ?, ?)
            `).run(leadId, `Lead registered by ${actor.name}`, actor.userId);
          });

          const item = db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(leadId);
          return sendJson(res, 201, { ok: true, item });
        }

        const crmLeadMatch = pathname.match(/^\/api\/crm\/leads\/([A-Za-z0-9-]+)(?:\/(activities|requirement|match))?$/);
        if (crmLeadMatch) {
          const leadId = crmLeadMatch[1];
          const sub = crmLeadMatch[2];
          const lead = db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(leadId);
          if (!lead) return sendJson(res, 404, { ok: false, error: 'Lead not found' });

          if (!sub && req.method === 'GET') {
            const requirement = db.prepare('SELECT * FROM buyer_requirements WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1').get(leadId);
            const activities = db.prepare('SELECT * FROM crm_activities WHERE lead_id = ? ORDER BY created_at DESC').all(leadId);
            const shortlists = db.prepare('SELECT * FROM client_shortlists WHERE lead_id = ? ORDER BY created_at DESC').all(leadId);
            const matches = requirement ? matchPropertiesForRequirement(db, requirement) : [];
            return sendJson(res, 200, {
              ok: true,
              lead: {
                ...lead,
                selected_questions: JSON.parse(lead.selected_questions_json || '[]'),
                saved_property_ids: JSON.parse(lead.saved_property_ids_json || '[]')
              },
              requirement,
              activities,
              shortlists,
              matches
            });
          }

          if (!sub && req.method === 'PATCH') {
            const body = await readJsonBody(req);
            const newStage = body.stage && LEAD_STAGES.includes(body.stage) ? body.stage : lead.stage;
            const newPriority = body.priority && ['high', 'normal', 'low'].includes(body.priority) ? body.priority : lead.priority;
            const nextFollow = body.next_followup_at !== undefined ? cleanWhitespace(body.next_followup_at) : lead.next_followup_at;

            withTransaction(db, () => {
              db.prepare(`
                UPDATE leads
                SET stage = ?, priority = ?, next_followup_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE lead_id = ?
              `).run(newStage, newPriority, nextFollow, leadId);

              if (newStage !== lead.stage) {
                db.prepare(`
                  INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id)
                  VALUES (?, 'stage_change', ?, ?)
                `).run(leadId, `Pipeline stage moved from "${lead.stage}" to "${newStage}"`, actor.userId);
              }
            });

            const updated = db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(leadId);
            return sendJson(res, 200, { ok: true, item: updated });
          }

          if (sub === 'activities' && req.method === 'POST') {
            const body = await readJsonBody(req);
            const summary = cleanWhitespace(body.summary);
            if (!summary) return sendJson(res, 400, { ok: false, error: 'Activity summary is required' });
            db.prepare(`
              INSERT INTO crm_activities (lead_id, property_id, activity_type, summary, actor_user_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              leadId,
              cleanWhitespace(body.property_id),
              cleanWhitespace(body.activity_type) || 'note',
              summary,
              actor.userId
            );
            db.prepare("UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE lead_id = ?").run(leadId);
            return sendJson(res, 201, { ok: true });
          }

          if (sub === 'requirement' && req.method === 'PUT') {
            const body = await readJsonBody(req);
            const existingReq = db.prepare('SELECT requirement_id FROM buyer_requirements WHERE lead_id = ?').get(leadId);
            const reqId = existingReq ? existingReq.requirement_id : allocatePrefixedId(db, 'buyer_requirements', 'requirement_id', 'REQ-2026');

            db.prepare(`
              INSERT OR REPLACE INTO buyer_requirements (
                requirement_id, lead_id, contact_id, intent, corridors_json, sectors_json, categories_json,
                min_bedrooms, min_budget_inr, max_budget_inr, min_area_sqft, max_area_sqft,
                preferred_facing, include_off_market, must_have_notes, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            `).run(
              reqId,
              leadId,
              lead.contact_id,
              cleanWhitespace(body.intent) || lead.intent || 'Buy',
              JSON.stringify(Array.isArray(body.corridors) ? body.corridors : []),
              JSON.stringify(Array.isArray(body.sectors) ? body.sectors : []),
              JSON.stringify(Array.isArray(body.categories) ? body.categories : []),
              body.min_bedrooms ? Number(body.min_bedrooms) : null,
              body.min_budget_inr ? Number(body.min_budget_inr) : null,
              body.max_budget_inr ? Number(body.max_budget_inr) : null,
              body.min_area_sqft ? Number(body.min_area_sqft) : null,
              body.max_area_sqft ? Number(body.max_area_sqft) : null,
              cleanWhitespace(body.preferred_facing),
              body.include_off_market === false ? 0 : 1,
              cleanWhitespace(body.must_have_notes)
            );

            const savedReq = db.prepare('SELECT * FROM buyer_requirements WHERE requirement_id = ?').get(reqId);
            const matches = matchPropertiesForRequirement(db, savedReq);
            return sendJson(res, 200, { ok: true, requirement: savedReq, matches });
          }
        }

        // Ad-hoc Requirement Auto-Matcher
        if (pathname === '/api/crm/requirements/match' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const matches = matchPropertiesForRequirement(db, body);
          return sendJson(res, 200, { ok: true, total: matches.length, matches });
        }

        // Shareable Client Shortlist Generator
        if (pathname === '/api/crm/shortlists' && req.method === 'GET') {
          const rows = db.prepare(`
            SELECT cs.*,
                   (SELECT COUNT(*) FROM shortlist_items si WHERE si.shortlist_id = cs.shortlist_id) AS item_count
            FROM client_shortlists cs
            ORDER BY cs.created_at DESC LIMIT 50
          `).all();
          return sendJson(res, 200, { ok: true, items: rows });
        }

        if (pathname === '/api/crm/shortlists' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const propIds = Array.isArray(body.property_ids) ? body.property_ids.filter(Boolean) : [];
          if (propIds.length === 0) {
            return sendJson(res, 400, { ok: false, error: 'Select at least one property for the client shortlist' });
          }

          const clientName = cleanWhitespace(body.client_name) || 'Valued Client';
          const title = cleanWhitespace(body.title) || `Curated Advisory Shortlist for ${clientName}`;
          const shortlistId = allocatePrefixedId(db, 'client_shortlists', 'shortlist_id', 'SL-2026');
          const shareToken = crypto.randomBytes(18).toString('base64url');
          const leadId = cleanWhitespace(body.lead_id);
          const commentaries = body.commentaries && typeof body.commentaries === 'object' ? body.commentaries : {};

          withTransaction(db, () => {
            db.prepare(`
              INSERT INTO client_shortlists (
                shortlist_id, share_token, lead_id, title, client_name, advisor_intro_note, created_by_user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              shortlistId,
              shareToken,
              leadId,
              title,
              clientName,
              cleanWhitespace(body.advisor_intro_note) || 'Prepared by Ajay Mukhija, AUM ESTATES. Exact unit availability and closing terms to be reconfirmed prior to viewing.',
              actor.userId
            );

            const insItem = db.prepare(`
              INSERT OR IGNORE INTO shortlist_items (shortlist_id, property_id, sort_order, advisor_commentary)
              VALUES (?, ?, ?, ?)
            `);
            propIds.forEach((pid, idx) => {
              insItem.run(shortlistId, String(pid), idx + 1, cleanWhitespace(commentaries[pid]));
            });

            if (leadId) {
              db.prepare(`
                UPDATE leads
                SET stage = CASE WHEN stage IN ('new_inquiry', 'qualified') THEN 'shortlist_shared' ELSE stage END,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE lead_id = ?
              `).run(leadId);

              db.prepare(`
                INSERT INTO crm_activities (lead_id, activity_type, summary, actor_user_id)
                VALUES (?, 'shortlist_sent', ?, ?)
              `).run(leadId, `Generated private client shortlist "${title}" (${propIds.length} properties).`, actor.userId);
            }

            recordAuditLog(db, {
              actorUserId: actor.userId,
              actorLabel: actor.label,
              entityType: 'shortlist',
              entityId: shortlistId,
              action: 'create_shortlist',
              summary: `Created shortlist ${shortlistId} for ${clientName} (${propIds.length} items)`
            });
          });

          const shareUrl = `${urlObj.origin}/shortlist/${shareToken}`;
          return sendJson(res, 201, {
            ok: true,
            shortlist_id: shortlistId,
            share_token: shareToken,
            share_url: shareUrl
          });
        }

        // Trigger Atomic Static Feed Sync & Release Manifest
        if (pathname === '/api/crm/publish' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const release = compileAndPublishStaticFeeds(db, {
            actorUserId: actor.userId,
            actorLabel: actor.label,
            allowShrink: Boolean(body.allowShrink),
            targetPaths: options.targetPaths || PATHS
          });
          return sendJson(res, 200, { ok: true, release });
        }

        // Audit Trail
        if (pathname === '/api/crm/audit-logs' && req.method === 'GET') {
          const logs = db.prepare(`
            SELECT * FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 100
          `).all();
          return sendJson(res, 200, { ok: true, items: logs });
        }

        return sendJson(res, 404, { ok: false, error: `Unknown CRM API endpoint: ${pathname}` });
      }

      // ======================================================================
      // 4. CONTAINED UI & FRONTEND STATIC ROUTES
      // ======================================================================

      // Advisor CRM Console (/crm and /crm/*)
      if (pathname === '/crm' || pathname === '/crm/' || pathname.startsWith('/crm/')) {
        const sub = pathname.replace(/^\/crm\/?/, '') || 'index.html';
        const file = resolveSafeStaticFile(PATHS.crmUiDir, sub);
        if (file) return serveStaticFile(res, file);
      }

      // Shareable Client Shortlist Viewer (/shortlist/:token)
      if (/^\/shortlist\/[A-Za-z0-9_-]{12,64}\/?$/.test(pathname)) {
        const file = path.join(PATHS.crmUiDir, 'shortlist.html');
        if (fs.existsSync(file)) return serveStaticFile(res, file);
      }

      // Brand Study v16 (/v16 and /v16/*)
      if (pathname === '/v16') {
        res.writeHead(302, { ...BASE_SECURITY_HEADERS, Location: `/v16/${urlObj.search}` });
        return res.end();
      }
      if (pathname.startsWith('/v16/')) {
        const sub = pathname.replace(/^\/v16\//, '') || 'index.html';
        const file = resolveSafeStaticFile(PATHS.v16Dir, sub);
        if (file) return serveStaticFile(res, file);
      }

      // Architectural Grid Study 06 (/grid and /grid/*)
      if (pathname === '/grid') {
        res.writeHead(302, { ...BASE_SECURITY_HEADERS, Location: `/grid/${urlObj.search}` });
        return res.end();
      }
      if (pathname.startsWith('/grid/')) {
        const sub = pathname.replace(/^\/grid\//, '') || 'index.html';
        const file = resolveSafeStaticFile(PATHS.gridBaselineDir, sub);
        if (file) return serveStaticFile(res, file);
      }

      // Contained Hostinger Production Website (Root / and /assets/*, /properties/*, etc.)
      const hostingerFile = resolveSafeStaticFile(PATHS.hostingerDir, pathname === '/' ? 'index.html' : pathname);
      if (hostingerFile) {
        return serveStaticFile(res, hostingerFile);
      }

      res.writeHead(404, { ...BASE_SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } catch (err) {
      const code = err.statusCode || 500;
      sendJson(res, code, {
        ok: false,
        error: err.message || 'Internal Server Error',
        validationErrors: err.validationErrors || undefined
      });
    }
  });

  return server;
}

if (require.main === module) {
  const db = openDatabase(PATHS.dbFile);
  const seedRes = seedDatabaseIfEmpty(db);
  if (seedRes.seeded) {
    console.log(`[SEED] Master Database initialized with ${seedRes.publicMandates} verified public mandates.`);
    compileAndPublishStaticFeeds(db, { actorLabel: 'initial_boot_sync' });
  }

  const server = createAppServer(db);
  server.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
    const base = `http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`;
    console.log(`\n=============================================================`);
    console.log(` AUM ESTATES — MASTER BACKEND, SEARCH & ADVISORY CRM SERVER`);
    console.log(`=============================================================`);
    console.log(`  • Advisor CRM Console : ${base}/crm/`);
    console.log(`  • Brand Study v16     : ${base}/v16/`);
    console.log(`  • Architectural Grid  : ${base}/grid/`);
    console.log(`  • Production Website  : ${base}/`);
    console.log(`  • Public Search API   : ${base}/api/public/properties`);
    console.log(`  • Master SQLite DB    : ${PATHS.dbFile}`);
    console.log(`=============================================================\n`);
  });
}

module.exports = {
  resolveSafeStaticFile,
  upsertPropertyMaster,
  createAppServer
};
