# Deployment plan — 11 November 2026

This is the plan for *this* deployment. `README.md` beside it is the generic
runbook; this file records the current state, the one decision that blocks
everything, and the order of work.

## Where things stand right now

| Checked | Result |
| --- | --- |
| `https://aumestates.com/` | 200, but `last-modified: 26 October 2026` |
| `https://aumestates.com/crm/` | **404** |
| `https://aumestates.com/api/public/health` | **404** |
| `https://aumestates.com/data/aum_inventory_local.json` | **200** — internal inventory publicly readable |
| `https://aumestates.com/data/inventory_data_meta.json` | **200** — exposes source spreadsheet filenames |
| Security headers on the live site | none (no HSTS, no `X-Frame-Options`, no `nosniff`) |
| This branch pushed | no upstream configured |
| Serving platform | Hostinger, via their CDN (`hcdn`, Mumbai edge) |

The live site is a static build predating all backend work. There is no API
behind it, so the enquiry form on the live site cannot record a lead; only the
WhatsApp handoff works today.

## The decision that blocks everything

**Does the Hostinger account run a persistent Node process?**

Shared/static Hostinger hosting cannot. The CRM is a long-running Node service
holding a SQLite database; it is not PHP and not a static bundle.

- **Path A — VPS (recommended).** Hostinger VPS, or any Linux host, with Node
  22.16+. Everything in this directory is written for it. The website, `/api`,
  `/crm` and `/shortlist` all run from one origin, one process.
- **Path B — keep shared hosting.** Upload `dist_hostinger/` for the catalogue,
  and run the API elsewhere. This only works if the administrator can proxy
  `/api`, `/crm` and `/shortlist` from the website's origin to that service.
  Without same-origin routing the enquiry form stays dead and there is no CRM.

Path B is not a cheaper version of Path A. It is Path A plus a second host and
a proxy rule, or it is no CRM at all.

## What makes this easier than it looks

- **Zero npm dependencies**, runtime or dev. No build step, no native modules,
  no `node_modules` to install. Deployment is: copy the tree, run Node.
- SQLite is `node:sqlite`, built into Node 22.16+. Nothing to compile.
- Only **1.8 MB** has to move: `private_master_store/db/aum_master_crm.sqlite`.
  The 207 MB of `releases/` is server-local recovery state that regenerates.
- `deploy/` already contains a hardened `aum-estates.service` (non-root user,
  `ProtectSystem=strict`, `UMask=0077`), an `nginx.conf` with TLS and the
  security headers the live site is currently missing, and a backup timer.

## Order of work

**1. Push the branch.** It exists on one laptop. 137 uncommitted source files
and no upstream. A disk failure loses the CRM, the Datum rebuild and the
database. Minutes, and it is the cheapest risk reduction available.
Note: the GitHub repository is public and older commits contain private seed
blobs. Pushing this branch adds none, but access restriction and history
cleanup remain a separate owner decision.

**2. Confirm the host.** The blocking decision above. Needs an answer before
anything else is worth doing.

**3. Provision.** Create the `aum` service user, install a checkout at
`/opt/aum-estates` outside any docroot, copy the database in, `chmod` the
private store to owner-only. Issue the TLS certificate for the domain.

**4. Configure and start.** Adjust the domain and certificate paths in
`nginx.conf` and the Node path in `aum-estates.service`. `nginx -t`, enable the
service, reload nginx. `NODE_ENV=production` makes session cookies Secure;
`AUM_PUBLIC_ORIGIN=https://aumestates.com` makes client shortlist links resolve
to the public origin.

**5. Provision a fresh principal.** `npm run setup:admin -- --generate` **on the
server**. Do not copy the local credential file; it belongs to a laptop
database. Retrieve the generated credential through a trusted channel.

**6. Clean the old document root.** This is the step an overwrite-only upload
silently skips. The two legacy JSON files above must stop returning 200, and
the CDN cache must be purged for those paths. Confirm by requesting the old
URLs and seeing 403/404 — do not infer it from the new bundle's contents.

**7. Enable backups.** Install `aum-backup.timer`, then configure off-machine
replication, which is *not* configured anywhere today. Run one restore drill
into an isolated copy before trusting it.

**8. Verify, then accept.** `npm run verify:deployed -- https://aumestates.com`
covers headers, API reachability, private-path denial and cache rules. It
deliberately creates no lead, so finish with a real browser enquiry and confirm
it appears exactly once in the CRM.

## Pre-flight checks already done locally, 11 November 2026

Run here so they do not fail on the server:

- **Production-mode startup.** `NODE_ENV=production` with
  `AUM_PUBLIC_ORIGIN=https://aumestates.com` starts cleanly; `/api/public/health`
  200, `/crm/` 200, `/api/crm/dashboard` 401 unauthenticated.
- **systemd write paths match what the service actually writes.** The publisher
  writes to `hostingerDataDir`, the grid-study and v16 data copies and
  `releasesDir` — all five are inside `ReadWritePaths`. `dist_hostinger/` is
  written only by `npm run package`, an operator command outside the unit
  sandbox, so `ProtectSystem=strict` will not block it.
- **Tests and checks.** 25/25 behavioural tests, 45/45 local checks.
- **Bundle.** 268 files, 35 MB, rebuilt from the current database.

Login cannot be fully exercised over plain HTTP in production mode, because
`NODE_ENV=production` sets `Secure` on the session cookie. That is correct
behaviour and is why step 4 must complete before step 5 is testable.

## Standing rule discovered during this work

Static assets are cache-busted with `?v=<date>` across 43 references. **Bump it
whenever CSS or JS changes**, or returning visitors keep the old files and the
deploy is invisible to them. It is currently `20261112`.

## What is not covered here

Per-client rate limiting at the CDN (the app's limiter sees the proxy address),
history cleanup of the public repository, and any DNS change if the API moves
to a different host than the CDN currently fronts.
