'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const PATHS = {
  root: ROOT_DIR,
  dbDir: path.join(ROOT_DIR, 'private_master_store', 'db'),
  dbFile: process.env.AUM_DB_PATH || path.join(ROOT_DIR, 'private_master_store', 'db', 'aum_master_crm.sqlite'),
  releasesDir: path.join(ROOT_DIR, 'private_master_store', 'releases'),
  seedInventoryJson: path.join(ROOT_DIR, 'private_master_store', 'aum_inventory_local.json'),
  seedMetaJson: path.join(ROOT_DIR, 'private_master_store', 'inventory_data_meta.json'),
  hostingerDir: path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger'),
  hostingerDataDir: path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'data'),
  hostingerConceptDataDir: path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'concepts', 'aum-grid-study', 'data'),
  gridBaselineDir: path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist'),
  gridBaselineDataDir: path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist', 'data'),
  v16Dir: path.join(ROOT_DIR, 'AUM_Estates_Brand_Study_v16_Local', 'dist'),
  distHostingerDir: path.join(ROOT_DIR, 'dist_hostinger'),
  crmUiDir: path.join(__dirname, 'crm-ui')
};

const OFFICIAL_PHONES = ['9873813595', '9811157018'];
const OFFICIAL_WHATSAPP = '919873813595';
const OFFICIAL_DIRECT_LINE = '+919811157018';

const PUBLICATION_STATES = new Set([
  'draft',
  'pending_approval',
  'approved_public',
  'private_off_market',
  'archived'
]);

const AVAILABILITY_STATES = new Set([
  'available',
  'under_offer',
  'sold',
  'leased',
  'withdrawn'
]);

const VERIFICATION_STATES = new Set([
  'verified_direct',
  'recently_reverified',
  'needs_confirmation',
  'stale_reverify_due'
]);

const LEAD_STAGES = [
  'new_inquiry',
  'qualified',
  'shortlist_shared',
  'site_visit_scheduled',
  'offer_negotiation',
  'documentation',
  'closed_won',
  'closed_lost'
];

const CONTACT_TYPES = new Set([
  'buyer',
  'seller_owner',
  'channel_broker',
  'family_office',
  'tenant',
  'developer'
]);

// Canonical public fields emitted to public_inventory.json / .js
const ALLOWED_PUBLIC_FIELDS = [
  'property_id',
  'status',
  'project_id',
  'project_name',
  'locality',
  'sector',
  'city',
  'micro_location',
  'corridor',
  'property_type',
  'category',
  'transaction_type',
  'listing_title',
  'configuration',
  'bedrooms',
  'bathrooms',
  'area_value',
  'area_unit',
  'area_sqft_norm',
  'facing',
  'road_width',
  'price_value',
  'price_unit',
  'price_text',
  'price_inr_norm',
  'rent_value',
  'rent_unit',
  'rent_inr_monthly_norm',
  'key_features',
  'public_description',
  'public_features',
  'image_file',
  'image_label',
  'verification_status',
  'last_verified',
  'things_to_confirm',
  'slug',
  'url'
];

const SERVER_CONFIG = {
  host: process.env.AUM_HOST || '127.0.0.1',
  port: Number(process.env.AUM_PORT || 8787),
  sessionCookieName: 'aum_crm_sid',
  sessionTtlHours: 72,
  defaultAdminEmail: process.env.AUM_ADMIN_EMAIL || 'ajay@aumestates.com',
  defaultAdminPassword: process.env.AUM_ADMIN_PASSWORD || 'AumAdvisory@2026',
  defaultAdminName: 'Ajay Mukhija'
};

module.exports = {
  ROOT_DIR,
  PATHS,
  OFFICIAL_PHONES,
  OFFICIAL_WHATSAPP,
  OFFICIAL_DIRECT_LINE,
  PUBLICATION_STATES,
  AVAILABILITY_STATES,
  VERIFICATION_STATES,
  LEAD_STAGES,
  CONTACT_TYPES,
  ALLOWED_PUBLIC_FIELDS,
  SERVER_CONFIG
};
