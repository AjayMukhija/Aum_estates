# AUM ESTATES — Production Operations & Deployment Manual

**Platform:** `aumestates.com` (Hostinger Production)  
**Advisory Firm:** AUM ESTATES (Founded in 2002 by Ajay Mukhija)  
**Principal Office:** C-210, Nirvana Courtyard, Nirvana Country, Sector 50, Gurgaon 122018  
**Advisory Contact:** Direct Line: `+91 98111 57018` | WhatsApp Desk: `+91 98738 13595`  
**Document Version:** 2.0 (Production Release)

---

## 1. Quick Operator Cheatsheet

All operations can be executed safely from the terminal in the workspace root with single commands:

| Task | Command | What It Does |
| :--- | :--- | :--- |
| **Add New Listing** | `npm run add` | Launches interactive registration wizard; auto-allocates next ID, scans for leaks, creates backup, and updates live feed. |
| **Check Inventory Health** | `npm run manage status` | Displays total verified mandates, status breakdown, top categories, and latest ID. |
| **Update Listing Price** | `npm run manage update-price <ID> <value>` | Updates asking price (e.g. `npm run manage update-price AUM-WEB-000348 9.5`). |
| **Mark Property as Sold** | `npm run manage update-status <ID> Sold` | Toggles listing status (`Available`, `Sold`, `Under Offer`, `Leased`). |
| **Undo Last Change** | `npm run rollback` | Instantly rolls back to the previous timestamped safety backup. |
| **Integrity & Security Audit** | `npm run verify` | Runs the 45-point zero-dependency security, corridor clustering, and leak verification audit. |
| **Run Unit Tests** | `npm test` | Runs the full regression test suite (7/7 tests). |
| **Package for Hostinger** | `npm run package` | Pre-flights audits and packages all sanitized production assets into `dist_hostinger/`. |
| **Local Preview** | `npm run serve` | Starts local preview server at `http://localhost:8000/`. |

---

## 2. Daily Inventory Operations

### 2.1 Adding a New Listing (`npm run add`)
To add a new verified property mandate:
```bash
npm run add
```
The wizard will prompt you step-by-step:
1. **Listing Title:** e.g. `DLF The Arbour 4 BHK Luxury Condominium`
2. **Project Name:** e.g. `DLF The Arbour`
3. **Micro-Market / Corridor:** e.g. `Golf Course Extension Road`
4. **Sector:** e.g. `Sector 63`
5. **Property Type:** `Apartment` / `Builder Floor` / `Plot` / `Villa` / `Commercial`
6. **Transaction Type:** `Sale` / `Rent`
7. **Configuration:** e.g. `4 BHK + Servant`
8. **Bedrooms:** e.g. `4`
9. **Area Value & Unit:** e.g. `3950`, `Sq Ft`
10. **Price in Crores:** e.g. `8.75`
11. **Key Highlights:** e.g. `Panoramic Aravali views; 2 dedicated parking bays; clubhouse access`

**Security Gatekeeper:**
The wizard automatically scans all entries for private seller phone numbers, broker split notes (`1% brokerage`, `cheque ratio`), or PAN cards. If any sensitive pattern is detected, the operation **fails closed** and blocks publication.

### 2.2 Updating Property Status or Price
To update the price of an existing mandate:
```bash
npm run manage update-price AUM-WEB-000348 9.5 Cr
```

To update the status when a deal is closed:
```bash
npm run manage update-status AUM-WEB-000348 Sold
```

Every update automatically creates a safety snapshot in `AUM_ESTATES_Website_For_Hostinger/data/backups/`.

### 2.3 Emergency Rollback
If an incorrect price or typo was published:
```bash
npm run rollback
```
This restores the exact state prior to the last operation in milliseconds.

---

## 3. Hostinger Deployment Procedure

When you are ready to push updates to `aumestates.com`:

### Step 1: Generate Clean Release Bundle
```bash
npm run package
```
This script performs a complete 4-step pipeline:
1. Runs `scripts/sanitize_and_build.js` to ensure the latest data is sanitized.
2. Runs the 45-point verification audit (`scripts/verify_site.js`).
3. Assembles clean production files into `dist_hostinger/` (strictly excluding `.git`, `.env`, backup files, and internal notes).
4. Performs a post-bundle privacy scan across all 600+ bundled files.

### Step 2: Upload to Hostinger

#### Option A: Hostinger File Manager (Web Browser)
1. Compress `dist_hostinger` into a `.zip` archive.
2. Log into the Hostinger Control Panel (hPanel) -> **File Manager** -> `public_html/`.
3. Upload the `.zip` file and click **Extract**.
4. Overwrite existing files when prompted.

#### Option B: SFTP / Secure Shell Sync
Connect using your Hostinger SFTP credentials and synchronize:
```bash
# Example rsync / sftp command
rsync -avz --delete dist_hostinger/ user@aumestates.com:public_html/
```

### Step 3: Verification on Live Website
1. Visit `https://aumestates.com/` to verify the homepage and corridor counts.
2. Visit `https://aumestates.com/properties/index.html` to test search filters.
3. Visit `https://aumestates.com/concepts/aum-grid-study/` to test the Architectural Grid UI.
4. Click **"Inquire on WhatsApp"** on any property card to confirm the pre-filled message:
   `Hi Ajay, I am interested in [Title] (Ref: [ID]) in [Location], listed around [Price]. Please share the complete dossier.`
5. Click the telephone button to confirm it rings Ajay Mukhija directly at `+91 98111 57018`.

---

## 4. CRM Bot Integration Architecture

AUM ESTATES uses a decoupled lead capture bridge `window.AUM_CRM_HOOK` across all property cards, dossier views, and contact forms.

### 4.1 Global Hook Specification
Whenever a user interacts with a property CTA, the following payload is dispatched:

```json
{
  "action": "inquire_whatsapp",
  "source": "property_detail_view",
  "property_id": "AUM-WEB-000348",
  "title": "DLF The Belaire 4 BHK Luxury Condominium",
  "price": "₹9.25 Cr",
  "location": "Golf Course Road, Sector 54, Gurgaon",
  "timestamp": "2026-10-28T10:00:00.000Z"
}
```

### 4.2 Listening to Leads in External Bots / CRM
To forward leads directly to your CRM bot, Google Analytics, or Airtable webhook, register a listener anywhere on the page:

```javascript
window._AUM_CRM_LISTENER = function(lead) {
  // Post payload to CRM webhook or Telegram / WhatsApp bot
  fetch('https://your-crm-bot.example.com/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  });
};
```

---

## 5. Security & Server Hardening Directives

The production `.htaccess` file enforces enterprise-grade security rules on Hostinger's LiteSpeed server:
- **Directory Browsing Disabled:** Scrapers cannot view raw directory contents (`Options -Indexes`).
- **File Quarantine:** Direct HTTP requests to `.txt`, `.md`, `.bak`, `.git`, `.jsonl`, and `.env` return `403 Forbidden`.
- **HSTS Preload:** Enforces SSL encryption for 1 year (`max-age=31536000; includeSubDomains; preload`).
- **Clickjacking Frame Protection:** `X-Frame-Options: SAMEORIGIN`.
- **MIME Sniffing Block:** `X-Content-Type-Options: nosniff`.
- **Cache Policy:** Inventory JSON/JS expires in **10 minutes** so price updates propagate rapidly; static images and fonts cache for **30 days** to ensure instant luxury loading performance.
