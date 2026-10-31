'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const { PATHS, SERVER_CONFIG } = require('../config');
const { hashPassword } = require('../auth');
const { withTransaction, rebuildAllFts, recordAuditLog } = require('./connection');
const {
  cleanWhitespace,
  slugify,
  normalizeAreaSqFt,
  normalizePriceInr,
  normalizeRentInr,
  cleanListingTitle,
  classifyCategory,
  classifyCorridor,
  resolveRepresentativeImage,
  parseBedroomsInt
} = require('../domain/normalizer');
const { quarantineSensitiveClauses } = require('../domain/privacy_gate');

const BROKEN_FEATURED_ID_MAP = {
  'AUM-WEB-000078': 'AUM-WEB-000151',    // DLF Park Place 2282 Aravalli
  'AUM-WEB-DLF-GROVE': 'AUM-WEB-000135', // DLF Grove 500 sq yd 4 BHK + office
  'AUM-WEB-000054': 'AUM-WEB-000253',    // DLF The Belaire Sector 54 3065 sq ft 4 BHK + Servant
  'AUM-APP-0001': 'AUM-WEB-000019'       // ASYA SmartLiving Goa
};

const CURATED_NEW_PROJECT_OVERRIDES = {
  'Godrej Miraya': {
    locality: 'Golf Course Road',
    sector: 'Sector 43',
    project_type: 'Ultra-Luxury Residential',
    price_band_text: 'Price on Request',
    description: 'Ultra-luxury residences on Golf Course Road micro-market positioned around open greens and bespoke club amenities.',
    image_file: 'godrej-meridian.jpg'
  },
  'DLF The Aureva': {
    locality: 'Golf Course Extension Road',
    sector: 'Sector 63',
    project_type: 'Luxury Condominiums',
    price_band_text: 'EOI / Price on Request',
    description: 'Curated luxury residential development on Golf Course Extension Road with RERA certification and prime sector connectivity.',
    image_file: 'dlf-exclusive-floors.jpg'
  },
  'Tonino Lamborghini Residences Gurugram': {
    locality: 'Golf Course Extension Road',
    sector: null,
    project_type: 'Branded Luxury Residences',
    price_band_text: 'Price on Request',
    description: 'Signature branded luxury residences designed with iconic European architecture, private terraces, and bespoke hospitality services.',
    image_file: 'pioneer-araya.jpg'
  },
  'Vantage Aura': {
    locality: 'Sohna Road',
    sector: 'Sector 48',
    project_type: 'Commercial & Retail',
    price_band_text: '₹90 Lakh onwards',
    description: 'Grade-A commercial spaces, retail showrooms, and office suites with prime frontage on main Sohna Road.',
    image_file: 'smartworld-orchid.jpg'
  },
  'Omara Trehan': {
    locality: 'Golf Course Extension Road',
    sector: null,
    project_type: 'Luxury Low-Rise Floors',
    price_band_text: 'Price on Request',
    description: 'Exclusive low-rise luxury residences offering basement, stilt parking, private lift lobbies, and landscaped garden terraces.',
    image_file: 'omara-trehan.jpg'
  },
  'Orchid Ivy Floors': {
    locality: 'Central Gurgaon',
    sector: 'Sector 51',
    project_type: 'Luxury Builder Floors',
    price_band_text: '₹3.80 Cr – ₹5.25 Cr',
    description: 'Gated low-rise residences offering 260 sq yd 3 BHK + Study and 350 sq yd 4 BHK configurations in central Gurgaon.',
    image_file: 'orchid-island.jpg'
  },
  'M3M Smartworld': {
    locality: 'Dwarka Expressway',
    sector: 'Sector 113',
    project_type: 'Luxury High-Rise',
    price_band_text: 'Price on Request',
    description: 'Contemporary high-rise residences positioned on the 0-km Delhi-Gurgaon border with multi-tier clubhouse amenities.',
    image_file: 'smartworld-sky-arc.webp'
  },
  'Shukrana Homes Super Luxury Floors': {
    locality: 'Sushant Lok 1',
    sector: null,
    project_type: 'Super Luxury Builder Floors',
    price_band_text: '₹3.80 Cr – ₹4.45 Cr',
    description: 'Bespoke 4 BHK luxury builder floors with Italian marble flooring, imported modular kitchen, private terrace, and stilt parking.',
    image_file: 'sushant-lok.jpg'
  },
  'Green Oaks': {
    locality: 'SPR Corridor',
    sector: 'Sector 70A',
    project_type: 'Independent Luxury Floors',
    price_band_text: '₹2.60 Cr onwards',
    description: 'Contemporary 3 BHK + Home Office configurations in a secure gated enclave along Southern Peripheral Road.',
    image_file: 'emerald-floors-premier.jpg'
  },
  'Premium Luxury Floors': {
    locality: 'Nirvana Country',
    sector: 'Sector 50',
    project_type: 'Luxury Builder Floors',
    price_band_text: 'Price on Request',
    description: 'High-specification independent floors with private elevators, landscaped terraces, and 24/7 gated security.',
    image_file: 'south-city-2.jpg'
  },
  'Palm Floors': {
    locality: 'Ardee City',
    sector: 'Sector 52',
    project_type: 'Luxury Builder Floors',
    price_band_text: '₹3.65 Cr',
    description: '240 sq yd 3 BHK low-rise floor with private terrace rights, premium woodwork, and dedicated double-bay stilt parking.',
    image_file: 'palm-terrace-select.jpeg'
  },
  'TARC Tripundra': {
    locality: 'Main Bijwasan Road',
    sector: null,
    city: 'New Delhi / NCR',
    project_type: 'Luxury Condominiums',
    price_band_text: '₹6.40 Cr onwards',
    description: 'Ready-to-move 3 & 4 BHK luxury residences surrounded by lush farm land and direct connectivity to Aerocity.',
    image_file: 'tata-raisina.webp'
  },
  'Saan Verdante': {
    locality: 'New Gurgaon',
    sector: 'Sector 95',
    project_type: 'Boutique Luxury Residences',
    price_band_text: '₹4.33 Cr onwards',
    description: 'Eco-luxury 3 & 4 BHK boutique residences featuring green building compliance, private decks, and panoramic Aravalli views.',
    image_file: 'urban-oasis.jpg'
  },
  'Nitara Ultra Luxury Triplex Residences': {
    locality: 'Emaar Emerald Hills',
    sector: 'Sector 65',
    project_type: 'Ultra-Luxury Triplex Penthouses',
    price_band_text: '₹11.00 Cr',
    description: 'Signature triplex sky residences with private plunge pool, personal elevator, double-height living room, and Golf Course views.',
    image_file: 'pioneer-presidia.jpg'
  }
};

function addDaysIso(isoDateStr, days) {
  const base = isoDateStr ? new Date(`${isoDateStr}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function loadWindowGlobal(filePath, globalKey) {
  if (!fs.existsSync(filePath)) return [];
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), ctx);
  return Array.isArray(ctx.window[globalKey]) ? ctx.window[globalKey] : [];
}

function ensureAdminUser(db) {
  const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(SERVER_CONFIG.defaultAdminEmail);
  if (existing) return existing.user_id;

  const { hash, salt } = hashPassword(SERVER_CONFIG.defaultAdminPassword);
  const res = db.prepare(`
    INSERT INTO users (email, full_name, role, password_hash, password_salt, is_active)
    VALUES (?, ?, 'principal', ?, ?, 1)
  `).run(SERVER_CONFIG.defaultAdminEmail, SERVER_CONFIG.defaultAdminName, hash, salt);
  return Number(res.lastInsertRowid);
}

function seedDatabaseIfEmpty(db, options = {}) {
  const adminUserId = ensureAdminUser(db);
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM properties').get();
  if (countRow.cnt > 0 && !options.force) {
    return { seeded: false, existingProperties: countRow.cnt, adminUserId };
  }

  const rawInventoryPath = fs.existsSync(PATHS.seedInventoryJson)
    ? PATHS.seedInventoryJson
    : `${PATHS.hostingerDataDir}/public_inventory.json`;
  const rawInventory = JSON.parse(fs.readFileSync(rawInventoryPath, 'utf8'));

  const projectsLocal = loadWindowGlobal(`${PATHS.hostingerDataDir}/projects_local.js`, 'AUM_PROJECTS_LOCAL');
  const approvedLocal = loadWindowGlobal(`${PATHS.hostingerDataDir}/approved_properties.js`, 'AUM_APPROVED_PROPERTIES');

  const curatedNames = Object.keys(CURATED_NEW_PROJECT_OVERRIDES);

  const stats = withTransaction(db, () => {
    const insertLocation = db.prepare(`
      INSERT OR IGNORE INTO locations (location_id, corridor, locality, sector, city)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertProject = db.prepare(`
      INSERT OR REPLACE INTO projects (
        project_id, project_name, location_id, city, locality, sector, micro_location,
        corridor, project_type, status, description, key_amenities, price_band_text,
        image_file, publication_state, is_new_project_curated, curated_sort_order, slug, last_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Seed Locations from inventory
    const seenLocations = new Set();
    for (const item of rawInventory) {
      const locId = cleanWhitespace(item.location_id);
      if (locId && !seenLocations.has(locId)) {
        seenLocations.add(locId);
        const corridor = classifyCorridor(item);
        insertLocation.run(
          locId,
          corridor,
          cleanWhitespace(item.locality),
          cleanWhitespace(item.sector),
          cleanWhitespace(item.city) || 'Gurgaon'
        );
      }
    }

    // 2. Seed Projects (144 spreadsheet projects + ensure all 14 curated New Projects exist and are reconciled)
    const projectIdsByName = new Map();
    let projectsPublicCount = 0;
    let projectsPrivateCount = 0;

    for (const p of projectsLocal) {
      const name = cleanWhitespace(p.project_name) || 'Unnamed Project';
      const curatedIdx = curatedNames.findIndex(
        (cn) => cn.toLowerCase() === name.toLowerCase() || (cn === 'Orchid Ivy Floors' && name === 'Orchid Ivy') || (cn === 'Green Oaks' && name.startsWith('Green Oaks'))
      );
      const curatedKey = curatedIdx >= 0 ? curatedNames[curatedIdx] : null;
      const override = curatedKey ? CURATED_NEW_PROJECT_OVERRIDES[curatedKey] : null;

      const vis = String(p.public_visibility || '').trim().toUpperCase();
      // Reconcile metadata conflict: curated New Projects or explicit YES are public; Private/No/NO stay private_off_market
      const pubState = curatedKey || vis === 'YES' ? 'approved_public' : 'private_off_market';
      if (pubState === 'approved_public') projectsPublicCount++;
      else projectsPrivateCount++;

      const merged = {
        city: override?.city || cleanWhitespace(p.city) || 'Gurgaon',
        locality: override?.locality || cleanWhitespace(p.locality),
        sector: override?.sector !== undefined ? override.sector : cleanWhitespace(p.sector),
        micro_location: cleanWhitespace(p.micro_location),
        project_name: curatedKey || name
      };
      const corridor = classifyCorridor(merged);

      insertProject.run(
        cleanWhitespace(p.project_id),
        merged.project_name,
        null,
        merged.city,
        merged.locality,
        merged.sector,
        merged.micro_location,
        corridor,
        override?.project_type || cleanWhitespace(p.project_type),
        cleanWhitespace(p.status) || 'Active',
        override?.description || cleanWhitespace(p.description),
        cleanWhitespace(p.key_amenities),
        override?.price_band_text || null,
        override?.image_file || null,
        pubState,
        curatedKey ? 1 : 0,
        curatedIdx >= 0 ? curatedIdx + 1 : null,
        cleanWhitespace(p.slug) || slugify(merged.project_name),
        cleanWhitespace(p.last_verified) || '2026-10-10'
      );
      projectIdsByName.set(merged.project_name.toLowerCase(), cleanWhitespace(p.project_id));
      projectIdsByName.set(name.toLowerCase(), cleanWhitespace(p.project_id));
    }

    // Ensure any of the 14 curated New Projects missing from projects_local.js are inserted cleanly
    curatedNames.forEach((cn, idx) => {
      if (projectIdsByName.has(cn.toLowerCase())) return;
      const ov = CURATED_NEW_PROJECT_OVERRIDES[cn];
      const pid = `PRJ-NEW-${String(idx + 1).padStart(3, '0')}`;
      const corridor = classifyCorridor({
        city: ov.city || 'Gurgaon',
        locality: ov.locality,
        sector: ov.sector,
        project_name: cn
      });
      insertProject.run(
        pid,
        cn,
        null,
        ov.city || 'Gurgaon',
        ov.locality,
        ov.sector,
        ov.locality,
        corridor,
        ov.project_type,
        'Developer Launch',
        ov.description,
        null,
        ov.price_band_text,
        ov.image_file,
        'approved_public',
        1,
        idx + 1,
        slugify(cn),
        '2026-10-10'
      );
      projectsPublicCount++;
      projectIdsByName.set(cn.toLowerCase(), pid);
    });

    // 3. Seed All 347 Verified Public Mandates + Fiduciary Private Vault
    const existingProjectIds = new Set(
      db.prepare('SELECT project_id FROM projects').all().map((r) => r.project_id)
    );

    const insertProperty = db.prepare(`
      INSERT OR REPLACE INTO properties (
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
        slug, url, approved_by_user_id, approved_at
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
        ?, ?, ?, ?
      )
    `);

    const insertPrivate = db.prepare(`
      INSERT OR REPLACE INTO property_private (
        property_id, owner_contact_id, owner_name_cache, owner_phone_cache, owner_email_cache,
        broker_contact_id, broker_name_cache, broker_phone_cache, source_group_name,
        exact_unit_or_plot_no, internal_floor_price_inr, commission_terms,
        payment_structure_notes, title_deed_verified, encumbrance_notes,
        raw_whatsapp_text, internal_advisor_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let quarantinedCount = 0;

    for (const raw of rawInventory) {
      const id = cleanWhitespace(raw.property_id);
      const { cleaned, extractedPaymentNotes, extractedAdvisorNotes } = quarantineSensitiveClauses(raw);
      if (extractedPaymentNotes || extractedAdvisorNotes) {
        quarantinedCount++;
      }

      const areaSqFt = normalizeAreaSqFt(raw.area_value, raw.area_unit);
      const priceInr = normalizePriceInr({
        priceValue: raw.price_value,
        priceUnit: raw.price_unit,
        priceText: cleaned.price_text,
        transactionType: raw.transaction_type,
        areaValue: raw.area_value,
        areaUnit: raw.area_unit,
        areaSqFtNorm: areaSqFt
      });
      const rentInr = normalizeRentInr({
        rentValue: raw.rent_value,
        rentUnit: raw.rent_unit,
        priceValue: raw.price_value,
        priceUnit: raw.price_unit,
        transactionType: raw.transaction_type,
        areaSqFtNorm: areaSqFt
      });

      const title = cleanListingTitle(raw.listing_title, raw.project_name);
      const category = classifyCategory({ ...raw, listing_title: title });
      const corridor = classifyCorridor({ ...raw, listing_title: title });
      const imageFile = resolveRepresentativeImage({
        ...raw,
        listing_title: title,
        category,
        key_features: cleaned.key_features,
        public_description: cleaned.public_description
      });
      const bedroomsInt = parseBedroomsInt(raw.bedrooms, raw.configuration, title);

      const rawProjId = cleanWhitespace(raw.project_id);
      const projId = rawProjId && existingProjectIds.has(rawProjId)
        ? rawProjId
        : (raw.project_name && projectIdsByName.get(String(raw.project_name).trim().toLowerCase())) || null;

      const locId = cleanWhitespace(raw.location_id);
      const lastVerified = cleanWhitespace(raw.last_verified) || '2026-08-16';
      const nextReverifyDue = addDaysIso(lastVerified, 120);
      const rawVerifStatus = cleanWhitespace(raw.verification_status) || 'Availability to be confirmed';
      const verifState = /recently/i.test(rawVerifStatus) ? 'recently_reverified' : 'needs_confirmation';

      const thingsToConfirm = [];
      if (!priceInr && !rentInr) thingsToConfirm.push('Current asking price & payment schedule');
      else thingsToConfirm.push('Current unit availability & firm closing terms');
      thingsToConfirm.push('Exact floor / unit position & viewing slot');
      thingsToConfirm.push('Title documents, RERA/HSVP status & recurring charges');

      const slug = cleanWhitespace(raw.slug) || slugify(`${id}-${title}`);
      const url = `https://aumestates.com/properties/detail.html?id=${encodeURIComponent(id)}`;

      insertProperty.run(
        id,
        'approved_public',
        'available',
        projId,
        cleanWhitespace(raw.project_name),
        locId && seenLocations.has(locId) ? locId : null,
        cleanWhitespace(raw.city) || 'Gurgaon',
        cleanWhitespace(raw.locality),
        cleanWhitespace(raw.sector),
        cleanWhitespace(raw.micro_location),
        corridor,
        cleanWhitespace(raw.property_type) || 'Residential',
        category,
        cleanWhitespace(raw.transaction_type) || 'Sale',
        title,
        cleanWhitespace(raw.configuration),
        raw.bedrooms != null ? String(raw.bedrooms) : (bedroomsInt ? String(bedroomsInt) : null),
        bedroomsInt,
        raw.bathrooms != null ? String(raw.bathrooms) : null,
        raw.area_value != null ? Number(raw.area_value) : null,
        cleanWhitespace(raw.area_unit),
        areaSqFt,
        cleanWhitespace(raw.floor),
        cleanWhitespace(raw.total_floors),
        cleanWhitespace(raw.facing),
        cleanWhitespace(raw.road_width),
        cleanWhitespace(raw.furnishing),
        cleanWhitespace(raw.possession_status),
        raw.price_value != null ? Number(raw.price_value) : null,
        cleanWhitespace(raw.price_unit),
        cleaned.price_text,
        priceInr,
        raw.rent_value != null ? Number(raw.rent_value) : null,
        cleanWhitespace(raw.rent_unit),
        rentInr,
        cleaned.key_features,
        cleaned.public_description,
        cleaned.public_features,
        imageFile,
        cleanWhitespace(raw.image_label) || 'Representative Reference Photograph',
        rawVerifStatus,
        verifState,
        lastVerified,
        nextReverifyDue,
        JSON.stringify(thingsToConfirm),
        slug,
        url,
        adminUserId,
        '2026-10-10T00:00:00.000Z'
      );

      insertPrivate.run(
        id,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'Master Workbook v13 (10 Oct 2026)',
        null,
        null,
        null,
        extractedPaymentNotes,
        verifState === 'recently_reverified' ? 1 : 0,
        null,
        null,
        extractedAdvisorNotes
      );
    }

    // 4. Reconcile 16 Featured Approved Properties (fixing the 4 broken legacy IDs)
    const updateFeatured = db.prepare(`
      UPDATE properties
      SET is_featured_approved = 1,
          featured_sort_order = ?,
          featured_card_override_json = ?
      WHERE property_id = ?
    `);

    let featuredLinked = 0;
    approvedLocal.forEach((card, idx) => {
      const targetId = BROKEN_FEATURED_ID_MAP[card.property_id] || card.property_id;
      const overridePayload = {
        name: card.name,
        location: card.location,
        type: card.type,
        description: card.description,
        price_text: card.price_text,
        price_value: card.price_value,
        features: card.features,
        image: card.image,
        transaction_type: card.transaction_type,
        category: card.category,
        slug: card.slug,
        image_label: card.image_label
      };
      const res = updateFeatured.run(idx + 1, JSON.stringify(overridePayload), targetId);
      if (res.changes > 0) featuredLinked++;
    });

    // 5. Seed Representative Off-Market Private Mandates & Pending Intake Draft + Contacts & CRM Sample Pipeline
    //    (Strictly private_off_market / pending_approval so public feed count stays at 347!)
    const insertContact = db.prepare(`
      INSERT OR REPLACE INTO contacts (
        contact_id, contact_type, full_name, firm_or_syndicate, phone_primary, phone_norm, email, city, preferred_channel, trust_tier, private_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertContact.run(
      'CNT-OWN-001',
      'seller_owner',
      'Vikramaditya Singhania',
      'Singhania Family Office',
      '+91 98110 44219',
      '9811044219',
      'vsinghania@example.org',
      'Gurgaon',
      'phone',
      'direct_mandate',
      'Direct family-office seller; strictly no public portal exposure. Viewings with 24h notice through Ajay directly.'
    );

    insertContact.run(
      'CNT-BRK-001',
      'channel_broker',
      'Rajesh Khatri',
      'GCR Luxury Syndicate',
      '+91 98102 77310',
      '9810277310',
      null,
      'Gurgaon',
      'whatsapp',
      'verified_partner',
      'Trusted DLF Phase 1-5 & Golf Course Road channel partner.'
    );

    insertContact.run(
      'CNT-BUY-001',
      'buyer',
      'Siddharth & Meera Malhotra',
      'McKinsey India (Partner)',
      '+91 98711 62045',
      '9871162045',
      's.malhotra@example.org',
      'Gurgaon',
      'whatsapp',
      'qualified_hnw',
      'Relocating from Mumbai to Golf Course Road / Extension. Pre-approved funds; looking for 4 BHK condominium or gated luxury floor.'
    );

    // Off-Market Mandate 1 (Invisible on public web, searchable in CRM & eligible for private HNW shortlists)
    insertProperty.run(
      'AUM-OFF-000001',
      'private_off_market',
      'available',
      null,
      'DLF The Magnolias',
      null,
      'Gurgaon',
      'Golf Course Road',
      'Sector 42',
      'DLF Phase 5',
      'Golf Course Road',
      'Apartment',
      'apartment',
      'Sale',
      'DLF The Magnolias 4 BHK + Study Golf-Facing Residence',
      '4 BHK + Study + 2 Staff',
      '4',
      4,
      '5',
      6400,
      'Sq Ft',
      6400,
      'Higher Floor',
      '25',
      'East (Golf Course View)',
      '60 m',
      'Bespoke Designer Furnished',
      'Ready to Move',
      36.5,
      'Cr',
      '₹36.50 Cr',
      365000000,
      null,
      null,
      null,
      'Uninterrupted DLF Golf & Country Club frontage; private lift lobby; 3 basement car parks',
      'Confidential off-market family-office mandate at DLF The Magnolias, Sector 42. Higher-floor residence overlooking the championship golf greens.',
      'Private Lift Lobby; Concierge & Clubhouse; 3 Parking Bays',
      'dlf-the-belaire.webp',
      'Representative Reference Photograph',
      'Direct Mandate Verified',
      'verified_direct',
      '2026-10-25',
      '2027-02-22',
      JSON.stringify(['24-hour prior notice required for private viewing', 'Club membership transfer fee schedule']),
      'dlf-the-magnolias-off-market-6400-sqft',
      'https://aumestates.com/properties/detail.html?id=AUM-OFF-000001',
      adminUserId,
      null
    );

    insertPrivate.run(
      'AUM-OFF-000001',
      'CNT-OWN-001',
      'Vikramaditya Singhania',
      '+91 98110 44219',
      'vsinghania@example.org',
      null,
      null,
      null,
      'Direct Principal Mandate',
      'Tower 4, Unit 14B',
      348000000,
      '1% direct seller mandate',
      '100% institutional bank transfer; 60-day closing preferred',
      1,
      'Clear conveyance deed inspected by Ajay',
      null,
      'Strictly off-market per owner instruction. Share only via private shortlist token to vetted HNW buyers.'
    );

    // Pending Approval Intake Draft (Demonstrates WhatsApp two-pass approval queue)
    insertProperty.run(
      'AUM-DRF-000001',
      'pending_approval',
      'available',
      null,
      'Conscient Elevate',
      null,
      'Gurgaon',
      'Golf Course Extension Road',
      'Sector 59',
      'Sector 59',
      'Golf Course Ext & SPR',
      'Apartment',
      'apartment',
      'Sale',
      'Conscient Elevate 4 BHK + Servant Corner Residence',
      '4 BHK + Servant',
      '4',
      4,
      '4',
      3395,
      'Sq Ft',
      3395,
      'Middle Floor',
      '32',
      'North-East',
      '60 m',
      'Semi-Furnished',
      'Ready to Move',
      7.65,
      'Cr',
      '₹7.65 Cr',
      76500000,
      null,
      null,
      null,
      '3-side open corner layout; Aravalli & central greens view; 2 covered parking slots',
      'Newly ingested 4 BHK + Servant residence in Conscient Elevate by Hines, Sector 59. Pending principal review before public website release.',
      'European Cascading Clubhouse; Vehicular-Free Surface; 2 Covered Car Parks',
      'elevate-by-hines.webp',
      'Architectural Visual',
      'Availability to be confirmed',
      'needs_confirmation',
      '2026-10-30',
      '2027-02-27',
      JSON.stringify(['Confirm exact tower & floor availability', 'Verify transfer charges & OC status']),
      'conscient-elevate-4-bhk-3395-sqft-draft',
      'https://aumestates.com/properties/detail.html?id=AUM-DRF-000001',
      null,
      null
    );

    insertPrivate.run(
      'AUM-DRF-000001',
      null,
      null,
      null,
      null,
      'CNT-BRK-001',
      'Rajesh Khatri',
      '+91 98102 77310',
      'GCR Luxury Syndicate WhatsApp',
      'Tower C, 1204',
      73500000,
      '1% side-by-side',
      'Full bank transfer preferred',
      0,
      'Pending physical inspection',
      'Elevate Hines Sec 59 | 3395 sqft 4BHK+S | Tower C 1204 NE facing | Demand 7.65 Cr closer 7.35 Cr | Keys with Rajesh Khatri 9810277310 | 1% side by side',
      'Extracted from WhatsApp broadcast; awaiting Ajay confirmation before publishing.'
    );

    // Seed 1 Qualified Active Buyer Lead + Structured Requirement so Auto-Matching works out of the box
    db.prepare(`
      INSERT OR REPLACE INTO leads (
        lead_id, contact_id, lead_title, client_name, client_phone, client_email,
        stage, priority, intent, situation, preferred_location, budget_text,
        source_channel, source_page, primary_property_id, assigned_user_id,
        inquiry_message, selected_questions_json, saved_property_ids_json, next_followup_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'LEAD-2026-0001',
      'CNT-BUY-001',
      'Malhotra Family — 4 BHK GCR / Extension Mandate',
      'Siddharth Malhotra',
      '+91 98711 62045',
      's.malhotra@example.org',
      'qualified',
      'high',
      'Buy',
      'Moving with family',
      'Golf Course Road / Golf Course Ext & SPR',
      '₹6 Cr – ₹10 Cr',
      'website',
      'v16-property-index',
      'AUM-WEB-000142',
      adminUserId,
      'Hello AUM ESTATES, relocating from Mumbai in Q1. Looking for a 4 BHK condominium in DLF Arbour, Conscient Elevate, or Belaire between ₹6–10 Cr.',
      JSON.stringify([
        'What exact unit is available, and when can I view it?',
        'What is the complete cost, including recurring charges?'
      ]),
      JSON.stringify(['AUM-WEB-000142', 'AUM-WEB-000194']),
      addDaysIso('2026-10-31', 2)
    );

    db.prepare(`
      INSERT OR REPLACE INTO buyer_requirements (
        requirement_id, lead_id, contact_id, intent, corridors_json, sectors_json,
        categories_json, min_bedrooms, min_budget_inr, max_budget_inr,
        min_area_sqft, max_area_sqft, preferred_facing, include_off_market, must_have_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'REQ-2026-0001',
      'LEAD-2026-0001',
      'CNT-BUY-001',
      'Buy',
      JSON.stringify(['Golf Course Road', 'Golf Course Ext & SPR']),
      JSON.stringify([]),
      JSON.stringify(['apartment', 'builder-floor']),
      3,
      50000000,  // 5 Cr
      110000000, // 11 Cr
      2200,
      5000,
      'North-East',
      1,
      'Gated condominium with strong club infrastructure; ready or near-possession preferred.'
    );

    db.prepare(`
      INSERT INTO crm_activities (lead_id, contact_id, property_id, activity_type, summary, actor_user_id)
      VALUES (?, ?, ?, 'qualification_call', ?, ?)
    `).run(
      'LEAD-2026-0001',
      'CNT-BUY-001',
      'AUM-WEB-000142',
      'Spoke with Siddharth (18 mins). Confirmed ₹6–10 Cr liquid budget, prefers Sector 54/59/63 gated towers. Prepare curated shortlist for weekend visit.',
      adminUserId
    );

    rebuildAllFts(db);

    recordAuditLog(db, {
      actorUserId: adminUserId,
      actorLabel: SERVER_CONFIG.defaultAdminEmail,
      entityType: 'database',
      entityId: 'master_seed_v1',
      action: 'seed_master_store',
      summary: `Seeded ${rawInventory.length} public mandates (${quarantinedCount} had payment/internal clauses quarantined to private vault), ${projectsPublicCount} public projects, ${projectsPrivateCount} private projects, and ${featuredLinked} reconciled featured cards.`
    });

    return {
      seeded: true,
      publicMandates: rawInventory.length,
      quarantinedCount,
      projectsPublicCount,
      projectsPrivateCount,
      featuredLinked,
      adminUserId
    };
  });

  return stats;
}

module.exports = {
  BROKEN_FEATURED_ID_MAP,
  CURATED_NEW_PROJECT_OVERRIDES,
  addDaysIso,
  ensureAdminUser,
  seedDatabaseIfEmpty
};
