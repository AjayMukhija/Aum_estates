# PHP migration — pre-production assessment, 22 November 2026

Reviewed branch: `codex/production-readiness-fixes`, baseline commit `82986d4`, with the
untracked `backend_php/` migration applied on top. Scope: the full PHP + MariaDB backend
and the public website, assessed for a Hostinger Premium go-live with a paying client.

Assessment of the local repository and a locally executed copy of the production bundle.
The live Hostinger deployment was not reachable from here and was not tested.

---

## Verdict

**Not acceptable to take live as it arrived. It is acceptable now, after the fixes in this
commit, subject to the six deployment steps listed at the end.**

The architecture is sound and the privacy engineering is genuinely good. But the migration
dropped protections the Node system had, introduced an authentication backdoor, and shipped
a bundle with two defects that would have been visible to the client within minutes of
going live: the homepage could return a blank `404 Not Found`, and nobody could sign in to
the CRM at all.

Every defect below was reproduced by execution, not inferred from reading. Every fix is
covered by a new regression test.

---

## What is genuinely good

Worth saying plainly, because it is the larger part of the work:

| Area | Assessment |
| --- | --- |
| Privacy gate | Strong. Public output is a strict field whitelist, re-scanned for phones, e-mails, PAN numbers, commission wording and cash/cheque structures before anything is written. I scanned all 347 published records: **zero** owner phones, broker names, commission terms, PANs or outside e-mail addresses leaked. |
| Public/private isolation | Clean. Public search can only reach `approved_public` + `available`; the private vault is a separate table reached only by authenticated CRM queries. |
| SQL injection | No exposure found. Every interpolated SQL fragment is an integer cast or a whitelisted literal; all user values are bound parameters. |
| Cross-site scripting | No exposure found. `crm.js`, `shortlist.html`, `inventory-search.js`, `detail.js` and `projects-page.js` each escape consistently; the one `url()` interpolation draws from a hardcoded filename whitelist. |
| Publisher | Atomic writes, a rollback journal, a release lock and an anti-truncation guard that refuses to publish if the catalogue shrinks more than 20%. |
| Frontend | Professional, fast, buildless. Renders 347 properties with no console errors and no horizontal overflow at 375px. "Representative reference photograph" labelling is an honest disclosure. |
| CSRF | Enforced on every mutating CRM method, with a correctly scoped header-auth exemption. |

The existing test suites (13 tests) passed before and after this work.

---

## Blocking defects found, all now fixed

### 1. The homepage could have served a blank `404 Not Found`

`public_html/` contains both `index.html` (the 40 KB website) and `index.php` (the API
front controller), and **no `DirectoryIndex` directive anywhere**. Apache and LiteSpeed
disagree on which to prefer, and Hostinger runs LiteSpeed, which commonly prefers
`index.php`. The front controller had no handler for `/`, so it fell through to a bare
`404 Not Found`.

Reproduced locally: `GET /` returned HTTP 404 with the body `404 Not Found`.

Fixed in two layers so neither alone is load-bearing:
- `DirectoryIndex index.html index.php` pinned in `.htaccess`.
- The front controller now falls back to serving the static site for non-API paths.

`GET /` now returns HTTP 200 and the real homepage.

### 2. Nobody could have signed in to the CRM after deployment

`mariadb_initial_import.sql` carried the only account, `ajay@aumestates.com`, with its
original **Node scrypt digest** (128 hex characters). PHP has no scrypt primitive matching
Node's parameters, so `Auth::verifyPassword()` returns `false` for it unconditionally. The
dead legacy branch in that function made this look handled; it was not.

So on go-live the client would have faced a CRM that rejected the correct password with
"Invalid email or password", with no indication why.

Fixed: the SQLite-to-MariaDB converter now detects any credential PHP cannot verify and
re-issues a proper `password_hash` credential, writing the new password to the git-ignored
`admin-credentials.json` (mode 0600) rather than printing it. Login now distinguishes a
migrated credential from a wrong password and returns HTTP 409 with recovery instructions.

### 3. `AUM_ADMIN_PASSWORD` was a master password for every account

The login route accepted the `AUM_ADMIN_PASSWORD` environment value as a valid password for
**any active user**, then silently overwrote that user's stored hash with it.

Reproduced: with `AUM_ADMIN_PASSWORD` set, signing in as `advisor@aumestates.com` with that
value succeeded, and the advisor's own password stopped working afterwards.

Since the setup instructions lead to this variable being left in `.env`, it would have
become a permanent shared master key to the private vault. The Node system had no such
mechanism — it was introduced by the migration.

Fixed: the override is removed entirely. Accounts are provisioned with
`bin/setup_admin.php`.

### 4. Brute-force protection was lost in the migration

`backend/server.js:805` rate-limited login to 15 attempts per minute per IP, and
`server.js:660` limited the public enquiry endpoint. **Neither survived the port.**

Reproduced: 60 consecutive wrong passwords all returned 401, never 429. 40 consecutive
anonymous enquiry posts all returned 201, creating 40 leads.

The in-memory bucket the Node server used cannot work under PHP-FPM, where every request is
a separate process — which is likely why it was dropped rather than ported.

Fixed: a shared `auth_throttle` table (migration 5) backs throttling across workers.
Login is limited per IP **and** per account (10 / 15 min); enquiries per IP (12 / 10 min).
A missing or unwritable throttle table fails open, so throttling can never take the site
down. Successful and failed sign-ins are now written to the audit log, restoring the
`advisor_login` record the Node system kept.

The CRM login page also hardcoded `value="ajay@aumestates.com"`, handing an attacker a
confirmed username. Now a placeholder.

### 5. One client's enquiry was filed onto an unrelated person's contact record

The most serious correctness defect, and the one least likely to be noticed.

Enquiry de-duplication ran:

```sql
WHERE (phone_norm IS NOT NULL AND phone_norm = ?)
   OR (email IS NOT NULL AND LOWER(email) = LOWER(?))
```

with `[$phoneNorm ?: '', $clientEmail ?: '']`. When an enquirer supplied no e-mail, `''`
was passed — which matches **any** contact stored with an empty-string e-mail.

`POST /api/crm/contacts` passed `$body['email'] ?? null` straight through without
normalising, so an advisor adding a contact and leaving the e-mail box blank stored exactly
that empty string. Normal CRM use created the trigger.

Reproduced end to end:

```
Step 1  Advisor adds "Mrs Seller Sharma" (seller_owner), e-mail left blank  -> stored as ''
Step 2  Unrelated buyer "Verma" submits the public enquiry form with a phone, no e-mail
Step 3  Buyer's lead is attached to the SELLER's contact record
        The buyer's enquiry text and stated budget now appear on the seller's file
```

For a fiduciary advisory whose entire proposition is discretion, a buyer's requirements
surfacing on a seller's record is a serious failure.

Fixed: the query now matches only on keys the enquirer actually supplied and ignores empty
values; contact creation normalises every blank field to `NULL`; migration 6 cleans existing
empty-string keys. Genuine de-duplication by phone still works — there is a test for both
directions.

---

## Further defects fixed

| # | Defect | Behaviour before | Now |
| --- | --- | --- | --- |
| 6 | Shortlists silently dropped properties | Advisor selects 3 properties, is told "sent"; the client silently sees 2. Un-shareable items were skipped at read time with no warning. | HTTP 422 naming each property that cannot be disclosed, and why. |
| 7 | `setup_admin.php` crashed | Fatal `NOT NULL constraint failed: users.password_salt` against the SQLite schema — the documented way to provision staff accounts did not work. | Works on both SQLite and MariaDB; role is validated. |
| 8 | Approving a missing property reported success | `POST /properties/UNKNOWN/approve` returned `200 {ok:true}` having changed nothing. | 404 for unknown, 409 for archived. |
| 9 | Unvalidated `contact_type` | Arbitrary values accepted; MariaDB's `ENUM` rejects them, so this is a 500 in production but passes on SQLite in tests. | Validated against `Config::CONTACT_TYPES`, returns 400. |
| 10 | Publisher lock could be stolen | Liveness used `posix_kill`, commonly disabled on shared hosting. Without it every existing lock looked stale and was deleted, so two concurrent publishers could interleave file promotions. | `flock`, which is OS-released on crash and needs no extension. |
| 11 | HTTPS redirect was ordered after the API rewrites | The release packager inserted `RewriteRule ^api/.*$ ... [L]` *above* the HTTPS redirect, so an `http://` POST to `/api/crm/auth/login` would be served in clear text rather than redirected. | Redirect pinned first; the packager now refuses to emit rewrites if the anchor is missing. |
| 12 | No Content-Security-Policy | Only `X-Frame-Options`, `nosniff`, `Referrer-Policy` and the deprecated `X-XSS-Protection`. | CSP pinned to `'self'` on both static responses and API responses. |
| 13 | `/crm/` static serving had no containment | Traversal was blocked only incidentally, because the path was never URL-decoded. Fragile against any layout change. | `realpath` containment inside the CRM asset directory. |
| 14 | `.env` ignored for origin and cookie flags | `getPublicOrigin()` and `isSecureCookie()` read `getenv()` without loading `.env` first. Latent only, because the DB connection happens to load it first. | Both load `.env` explicitly. |

---

## Verification performed

- `npm run test:php` — **29 passed, 0 failed** (6 unit, 7 HTTP contract, 16 new regression).
- 9 standalone probes reproduced each defect against the original code before fixing.
- `npm run package:php` rebuilds cleanly; release `.htaccess` verified in correct order.
- Production bundle executed locally via a new `aum-php` dev server:
  - `GET /` → 200, real homepage (was 404)
  - CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` present on API responses
  - 11th consecutive bad password → 429 with `retry_after_seconds`
  - Legacy credential → 409 with reset instructions
  - `advisor_login`, `login_failed` and `login_blocked_legacy_credential` written to audit log
  - CRM sign-in, dashboard (347 live / 63 needing confirmation) and Master Inventory verified in a browser
  - Public site verified at desktop and 375px; no console errors, no horizontal overflow
- Published feed scanned for leakage across all 347 records: none.
- Secret scan over everything committed: no credentials. `.env`, the data dump,
  `admin-credentials.json`, the SQLite vault and `dist_hostinger_php/` are all git-ignored.

The real master store was not modified; all runtime testing used a disposable copy.

---

## Known limitations, accepted

- **The live Hostinger deployment was not tested.** Everything above was verified against a
  local copy of the production bundle. `DirectoryIndex` behaviour in particular should be
  confirmed on the real host — it is the one finding whose severity depends on server
  configuration I could not observe.
- **MariaDB was not exercised.** Local runs used the SQLite driver. The schema, the ENUM
  validation and the import dump were reviewed by reading. Run `bin/migrate.php` on the
  server and confirm migrations 5 and 6 apply.
- `bin/publish.php` writing to `public_html/data` requires the backend process to have write
  access to the docroot; confirm after deployment.
- The hand-rolled SQL escaping in the export (`convert_sqlite_to_mariadb.php:102`) is
  correct as written but would be better served by a driver-level quoting routine. It runs
  only as an operator CLI step, so it is not a go-live blocker.
- Sessions are stored unhashed in the database. Acceptable for this threat model, but worth
  revisiting if the account count grows.

---

## Before you switch DNS

1. Import `mariadb_initial_import.sql` **regenerated by this commit**. The older dump
   contains the unusable credential. Confirm the users row begins with `$2y$`.
2. Place `backend_php/` **above** `public_html/`, never inside it.
3. Create `backend_php/.env` from `.env.example` with the real MariaDB credentials and
   `AUM_PUBLIC_ORIGIN=https://aumestates.com`, `AUM_COOKIE_SECURE=true`. Do **not** set
   `AUM_ADMIN_PASSWORD`; it no longer does anything.
4. Run `php backend_php/bin/migrate.php`, then `php backend_php/bin/setup_admin.php
   --email=ajay@aumestates.com` to set the principal's real password. Delete
   `admin-credentials.json` once the password is stored safely.
5. Confirm `https://aumestates.com/` serves the website and not `404 Not Found`. This is the
   single most important post-deploy check.
6. Run `npm run verify:deployed -- https://aumestates.com`.
