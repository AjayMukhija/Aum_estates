# Remediation shipped — 1 November 2026

This is the implementation follow-up to REPORT.md. The assessment describes the original reviewed commit; this file records the repaired state.

## Implemented

- Shared shortlists validate approved/off-market property fields and client commentary both at creation and retrieval. Draft/pending/unavailable records are rejected. Links expire in 30 days and can be revoked from the CRM.
- Fixed credentials removed from configuration and the login page. Known compromised bootstrap accounts are disabled by migration. A local principal credential was generated privately, without printing it or committing it; prior sessions were revoked.
- Analysts are read-only. Advisors cannot approve/publish or bypass approval through generic updates or imports. Cookie-authenticated mutations cannot bypass CSRF with an unrelated header. Production cookies are Secure.
- Featured cards use master identity, specs, imagery and current financial terms. Arbour and Quartier selections now point to the correct records. Curated projects and homepage corridor counts also derive from the master feed.
- SQLite is authoritative for CLI operations and undo. Failed publication rolls back its CLI mutation. Undo survives rebuild and refuses to overwrite later CRM changes. No direct JSON-to-public compiler remains.
- Publishing has serialized writers, retained before/after snapshots and an interruption-recovery journal. Failed multi-file promotion restores the previous release. This is recoverable promotion; instantaneous whole-site atomicity is not claimed.
- Packaging validates in staging, runs behavioral tests, scans all relevant text assets and only then replaces the previous bundle. It recovers interrupted directory promotion on the next run.
- Unified lead client checks durable acknowledgements, retries transient failures with one idempotency key, reports failure honestly and retains WhatsApp handoff. Catalogue, dossiers, featured properties, projects, grid and v16 use the same client.
- Homepage overflow fixed at sampled 320/390/768/1280px widths. Blanket title-clearance claims removed; public reference labels and representative images replace unconditional verified badges. Updated assets have cache versions; inventory has explicit revalidation rules.
- Versioned migrations reconcile existing data, remove exact unit references from public titles/slugs, retain source details privately and label/archive old demo fixtures. Fresh operational bootstrap excludes demo contacts/leads. A consistent SQLite backup preceded local migration.
- Added a root operating guide, current deployment documentation, nginx/systemd/backup examples and read-only deployed acceptance checks.
- Raw private seed JSON files removed from the Git index and ignored; local copies retained. Fresh checkouts build from sanitized public data without needing confidential seed files.

## Verification

- `npm run package`: passed; includes **21/21 behavioral tests**, **45/45 local smoke checks**, and scan of **268 bundled files**.
- Independent package in a temporary clean copy without private seeds: passed.
- Synthetic private JSON canary and out-of-root symlink: each rejected; the previous accepted bundle remained intact.
- Fault injection during JavaScript promotion: previous JSON, JavaScript and manifest restored.
- Interrupted publisher journal recovery: passed.
- SQLite backup restored into an isolated database: integrity check and public projection passed.
- Browser enquiry on an in-memory local database: durable lead acknowledgement displayed; no external WhatsApp message sent.
- Canonical Golf Course Ext & SPR catalogue filter: 79 references, matching the master corridor count.
- Browser mobile widths: no horizontal document overflow after the final fix. At 320px viewport, document width was 305px (scrollbar excluded).
- Syntax checks: 40 external and 37 inline scripts/structured data blocks parsed without errors.
- `git diff --check`: passed.

## External deployment and historical exposure remain

Read-only live checks after implementation returned homepage 200, `/api/public/health` 404, and the legacy raw inventory path 200 with JSON content type. HSTS was absent on those responses. No raw private file body was downloaded. These observations establish that this release has not been deployed there; local tests do not change the live server.

The existing GitHub repository is public, and the original `redesign-clean` branch tracks the private seed files. This patch removes them from its new tip, but cannot erase older commits, caches, clones or previously downloaded files. Repository-owner action is required to restrict exposure and plan any history cleanup; no force push or history rewrite was performed.

A live deploy needs the Hostinger connection and a Node-capable hosting/proxy arrangement. When deploying the static bundle, remove obsolete raw files from the public document root and purge their CDN/cache entries. Do not upload the repository root, private store or local credential export. Configure an off-machine backup destination separately.
