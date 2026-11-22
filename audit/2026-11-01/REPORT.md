# Current project assessment — 1 November 2026

Reviewed commit: `81d5e0f`. Assessment of the local repository; production deployment was not verified.

## Overall judgment

AUM Estates has a functioning static property catalogue and a substantial local CRM implementation. It has progressed well beyond the backend roadmap and the October 29 audit. The architectural direction—private SQLite master, separate public projection, static catalogue—is sensible for this business and inventory size.

The integrated system is **not ready for unrestricted production use**. Important defects remain in client shortlist disclosure, account defaults, authorization, featured-property identity, and recovery. The website and CRM also lack a demonstrated deployment arrangement that makes the public inquiry API available on the website's origin.

The next milestone should be operational correctness and a verified deployment, before adding further visual directions or CRM features.

## What exists and works

| Component | Current state |
| --- | --- |
| Public website | Buildless HTML/CSS/JS catalogue, search, filters, property dossiers, featured cards, projects, contact and WhatsApp handoff. |
| Architectural grid | Separate interactive study; shares the current public inventory. |
| Brand study v16 | Search, property views, comparison/saved state, enquiry review, five identity directions; now reads public inventory and can call the local API. Its README still describes the earlier six-record prototype. |
| CRM | Node HTTP server, SQLite schema, sessions, contacts, leads, requirements, matching, WhatsApp parsing, CSV import, approval, audit logs and shareable shortlists. |
| Data isolation | Separate private table and public/private FTS indexes; ordinary public property responses use a whitelist and privacy validation. |
| Publishing | Compiles approved, available properties; generates projects and featured feeds; synchronizes frontend inventory copies; records release hashes. |
| Packaging | Produces a static Hostinger bundle and checks text artifacts for private metadata; rejects symlinks outside the source tree. |

The private/public search separation, rejection of common privacy leaks, authenticated CRM endpoints, basic CSRF checks, unit normalization and lead idempotency have meaningful coverage. A freshly seeded in-memory database contains 347 public properties, one off-market property and one pending intake record. The standard bootstrap also inserts sample CRM records.

## Verification performed

- `npm test`: **12/12 passed** on Node `v26.5.0`.
- `npm run verify`: **45/45 passed**. These are local checks, not production certification.
- `npm run package` equivalent: **passed in an isolated temporary copy**, compiling from a newly seeded database and scanning 266 bundled files. Relative symlinks were preserved when copying the project.
- Existing October 29 reproduction script: none of its 23 old defect predicates reported reproduction. This is evidence of substantial repair, but not 23 independently proven fixes: its file-write failure injection no longer targets the temporary-file implementation, and its packaging fixture rewrites relative symlinks during copying, causing rejection before the intended canary checks.
- Additional in-memory HTTP probes confirmed draft disclosure, missing approval-role enforcement and a CSRF exemption defect.
- Additional temporary-file probes confirmed partial multi-file publication and rollback divergence from SQLite.
- Browser review of the production-style homepage, a dossier and v16, including a 390px mobile viewport. No external inquiry or WhatsApp message was submitted.
- All five checked `public_inventory.js` copies currently have identical SHA-256 prefixes: `205723788e33`.
- Live website requests failed in the available web tool; the shell request could not resolve the domain. This does **not** establish that the website is down. Live headers, legacy-file cleanup, deployment state and API reachability remain unverified.

Application code, actual inventory and the existing database were not changed. Assessment files are the only repository additions.

## Findings, in repair order

### 1. High — client shortlists bypass privacy validation and draft approval

The normal public catalogue validates projected records. The shortlist endpoint instead copies allowed columns directly from every selected property, regardless of its publication state, and returns advisor commentary without privacy scanning.

**Confirmed:** an authenticated test analyst created a draft with a synthetic private phone in `public_description`, added it to a shortlist, and retrieved that phone from the unauthenticated token URL. All three requests succeeded. No actual private record was published in this assessment.

Allowlisting column names is insufficient when draft/off-market public-text columns have not passed approval. An off-market property can legitimately be shared with a selected client, but its client-facing fields still require validation. Draft/pending records should require a deliberate sharing approval, and commentary must use the same disclosure rules.

Source: [server.js:598](/Users/udaymukhija/Aum_estates/backend/server.js:598), [server.js:1407](/Users/udaymukhija/Aum_estates/backend/server.js:1407), [server.js:365](/Users/udaymukhija/Aum_estates/backend/server.js:365).

### 2. High before network exposure — administrative credentials ship in source and the login page

Configuration falls back to a fixed administrator password. The publicly served CRM login HTML prepopulates that same password. A fresh installation without environment overrides therefore exposes the credentials needed to enter its private CRM. Loopback binding by default reduces exposure today; it does not make these defaults suitable for deployment.

Require an explicit setup secret, remove the password from HTML, and fail startup when production credentials are missing. Define account creation, password rotation and session revocation procedures. The session cookie also lacks `Secure`; configure that appropriately for the intended HTTPS deployment.

Source: [config.js:113](/Users/udaymukhija/Aum_estates/backend/config.js:113), [index.html:23](/Users/udaymukhija/Aum_estates/backend/crm-ui/index.html:23), [seed.js:159](/Users/udaymukhija/Aum_estates/backend/db/seed.js:159), [auth.js:89](/Users/udaymukhija/Aum_estates/backend/auth.js:89).

### 3. High — authentication does not enforce approval authority; CSRF has an inconsistent exemption

Roles exist in the schema and session, but protected routes perform no role checks. **Confirmed:** an `analyst` session successfully called a property's approval endpoint. Generic property creation/update can also request `approved_public`. There is no enforced principal-only publication boundary.

Separately, authentication prefers a valid cookie, while CSRF verification exempts any request containing `x-aum-session`. **Confirmed:** a valid session cookie plus an invalid session header created a contact without a CSRF token. This is a server-side CSRF enforcement defect; the probe does not establish a cross-origin browser exploit, because custom headers normally require CORS preflight.

Define who can approve, publish, import and read private records. Base CSRF exemptions on the credential actually authenticated, rather than header presence.

Source: [server.js:856](/Users/udaymukhija/Aum_estates/backend/server.js:856), [server.js:949](/Users/udaymukhija/Aum_estates/backend/server.js:949), [server.js:999](/Users/udaymukhija/Aum_estates/backend/server.js:999), [auth.js:54](/Users/udaymukhija/Aum_estates/backend/auth.js:54), [auth.js:100](/Users/udaymukhija/Aum_estates/backend/auth.js:100).

### 4. High business impact — featured cards can identify the wrong property

The seed attaches independently maintained card overrides to inventory IDs. It repairs four previously missing references, but does not validate that every existing reference describes the same property.

Two concrete conflicts remain:

| Featured presentation | Underlying record |
| --- | --- |
| DLF The Arbour · Sector 63 | `AUM-WEB-000142`: Privana South Tower A Unit 1 |
| Paras Quartier · Gwal Pahari | `AUM-WEB-000095`: Ridgewood Estate rental option 2 |

The first card visibly combines the Arbour name/features with a ₹25 lakh premium from Privana South. Its dossier opens as Privana South. A valid foreign key prevents a missing page; it does not establish correct property identity. Featured overrides also supply older asking prices when the master record says Price on Request.

Reconcile all 16 featured records against the real mandate, then derive identity, transaction type and financial terms from the master. Treat title/imagery overrides as reviewed presentation data with consistency checks.

Source: [seed.js:485](/Users/udaymukhija/Aum_estates/backend/db/seed.js:485), [publisher.js:124](/Users/udaymukhija/Aum_estates/backend/domain/publisher.js:124), [approved_properties.js](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/data/approved_properties.js).

### 5. High operational impact — release consistency and rollback are incomplete

The publisher atomically replaces individual files, then repeats the operation across feeds and frontend copies. The complete release is not atomic.

**Confirmed fault injection:** failing promotion of the main inventory JavaScript left JSON at ₹6.75 Cr and JavaScript at the previous ₹5.50 Cr for the same synthetic price update. The failed publication did not restore the already-promoted JSON. There is also no writer lock covering all tools.

**Confirmed rollback divergence:** in a temporary full project, CLI price update → rollback restored the old public feed, but the next SQLite build republished the undone price. `cmdRollback()` restores JSON backups without restoring the master database. Database synchronization failures in CLI mutations are warnings after public files have already changed.

The release directory stores hashes/manifests, not complete recoverable feed snapshots despite the publisher's comment. Packaging deletes and rebuilds `dist_hostinger` in place rather than promoting a validated staging directory. No off-machine database restore drill is demonstrated.

Make SQLite authoritative for every mutation and rollback, serialize writers, keep recoverable source/release versions, and promote complete validated releases with a recovery strategy for partial failure.

Source: [publisher.js:15](/Users/udaymukhija/Aum_estates/backend/domain/publisher.js:15), [publisher.js:185](/Users/udaymukhija/Aum_estates/backend/domain/publisher.js:185), [manage_inventory.js:240](/Users/udaymukhija/Aum_estates/scripts/manage_inventory.js:240), [manage_inventory.js:443](/Users/udaymukhija/Aum_estates/scripts/manage_inventory.js:443), [package_release.js:45](/Users/udaymukhija/Aum_estates/scripts/package_release.js:45).

### 6. High integration gap — static hosting does not provide the lead API

Catalogue, detail, contact and v16 now call `/api/public/inquiries`. The local Node server implements that endpoint. The Hostinger package contains static frontend assets, with no Node service, PHP equivalent or reverse-proxy configuration for `/api`.

Consequently, uploading this bundle alone does not establish CRM lead capture. An API might be configured outside this repository, but that was not verified. Several production-style hooks ignore network errors and do not check HTTP success. Frontends do not consistently submit idempotency keys, despite backend support. WhatsApp handoff remains useful, but it is not proof of a recorded lead.

Choose and document the actual service host, HTTPS/proxy routing, process supervision, database persistence/backups and failure behavior. Verify one real browser enquiry through to the private CRM after deployment. Do not display a recorded-lead claim without a durable acknowledgement.

Source: [contact/index.html:364](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/contact/index.html:364), [app.js:731](/Users/udaymukhija/Aum_estates/AUM_Estates_Brand_Study_v16_Local/dist/app.js:731), [server.js:663](/Users/udaymukhija/Aum_estates/backend/server.js:663), [package_release.js:50](/Users/udaymukhija/Aum_estates/scripts/package_release.js:50).

### 7. Medium — the production-style layout overflows mobile screens

At a 390px viewport, the homepage document measured **564px wide**. The advisory button and navigation extend past the right edge, with visible horizontal scrolling. Overflow was also visible at the browser's default desktop width. v16 fit the mobile viewport in the sampled view and offers a clearer search-first hierarchy.

The oxblood site has a distinct identity, but dense navigation, large promotional sections and competing CTAs make it harder to scan. V16 is the stronger usability foundation in my judgment, though it remains a study with brand controls and incomplete production validation. Select a primary frontend deliberately, then complete responsive, keyboard and search-to-enquiry acceptance checks on that surface.

The homepage's unconditional “100% verified titles” and dossier “verified listing” labels should be reconciled with stored verification state and the actual evidence supporting each mandate. The site also says twenty-two years despite a 2002 founding date and 2026 copyright. This review does not independently validate business or regulatory claims.

### 8. Medium — documentation and readiness checks overstate assurance

The operating manual says seven tests; the current suite has twelve. The backend specification still describes implemented CRM capabilities as future work. The v16 README says six sample records and no API/CRM; its implementation now consumes the full public feed and submits inquiries.

The verifier labels the system production ready after local source checks. Its main.js syntax assertion is literally `true`, and header checks inspect `.htaccess` text rather than deployed responses. Passing the existing tests did not prevent the shortlist disclosure, role defect, wrong-property mappings or recovery failures above. Packaging does not run `npm test`.

Add a root README with the supported Node runtime, authoritative source of truth, frontend/deployment map, safe startup and bootstrap configuration. Separate smoke checks from security and deployed acceptance checks. Convert the confirmed failures into focused regression coverage when fixing them. Add migration/versioning procedures before evolving a real populated database; startup currently executes a `CREATE TABLE IF NOT EXISTS` schema, not a versioned migration sequence.

Source: [verify_site.js:128](/Users/udaymukhija/Aum_estates/scripts/verify_site.js:128), [verify_site.js:252](/Users/udaymukhija/Aum_estates/scripts/verify_site.js:252), [OPERATING_MANUAL.md](/Users/udaymukhija/Aum_estates/OPERATING_MANUAL.md), [README.md](/Users/udaymukhija/Aum_estates/AUM_Estates_Brand_Study_v16_Local/README.md).

## Additional data and maintenance considerations

- The standard database bootstrap inserts fictional/sample owner, broker, lead and off-market records. Move these into explicit demo/test fixtures before using the CRM as the firm's operational record.
- Private seed JSON and metadata are tracked in Git, although the SQLite database and release directory are ignored. Review repository access and history handling if those files contain confidential source material; this assessment did not establish a public repository exposure.
- Several overlapping implementations maintain privacy rules: backend gate, standalone compiler, CLI and packager. Consolidation would reduce inconsistent treatment of types, currencies, approval and free text.
- No application dependency packages are required, which simplifies operation. The tradeoff is maintaining HTTP routing, sessions, validation, imports and rate limiting in-house. The 1,590-line server and broad integration test should be split around stable domain boundaries as fixes are made, rather than rewritten wholesale.
- Catalogue correctness needs a human reconciliation pass: exact unit identifiers remain in some public titles, representative imagery requires honest labeling, and project/price/verification metadata should not be inferred from attractive featured copy.

## Suggested completion sequence

1. Fix shortlist validation and sharing approval; remove default credentials; enforce roles and correct CSRF authentication handling.
2. Reconcile featured property identity and price provenance; separate demo records from real CRM bootstrap.
3. Make mutations and rollback operate on SQLite; implement recoverable release promotion and verify a restore.
4. Choose the customer frontend and fix mobile overflow; align claims with per-record verification.
5. Deploy the API and static site as one documented system; prove enquiry persistence, publication, legacy-file removal and effective HTTPS/cache headers on the actual host.
6. Update the runbook and replace unsupported production-ready assertions with behavioral and deployed checks.

The existing work is worth keeping. Its main need is closing the gaps between a working local demonstration and a trustworthy day-to-day business system.
