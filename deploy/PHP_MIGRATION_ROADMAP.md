# AUM Estates PHP migration roadmap

Proposed implementation plan for full property publishing and the advisory CRM on Hostinger Premium. Planning baseline dated 21 November 2026.

- [Feature parity and acceptance tests](#feature-parity-and-acceptance-tests)
- [Application design on Hostinger Premium](#application-design-on-hostinger-premium)
- [Data migration and reconciliation](#data-migration-and-reconciliation)
- [Execution phases](#execution-phases)
- [Tests and evidence required before production](#tests-and-evidence-required-before-production)
- [Production cutover and rollback](#production-cutover-and-rollback)
- [Client handover and ongoing ownership](#client-handover-and-ongoing-ownership)
- [Decisions needed to start](#decisions-needed-to-start)

## Launch objective

An AUM Estates staff member can sign in at `aumestates.com/crm/`, enter a property, and submit it for approval. The account owner can approve it and publish it to the public catalogue. A buyer can find the listing, submit an enquiry, and receive a private shortlist. The team can follow up in the dashboard and withdraw the property when it becomes unavailable. These workflows must work on the current Hostinger plan and survive an application deployment or database restore.

Keep the public website and CRM interface in HTML, CSS, and JavaScript. Reimplement the server behind them in PHP and migrate the operational data from SQLite to Hostinger’s MariaDB service. Serve the website, the CRM, and the API from the same domain. Node.js can still run locally for existing frontend checks and baseline comparisons. Hostinger Premium supports PHP and MariaDB through the MySQL-compatible interface. [Hostinger plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/) · [Hostinger database engine](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/) · [Hostinger PDO support](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)

For one developer, budget **14–22 engineering days** for full parity, roughly three to five working weeks before scheduling delays. This is a planning range based on reusing both interfaces and having a usable inventory source. Price the work after the hosting and data preflight. The main uncertainties are the quality of the source data, reproducing search results, and getting the publication and import paths through staging with the plan’s actual limits.

## Starting point and sources of truth

| Surface | Starting point | Use during migration |
| --- | --- | --- |
| Live website | Hostinger Premium serves an older static catalogue, listing details, projects, locations, and contact links. `/crm/` and `/api/public/health` returned `404` at the last check. | Capture URLs, assets, redirects, and current access rules. Keep this site available while PHP is staged. |
| Local production frontend | `AUM_ESTATES_Website_For_Hostinger/` contains the newer public interface and enquiry capture client. | Reuse the source, test its browser behaviour, and compare visible inventory and deep links against production before cutover. |
| Local CRM and API | `backend/crm-ui/` and `backend/server.js` implement sign-in, inventory, leads, contacts, imports, matching, shortlists, and publishing. The current Node test suite passed 27 tests. | Capture the API and domain behaviour from code and tests. Use the Node version as the reference during the port. |
| Operational records | The local SQLite database is the Node app’s authority. A fresh checkout can seed public listings from the sanitized feed. | Have the account owner identify the approved inventory and private records to carry forward. Record this choice before writing a migration script. |
| Public build | The clean, sanitized local build passed 45 checks and packaged 268 public files. The local seed needed a fix to preserve floor labels when bootstrapping from the public feed. | Include the seed fix in the reference revision and preserve the floor values present in the approved source. The build stats describe a reference run. Reconcile production counts against the actual export. |
| Live access rules | The two legacy inventory JSON URLs and the deployment ZIP are denied by the production `.htaccess` rules. The Hostinger CDN was purged and those URLs were checked afterwards. | Carry forward the deny rules and test them through the CDN before and after cutover. Keep deployment archives outside the public web root. |

The reference checkout is revision `82986d4` plus the local floor-label seed fix. Capture a reproducible reference revision during preflight. [Repository README](../README.md) · [Route handlers](../backend/server.js) · [Database schema](../backend/db/schema.sql) · [Backend tests](../backend/backend-crm.test.cjs) · [Deployed checks](../scripts/verify_deployed.js) · [Node deployment guide](README.md)

## Feature parity and acceptance tests

| Workflow | Behaviour to preserve | Acceptance evidence |
| --- | --- | --- |
| Public catalogue and property details | Preserve public URLs and property IDs, sale and rent distinctions, price on request, project and location pages, filters, featured cards, and representative imagery. Keep existing phone and WhatsApp links. | A browser opens representative apartment, plot, commercial, rental, and off-plan entries from search and saved URLs. Prices, floors, links, filters, and images match the approved inventory. |
| Staff accounts | Provision owner, advisor, and analyst accounts. Owner maps to the existing `principal` role. Advisors prepare and manage permitted records and share shortlists. Analysts can read and run matching. Enforce permissions in PHP on every request. | Each role passes a browser sign-in and an API permission test. Anonymous requests, expired sessions, and unauthorized writes fail. A revoked or deactivated account loses access. |
| Inventory lifecycle | Keep publication state and availability as separate fields. Preserve drafts, pending approval, available public listings, off-market inventory, and archived records. Preserve under offer, sold, leased, and withdrawn statuses. Only approved and available listings qualify for the catalogue. | An advisor submits a draft, the owner approves and publishes it, an updated price appears after the next publish, and removal clears search, featured cards, and the public API. Confirm whether advisors may demote an already public listing before finalizing the permission tests. |
| Private CRM search and re-verification | Preserve search by owner or broker details, exact internal references, and raw intake text for authorized staff. Preserve verification status, review-due dates, and re-verification actions. | The same representative private lookups yield the intended records in the CRM. The public API and feeds contain only permitted public fields. |
| Website enquiries | Save the visitor’s contact details, preference and budget, source, and listing reference when valid. Preserve deal intent, follow-up activity, and the separate WhatsApp handoff. Keep retries idempotent. | Submit from the live-style contact form and from a listing. Confirm the form creates one lead even if the response is lost and retried. A simulated server failure shows the fallback while WhatsApp remains available. |
| Lead and contact management | Preserve contact lookup and creation, lead stages and priorities, linked contacts and listings, buyer requirements, and logged calls or viewings. | The team qualifies a lead, records a viewing, edits its requirements, finds the linked contact, and sees the activity history after signing out and back in. |
| Buyer requirement matching | Port the scoring for intent, geography, category, budget, area, bedrooms, facing, and verification. Include eligible off-market inventory when the staff member selects that option. Keep internal negotiation values inside the CRM. | Run the same synthetic buyer requirements through Node and PHP. Compare candidate IDs, ranking, and explanations, and review intentional differences with the owner. |
| Private shortlists | Preserve shareable URLs, deliberate selection of eligible off-market properties, the 30-day expiry, revocation, and screening of property copy and staff commentary at creation and read time. | A buyer opens a shortlist without a staff login. Expired and revoked links become unavailable. A property that becomes ineligible or unsafe after sharing stops being disclosed. |
| Imports and WhatsApp intake | Preserve `.xlsx`, `.csv`, `.tsv`, and `.json` import, dry-run previews, new versus updated records, row issues, full-batch validation, and role rules. Preserve pasted WhatsApp parsing and separation of public text from private details. | Valid files produce expected previews and committed records. An invalid row causes the batch to fail without partial writes. A retry, duplicate ID, and advisor attempt to import a public approval behave as specified. |
| Audit and recovery | Retain actor, action, record reference, and timestamp for auditable changes. Provide controlled rollback for a release and an operator path to undo an eligible inventory edit without overwriting a later change. | Staff can identify a change and its actor. A failed publish leaves the previous release available. A backup restores inventory, enquiries, and audit history in an isolated environment. |

Keep the current feature scope as the launch contract. Confirm which concept or study pages belong on the production site. If retained, give them the same published inventory. Schedule new features such as image or floor-plan uploads through a separate product decision.

## Application design on Hostinger Premium

### Request routing and configuration

- Use a supported PHP 8.x version verified in this account. Start by confirming web and command-line PHP match where required, `pdo_mysql`, `mbstring`, and the ZIP and XML extensions needed by the chosen workbook parser. Match local and staging PHP and MariaDB versions closely enough to exercise the same behaviours. [Hostinger PHP versions](https://www.hostinger.com/support/1575755-how-to-change-the-php-version-of-your-hosting-plan/) · [Hostinger PHP extensions](https://www.hostinger.com/support/4667515-how-to-manage-php-extensions-and-options-in-hostinger/)
- Ship the existing frontend assets and a PHP entry point. Use targeted `.htaccess` rewrites for API, shortlist, and publication feed URLs. Explicitly preserve direct links, trailing-slash behaviour, status codes, real static assets, and the live access rules. Verify that `GET`, `HEAD`, `POST`, `PATCH`, and `PUT` work as intended, including how the host passes request bodies, cookies, and custom headers.
- Keep application code that handles credentials, environment configuration, import scratch space, logs, backups, and release administration outside `public_html`. Use separate stage and production database credentials. Restrict the application account to its database and reserve schema changes and restores for the migration operator.
- Keep route handlers small enough to share role checks, input validation, normalization, and database transaction logic across the endpoints and operator tools that need them. Add a maintained workbook parser if it fits verified Hostinger limits. Build any PHP dependencies before uploading a deployable release.

### API compatibility

Record methods, headers, request fields, aliases, JSON keys and types, status codes, and error payloads using synthetic fixtures. The current dashboard makes same-origin requests. Keeping that contract limits the JavaScript work to intentional changes. Preserve integer and boolean serialization where the browser depends on it, especially when the MariaDB driver returns numeric columns as strings.

| API area | Reference routes and contracts |
| --- | --- |
| Public reads | `GET /api/public/health`, `/api/public/properties`, `/api/public/properties/{id}`, and `/api/public/projects`. Preserve search aliases such as `purpose` or `mode`, `category` or `type`, and `bedrooms` or `beds` when used. Cover filters, pagination, sort order, and unavailable detail responses. |
| Public intake | `POST /api/public/inquiries`. Keep the enquiry aliases used by current callers, the `lead_id` acknowledgement, success on an idempotent replay, and input and rate-limit errors. |
| Staff session | `/api/crm/auth/login`, `/api/crm/auth/logout`, and `/api/crm/auth/session`. Keep the dashboard’s sign-in response and CSRF exchange compatible. Inventory any authorized non-browser client that needs the existing `x-aum-session` header before deciding how to support it. |
| CRM inventory | `/api/crm/dashboard`, `/api/crm/properties`, `/api/crm/properties/{id}`, and the `approve` and `reverify` actions. Include read and update methods, public and private drawer data, and audit history. |
| CRM intake and sales | `/api/crm/intake/whatsapp`, `/api/crm/intake/import`, `/api/crm/contacts`, `/api/crm/leads`, per-lead detail, activities and requirement routes, and `/api/crm/requirements/match`. Capture the routes the UI calls alongside the endpoints that other authorized callers actually use. |
| Sharing and publishing | `/api/crm/shortlists`, `/api/crm/shortlists/{id}/revoke`, `/shortlist/{token}`, `/api/public/shortlists/{token}`, `/api/crm/publish`, and `/api/crm/audit-logs`. Preserve the dashboard’s release response, including counts, release ID, and feed hashes. |

Keep existing contact and property enquiry links usable during the cutover. Explicitly distinguish an enquiry saved to the CRM, a WhatsApp handoff event, and a message a visitor actually sends in WhatsApp in the UI and acceptance script.

### Publication and search

The Node reference uses a generated feed for the catalogue and direct database reads for parts of the public API. The proposed PHP design treats **Publish** as the point when approved catalogue changes become visible across the public catalogue and API. Confirm this behaviour in staging with the owner, including how to remove an unavailable or confidential listing quickly. Shortlists recheck an item’s current eligibility separately because their links can intentionally include off-market properties.

1. Build a candidate release from a consistent view of approved, available inventory and approved project data. Reconcile featured cards to real available listing IDs. Project only the public fields and scan public text for sensitive content. Keep the existing safety checks for empty output and large inventory drops, with an explicit owner override for a legitimate bulk removal and a recorded reason.
2. Store each successful version as an immutable public data snapshot with a release ID, counts, hashes, and publisher. Store the active release ID in MariaDB. Activate the completed snapshot and record the audit event in one database transaction. Serialize competing publishes and define how a listing edit concurrent with a publish is included or deferred. A timeout, failed validation, or interrupted transaction must leave the previous release readable.
3. Serve the existing public feed URLs from the active snapshot. Preserve JavaScript globals and content types for `public_inventory.js`, `projects_local.js`, and `approved_properties.js`, and retain `public_inventory.json` where consumed. Start with PHP serving complete, precomputed feed payloads from MariaDB. Benchmark that path on Premium before considering private versioned files. Use the release ID for revalidation. If a page requires multiple feeds from the same release, pin those requests to a single version or supply the required data together.
4. Keep the browser’s public catalogue filters on the reused frontend. Build API search from the published projection and staff search from its own indexed fields. Test MariaDB full-text ranking and add targeted indexed lookup paths for record IDs, normalized phone numbers, sector numbers, and other short tokens. Preserve Gurugram and Gurgaon aliases, project-name prefixes, BHK variants, INR and area conversions, rental filters, and price-on-request handling. Preserve private data exclusions in result sets, counts, facets, and logs. [MariaDB full-text behaviour](https://mariadb.com/docs/server/ha-and-performance/optimization-and-tuning/optimization-and-indexes/full-text-indexes/full-text-index-overview)
5. Configure CRM pages, authenticated API responses, and shortlist responses to bypass shared caches. Require revalidation or an equivalent CDN rule for current inventory URLs, and use versioned names or query strings for cacheable static assets. Verify a price change and withdrawal in a clean browser and through Hostinger CDN after publishing. Preserve cache headers and confirm they take effect at the edge.

### Accounts, enquiries, and intake

- Use PHP password hashing and verification for newly provisioned accounts. The Node password hashes use scrypt with a separate salt. Prefer activating fresh PHP accounts for approved staff and preserving user IDs or their audit mapping. If any account migration is required, define how those staff set a new password before launch. Issue fresh sessions and preserve `Secure`, `HttpOnly`, and `SameSite=Strict` cookies. Verify CSRF on browser writes and the authoritative role for the session on each protected endpoint. [PHP password hashing](https://www.php.net/manual/en/function.password-hash.php)
- Put mutations and their audit records in the same transaction where feasible. Use a database-safe ID allocator for public listing references and CRM identifiers. Handle concurrent edits with a version check or an equivalent strategy. Preserve approved references during data import so existing listing links continue to resolve.
- Make the enquiry insert, contact resolution, buyer requirement creation where applicable, and activity write transactional. Enforce a unique idempotency key at the database level and handle repeated or concurrent requests consistently. Keep normalized contact lookup and distinguish a valid repeat from an empty or invalid enquiry. Use rate limits that work across PHP workers and confirm how Hostinger identifies clients behind the CDN before relying on IP-based controls.
- Use prepared statements, explicit output field lists, context-appropriate escaping, and generic unexpected-error messages. Keep sensitive values out of diagnostic logs and browser responses unless the authenticated workflow expressly requires them. The public site and its APIs must be unable to select private fields through alternate searches, export paths, or parameter changes.
- Bound imports by request bytes, expanded workbook size, worksheet and row count, and execution time. The current CRM sends workbook data as Base64 in JSON, which increases request size. Test the actual end-to-end cap on Hostinger and report errors in the existing UI. Keep dry runs free of business writes. Recheck permissions, IDs, and validation on commit, then use one transaction for an accepted batch. Exercise quoted CSV, line breaks, BOM and non-ASCII text, decimal values, duplicate IDs, malformed workbooks, and clearly reported invalid rows.

## Data migration and reconciliation

| Data | Migration treatment | Required checks |
| --- | --- | --- |
| Listings, locations, projects, and featured references | Preserve IDs, slugs, image references, timestamps, state, and approved relationships. Retain original units and normalized INR and square-foot values at defined precision. | Compare counts by publication and availability state, representative field values, ID sets, project links, floor labels, featured IDs, and public listing URLs. |
| Private property fields | Export only the records the owner approves moving. Import into the private tables over an authenticated channel and preserve the association with the master record. | Reconcile per-table counts and foreign keys. Compare redacted samples or checksums privately. Scan all generated public material for private keys and text. |
| Users and sessions | Preserve approved staff identities, role, and active status or map them to new users for audit attribution. Provision fresh credentials and start fresh sessions on PHP. | Confirm each account with the owner, verify a usable principal login, and check that old sessions and any demo accounts grant no access. |
| Contacts, leads, requirements, and activities | Import approved real records in dependency order. Preserve relationships, event chronology, normalized phone lookups, and idempotency keys where present. Resolve duplicate normalized contacts with a documented mapping before adding any new uniqueness constraint. | Check lead counts and stages, date ranges, contact links, deduplication, and orphan records. Verify sample lead timelines and requirements in the UI. |
| Shortlists and items | Determine whether the source contains active links already shared externally. If any must be retained, preserve link validity, item order, expiry, and revocation state. Treat stored tokens as secrets and use case-sensitive token matching. Otherwise start with a clean production shortlist table. | Test valid, expired, and revoked samples. Preserve required links without extending expiry or changing item visibility. |
| Search indexes and release data | Rebuild from the imported master records. Produce the first release through the PHP publisher and retain the sanitized site backup and comparison report. | Confirm usable indexes, reproducible result sets, expected public counts, and consistent asset and feed versions. |
| Historical audit and operator records | Preserve relevant audit records and their actor mapping. Retain a secured export of Node-specific release and rollback history when it is needed for support. | Verify audit timeline and attribution. Check that a future PHP rollback can find the prior release and that a guarded undo detects intervening edits. |

Use versioned InnoDB schema migrations and repeatable, restartable import commands. Define key collations, `utf8mb4` text, nullable versus zero and empty values, JSON fields, relationship constraints, and UTC storage with agreed display time. Port SQLite-specific SQL and transaction semantics explicitly, including upserts, identifier allocation, timestamp expressions, lookups, and search. A SQLite dump serves as a source artifact for a conversion, since the database engines accept different SQL dialects.

Rehearse from a consistent backup against a fresh MariaDB database. Record source and destination counts, IDs, differences, and a checksum or equivalent evidence for canonical exports. Import again into an empty rehearsal database and verify the same outcome. Resolve missing fields, duplicates, generated demo data, and orphan references before sign-off. Use synthetic or sanitized fixtures in staging by default. If the owner authorizes particular real records for staging, restrict access and agree how that copy will be removed after testing.

Keep exports, database dumps, and account secrets out of source control. The repository README records a separate exposure in older public commits. Have the repository owner review access and historical cleanup while the deployment uses a reviewed release package. [Repository data and permissions](../README.md#data-and-permissions)

## Execution phases

| Phase | Effort | Implementation and deliverable | Exit condition |
| --- | --- | --- | --- |
| 0. Confirm production constraints and capture the reference | 1–2 days | Confirm hPanel and deployment access, find the selected PHP and MariaDB versions, test staging routing and HTTP methods, check file and database limits, confirm scheduled jobs, and name source data and reviewers. Save read-only live checks, the protected access rules, the existing frontend release, and baseline API fixtures. | A restricted staging subdomain can serve PHP with a separate MariaDB database. The owner approves the inventory source, required surfaces, roles, and launch scope. |
| 1. Build the PHP foundation and rehearse the data conversion | 2–3 days | Create routing, database access, schema migrations, import tooling, configuration, logging, and account bootstrap. Port auth, session, and role checks first. Rehearse the import and compare integrity. | A clean install can be reproduced from a known source. The owner can access the staging CRM. Unauthorized roles and requests are rejected. |
| 2. Deliver the listing workflow and public catalogue | 3–5 days | Port inventory queries and edits, normalization, verification, disclosure checks, versioned publishing, project and featured feeds, and public API reads. Connect the existing interfaces and test cache behaviour. | On staging, an advisor drafts and the owner approves and publishes. The new listing appears, an edited price becomes visible, and a withdrawal clears public results. Failure recovery preserves the previous release. |
| 3. Deliver enquiries, contacts, requirements, and sharing | 3–4 days | Port public intake, idempotency, contacts, lead stages, activities, buyer requirements, matching, and shortlist links. Exercise browser submission and WhatsApp fallback. | A repeated form submission creates one lead. Staff can find and follow up on it, generate a shortlist, and revoke the link. |
| 4. Finish imports, parity, and operations | 3–5 days | Port workbook and WhatsApp intake, finalize permissions and audit, rehearse concurrent requests and failure paths, compare queries and interfaces, implement backup and restore, and run browser and host checks. | The feature acceptance matrix passes, a restore drill succeeds, and deployment and rollback are rehearsed. Any intentional differences have owner sign-off. |
| 5. Reconcile production data, cut over, and hand over | 2–3 days | Run final migration, verify the first release and staff login, switch the public routes, purge affected cache entries, and run production checks. Walk the owner through publishing and lead handling. | A production test listing and enquiry complete the agreed workflow, the owner confirms access, and a rollback-ready copy is retained. |

At the end of phase 2, the owner can try self-service property publishing in staging. The first three phases total an estimated 6–10 engineering days. Use the review to confirm labels and permissions before connecting the remaining CRM features. The final release goes through the full acceptance matrix. The dates and effort depend on access, the agreed data source, and client availability for testing.

## Tests and evidence required before production

| Test area | Cases and evidence |
| --- | --- |
| Contract tests | Run the same synthetic requests against Node and PHP. Compare statuses, response fields and types, sorting and pagination, normalized values, and error messages where the UI uses them. Use the existing `npm test` suite as a reference for writing PHP tests. Document intentional changes to release timing or API semantics. |
| Public site regression | Home, projects, locations, listings, deep links, featured cards, navigation, sitemap and redirects, image loads, keyboard use, and responsive layouts. Include a property opened by a previously shared URL and confirm HTTPS on the canonical domain. |
| Roles and privacy | Anonymous CRM access, expired and revoked sessions, cookie-authenticated writes without valid CSRF, analyst writes, advisor approval through normal or import routes, public/private search separation, and disclosure inside shortlist comments. Verify known legacy raw-file and ZIP URLs return `403` or `404` through the CDN. |
| Data and search | Compare counts and field values using a source with approved, draft, off-market, sold, leased, and withdrawn records. Test short numeric sector queries, partial project names, INR and square-foot ranges, BHK variants, Unicode, filters, featured ordering, and buyer matches. |
| Enquiries and reliability | Test duplicate and concurrent enquiry requests, missing information, retry after an uncertain response, correct property associations, and a server failure that leaves the WhatsApp and phone handoff available. Verify the form acknowledges only a durable save. |
| Publishing and import recovery | Test simultaneous publishes and edits, invalid and oversized imports, a stopped publish before activation, a simulated failure after activation, a bulk-removal override, and rollback. Validate a refresh and a second browser see the current inventory release. |
| Limits and operations | Measure catalogue and CRM request time, publication duration, workbook memory and runtime, and database usage on the actual plan. Set performance expectations from staging results. Rehearse backups and a restore in a separate database. Record how to detect an unhealthy API, failed import, or stale inventory. |

Keep the release reference, checks run, test results, reconciliation totals, and owner approval together. Store outputs containing staff or buyer information in restricted storage. A useful owner acceptance session takes one end-to-end pass through sign-in, draft, approval, publish, public verification, test enquiry, shortlist, and withdrawal.

## Production cutover and rollback

### Before the change window

1. Agree the cutover window and the people authorized to deploy, pause writes, and roll back. Keep the original site serving while staging runs. Inventory web, DNS, and email dependencies and verify access to the production file manager and CDN controls.
2. Save a recoverable copy of the live site, its `.htaccess` rules, the approved SQLite export, and any existing production databases involved. Store backups outside `public_html` and rehearse the restore. Record the live catalogue, route checks, and complete list of approved files to deploy.
3. Pause edits in the migration source for the final export and record the cutoff time. Have the owner confirm any listings changed outside the app and reconcile the differences. Import into production MariaDB and confirm counts, IDs, links, account access, and the first release using restricted checks before enabling public writes.
4. Prepare the PHP release and previous static release as separately recoverable packages. Review `.htaccess` precedence, targeted rewrites, public file allowlists, and ownership. Check that an application rollback can read the production schema or use the static fallback safely. A switch within the existing Premium website should use the existing production domain and certificate. Check the verified hosting setup for any necessary DNS or mail change.

### At cutover

1. Deploy the PHP release and static assets using the rehearsed file switch. Retain the access rules blocking legacy private files. Enable the application only once the expected database schema and first inventory release are present.
2. Clear relevant Hostinger and CDN entries and verify HTTPS, the home page, catalogue, saved listing URLs, feeds, CRM login route, public health endpoint, and anonymous dashboard denial. Verify the legacy JSON files and ZIP remain denied. Update [the deployed verification script](../scripts/verify_deployed.js) alongside the PHP port so its checks match the new release contract.
3. Sign in with the staff accounts under test. Carry out the approved production smoke test with an owner-approved listing and an identified test enquiry. Confirm listing visibility, price and status updates, a successful enquiry with exactly one CRM record, and shortlist expiry or revocation. Withdraw or mark test records according to the owner’s agreed handling.
4. Record the deployed revision and active inventory release ID. Check error logs and CDN results after switching. Complete the owner walkthrough and record acceptance before closing the migration.

### Rollback choices

| Symptom | Response |
| --- | --- |
| Incorrect public inventory or stale featured cards | Pause publication, switch back to the last verified safe release, revalidate inventory across the CDN, and review the changed listings. Recheck current withdrawal and privacy restrictions before restoring older data. |
| Public disclosure or unauthorized staff access | Restrict the affected routes immediately, revoke relevant sessions or share tokens, restore a safe public release, and preserve incident evidence privately. Verify the CDN no longer serves the affected content before public access resumes. |
| PHP routes fail or legitimate enquiries cannot be saved | Restore the previous compatible application, or serve the retained static catalogue with phone and WhatsApp contact while repairing PHP. Keep the MariaDB records and export post-cutover writes for reconciliation before any database restore. Confirm the actual live contact workflow after rollback. |
| Database migration or corruption | Pause writes, preserve the current database and any accepted new data, restore a verified backup into a separate database, reconcile lost or overlapping activity, then switch once integrity and user workflows pass. |

The deployment operator owns the technical switch and reversal. The account owner confirms which listings and enquiries must be carried forward. Set a time budget for the cutover rehearsal and record the measured restore time and potential data loss window before agreeing recovery targets.

## Client handover and ongoing ownership

- **Account owner.** Confirm the initial staff roster and permissions, choose who can approve public changes, and sign off on the starting inventory. Practice publishing, checking the public result, withdrawing a listing, and revoking a shortlist.
- **Advisory staff.** Practice saving a draft, running a spreadsheet preview, recording a call or viewing, and following up on a website enquiry. Give them the production login URL and a short workflow showing where public and private fields are entered.
- **Hosting owner and developer.** Document how to provision or deactivate accounts, deploy an update, check logs, renew any credentials, validate a backup, and recover the last safe release. Verify the real scope and retention of Hostinger backups and keep an access-controlled copy that can be restored independently. Use Hostinger scheduled jobs for application tasks that need them, after verifying the account’s command and time settings. [Hostinger cron jobs](https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/)
- **First week.** Review the first real publish and enquiry with the client. Check error rates, database and disk use, cache freshness, and backup completion. Confirm the escalation contact for a failed enquiry or a listing that needs immediate removal.

## Decisions needed to start

| Decision | Who confirms | Why it matters |
| --- | --- | --- |
| Keep Premium and commission the PHP rebuild | Account owner | Confirms the hosting constraint and approves the port as implementation work. |
| Authoritative inventory and approved private records | Account owner and inventory operator | Determines the source export, which historical data may move, and how counts and visibility will be reconciled. |
| Staging and deployment access | Account owner and developer | Enables the restricted subdomain, database, PHP configuration checks, file deployment, and CDN verification. |
| Staff roles and rules for taking a property offline | Account owner | Determines the transition permissions and the quick removal workflow used at acceptance. |
| Production pages, active shortlist links, and cutover window | Account owner and developer | Sets which links and features require continuity and when to reconcile final writes. |

Start with phase 0. The first checkpoint is a protected staging site on Premium that can run PHP and access MariaDB, plus agreement on which inventory and staff records will go live. This validates the hosting path before the full backend port begins.
