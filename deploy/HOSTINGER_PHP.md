# Publishing from the live site (Hostinger PHP + MariaDB)

This is the arrangement the site actually runs on, and the one the principal
uses day to day. `deploy/README.md` describes the alternative Node/VPS
arrangement; the two are not deployed together.

The short version of the daily loop, once the host is set up:

1. Sign in at `https://aumestates.com/crm/`.
2. **＋ New Mandate** → fill the public marketing spec → **Create Master Mandate**.
3. Set its state to **Approved Public (Live Web)** (an advisor's work lands in
   *Pending Principal Approval* and the principal approves it from the desk).
4. **Sync Public Feeds**.

Step 4 is what makes a listing public. The site's catalogue pages are static
and read `public_html/data/*.js`; the publisher recompiles those files from the
database, through the privacy gate, and replaces them atomically. Nothing
reaches the website until that button is pressed.

## One-time host setup

The deployable bundle is built locally with `npm run package:php`, which runs
the PHP test suites first and refuses to package if they fail. It produces
`dist_hostinger_php/`:

| Bundle path | Goes to | Notes |
| --- | --- | --- |
| `public_html/` | the account's document root | website, CRM app, shortlist viewer, static feeds, front controller, `.htaccess` |
| `backend_php/` | **one level above** `public_html/` | application code; must not be reachable over HTTP |
| `mariadb_initial_import.sql` | phpMyAdmin import | schema and initial data |

1. **Database.** Create a MariaDB database and user in hPanel, then import
   `mariadb_initial_import.sql` through phpMyAdmin.
2. **Configuration.** Copy `backend_php/.env.example` to `backend_php/.env` on
   the server and fill in the database name, user and password. Keep
   `AUM_COOKIE_SECURE=true` and `AUM_PUBLIC_ORIGIN=https://aumestates.com`.
   This file holds the database password: it lives outside `public_html` and is
   never part of an upload from this repository.
3. **Account.** Over SSH, from the directory holding `backend_php`:

   ```sh
   php backend_php/bin/setup_admin.php --generate
   ```

   The password is written to an owner-only `admin-credentials.json` beside the
   private store and is deliberately *not* printed, so it does not survive in
   hPanel's terminal scrollback or in shell history. Read it once, move it into
   a password manager, and delete the file. To set a chosen password instead,
   pass it through the environment:

   ```sh
   AUM_ADMIN_PASSWORD='…at least 16 characters…' php backend_php/bin/setup_admin.php
   ```

   Re-running either form rotates the password and signs every open session
   out. The script refuses to run with no password source, so a typo cannot
   lock the principal out of their own CRM.
4. **Check.** Sign in at `/crm/`, publish one listing end to end, and confirm it
   appears on `/properties/`. Then send one identified test enquiry through the
   public form and confirm it arrives in the CRM exactly once.

## Command-line equivalents

Useful when the CRM is not to hand, or for bulk work. Both act on the same
database the CRM uses.

```sh
php backend_php/bin/import_inventory.php   # bulk intake from the master workbook
php backend_php/bin/publish.php            # the Sync Public Feeds step
```

`publish.php` refuses a release that would publish nothing at all, or drop the
catalogue more than 20% below the currently published count — which catches a
half-finished import before it guts the site. When a bulk archival is genuinely
intended, pass `--allow-shrink`.

## Local rehearsal

The whole thing runs locally against the SQLite master store, which is what
every change here is tested on:

```sh
php -S 127.0.0.1:8123 -t dist_hostinger_php/public_html scripts/php_dev_router.php
```

The router reproduces the `.htaccess` rewrites, so `/crm/`, `/api/*`,
`/shortlist/{token}` and the per-property share previews behave as they do on
the host. Note that `npm run package:php` rebuilds `dist_hostinger_php/` from
scratch, so a local `.env` copied into the bundle has to be put back after
each packaging run.

## Cache

`public_html` assets are referenced with a hand-maintained `?v=YYYYMMDD<letter>`
string. Changing CSS or JavaScript without bumping it leaves returning visitors
and Hostinger's CDN on the previous copy. Publishing inventory does not need a
bump — the feeds are separate files with their own release stamp.
