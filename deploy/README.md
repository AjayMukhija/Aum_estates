# Integrated deployment

These files target a Linux VPS with Node 22.16+ and nginx. They have not been installed on the live Hostinger account by this workspace. Confirm whether the account supports a persistent Node service; a static/shared hosting upload cannot run this backend.

1. Create a non-root `aum` service user. Install a reviewed checkout at `/opt/aum-estates` owned by that user, outside the nginx docroot. Keep `private_master_store/` and all backups private.
2. Before upgrading an existing installation, run `npm run backup` as that user and retain the backup off-machine. Keep the existing SQLite database; do not replace it with a fresh seed.
3. As the service user, run `npm run setup:admin -- --generate`, then `npm run package`. Retrieve the owner-only generated credential file through a trusted administrative channel. If provisioning a chosen password instead, pass `AUM_ADMIN_PASSWORD` through the server's secret-management channel; never commit it.
4. Provision the domain's TLS certificate. Adjust the certificate paths and domain in `nginx.conf`, and the Node executable/path in `aum-estates.service` if needed. The service routes all website and API requests through the same process; it never exposes the repository as a static root.
5. Install the service and nginx config. Validate nginx with `nginx -t`, then enable/start `aum-estates.service` and reload nginx. `NODE_ENV=production` makes authentication cookies Secure. `AUM_PUBLIC_ORIGIN` ensures client shortlist links use the public HTTPS origin.
6. Install and enable `aum-backup.timer` with its service. The timer uses the server's local timezone. Configure access-controlled off-machine backup replication separately and perform a restore drill.
7. Run `npm run verify:deployed -- https://aumestates.com`. Submit an identified test enquiry through the real browser form and verify it appears once in the CRM. Verify a price/status change, client shortlist expiry/revocation, old private URLs and recovery before accepting the deployment.

The API has an in-process per-IP rate limiter. Behind a proxy it conservatively uses the socket address, so clients share the origin's limits. Configure per-client request limiting at nginx/CDN when traffic warrants it; the application does not trust arbitrary forwarded-IP headers.

The static `dist_hostinger/` bundle remains useful for static hosting. Its enquiry UI reports recording failures and keeps the WhatsApp handoff available. To integrate it with a separately hosted API, the hosting administrator must route `/api`, `/crm` and `/shortlist` to this service on the same public origin. No credentials, privileged API keys or cross-origin bypasses belong in browser assets.

## Required cleanup of the existing live site

The live host still returned the legacy `/data/aum_inventory_local.json` endpoint with HTTP 200 during the remediation check. Remove obsolete raw inventory and metadata from the actual public document root, enforce the supplied deny rules, and purge those paths from any CDN/cache. An overwrite-only upload leaves obsolete private files behind. Confirm the old URLs return 403/404 after deployment; do not infer removal from the contents of the new bundle.

The current GitHub repository is public and has historical private seed blobs. This change removes the files from the new branch tip, but the repository owner must separately decide access restriction and history cleanup. Do not force-push rewritten history without coordinating existing branches and clones.
