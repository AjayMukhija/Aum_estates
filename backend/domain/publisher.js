'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PATHS } = require('../config');
const { validateAndProjectPublicRecord, scanTextForLeaks } = require('./privacy_gate');
const { formatPublicPriceDisplay } = require('./normalizer');
const { recordAuditLog } = require('../db/connection');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function writeAtomicSync(targetPath, content) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
  );
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Compiles all public feeds strictly from the Master Database through the Fiduciary Firewall
 * and atomically updates every synchronized frontend data target.
 */
function compileAndPublishStaticFeeds(db, options = {}) {
  const {
    actorUserId = null,
    actorLabel = 'system',
    allowShrink = false,
    writeFiles = true,
    targetPaths = PATHS
  } = options;

  // 1. Fetch candidate public mandates
  const rows = db.prepare(`
    SELECT * FROM properties
    WHERE publication_state = 'approved_public'
      AND availability_state = 'available'
    ORDER BY property_id ASC
  `).all();

  if (rows.length === 0 && !allowShrink) {
    throw new Error('Publication aborted: 0 approved_public + available mandates found (empty export protection)');
  }

  // Anti-truncation threshold against previous live file if present
  const existingPubJson = path.join(targetPaths.hostingerDataDir, 'public_inventory.json');
  if (!allowShrink && fs.existsSync(existingPubJson)) {
    try {
      const prev = JSON.parse(fs.readFileSync(existingPubJson, 'utf8'));
      if (Array.isArray(prev) && prev.length >= 20 && rows.length < Math.floor(prev.length * 0.8)) {
        throw new Error(
          `Publication aborted by anti-truncation guard: candidate count (${rows.length}) dropped >20% below current published count (${prev.length}). Pass allowShrink=true to confirm bulk archival.`
        );
      }
    } catch (err) {
      if (err.message.startsWith('Publication aborted')) throw err;
    }
  }

  // 2. Validate & project every public mandate BEFORE writing a single byte
  const publicRecords = [];
  const allErrors = [];
  const seenIds = new Set();

  for (const row of rows) {
    if (seenIds.has(row.property_id)) {
      allErrors.push(`Duplicate property_id in export set: ${row.property_id}`);
      continue;
    }
    seenIds.add(row.property_id);

    const check = validateAndProjectPublicRecord(row);
    if (!check.ok) {
      allErrors.push(...check.errors);
    } else {
      publicRecords.push(check.record);
    }
  }

  // 3. Build & scan approved public projects feed (omitting private_off_market / draft projects)
  const projectRows = db.prepare(`
    SELECT * FROM projects
    WHERE publication_state = 'approved_public'
    ORDER BY is_new_project_curated DESC, COALESCE(curated_sort_order, 9999) ASC, project_id ASC
  `).all();

  const publicProjects = projectRows.map((p) => {
    const dto = {
      project_id: p.project_id,
      project_name: p.project_name,
      city: p.city,
      locality: p.locality,
      sector: p.sector,
      micro_location: p.micro_location,
      corridor: p.corridor,
      project_type: p.project_type,
      status: p.status,
      description: p.description,
      key_amenities: p.key_amenities,
      price_band_text: p.price_band_text,
      image_file: p.image_file,
      public_visibility: 'YES',
      is_new_project_curated: Boolean(p.is_new_project_curated),
      slug: p.slug,
      last_verified: p.last_verified
    };
    for (const [k, v] of Object.entries(dto)) {
      if (typeof v === 'string') {
        for (const leak of scanTextForLeaks(`project.${p.project_id}.${k}`, v)) {
          allErrors.push(`[PROJECT PRIVACY LEAK] ${p.project_id}.${k}: ${leak.rule} (${leak.excerpt})`);
        }
      }
    }
    return dto;
  });

  // 4. Build & validate featured approved_properties feed (strictly foreign-keyed to available public mandates!)
  const featuredRows = rows
    .filter((r) => r.is_featured_approved === 1)
    .sort((a, b) => (a.featured_sort_order || 999) - (b.featured_sort_order || 999));

  const publicFeatured = featuredRows.map((r) => {
    let ov = {};
    if (r.featured_card_override_json) {
      try {
        ov = JSON.parse(r.featured_card_override_json) || {};
      } catch {}
    }
    const livePrice = formatPublicPriceDisplay(r);
    const effectivePrice = livePrice && livePrice !== 'Price on Request'
      ? livePrice
      : (ov.price_text || 'Price on Request');

    const card = {
      property_id: r.property_id,
      name: ov.name || r.listing_title,
      location: ov.location || [r.locality, r.sector, r.city].filter(Boolean).join(', '),
      type: ov.type || r.property_type,
      description: ov.description || r.public_description || r.key_features || '',
      price_text: effectivePrice,
      price_value: effectivePrice.replace(/^₹/, ''),
      features: ov.features || [r.configuration, r.area_value ? `${r.area_value} ${r.area_unit || ''}`.trim() : null].filter(Boolean).join(' · '),
      image: ov.image || `assets/property-images/${r.image_file || 'apartment.jpg'}`,
      transaction_type: r.transaction_type || ov.transaction_type || 'Sale',
      category: ov.category || 'Residential',
      slug: r.slug || ov.slug,
      image_label: ov.image_label || r.image_label || 'Representative Visual'
    };
    for (const [k, v] of Object.entries(card)) {
      if (typeof v === 'string') {
        for (const leak of scanTextForLeaks(`featured.${r.property_id}.${k}`, v)) {
          allErrors.push(`[FEATURED PRIVACY LEAK] ${r.property_id}.${k}: ${leak.rule} (${leak.excerpt})`);
        }
      }
    }
    return card;
  });

  if (allErrors.length > 0) {
    const err = new Error(`Fiduciary Privacy Gate blocked publication with ${allErrors.length} error(s):\n- ${allErrors.slice(0, 10).join('\n- ')}`);
    err.validationErrors = allErrors;
    throw err;
  }

  const inventoryJsonStr = `${JSON.stringify(publicRecords, null, 2)}\n`;
  const inventoryJsStr = `window.AUM_PUBLIC_INVENTORY = ${JSON.stringify(publicRecords, null, 2)};\n`;
  const projectsJsStr = `window.AUM_PROJECTS_LOCAL = ${JSON.stringify(publicProjects, null, 2)};\n`;
  const featuredJsStr = `window.AUM_APPROVED_PROPERTIES = ${JSON.stringify(publicFeatured, null, 2)};\n`;

  const releaseId = `REL-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const hashes = {
    'public_inventory.json': sha256(inventoryJsonStr),
    'public_inventory.js': sha256(inventoryJsStr),
    'projects_local.js': sha256(projectsJsStr),
    'approved_properties.js': sha256(featuredJsStr)
  };

  const writtenTargets = [];

  if (writeFiles) {
    // Target 1: Primary Hostinger Source Data
    writeAtomicSync(path.join(targetPaths.hostingerDataDir, 'public_inventory.json'), inventoryJsonStr);
    writeAtomicSync(path.join(targetPaths.hostingerDataDir, 'public_inventory.js'), inventoryJsStr);
    writeAtomicSync(path.join(targetPaths.hostingerDataDir, 'projects_local.js'), projectsJsStr);
    writeAtomicSync(path.join(targetPaths.hostingerDataDir, 'approved_properties.js'), featuredJsStr);
    writtenTargets.push(targetPaths.hostingerDataDir);

    // Target 2: Embedded Hostinger Architectural Grid Concept Data (fixes Audit Finding #11!)
    if (fs.existsSync(path.dirname(targetPaths.hostingerConceptDataDir))) {
      writeAtomicSync(path.join(targetPaths.hostingerConceptDataDir, 'public_inventory.json'), inventoryJsonStr);
      writeAtomicSync(path.join(targetPaths.hostingerConceptDataDir, 'public_inventory.js'), inventoryJsStr);
      writtenTargets.push(targetPaths.hostingerConceptDataDir);
    }

    // Target 3: Standalone Architectural Grid Study 06 Baseline Data
    if (fs.existsSync(targetPaths.gridBaselineDir)) {
      writeAtomicSync(path.join(targetPaths.gridBaselineDataDir, 'public_inventory.json'), inventoryJsonStr);
      writeAtomicSync(path.join(targetPaths.gridBaselineDataDir, 'public_inventory.js'), inventoryJsStr);
      writtenTargets.push(targetPaths.gridBaselineDataDir);
    }

    // Target 4: Brand Study v16 Static Fallback Feed
    if (fs.existsSync(targetPaths.v16Dir)) {
      writeAtomicSync(path.join(targetPaths.v16Dir, 'public_inventory.js'), inventoryJsStr);
      writtenTargets.push(targetPaths.v16Dir);
    }

    // Save Release Manifest & Recoverable Snapshot outside public web root
    fs.mkdirSync(targetPaths.releasesDir, { recursive: true });
    const manifest = {
      release_id: releaseId,
      published_at: new Date().toISOString(),
      actor: actorLabel,
      counts: {
        public_properties: publicRecords.length,
        public_projects: publicProjects.length,
        featured_cards: publicFeatured.length
      },
      sha256: hashes,
      targets: writtenTargets
    };
    writeAtomicSync(
      path.join(targetPaths.releasesDir, `${releaseId}_manifest.json`),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    writeAtomicSync(
      path.join(targetPaths.releasesDir, 'latest_manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );

    recordAuditLog(db, {
      actorUserId,
      actorLabel,
      entityType: 'release',
      entityId: releaseId,
      action: 'publish_static_feeds',
      summary: `Published ${publicRecords.length} approved properties, ${publicProjects.length} public projects, and ${publicFeatured.length} featured cards across ${writtenTargets.length} targets.`,
      after: manifest
    });
  }

  return {
    releaseId,
    counts: {
      publicProperties: publicRecords.length,
      publicProjects: publicProjects.length,
      featuredCards: publicFeatured.length
    },
    hashes,
    writtenTargets
  };
}

module.exports = {
  writeAtomicSync,
  compileAndPublishStaticFeeds
};
