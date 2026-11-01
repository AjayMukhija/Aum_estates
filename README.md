# AUM Estates

Static property catalogue and private advisory CRM. The production frontend is `AUM_ESTATES_Website_For_Hostinger/`. The architectural grid and v16 brand study remain alternative local experiences; they are not separate inventory authorities.

## Run locally

Use Node **22.16+** (24+ also supported). No npm dependencies are required. The minimum version supports the SQLite transaction API used here ([Node documentation](https://nodejs.org/download/release/v22.21.0/docs/api/sqlite.html#databaseistransaction)).

```sh
npm run setup:admin -- --generate
npm run build
npm start
```

Open `http://127.0.0.1:8787/` for the site, `/crm/` for the CRM, `/grid/` for the grid, or `/v16/` for the brand study. Generated credentials are saved to `private_master_store/db/admin-credentials.json` with owner-only permissions; no password is printed or embedded in the login page. Re-running setup rotates the principal credential and revokes its sessions. Alternatively, supply a new password of at least 16 characters in `AUM_ADMIN_PASSWORD` when running `npm run setup:admin`.

`npm run serve` previews static files on ports 8000/8080. Static-only preview does not provide lead recording; use `npm start` for integrated testing.

## Data and permissions

SQLite at `private_master_store/db/aum_master_crm.sqlite` is authoritative. Set `AUM_DB_PATH` to use another private database location. Public JSON/JS are generated, disposable outputs; do not edit them directly. Bootstrap imports the existing private inventory seed, not fictitious contacts or buyer leads. Tests explicitly request demo fixtures.

- **Principal:** private CRM access, record editing, approval, imports, publishing and client sharing.
- **Advisor:** private CRM access, draft/pending/off-market work, imports pending approval, contacts, leads and client sharing. Cannot create/change an approved public mandate or publish releases.
- **Analyst:** authenticated read access and requirement matching; no mutations or sharing.

Sharing an available off-market property is a deliberate advisor action. Draft, pending, archived, unavailable or unsafe properties cannot be shared. All client-facing fields and commentary pass the privacy gate when a link is created and each time it is opened. Links expire after 30 days and can be revoked via `POST /api/crm/shortlists/:id/revoke`.

The private store stays outside every served directory. Raw private seed files are now ignored and retained only on the local machine. A fresh checkout bootstraps from the sanitized public feed; it does not include historical confidential notes. The existing remote repository is public and older commits contain private seed data: removing current files does not remove historical exposure. Repository-owner action is required to restrict access and assess history cleanup. Do not upload the project root to a web docroot.

## Inventory operations

```sh
npm run manage -- status
npm run add
npm run manage -- add /path/to/approved-property.json
npm run manage -- update-price AUM-WEB-000134 6.75 Cr
npm run manage -- update-status AUM-WEB-000134 Sold
npm run rollback
npm run build
```

The local CLI is a trusted principal/operator tool. Every mutation updates SQLite and regenerates all feeds; a failed build rolls back the database mutation and restores previous files. CLI undo restores the database, so a later build does not reinstate the undone value. Undo refuses to overwrite a property changed afterward in the CRM. Undoing an addition archives it to preserve IDs and history. Availability changes do not approve private/draft records; principal approval is a separate CRM action. The legacy public-JSON backup stack is not used for database restoration.

All imports use the authenticated CRM importer. Direct JSON-to-public compilation is disabled. Import batches commit transactionally; advisors' public approvals are demoted to pending principal review.

## Releases and recovery

```sh
npm test
npm run verify
npm run package
npm run backup
```

`package` builds from SQLite, runs local checks and behavioral tests, assembles a staging directory and scans its text assets. Only a successful candidate replaces `dist_hostinger/`; the previous bundle survives validation failure. Packaging rejects out-of-tree symlinks and private metadata. Bundle output is static: uploading it alone does not install the Node API.

Publishing uses a process lock, per-file atomic replacement, complete before/after snapshots and a persistent recovery journal in `private_master_store/releases/`. A normal failure restores the previous complete release. After a killed publisher, the next build or server startup checks the committed SQLite release audit record: it restores an uncommitted release or keeps a fully committed one before publishing again. Writer locks stay held until the enclosing database transaction commits or rolls back. This is recoverable multi-file promotion: readers can briefly see files switch at different instants. For strict whole-site cutover on a VPS, deploy a versioned application directory and switch the reverse proxy/upstream during a maintenance window.

`npm run backup` uses SQLite `VACUUM INTO` to produce a consistent backup, including committed WAL data. Backups contain confidential data and are owner-readable only. Before restoring:

1. Stop the CRM service and keep a fresh backup of the current database.
2. Verify the chosen backup with SQLite `PRAGMA integrity_check` and application tests in an isolated copy.
3. Replace the stopped database with the backup; remove only its obsolete `-wal` and `-shm` sidecars.
4. Start the service, run `npm run build`, then verify search and inventory.

A restore into an isolated database was tested during this fix. Copy backups to an access-controlled off-machine destination and set retention for your hosting environment; no remote backup destination is configured here. Release snapshots are not a substitute for backing up contacts, leads and private data.

## Deployment

See [deploy/README.md](deploy/README.md). The supported integrated arrangement is a Node process behind HTTPS nginx, with the website, `/api`, `/crm` and `/shortlist` on one origin. Static Hostinger hosting can serve the catalogue and WhatsApp handoff, but needs an explicitly configured same-origin API proxy to record leads.

Before external deployment, set `NODE_ENV=production`, `AUM_PUBLIC_ORIGIN=https://aumestates.com`, provision a new principal account on that host, configure TLS and enable the backup timer. Do not copy local credentials or database files into `public_html`.

```sh
npm run verify:deployed -- https://aumestates.com
```

This command checks HTTPS headers, API responses, private-path denial and inventory caching without creating a lead. Complete one clearly identified test enquiry through the browser and confirm it in the CRM before declaring lead capture operational. Local checks cannot certify the deployed server.

## Layout and maintenance

- `backend/`: HTTP APIs, auth, schema/migrations, domain rules and private CRM UI.
- `scripts/`: inventory operations, release packaging, backup and verification.
- `AUM_ESTATES_Website_For_Hostinger/`: primary frontend source.
- `aum-grid-local-baseline-2026-10-27/dist/`: architectural study.
- `AUM_Estates_Brand_Study_v16_Local/dist/`: brand study and property-index experience.
- `dist_hostinger/`: generated static deployment bundle.
- `audit/`: dated assessments and evidence; historical reports describe their specific reviewed commits.

Versioned migrations upgrade existing databases without reseeding business data. Known compromised bootstrap accounts are disabled, legacy featured references reconciled, exact unit references removed from public titles, and old demo records clearly labeled/archived. A backup was taken before applying these upgrades locally.
