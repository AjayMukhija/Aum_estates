**AUM ESTATES backend readiness and security audit — 29 October 2026**

**Verdict: I cannot sign off this system as a fully functioning, fully connected, safe and secure backend.** The public catalogue works, and the local scripts provide a useful beginning for inventory operations. The intended private inventory → approval → publication → CRM workflow is not implemented end to end. There are confirmed production information leaks and reproducible defects in the local privacy, publishing, packaging, and preview-server controls.

This is an assessment of the code and deployment available on the audit date. It does not assert that the site has been compromised. It identifies what is working, what is missing, and what can fail under demonstrated inputs.

**Scope and method**

- Audited the current `redesign-clean` checkout at `1135c35`, the static source, generated `dist_hostinger` bundle, scripts, inventory variants, documentation, tests, cached branch references, and the other registered AUM worktree. The user confirmed that backend work is in this repository and local checkout.
- Inspected production through read-only requests to `aumestates.com` and a real browser. Production HTTP observations began at approximately 15:56 IST and continued through approximately 16:04 IST on 29 October 2026; exact UTC response timestamps are in `evidence.json`.
- Ran the existing seven tests, 45 verification checks, JavaScript syntax checks, focused credential-pattern searches, data comparisons, and three positive controls. Added an audit reproduction script that exercised 23 adverse observations in temporary directories or an isolated JavaScript VM.
- Did not change application code, inventory, production, hosting settings, or the existing preview process. No enquiry was sent to WhatsApp or any CRM. The only repository additions are this audit folder.
- Did not have Hostinger account/admin access, origin filesystem access, access logs, backup-console access, firewall settings, or independent proof of account MFA. Those controls remain unverified. The hosting platform could provide controls outside the repository; absence of configuration here is not proof of their absence everywhere.

**Readiness by capability**

| Capability | Assessment | Evidence |
| --- | --- | --- |
| Public listing catalogue | Functioning for the paths exercised | Live browser rendered 347 listings, opened a populated dossier, and returned 71 DLF results. Local catalogue also returned 71 DLF results. |
| Call and WhatsApp routing | Link construction works | Observed the business phone link and a prefilled WhatsApp link. Delivery and staff response were not tested. |
| Local inventory CLI | Implemented, with significant correctness gaps | Add/update/backup/rollback paths exist; adverse probes demonstrated invalid writes, stale copies, and inconsistent rollback behavior. |
| Privacy and publication controls | Insufficient | Current and live payment notes, live brokerage notes, scanner bypasses, and private/draft import acceptance. |
| Private master business database | Not implemented in the checked system | `private_master_store` is a tracked JSON staging export, not the specified database containing owner/source metadata and an audit trail. |
| Persistent lead capture / CRM / bot | Not connected end to end | Browser events and WhatsApp links exist; no receiver, durable lead store, delivery acknowledgement, retry queue, or bot approval service was found. |
| Production security configuration | Partially effective | HTTPS redirect and some file restrictions work; promised headers and raw-data restrictions are not effective on observed live responses. |
| Release, recovery, monitoring | Manual and insufficiently proven | Local packaging exists; no deployment automation, release manifest, live parity gate, or verified production restoration procedure was found. |

**1. High priority — internal commercial notes remain publicly accessible in production**

The production JavaScript feed contains brokerage/commission text on **four records**: `AUM-WEB-000211`, `AUM-WEB-000246`, `AUM-WEB-000247`, and `AUM-WEB-000249`. Both `key_features` and `public_features` carry these notes, for eight affected fields. These are the same records the specification claims were cleaned. The local main feed has removed these brokerage strings, but the deployed feed still contains them.

Additionally, a broader payment-term review found **21 listings** containing cheque/payment text in both the local and live datasets: 24 fields locally and 34 live. Examples of the kinds of text present include cheque amounts, percentages, and payment preferences. Some matches may be legitimate public marketing information, but these require explicit review against the repository's policy to keep cheque/cash arrangements private. The current scanner does not enforce that policy. Hiding a string in a frontend formatter does not remove it from the public download.

The old raw endpoint [data/aum_inventory_local.json](https://aumestates.com/data/aum_inventory_local.json) also returns HTTP 200 and contains the same 347 records as the live JavaScript feed, including its additional fields and notes. The metadata [data/README.txt](https://aumestates.com/data/README.txt) returns 200. This contradicts the stated production quarantine rules.

No unexpected contiguous or normalized Indian phone-number candidates, PAN-pattern matches, or email-pattern matches were found in the scanned live listing strings. That limited negative result does not negate the confirmed commercial-note exposure or prove that every possible identifier format is absent. The accessible raw listing file is a website export; this audit did not establish that it contains owner identities or the complete private brokerage database.

**Repair:** review and remove confidential notes from every public feed and related static copy, remove or block obsolete raw/metadata endpoints, deploy the corrected release, purge relevant CDN caches, and verify the actual public responses. Deploying local files alone is not evidence that old remote files were deleted.

**2. High priority — the running preview server exposes the workspace and permits traversal**

At audit time the Node process listened on **all interfaces** on ports 8000 and 8080. Read-only requests confirmed:

| Request | Result |
| --- | --- |
| `http://127.0.0.1:8000/package.json` | 200 |
| `http://127.0.0.1:8000/private_master_store/aum_inventory_local.json` | 200 |
| `http://127.0.0.1:8000/.git/config` | 200 |
| `http://127.0.0.1:8080/../package.json` using an unnormalized request path | 200 |

The handler falls back to the workspace root, joins request paths without checking that the result remains inside the intended public directory, and sends `Access-Control-Allow-Origin: *`. The Node server does not process Apache `.htaccess` rules. This establishes an HTTP disclosure surface wherever these ports are reachable. Reachability from another computer, firewall policy, public-internet exposure, and access history were not tested. No Git credential or unrelated machine file was requested or disclosed in audit output.

Source: [serve.js:76](/Users/udaymukhija/Aum_estates/scripts/serve.js:76), [serve.js:99](/Users/udaymukhija/Aum_estates/scripts/serve.js:99), and listeners at lines 86 and 105.

**Repair:** bind explicitly to loopback, serve only approved public roots, canonicalize and contain resolved paths, reject dotfiles/private paths and out-of-root symlinks, and remove unnecessary permissive CORS. Treat these ports as unsuitable for sharing or exposing until repaired.

**3. High priority — the privacy gate can be bypassed and does not enforce the documented schema**

The sanitizer correctly removes unknown top-level keys and flags a straightforward contiguous private phone or explicit brokerage keyword. Those positive controls passed. However, the isolated probes also demonstrated:

- A field containing an official phone plus another phone is exempted wholesale.
- A spaced phone such as a synthetic `91234 56789` is accepted.
- A numeric phone or an object containing private fields can be supplied under an allowed field and is emitted unchanged: only strings are scanned, and allowed field types are not enforced.
- Global regular expressions reuse `lastIndex`. A match on an official phone in one field can cause the next field's private phone to be missed. The defect was reproduced with zero warnings.
- Cheque/payment preferences bypass the narrow financial regex.
- `FORCE_BUILD=0` still bypasses the privacy failure because any nonempty environment-variable value is treated as an override.
- A record following the specification's nested `public_listing_data` shape is accepted but loses its public title/details; there is no implemented transformation for that advertised master schema.

Source: [sanitize_and_build.js:90](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:90), [sanitize_and_build.js:156](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:156), and the duplicated scanner in [manage_inventory.js:94](/Users/udaymukhija/Aum_estates/scripts/manage_inventory.js:94).

**Repair:** use a shared, strict schema with explicit primitive types, allowed enums and lengths; reject nested/nonconforming values; normalize identifiers; evaluate every phone match independently; remove stateful regex misuse; and make privacy failures fail closed in the release path. Regex matching alone cannot reliably classify all confidential free text, so retain an explicit review/approval stage.

**4. High priority — private, draft, and unavailable records do not have a dependable publication boundary**

The sanitizer does not check publication approval or visibility. A synthetic input with `visibility: Private` and `publication_approved: false` is emitted after those fields are discarded, with status defaulted to `Available`. A `Draft` record is also emitted into the downloadable public feed.

The standard catalogue filters availability, but the grid's `currentFiltered()` does not filter status; a VM probe returned both Sold and Draft fixtures. The detail page resolves records by ID without checking publication/status. Client filtering cannot make an already-downloaded draft private.

There are also real metadata conflicts to resolve: all 144 project records are included in the bundled and live project feed, including 34 marked `Private`, `No`, or `NO`; all 14 names in the current curated projects page have `NO` metadata. The old listing export has contact/WhatsApp/call flags set to `NO` on 301 records, while CTAs are generated without honoring those flags and the new sanitizer drops them. Manual curation might supersede some historical flags, but that approval is not represented in a consistent enforced contract. These facts do not by themselves establish that every such record is unauthorized; they establish that metadata cannot currently be trusted to control publication.

Source: [sanitize_and_build.js:83](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:83), [main.js:458](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/main.js:458), [detail.js:27](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/properties/detail.js:27), and [projects-page.js:119](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/data/projects-page.js:119).

**Repair:** define one authoritative publication state, migrate/reconcile legacy flags, require affirmative approval before export, and omit all private/draft records from every public artifact. Test status changes across catalogue, dossiers, featured listings, and projects.

**5. High priority — imports can destroy or corrupt inventory before verification**

The sanitizer successfully overwrote a nonempty fixture with an empty array. Duplicate IDs produced warnings but still wrote both records. Missing ID/title fields were accepted; the locally computed fallback ID is not actually assigned to the output. The CLI also accepted a new record without a title and a negative price. `update-price` accepts an unrestricted unit string without the sanitizer; a synthetic phone in the unit was written into public data.

The standalone verifier's minimum-count check runs only when separately invoked or during packaging, **after the sanitizer has already overwritten the source**. It cannot protect the old source from truncation. The sanitizer has no automatic backup.

Source: [sanitize_and_build.js:75](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:75), [sanitize_and_build.js:167](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:167), and [manage_inventory.js:235](/Users/udaymukhija/Aum_estates/scripts/manage_inventory.js:235).

**Repair:** validate the complete candidate dataset before any write; reject duplicates/missing required fields/invalid prices; enforce a sensible import-change threshold with explicit review for legitimate bulk removals; apply the same validation to every CLI mutation; and keep the previous accepted source intact on failure.

**6. High priority — inventory writes are not atomic and have no concurrency protection**

Despite the comments, the scripts write JSON and JavaScript directly and sequentially with `writeFileSync`; there is no temporary-file swap, versioned snapshot transaction, or writer lock. An injected failure on the JavaScript write left JSON at price 2 while JavaScript remained at price 1. The synthetic fault injection occurred only in a temporary fixture. Concurrent writers can also operate on stale snapshots; that race is an inspection finding, not a separately reproduced production event.

Source: [manage_inventory.js:69](/Users/udaymukhija/Aum_estates/scripts/manage_inventory.js:69) and [sanitize_and_build.js:167](/Users/udaymukhija/Aum_estates/scripts/sanitize_and_build.js:167).

**Repair:** validate into a versioned release directory, publish a complete consistent version atomically where the deployment platform supports it, serialize writers, and recover cleanly from failure at every stage. Atomic replacement of one file alone does not make a multi-file release atomic.

**7. High priority — packaging does not provide its claimed privacy guarantee**

In a temporary copy of the actual source, the full packager passed all 45 preflight checks and completed successfully while including:

- A synthetic private JSON file under `assets/`, containing a phone, email, and internal-note keys.
- A symlink under `assets/` pointing to another synthetic private file outside the source tree.

The post-package scanner only applies its commission regex to filenames containing `inventory`; its declared phone regex is never used. It does not broadly enforce content schemas or scan all copied JSON/HTML/JS for identifiers. The directory allowlist still recursively admits arbitrary files inside allowed directories. Symlinks are deliberately followed without a containment check.

The current bundle has 266 files and its included files match the source. No existing symlink was found in the inspected bundle. These probes establish a defective guardrail, not that the synthetic canaries or an actual external private file were present in the real release.

Source: [package_release.js:87](/Users/udaymukhija/Aum_estates/scripts/package_release.js:87) and [package_release.js:129](/Users/udaymukhija/Aum_estates/scripts/package_release.js:129).

**Repair:** build into a staging directory from a precise artifact manifest, reject out-of-root symlinks, validate all structured public datasets, scan every relevant text artifact, and promote the bundle only after final checks. Quarantine failed staging output rather than presenting it as a usable release.

**8. High priority before exposing the grid — unescaped property IDs can become stored HTML/script content**

The grid inserts `property_id` directly into the property-number paragraph, even though other uses are escaped. The sanitizer does not validate ID format. A synthetic ID containing an image tag and event-handler attribute passed into `propertyCard()` appeared as raw markup in the returned HTML. The grid subsequently renders those strings with `innerHTML`.

This is a stored-injection path through imported inventory. The probe checked generated markup and did not execute a payload in a browser. No public unauthenticated write endpoint was found, and no attack was attempted on production. The grid concept itself was 404 in production during this audit.

Source: [main.js:440](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/main.js:440).

**Repair:** validate IDs against the intended format and escape the ID at every HTML interpolation. Apply and verify a suitable Content Security Policy as defense in depth after accounting for existing inline code; it does not replace escaping.

**9. Material completeness gap — the CRM/backend is a stub, not a working integration**

The contact form constructs a WhatsApp URL and opens it. Its hook dispatches an in-page event and optionally invokes `_AUM_CRM_LISTENER`. No installed listener implementation, real lead POST endpoint, database write, delivery acknowledgement, or retry mechanism was found. The only webhook example in the operating manual is a placeholder.

The grid defines a different hook contract: `(action, payload)` and event `aum:lead_inquiry`; the catalogue/contact/detail version accepts one object and emits `aum:lead`. The grid hook does not call the documented listener, and no grid call sites invoke that hook. The isolated listener probe observed zero calls. Featured listings/projects are additional CTA surfaces without demonstrated persistent capture.

The intended intake parser, private source store, authenticated operator API, human approval loop, change audit log, deployment trigger, and bot notifications are roadmap items. There is no server-side API implementation or database schema/migration set for them in the checked system. `inventory-api.js` in older branch references is a static URL configuration object, not an API server.

Source: [contact/index.html:364](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/contact/index.html:364), [main.js:27](/Users/udaymukhija/Aum_estates/AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/main.js:27), and `BACKEND_SYSTEM_SPECIFICATION.md` phases 2–3.

**Repair:** decide whether the supported product is a manually operated static catalogue with WhatsApp handoff or a persistent CRM workflow. For the latter, implement and test an authenticated private service and one versioned event contract, durable writes, acknowledgements, idempotency/retries, operator approval, and delivery monitoring. Do not place service credentials or privileged webhook secrets in browser JavaScript. Lack of authentication/rate limiting on a nonexistent API is a missing future capability, not evidence of an exposed writable API today.

**10. Production hardening and cache behavior differ from the local claims**

Observed production behavior:

| Check | Result |
| --- | --- |
| HTTPS homepage | 200, certificate verification succeeded through curl |
| HTTP homepage | 301 to HTTPS |
| HSTS | Absent on observed HTTPS responses |
| X-Frame-Options | Absent |
| X-Content-Type-Options | Absent |
| Referrer-Policy / Permissions-Policy | Absent |
| Content-Security-Policy | Only `upgrade-insecure-requests`; no script-source or frame-ancestor restrictions in the observed header |
| `.git/config` and `.env` | 403 |
| `/data/` directory | 403 |
| Old raw inventory and data README | 200 |
| Live inventory JavaScript caching | `public, max-age=604800` — seven days |
| New `/data/public_inventory.json` and grid concept | 404 |

The local `.htaccess` contains several useful directives, but reading it does not establish deployment or enforcement. Responses indicate the claimed policy is not effective at the observed CDN edge. The JavaScript MIME type was `application/x-javascript`, while the local ten-minute expiry rule targets `application/javascript`; that potential mismatch also needs a live deployment test. Setting an HSTS header with the word `preload` would not by itself prove enrollment in a browser preload list.

**Repair:** deploy/enforce the intended headers at the origin and CDN, confirm them on successful and error responses, apply explicit inventory cache rules matching the served MIME types, and use release versioning/cache invalidation for inventory changes. Verify legacy-file cleanup and redirects after deployment.

**11. Multiple data copies are not synchronized by the supported update path**

The CLI and sanitizer update the main source feed and standalone baseline, but not the embedded `concepts/aum-grid-study/data/` feed. A synthetic price update left the embedded concept at its old price. The packager copies that embedded feed as-is. Existing data copies currently differ on all 347 URL values; those URL differences can be intentional for different navigation contexts, so they are not themselves 347 pricing defects. The reproduction establishes that future real price/status changes will also diverge.

`approved_properties.js` is a separately maintained set of 16 cards. Four referenced IDs are absent from the current primary inventory (`AUM-WEB-000078`, `AUM-WEB-DLF-GROVE`, `AUM-WEB-000054`, `AUM-APP-0001`), while homepage cards generate dossier links from those IDs. These links can reach a “Property Not Found” state. Featured prices/status also do not automatically change when the primary feed changes. Project/listing relationships are weakened by dropping fields such as `project_id` from the new public schema even though consuming code expects them.

**Repair:** derive all public views and curated references from one approved source and validate referential integrity. Generate copies deliberately with only documented path-specific transformations. Test a price/status change across every exported view.

**12. Tests pass, but their “production ready” conclusion is not supported**

Observed baseline: **7/7 tests pass, 45/45 verifier checks pass, 18/18 external JavaScript files pass syntax checks**, and three positive sanitizer controls pass. These are useful smoke checks.

However, some verifier assertions are hardcoded true, including the advertised main.js syntax check and WhatsApp-format check. Many security/integration checks search for strings in local source rather than exercise the behavior or request production. The full package can pass while leaking the synthetic canaries described above. The existing tests also hardcode exactly 347 records and all statuses Available, which will fail legitimate inventory evolution rather than provide a general lifecycle safety test. Packaging invokes the sanitizer and verifier but not `npm test`.

Source: [verify_site.js:124](/Users/udaymukhija/Aum_estates/scripts/verify_site.js:124), [verify_site.js:199](/Users/udaymukhija/Aum_estates/scripts/verify_site.js:199), and [production-verification.test.cjs](/Users/udaymukhija/Aum_estates/aum-grid-local-baseline-2026-10-27/production-verification.test.cjs).

**Repair:** replace unconditional/string-only assurance checks with behavior and rejection tests, test the exact generated release, exercise lifecycle and write-failure cases, and gate deployment on production response checks. Passing the current suite should be reported as smoke-test success, not security certification.

**13. Recovery, accountability, and operational visibility remain limited**

CLI backups are local JSON files under the website source `data/backups/`, with only the latest ten retained. The packager excludes the directory, which is useful, but there is no demonstrated off-machine backup/restore or complete deployed-release recovery. The sanitizer does not use these backups. Repeated rollback probes restored price 1 and then re-applied the undone price 2 because a rollback itself creates the newest backup. That is an undo-toggle limitation rather than reliable traversal through a known version history.

No durable “who approved/changed/published what” log, deployed-version record, monitored lead-delivery failure path, or uptime/deployment alert configuration was found. Hostinger might supply some monitoring outside this repository; it was not independently verified. A focused working-tree text search found no matches for common private-key, AWS access-key, GitHub-token, OpenAI-style-key, or Supabase-secret patterns. This was not a complete Git-history secret audit or a hosting-account access review.

**Repair:** retain versioned source and complete release snapshots, keep recoverable backups outside the public tree and machine, verify restoration, record operator approvals and release hashes, and monitor actual customer paths and failures.

**Repair order and sign-off conditions**

1. Contain the local preview disclosure; clean and remove the confirmed public commercial notes and obsolete endpoints; apply the effective production headers and cache policy. Re-fetch production to prove the changes took effect.
2. Implement a single schema/publication/privacy gate for every import and update. Preserve the previous source on rejection, fix the grid injection path, and reject the scanner bypass fixtures.
3. Make writes/releases consistent and recoverable; harden packaging and synchronize all feeds/featured references. Demonstrate failure recovery, unavailable/draft exclusion, and correct changes across every public view.
4. State the actual product contract. If CRM is part of the required backend, implement the missing private service, operator permissions, approval workflow, durable lead capture, and reliable event delivery before claiming full wiring.
5. Replace misleading readiness assertions with behavioral checks, verify the exact deployed version, perform a production restore drill, and verify hosting-account MFA/access controls/backups with the account owner.

A static catalogue can be a valid production architecture. A public database or large application server is not required merely to display listings. What prevents sign-off here is the demonstrated leakage and operational failure paths, plus the missing integration features the documentation describes as part of the intended backend.

**Audit artifacts**

- [evidence.json](/Users/udaymukhija/Aum_estates/audit/2026-10-29/evidence.json): captured production headers/statuses, local server request results, redacted finding references, and browser observations. No raw listing text or credentials are included.
- [reproduce.cjs](/Users/udaymukhija/Aum_estates/audit/2026-10-29/reproduce.cjs): reproducible local adverse probes. All writes occur in new OS temporary directories. It copies the site for the full packaging probes and makes no network requests.
- [probe-results.json](/Users/udaymukhija/Aum_estates/audit/2026-10-29/probe-results.json): 23 adverse observations, all reproduced. These are grouped evidence for the findings above, not a count of 23 independent vulnerabilities.
- [positive-controls.json](/Users/udaymukhija/Aum_estates/audit/2026-10-29/positive-controls.json): three basic sanitizer controls that worked.

To repeat the local probes: `node audit/2026-10-29/reproduce.cjs`. The script reports whether each previously observed defect still reproduces; it does not certify security or automatically apply repairs.
