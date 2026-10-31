PRAGMA foreign_keys = ON;

-- 1. Advisor Users & Sessions
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'advisor' CHECK (role IN ('principal', 'advisor', 'analyst')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 2. Locations & Projects
CREATE TABLE IF NOT EXISTS locations (
  location_id TEXT PRIMARY KEY,
  corridor TEXT NOT NULL,
  locality TEXT,
  sector TEXT,
  city TEXT NOT NULL DEFAULT 'Gurgaon',
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_locations_corridor ON locations(corridor);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  location_id TEXT REFERENCES locations(location_id) ON DELETE SET NULL,
  city TEXT NOT NULL DEFAULT 'Gurgaon',
  locality TEXT,
  sector TEXT,
  micro_location TEXT,
  corridor TEXT NOT NULL DEFAULT 'Gurugram Central & Other',
  project_type TEXT,
  status TEXT,
  description TEXT,
  key_amenities TEXT,
  price_band_text TEXT,
  image_file TEXT,
  publication_state TEXT NOT NULL DEFAULT 'approved_public'
    CHECK (publication_state IN ('draft', 'pending_approval', 'approved_public', 'private_off_market', 'archived')),
  is_new_project_curated INTEGER NOT NULL DEFAULT 0,
  curated_sort_order INTEGER,
  slug TEXT,
  last_verified TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_pub ON projects(publication_state, is_new_project_curated);

-- 3. CRM Unified Contacts Directory (Buyers, Sellers/Owners, Channel Brokers, Family Offices)
CREATE TABLE IF NOT EXISTS contacts (
  contact_id TEXT PRIMARY KEY,
  contact_type TEXT NOT NULL DEFAULT 'buyer'
    CHECK (contact_type IN ('buyer', 'seller_owner', 'channel_broker', 'family_office', 'tenant', 'developer')),
  full_name TEXT NOT NULL,
  firm_or_syndicate TEXT,
  phone_primary TEXT,
  phone_norm TEXT,
  phone_secondary TEXT,
  email TEXT,
  city TEXT DEFAULT 'Gurgaon',
  preferred_channel TEXT DEFAULT 'whatsapp',
  trust_tier TEXT DEFAULT 'standard',
  private_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_norm ON contacts(phone_norm);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);

-- 4. Master Properties (Public & Structural Specification ONLY — Zero Fiduciary Secrets)
CREATE TABLE IF NOT EXISTS properties (
  property_id TEXT PRIMARY KEY,
  publication_state TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'pending_approval', 'approved_public', 'private_off_market', 'archived')),
  availability_state TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_state IN ('available', 'under_offer', 'sold', 'leased', 'withdrawn')),
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  project_name TEXT,
  location_id TEXT REFERENCES locations(location_id) ON DELETE SET NULL,
  city TEXT NOT NULL DEFAULT 'Gurgaon',
  locality TEXT,
  sector TEXT,
  micro_location TEXT,
  corridor TEXT NOT NULL DEFAULT 'Gurugram Central & Other',
  property_type TEXT,
  category TEXT NOT NULL DEFAULT 'apartment',
  transaction_type TEXT NOT NULL DEFAULT 'Sale',
  listing_title TEXT NOT NULL,
  configuration TEXT,
  bedrooms TEXT,
  bedrooms_int INTEGER,
  bathrooms TEXT,
  area_value REAL,
  area_unit TEXT,
  area_sqft_norm INTEGER,
  floor_label TEXT,
  total_floors TEXT,
  facing TEXT,
  road_width TEXT,
  furnishing TEXT,
  possession_status TEXT,
  price_value REAL,
  price_unit TEXT,
  price_text TEXT,
  price_inr_norm INTEGER,
  rent_value REAL,
  rent_unit TEXT,
  rent_inr_monthly_norm INTEGER,
  key_features TEXT,
  public_description TEXT,
  public_features TEXT,
  image_file TEXT,
  image_label TEXT DEFAULT 'Representative Photograph',
  verification_status TEXT DEFAULT 'Availability to be confirmed',
  verification_state TEXT NOT NULL DEFAULT 'needs_confirmation'
    CHECK (verification_state IN ('verified_direct', 'recently_reverified', 'needs_confirmation', 'stale_reverify_due')),
  last_verified TEXT,
  next_reverify_due TEXT,
  things_to_confirm TEXT DEFAULT '["Exact unit & floor availability","Current asking price & complete cost breakdown","Title, RERA/HSVP approval & possession timeline"]',
  is_featured_approved INTEGER NOT NULL DEFAULT 0,
  featured_sort_order INTEGER,
  featured_card_override_json TEXT,
  slug TEXT,
  url TEXT,
  approved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_pub_avail ON properties(publication_state, availability_state);
CREATE INDEX IF NOT EXISTS idx_properties_corridor ON properties(corridor);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_price_norm ON properties(price_inr_norm);
CREATE INDEX IF NOT EXISTS idx_properties_rent_norm ON properties(rent_inr_monthly_norm);
CREATE INDEX IF NOT EXISTS idx_properties_area_norm ON properties(area_sqft_norm);
CREATE INDEX IF NOT EXISTS idx_properties_reverify ON properties(next_reverify_due);

-- 5. Fiduciary Private Vault (1:1 Strict Advisor-Only Isolation)
CREATE TABLE IF NOT EXISTS property_private (
  property_id TEXT PRIMARY KEY REFERENCES properties(property_id) ON DELETE CASCADE,
  owner_contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  owner_name_cache TEXT,
  owner_phone_cache TEXT,
  owner_email_cache TEXT,
  broker_contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  broker_name_cache TEXT,
  broker_phone_cache TEXT,
  source_group_name TEXT,
  exact_unit_or_plot_no TEXT,
  internal_floor_price_inr INTEGER,
  commission_terms TEXT,
  payment_structure_notes TEXT,
  title_deed_verified INTEGER NOT NULL DEFAULT 0,
  encumbrance_notes TEXT,
  raw_whatsapp_text TEXT,
  internal_advisor_notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 6. FTS5 Full-Text Search Indexes (Strictly Separate Public vs CRM Private Indexes)
CREATE VIRTUAL TABLE IF NOT EXISTS properties_public_fts USING fts5(
  property_id UNINDEXED,
  listing_title,
  project_name,
  corridor,
  location_text,
  category_text,
  specs_text,
  description_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS properties_crm_fts USING fts5(
  property_id UNINDEXED,
  public_text,
  owner_text,
  broker_text,
  exact_unit_no,
  private_notes_text,
  raw_whatsapp_text,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- 7. CRM Leads, Deal Pipeline & Buyer Requirements
CREATE TABLE IF NOT EXISTS leads (
  lead_id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  lead_title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  stage TEXT NOT NULL DEFAULT 'new_inquiry'
    CHECK (stage IN (
      'new_inquiry',
      'qualified',
      'shortlist_shared',
      'site_visit_scheduled',
      'offer_negotiation',
      'documentation',
      'closed_won',
      'closed_lost'
    )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  intent TEXT NOT NULL DEFAULT 'Buy',
  situation TEXT,
  preferred_location TEXT,
  budget_text TEXT,
  source_channel TEXT NOT NULL DEFAULT 'website',
  source_page TEXT,
  primary_property_id TEXT REFERENCES properties(property_id) ON DELETE SET NULL,
  assigned_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  inquiry_message TEXT,
  selected_questions_json TEXT DEFAULT '[]',
  saved_property_ids_json TEXT DEFAULT '[]',
  idempotency_key TEXT UNIQUE,
  next_followup_at TEXT,
  lost_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS buyer_requirements (
  requirement_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  intent TEXT NOT NULL DEFAULT 'Buy',
  corridors_json TEXT DEFAULT '[]',
  sectors_json TEXT DEFAULT '[]',
  categories_json TEXT DEFAULT '[]',
  min_bedrooms INTEGER,
  min_budget_inr INTEGER,
  max_budget_inr INTEGER,
  min_area_sqft INTEGER,
  max_area_sqft INTEGER,
  preferred_facing TEXT,
  include_off_market INTEGER NOT NULL DEFAULT 1,
  must_have_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_requirements_lead ON buyer_requirements(lead_id);

-- 8. Shareable Client Shortlists / Private Dossiers
CREATE TABLE IF NOT EXISTS client_shortlists (
  shortlist_id TEXT PRIMARY KEY,
  share_token TEXT NOT NULL UNIQUE,
  lead_id TEXT REFERENCES leads(lead_id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  advisor_intro_note TEXT,
  created_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_shortlists_token ON client_shortlists(share_token);

CREATE TABLE IF NOT EXISTS shortlist_items (
  shortlist_id TEXT NOT NULL REFERENCES client_shortlists(shortlist_id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  advisor_commentary TEXT,
  match_score INTEGER,
  PRIMARY KEY (shortlist_id, property_id)
);

-- 9. CRM Activity Timeline & Immutable Audit Trail
CREATE TABLE IF NOT EXISTS crm_activities (
  activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT REFERENCES leads(lead_id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(contact_id) ON DELETE SET NULL,
  property_id TEXT REFERENCES properties(property_id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL DEFAULT 'note',
  summary TEXT NOT NULL,
  metadata_json TEXT,
  actor_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON crm_activities(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  actor_label TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
