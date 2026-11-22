-- ==============================================================================
-- AUM Estates — MariaDB / MySQL Production Schema
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Advisor Users & Sessions
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('principal', 'advisor', 'analyst') NOT NULL DEFAULT 'advisor',
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  user_id INT NOT NULL,
  csrf_token VARCHAR(64) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  ip_address VARCHAR(45) NULL,
  created_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Locations & Projects
CREATE TABLE IF NOT EXISTS locations (
  location_id VARCHAR(64) PRIMARY KEY,
  corridor VARCHAR(128) NOT NULL,
  locality VARCHAR(128) NULL,
  sector VARCHAR(64) NULL,
  city VARCHAR(64) NOT NULL DEFAULT 'Gurgaon',
  description TEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  INDEX idx_locations_corridor (corridor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  project_id VARCHAR(64) PRIMARY KEY,
  project_name VARCHAR(191) NOT NULL,
  location_id VARCHAR(64) NULL,
  city VARCHAR(64) NOT NULL DEFAULT 'Gurgaon',
  locality VARCHAR(128) NULL,
  sector VARCHAR(64) NULL,
  micro_location VARCHAR(128) NULL,
  corridor VARCHAR(128) NOT NULL DEFAULT 'Gurugram Central & Other',
  project_type VARCHAR(64) NULL,
  status VARCHAR(64) NULL,
  description TEXT NULL,
  key_amenities TEXT NULL,
  price_band_text VARCHAR(128) NULL,
  image_file VARCHAR(255) NULL,
  publication_state ENUM('draft', 'pending_approval', 'approved_public', 'private_off_market', 'archived') NOT NULL DEFAULT 'approved_public',
  is_new_project_curated TINYINT(1) NOT NULL DEFAULT 0,
  curated_sort_order INT NULL,
  slug VARCHAR(191) NULL,
  last_verified VARCHAR(32) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_projects_location FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
  INDEX idx_projects_pub (publication_state, is_new_project_curated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CRM Unified Contacts Directory
CREATE TABLE IF NOT EXISTS contacts (
  contact_id VARCHAR(64) PRIMARY KEY,
  contact_type ENUM('buyer', 'seller_owner', 'channel_broker', 'family_office', 'tenant', 'developer') NOT NULL DEFAULT 'buyer',
  full_name VARCHAR(191) NOT NULL,
  firm_or_syndicate VARCHAR(191) NULL,
  phone_primary VARCHAR(32) NULL,
  phone_norm VARCHAR(32) NULL,
  phone_secondary VARCHAR(32) NULL,
  email VARCHAR(191) NULL,
  city VARCHAR(64) DEFAULT 'Gurgaon',
  preferred_channel VARCHAR(32) DEFAULT 'whatsapp',
  trust_tier VARCHAR(32) DEFAULT 'standard',
  private_notes TEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  INDEX idx_contacts_phone_norm (phone_norm),
  INDEX idx_contacts_type (contact_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Master Properties
CREATE TABLE IF NOT EXISTS properties (
  property_id VARCHAR(64) PRIMARY KEY,
  publication_state ENUM('draft', 'pending_approval', 'approved_public', 'private_off_market', 'archived') NOT NULL DEFAULT 'draft',
  availability_state ENUM('available', 'under_offer', 'sold', 'leased', 'withdrawn') NOT NULL DEFAULT 'available',
  project_id VARCHAR(64) NULL,
  project_name VARCHAR(191) NULL,
  location_id VARCHAR(64) NULL,
  city VARCHAR(64) NOT NULL DEFAULT 'Gurgaon',
  locality VARCHAR(128) NULL,
  sector VARCHAR(64) NULL,
  micro_location VARCHAR(128) NULL,
  corridor VARCHAR(128) NOT NULL DEFAULT 'Gurugram Central & Other',
  property_type VARCHAR(64) NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'apartment',
  transaction_type VARCHAR(64) NOT NULL DEFAULT 'Sale',
  listing_title VARCHAR(255) NOT NULL,
  configuration VARCHAR(128) NULL,
  bedrooms VARCHAR(64) NULL,
  bedrooms_int INT NULL,
  bathrooms VARCHAR(64) NULL,
  area_value DOUBLE NULL,
  area_unit VARCHAR(64) NULL,
  area_sqft_norm BIGINT NULL,
  floor_label VARCHAR(64) NULL,
  total_floors VARCHAR(64) NULL,
  facing VARCHAR(64) NULL,
  road_width VARCHAR(64) NULL,
  furnishing VARCHAR(64) NULL,
  possession_status VARCHAR(64) NULL,
  price_value DOUBLE NULL,
  price_unit VARCHAR(64) NULL,
  price_text VARCHAR(128) NULL,
  price_inr_norm BIGINT NULL,
  rent_value DOUBLE NULL,
  rent_unit VARCHAR(64) NULL,
  rent_inr_monthly_norm BIGINT NULL,
  key_features TEXT NULL,
  public_description TEXT NULL,
  public_features TEXT NULL,
  image_file VARCHAR(255) NULL,
  image_label VARCHAR(128) DEFAULT 'Representative Photograph',
  verification_status VARCHAR(128) DEFAULT 'Availability to be confirmed',
  verification_state ENUM('verified_direct', 'recently_reverified', 'needs_confirmation', 'stale_reverify_due') NOT NULL DEFAULT 'needs_confirmation',
  last_verified VARCHAR(32) NULL,
  next_reverify_due VARCHAR(32) NULL,
  things_to_confirm TEXT NULL,
  is_featured_approved TINYINT(1) NOT NULL DEFAULT 0,
  featured_sort_order INT NULL,
  featured_card_override_json LONGTEXT NULL,
  slug VARCHAR(255) NULL,
  url VARCHAR(255) NULL,
  approved_by_user_id INT NULL,
  approved_at VARCHAR(32) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_properties_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL,
  CONSTRAINT fk_properties_location FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_properties_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_properties_pub_avail (publication_state, availability_state),
  INDEX idx_properties_corridor (corridor),
  INDEX idx_properties_category (category),
  INDEX idx_properties_price_norm (price_inr_norm),
  INDEX idx_properties_rent_norm (rent_inr_monthly_norm),
  INDEX idx_properties_area_norm (area_sqft_norm),
  INDEX idx_properties_reverify (next_reverify_due),
  FULLTEXT idx_properties_fts (listing_title, project_name, corridor, locality, sector, micro_location, category, configuration, public_description, key_features)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Fiduciary Private Vault
CREATE TABLE IF NOT EXISTS property_private (
  property_id VARCHAR(64) PRIMARY KEY,
  owner_contact_id VARCHAR(64) NULL,
  owner_name_cache VARCHAR(191) NULL,
  owner_phone_cache VARCHAR(64) NULL,
  owner_email_cache VARCHAR(191) NULL,
  broker_contact_id VARCHAR(64) NULL,
  broker_name_cache VARCHAR(191) NULL,
  broker_phone_cache VARCHAR(64) NULL,
  source_group_name VARCHAR(191) NULL,
  exact_unit_or_plot_no VARCHAR(128) NULL,
  internal_floor_price_inr BIGINT NULL,
  commission_terms VARCHAR(255) NULL,
  payment_structure_notes TEXT NULL,
  title_deed_verified TINYINT(1) NOT NULL DEFAULT 0,
  encumbrance_notes TEXT NULL,
  raw_whatsapp_text MEDIUMTEXT NULL,
  internal_advisor_notes TEXT NULL,
  updated_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_prop_priv_prop FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  CONSTRAINT fk_prop_priv_owner FOREIGN KEY (owner_contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  CONSTRAINT fk_prop_priv_broker FOREIGN KEY (broker_contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  FULLTEXT idx_prop_priv_fts (owner_name_cache, broker_name_cache, exact_unit_or_plot_no, internal_advisor_notes, payment_structure_notes, raw_whatsapp_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. CRM Leads & Pipeline
CREATE TABLE IF NOT EXISTS leads (
  lead_id VARCHAR(64) PRIMARY KEY,
  contact_id VARCHAR(64) NULL,
  lead_title VARCHAR(255) NOT NULL,
  client_name VARCHAR(191) NOT NULL,
  client_phone VARCHAR(64) NULL,
  client_email VARCHAR(191) NULL,
  stage ENUM('new_inquiry', 'qualified', 'shortlist_shared', 'site_visit_scheduled', 'offer_negotiation', 'documentation', 'closed_won', 'closed_lost') NOT NULL DEFAULT 'new_inquiry',
  priority ENUM('high', 'normal', 'low') NOT NULL DEFAULT 'normal',
  intent VARCHAR(32) NOT NULL DEFAULT 'Buy',
  situation VARCHAR(255) NULL,
  preferred_location VARCHAR(191) NULL,
  budget_text VARCHAR(128) NULL,
  source_channel VARCHAR(64) NOT NULL DEFAULT 'website',
  source_page VARCHAR(255) NULL,
  primary_property_id VARCHAR(64) NULL,
  assigned_user_id INT NULL,
  inquiry_message TEXT NULL,
  selected_questions_json LONGTEXT NULL,
  saved_property_ids_json LONGTEXT NULL,
  idempotency_key VARCHAR(191) NULL UNIQUE,
  next_followup_at VARCHAR(32) NULL,
  lost_reason VARCHAR(255) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_leads_contact FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_property FOREIGN KEY (primary_property_id) REFERENCES properties(property_id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_user FOREIGN KEY (assigned_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_leads_stage (stage),
  INDEX idx_leads_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buyer_requirements (
  requirement_id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NULL,
  intent VARCHAR(32) NOT NULL DEFAULT 'Buy',
  corridors_json LONGTEXT NULL,
  sectors_json LONGTEXT NULL,
  categories_json LONGTEXT NULL,
  min_bedrooms INT NULL,
  min_budget_inr BIGINT NULL,
  max_budget_inr BIGINT NULL,
  min_area_sqft INT NULL,
  max_area_sqft INT NULL,
  preferred_facing VARCHAR(64) NULL,
  include_off_market TINYINT(1) NOT NULL DEFAULT 1,
  must_have_notes TEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_req_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  CONSTRAINT fk_req_contact FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  INDEX idx_requirements_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Shareable Client Shortlists
CREATE TABLE IF NOT EXISTS client_shortlists (
  shortlist_id VARCHAR(64) PRIMARY KEY,
  share_token VARCHAR(128) NOT NULL UNIQUE,
  lead_id VARCHAR(64) NULL,
  contact_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  client_name VARCHAR(191) NOT NULL,
  advisor_intro_note TEXT NULL,
  created_by_user_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at VARCHAR(32) NULL,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at VARCHAR(32) NULL,
  created_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_sl_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL,
  CONSTRAINT fk_sl_contact FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  CONSTRAINT fk_sl_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_shortlists_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shortlist_items (
  shortlist_id VARCHAR(64) NOT NULL,
  property_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  advisor_commentary TEXT NULL,
  match_score INT NULL,
  PRIMARY KEY (shortlist_id, property_id),
  CONSTRAINT fk_sli_shortlist FOREIGN KEY (shortlist_id) REFERENCES client_shortlists(shortlist_id) ON DELETE CASCADE,
  CONSTRAINT fk_sli_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Activities & Audit Logs
CREATE TABLE IF NOT EXISTS crm_activities (
  activity_id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id VARCHAR(64) NULL,
  contact_id VARCHAR(64) NULL,
  property_id VARCHAR(64) NULL,
  activity_type VARCHAR(64) NOT NULL DEFAULT 'note',
  summary VARCHAR(255) NOT NULL,
  metadata_json LONGTEXT NULL,
  actor_user_id INT NULL,
  created_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_act_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  CONSTRAINT fk_act_contact FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL,
  CONSTRAINT fk_act_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE SET NULL,
  CONSTRAINT fk_act_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_activities_lead (lead_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  actor_label VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  summary VARCHAR(255) NULL,
  before_json LONGTEXT NULL,
  after_json LONGTEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  INDEX idx_audit_entity (entity_type, entity_id, created_at),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  applied_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_undo (
  change_id INT AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(64) NOT NULL,
  before_json LONGTEXT NULL,
  after_json LONGTEXT NOT NULL,
  undone TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- Credential & intake throttling
-- Shared across PHP-FPM workers, which do not share memory.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS auth_throttle (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(32) NOT NULL,
  identifier VARCHAR(190) NOT NULL,
  attempted_at VARCHAR(32) NOT NULL,
  INDEX idx_auth_throttle_lookup (scope, identifier, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
