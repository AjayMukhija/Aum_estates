(function () {
  'use strict';

  const state = {
    user: null,
    csrfToken: null,
    activeTab: 'overview',
    leadStageFilter: 'all',
    lastImportPayload: null
  };

  const STAGE_LABELS = {
    new_inquiry: 'New Inquiry',
    qualified: 'Qualified',
    shortlist_shared: 'Shortlist Shared',
    site_visit_scheduled: 'Site Visit',
    offer_negotiation: 'Offer / Negotiation',
    documentation: 'Documentation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost'
  };

  const PUB_LABELS = {
    approved_public: ['Live Public', 'pill-public'],
    private_off_market: ['Off-Market Vault', 'pill-vault'],
    pending_approval: ['Pending Approval', 'pill-pending'],
    draft: ['Draft', 'pill-muted'],
    archived: ['Archived', 'pill-muted']
  };

  const CORRIDOR_OPTIONS = [
    'Golf Course Road',
    'DLF Phase 1–5',
    'Golf Course Ext & SPR',
    'Nirvana Country & Sohna Road',
    'Sushant Lok & Central Gurgaon',
    'Dwarka Expressway & New Gurgaon',
    'South Goa'
  ];

  const CATEGORY_OPTIONS = [
    ['apartment', 'Apartment'],
    ['builder-floor', 'Builder Floor'],
    ['villa', 'Villa / House'],
    ['plot', 'Plot / Land'],
    ['commercial', 'Commercial'],
    ['farmhouse', 'Farmhouse']
  ];

  function esc(val) {
    return String(val ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function formatInrShort(inr) {
    const n = Number(inr);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')} Lakh`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  function pubBadge(pubState) {
    const [label, cls] = PUB_LABELS[pubState] || [pubState || 'Draft', 'pill-muted'];
    return `<span class="pill ${cls}">${esc(label)}</span>`;
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
    }
    if (state.csrfToken && options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
      headers['X-CSRF-Token'] = state.csrfToken;
    }

    const res = await fetch(path, {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body
    });
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (res.status === 401 && !path.includes('/auth/')) {
      showAuthScreen();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast-banner');
    el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="btn-link" style="color:#fff" id="toast-dismiss">Dismiss</button>`;
    el.hidden = false;
    document.getElementById('toast-dismiss').onclick = () => { el.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // Drawer Management
  const drawer = document.getElementById('drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');
  let lastTriggerEl = null;

  function openDrawer(eyebrow, title, html) {
    lastTriggerEl = document.activeElement;
    document.getElementById('drawer-eyebrow').textContent = eyebrow;
    document.getElementById('drawer-title').textContent = title;
    drawerBody.innerHTML = html;
    drawer.hidden = false;
    drawerBackdrop.hidden = false;
    document.getElementById('drawer-close').focus();
  }

  function closeDrawer() {
    drawer.hidden = true;
    drawerBackdrop.hidden = true;
    drawerBody.innerHTML = '';
    if (lastTriggerEl && lastTriggerEl.focus) lastTriggerEl.focus();
  }

  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) {
      closeDrawer();
    } else if (e.key === '/' && drawer.hidden && state.activeTab === 'inventory' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      document.getElementById('inv-q').focus();
    }
  });

  // Auth & Navigation
  function showAuthScreen() {
    document.getElementById('app-shell').hidden = true;
    document.getElementById('auth-screen').hidden = false;
  }

  function showAppShell() {
    document.getElementById('auth-screen').hidden = true;
    document.getElementById('app-shell').hidden = false;
    document.getElementById('user-name').textContent = state.user.full_name;
    document.getElementById('user-role').textContent = state.user.role === 'principal' ? 'Principal Advisor' : 'Advisory Desk';
    switchTab(state.activeTab);
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    errEl.hidden = true;
    btn.disabled = true;
    try {
      const f = new FormData(e.currentTarget);
      const data = await api('/api/crm/auth/login', {
        method: 'POST',
        body: { email: f.get('email'), password: f.get('password') }
      });
      state.user = data.user;
      state.csrfToken = data.csrfToken;
      showAppShell();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/crm/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    state.csrfToken = null;
    showAuthScreen();
  });

  const TAB_META = {
    overview: ['AUM ESTATES / OPERATIONS', 'Advisory Desk'],
    inventory: ['MASTER DATABASE & FIDUCIARY VAULT', 'Master Inventory'],
    intake: ['ZERO-TRUST INGESTION', 'WhatsApp & Workbook Intake Studio'],
    leads: ['BUYER ADVISORY & AUTO-MATCHING', 'Leads, Deal Pipeline & Shortlists'],
    contacts: ['RELATIONSHIP GRAPH', 'Unified Contacts Vault'],
    publish: ['HEADLESS RELEASE & GOVERNANCE', 'Static Publisher & Audit Trail']
  };

  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.hidden = p.id !== `tab-${tab}`;
    });
    const [eye, title] = TAB_META[tab] || TAB_META.overview;
    document.getElementById('topbar-eyebrow').textContent = eye;
    document.getElementById('topbar-title').textContent = title;

    if (tab === 'overview') loadOverview();
    else if (tab === 'inventory') loadInventory();
    else if (tab === 'leads') loadLeads();
    else if (tab === 'contacts') loadContacts();
    else if (tab === 'publish') loadAuditLogs();
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-jump-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.jumpTab));
  });

  document.getElementById('quick-new-mandate').addEventListener('click', () => openPropertyDrawer(null));
  document.getElementById('quick-publish-btn').addEventListener('click', async () => {
    switchTab('publish');
    await runStaticPublish();
  });

  // ==========================================================================
  // TAB 1: OVERVIEW DESK
  // ==========================================================================
  async function loadOverview() {
    const data = await api('/api/crm/dashboard');
    const inv = data.inventory || {};

    document.getElementById('nav-badge-total').textContent = String(inv.total_master || 0);
    const pendingBadge = document.getElementById('nav-badge-pending');
    pendingBadge.textContent = String(inv.pending_approval || 0);
    pendingBadge.hidden = !inv.pending_approval;

    const newLeadsCount = (data.pipeline || []).find((s) => s.stage === 'new_inquiry')?.count || 0;
    const leadsBadge = document.getElementById('nav-badge-leads');
    leadsBadge.textContent = String(newLeadsCount);
    leadsBadge.hidden = !newLeadsCount;

    document.getElementById('overview-kpis').innerHTML = `
      <div class="kpi-box">
        <span class="eyebrow">LIVE ON WEBSITE</span>
        <div class="kpi-value">${inv.live_public || 0}</div>
        <span class="kpi-sub">Approved public mandates</span>
      </div>
      <div class="kpi-box">
        <span class="eyebrow">PRIVATE VAULT</span>
        <div class="kpi-value">${inv.off_market || 0}</div>
        <span class="kpi-sub">Off-market family-office mandates</span>
      </div>
      <div class="kpi-box ${inv.pending_approval ? 'kpi-alert' : ''}">
        <span class="eyebrow">APPROVAL QUEUE</span>
        <div class="kpi-value">${inv.pending_approval || 0}</div>
        <span class="kpi-sub">Awaiting advisor sign-off</span>
      </div>
      <div class="kpi-box">
        <span class="eyebrow">NEEDS CONFIRMATION</span>
        <div class="kpi-value">${inv.reverify_due || 0}</div>
        <span class="kpi-sub">120-day reverification cycle</span>
      </div>
      <div class="kpi-box">
        <span class="eyebrow">ACTIVE PIPELINE</span>
        <div class="kpi-value">${(data.recentLeads || []).length}</div>
        <span class="kpi-sub">${newLeadsCount} new inbound inquiry</span>
      </div>
    `;

    // Pending approvals
    const pendEl = document.getElementById('overview-pending-list');
    if (!data.pendingApprovals.length) {
      pendEl.innerHTML = '<p class="fineprint">Approval queue is clear. All ingested drafts have been reviewed.</p>';
    } else {
      pendEl.innerHTML = data.pendingApprovals.map((item) => `
        <div class="compact-item">
          <div>
            <strong>${esc(item.listing_title)}</strong>
            <small>${esc(item.property_id)} · ${esc(item.corridor)} · ${esc(item.price_text || formatInrShort(item.price_inr_norm))}${item.broker_name_cache ? ` · Source: ${esc(item.broker_name_cache)}` : ''}</small>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary btn-sm" data-open-prop="${esc(item.property_id)}">Inspect Vault</button>
            <button type="button" class="btn btn-primary btn-sm" data-approve-prop="${esc(item.property_id)}">Approve</button>
          </div>
        </div>
      `).join('');
    }

    // Recent leads
    const leadsEl = document.getElementById('overview-leads-list');
    if (!data.recentLeads.length) {
      leadsEl.innerHTML = '<p class="fineprint">No leads recorded yet.</p>';
    } else {
      leadsEl.innerHTML = data.recentLeads.map((l) => `
        <div class="compact-item">
          <div>
            <strong>${esc(l.client_name)} <span class="pill pill-muted">${esc(STAGE_LABELS[l.stage] || l.stage)}</span></strong>
            <small>${esc(l.intent)} · ${esc(l.preferred_location || 'Gurugram')}${l.budget_text ? ` · ${esc(l.budget_text)}` : ''} · via ${esc(l.source_channel)}</small>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-open-lead="${esc(l.lead_id)}">Match &amp; Shortlist →</button>
        </div>
      `).join('');
    }

    // Reverification queue
    const revEl = document.getElementById('overview-reverify-list');
    if (!data.reverifyQueue.length) {
      revEl.innerHTML = '<p class="fineprint">All mandates are within their active verification window.</p>';
    } else {
      revEl.innerHTML = data.reverifyQueue.map((r) => `
        <div class="compact-item">
          <div>
            <strong>${esc(r.listing_title)}</strong>
            <small>${esc(r.property_id)} · ${esc(r.corridor)} · Last verified: ${esc(r.last_verified || 'Unrecorded')} (${esc(r.verification_status)})</small>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary btn-sm" data-reverify-prop="${esc(r.property_id)}">Mark Re-verified ✓</button>
            <button type="button" class="btn-link" data-open-prop="${esc(r.property_id)}">Edit</button>
          </div>
        </div>
      `).join('');
    }
  }

  document.getElementById('view-all-reverify').addEventListener('click', () => {
    document.getElementById('inv-reverify').checked = true;
    switchTab('inventory');
  });

  // Delegated quick actions
  document.addEventListener('click', async (e) => {
    const openProp = e.target.closest('[data-open-prop]');
    if (openProp) {
      openPropertyDrawer(openProp.dataset.openProp);
      return;
    }
    const approveProp = e.target.closest('[data-approve-prop]');
    if (approveProp) {
      try {
        await api(`/api/crm/properties/${encodeURIComponent(approveProp.dataset.approveProp)}/approve`, { method: 'POST' });
        showToast(`Approved ${approveProp.dataset.approveProp} for public catalogue. Click "Sync Public Feeds" when ready to publish static bundle.`);
        loadOverview();
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    const revProp = e.target.closest('[data-reverify-prop]');
    if (revProp) {
      try {
        await api(`/api/crm/properties/${encodeURIComponent(revProp.dataset.reverifyProp)}/reverify`, { method: 'POST' });
        showToast(`Marked ${revProp.dataset.reverifyProp} re-verified today (+120 day cycle).`);
        if (state.activeTab === 'overview') loadOverview();
        else if (state.activeTab === 'inventory') loadInventory();
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    const openLead = e.target.closest('[data-open-lead]');
    if (openLead) {
      openLeadDrawer(openLead.dataset.openLead);
    }
  });

  // ==========================================================================
  // TAB 2: MASTER INVENTORY & SPLIT FIDUCIARY VAULT DRAWER
  // ==========================================================================
  let invTimer = null;
  async function loadInventory() {
    const q = document.getElementById('inv-q').value.trim();
    const publicationState = document.getElementById('inv-pub').value;
    const availabilityState = document.getElementById('inv-avail').value;
    const corridor = document.getElementById('inv-corridor').value;
    const category = document.getElementById('inv-category').value;
    const reverifyDueOnly = document.getElementById('inv-reverify').checked ? '1' : '';

    const params = new URLSearchParams({
      q,
      publicationState,
      availabilityState,
      corridor,
      category,
      reverifyDueOnly,
      limit: '200'
    });

    const data = await api(`/api/crm/properties?${params.toString()}`);
    document.getElementById('inv-count').textContent = `Showing ${data.items.length} of ${data.total} master mandates`;

    const tbody = document.getElementById('inv-tbody');
    if (!data.items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="fineprint">No mandates match the current search and filter criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = data.items.map((item) => {
      const vaultBits = [];
      if (item.exact_unit_or_plot_no) vaultBits.push(`Unit: ${item.exact_unit_or_plot_no}`);
      if (item.owner_name_cache) vaultBits.push(`Owner: ${item.owner_name_cache}`);
      if (item.broker_name_cache) vaultBits.push(`Broker: ${item.broker_name_cache}`);
      if (item.floor_price_display) vaultBits.push(`Floor: ${item.floor_price_display}`);
      if (item.payment_structure_notes) vaultBits.push('Payment note');

      const specs = [
        item.category,
        item.transaction_type,
        item.configuration,
        item.area_value ? `${item.area_value} ${item.area_unit || ''}`.trim() : null
      ].filter(Boolean).join(' · ');

      return `
        <tr class="clickable-row" data-open-prop="${esc(item.property_id)}">
          <td class="mono-id">${esc(item.property_id)}</td>
          <td>
            <strong>${esc(item.listing_title)}</strong>
            <div class="fineprint">${esc(item.corridor)}${item.sector ? ` · ${esc(item.sector)}` : ''}${item.locality ? ` · ${esc(item.locality)}` : ''}</div>
          </td>
          <td>${esc(specs)}</td>
          <td><strong>${esc(item.display_price)}</strong></td>
          <td>
            ${vaultBits.length
              ? `<span class="pill pill-vault">${esc(vaultBits.slice(0, 2).join(' · '))}</span>`
              : '<span class="fineprint">Standard record</span>'}
          </td>
          <td>
            ${pubBadge(item.publication_state)}
            ${item.availability_state !== 'available' ? `<span class="pill pill-muted">${esc(item.availability_state)}</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('inv-q').addEventListener('input', () => {
    clearTimeout(invTimer);
    invTimer = setTimeout(loadInventory, 180);
  });
  ['inv-pub', 'inv-avail', 'inv-corridor', 'inv-category', 'inv-reverify'].forEach((id) => {
    document.getElementById(id).addEventListener('change', loadInventory);
  });
  document.getElementById('inv-reset').addEventListener('click', () => {
    document.getElementById('inv-q').value = '';
    document.getElementById('inv-pub').value = 'all';
    document.getElementById('inv-avail').value = 'all';
    document.getElementById('inv-corridor').value = 'all';
    document.getElementById('inv-category').value = 'all';
    document.getElementById('inv-reverify').checked = false;
    loadInventory();
  });

  async function openPropertyDrawer(propertyId) {
    let item = {
      publication_state: 'pending_approval',
      availability_state: 'available',
      transaction_type: 'Sale',
      property_type: 'Apartment',
      city: 'Gurgaon',
      area_unit: 'Sq Ft',
      price_unit: 'Cr'
    };
    let history = [];

    if (propertyId) {
      const data = await api(`/api/crm/properties/${encodeURIComponent(propertyId)}`);
      item = data.item;
      history = data.auditHistory || [];
    }

    const isNew = !propertyId;
    const floorCr = item.internal_floor_price_inr ? (item.internal_floor_price_inr / 1e7).toFixed(2).replace(/\.00$/, '') : '';

    openDrawer(
      isNew ? 'NEW MASTER MANDATE' : `MASTER MANDATE · ${item.property_id}`,
      isNew ? 'Register Property & Fiduciary Vault' : item.listing_title,
      `
      <div class="subtabs" role="tablist">
        <button type="button" class="subtab-btn active" data-dtab="pub">1. Public Marketing Spec</button>
        <button type="button" class="subtab-btn" data-dtab="priv">2. Confidential Fiduciary Vault</button>
        ${!isNew ? '<button type="button" class="subtab-btn" data-dtab="hist">3. Audit History</button>' : ''}
      </div>

      <form id="prop-form" class="stack-form">
        <div id="dtab-pub">
          <div class="form-grid-3">
            <div class="field">
              <label for="pf-pub">Publication Boundary</label>
              <select id="pf-pub" name="publication_state">
                <option value="approved_public" ${item.publication_state === 'approved_public' ? 'selected' : ''}>Approved Public (Live Web)</option>
                <option value="private_off_market" ${item.publication_state === 'private_off_market' ? 'selected' : ''}>Private Off-Market Vault Only</option>
                <option value="pending_approval" ${item.publication_state === 'pending_approval' ? 'selected' : ''}>Pending Principal Approval</option>
                <option value="draft" ${item.publication_state === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="archived" ${item.publication_state === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
            </div>
            <div class="field">
              <label for="pf-avail">Availability Status</label>
              <select id="pf-avail" name="availability_state">
                <option value="available" ${item.availability_state === 'available' ? 'selected' : ''}>Available</option>
                <option value="under_offer" ${item.availability_state === 'under_offer' ? 'selected' : ''}>Under Offer</option>
                <option value="sold" ${item.availability_state === 'sold' ? 'selected' : ''}>Sold</option>
                <option value="leased" ${item.availability_state === 'leased' ? 'selected' : ''}>Leased</option>
                <option value="withdrawn" ${item.availability_state === 'withdrawn' ? 'selected' : ''}>Withdrawn</option>
              </select>
            </div>
            <div class="field">
              <label for="pf-tx">Transaction</label>
              <select id="pf-tx" name="transaction_type">
                <option value="Sale" ${/sale/i.test(item.transaction_type) ? 'selected' : ''}>Sale</option>
                <option value="Rent" ${/rent|lease/i.test(item.transaction_type) && !/sale/i.test(item.transaction_type) ? 'selected' : ''}>Rent / Lease</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2" style="margin-top:12px">
            <div class="field">
              <label for="pf-title">Public Listing Title *</label>
              <input id="pf-title" name="listing_title" type="text" required value="${esc(item.listing_title || '')}" placeholder="e.g. DLF The Arbour 4 BHK Luxury Condominium">
            </div>
            <div class="field">
              <label for="pf-project">Project Name</label>
              <input id="pf-project" name="project_name" type="text" value="${esc(item.project_name || '')}" placeholder="e.g. DLF The Arbour">
            </div>
          </div>

          <div class="form-grid-3" style="margin-top:12px">
            <div class="field">
              <label for="pf-locality">Locality</label>
              <input id="pf-locality" name="locality" type="text" value="${esc(item.locality || '')}" placeholder="Golf Course Ext Road">
            </div>
            <div class="field">
              <label for="pf-sector">Sector</label>
              <input id="pf-sector" name="sector" type="text" value="${esc(item.sector || '')}" placeholder="Sector 63">
            </div>
            <div class="field">
              <label for="pf-type">Property Type</label>
              <input id="pf-type" name="property_type" type="text" value="${esc(item.property_type || 'Apartment')}" placeholder="Apartment / Builder Floor / Plot">
            </div>
          </div>

          <div class="form-grid-3" style="margin-top:12px">
            <div class="field">
              <label for="pf-config">Configuration</label>
              <input id="pf-config" name="configuration" type="text" value="${esc(item.configuration || '')}" placeholder="4 BHK + Servant">
            </div>
            <div class="field">
              <label for="pf-area">Area Value</label>
              <input id="pf-area" name="area_value" type="number" step="any" min="0" value="${esc(item.area_value ?? '')}">
            </div>
            <div class="field">
              <label for="pf-aunit">Area Unit</label>
              <input id="pf-aunit" name="area_unit" type="text" value="${esc(item.area_unit || 'Sq Ft')}" placeholder="Sq Ft / Sq Yards / Marla">
            </div>
          </div>

          <div class="form-grid-3" style="margin-top:12px">
            <div class="field">
              <label for="pf-price">Sale Price Value</label>
              <input id="pf-price" name="price_value" type="number" step="any" min="0" value="${esc(item.price_value ?? '')}">
            </div>
            <div class="field">
              <label for="pf-punit">Price Unit</label>
              <input id="pf-punit" name="price_unit" type="text" value="${esc(item.price_unit || 'Cr')}" placeholder="Cr / Lakh / Lakh/sq yd">
            </div>
            <div class="field">
              <label for="pf-ptext">Public Price Label (Optional)</label>
              <input id="pf-ptext" name="price_text" type="text" value="${esc(item.price_text || '')}" placeholder="₹8.75 Cr or Price on Request">
            </div>
          </div>

          <div class="form-grid-2" style="margin-top:12px">
            <div class="field">
              <label for="pf-rent">Monthly Rent (INR, if Rent)</label>
              <input id="pf-rent" name="rent_value" type="number" step="any" min="0" value="${esc(item.rent_value ?? '')}">
            </div>
            <div class="field">
              <label for="pf-facing">Facing / Orientation</label>
              <input id="pf-facing" name="facing" type="text" value="${esc(item.facing || '')}" placeholder="North-East / Park Facing">
            </div>
          </div>

          <div class="field" style="margin-top:12px">
            <label for="pf-feat">Public Key Features (Fiduciary Firewall Scanned — No phones, commissions, or cheque notes)</label>
            <textarea id="pf-feat" name="key_features" rows="2">${esc(item.key_features || '')}</textarea>
          </div>
          <div class="field" style="margin-top:12px">
            <label for="pf-desc">Public Advisory Description</label>
            <textarea id="pf-desc" name="public_description" rows="3">${esc(item.public_description || '')}</textarea>
          </div>
        </div>

        <div id="dtab-priv" hidden>
          <div class="vault-panel">
            <div class="vault-banner">
              <span>CONFIDENTIAL FIDUCIARY VAULT · NEVER EXPORTED TO PUBLIC WEB</span>
              <span>TABLE: property_private</span>
            </div>

            <div class="form-grid-2">
              <div class="field">
                <label for="pv-oname">Owner / Seller Name</label>
                <input id="pv-oname" name="owner_name_cache" type="text" value="${esc(item.owner_name_cache || '')}" placeholder="Direct owner or family office">
              </div>
              <div class="field">
                <label for="pv-ophone">Owner Mobile Number</label>
                <input id="pv-ophone" name="owner_phone_cache" type="text" value="${esc(item.owner_phone_cache || '')}" placeholder="+91 98110 XXXXX">
              </div>
            </div>

            <div class="form-grid-3" style="margin-top:12px">
              <div class="field">
                <label for="pv-bname">Source Channel Broker</label>
                <input id="pv-bname" name="broker_name_cache" type="text" value="${esc(item.broker_name_cache || '')}">
              </div>
              <div class="field">
                <label for="pv-bphone">Broker Mobile</label>
                <input id="pv-bphone" name="broker_phone_cache" type="text" value="${esc(item.broker_phone_cache || '')}">
              </div>
              <div class="field">
                <label for="pv-group">Source Group / Workbook</label>
                <input id="pv-group" name="source_group_name" type="text" value="${esc(item.source_group_name || '')}">
              </div>
            </div>

            <div class="form-grid-3" style="margin-top:12px">
              <div class="field">
                <label for="pv-unit">Exact Tower / Unit / Plot No.</label>
                <input id="pv-unit" name="exact_unit_or_plot_no" type="text" value="${esc(item.exact_unit_or_plot_no || '')}" placeholder="Tower 4, 14B">
              </div>
              <div class="field">
                <label for="pv-floor">Internal Floor / Closer Price (Cr)</label>
                <input id="pv-floor" name="internal_floor_price_cr" type="number" step="any" min="0" value="${esc(floorCr)}" placeholder="e.g. 8.35">
              </div>
              <div class="field">
                <label for="pv-comm">Commission / Mandate Terms</label>
                <input id="pv-comm" name="commission_terms" type="text" value="${esc(item.commission_terms || '')}" placeholder="1% direct / side-by-side">
              </div>
            </div>

            <div class="field" style="margin-top:12px">
              <label for="pv-pay">Payment / Cheque Structure Notes</label>
              <input id="pv-pay" name="payment_structure_notes" type="text" value="${esc(item.payment_structure_notes || '')}">
            </div>

            <div class="field" style="margin-top:12px">
              <label for="pv-notes">Internal Advisor Notes &amp; Encumbrance Checks</label>
              <textarea id="pv-notes" name="internal_advisor_notes" rows="3">${esc(item.internal_advisor_notes || '')}</textarea>
            </div>

            <div class="field" style="margin-top:12px">
              <label for="pv-raw">Original Raw WhatsApp / Broker Message</label>
              <textarea id="pv-raw" name="raw_whatsapp_text" rows="2">${esc(item.raw_whatsapp_text || '')}</textarea>
            </div>
          </div>
        </div>

        <div id="dtab-hist" hidden>
          ${history.length === 0
            ? '<p class="fineprint">No audit events recorded for this property yet.</p>'
            : `<div class="compact-list">${history.map((h) => `
                <div class="compact-item">
                  <div>
                    <strong>${esc(h.action)}</strong>
                    <small>${esc(h.summary || '')} · by ${esc(h.actor_label)}</small>
                  </div>
                  <span class="mono-id">${esc(h.created_at.slice(0, 19).replace('T', ' '))}</span>
                </div>
              `).join('')}</div>`}
        </div>

        <p id="prop-form-error" class="form-error" hidden></p>

        <div class="btn-row" style="padding-top:12px;border-top:1px solid var(--line)">
          <button type="submit" class="btn btn-primary">${isNew ? 'Create Master Mandate' : 'Save Mandate & Vault'}</button>
          ${!isNew ? `<button type="button" class="btn btn-secondary" data-reverify-prop="${esc(item.property_id)}">Mark Re-verified Today ✓</button>` : ''}
        </div>
      </form>
      `
    );

    drawerBody.querySelectorAll('[data-dtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        drawerBody.querySelectorAll('[data-dtab]').forEach((b) => b.classList.toggle('active', b === btn));
        ['pub', 'priv', 'hist'].forEach((k) => {
          const panel = drawerBody.querySelector(`#dtab-${k}`);
          if (panel) panel.hidden = k !== btn.dataset.dtab;
        });
      });
    });

    drawerBody.querySelector('#prop-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = drawerBody.querySelector('#prop-form-error');
      errEl.hidden = true;
      const f = new FormData(e.currentTarget);

      const floorVal = f.get('internal_floor_price_cr');
      const payload = {
        public: {
          publication_state: f.get('publication_state'),
          availability_state: f.get('availability_state'),
          transaction_type: f.get('transaction_type'),
          listing_title: f.get('listing_title'),
          project_name: f.get('project_name'),
          locality: f.get('locality'),
          sector: f.get('sector'),
          property_type: f.get('property_type'),
          configuration: f.get('configuration'),
          area_value: f.get('area_value'),
          area_unit: f.get('area_unit'),
          price_value: f.get('price_value'),
          price_unit: f.get('price_unit'),
          price_text: f.get('price_text'),
          rent_value: f.get('rent_value'),
          facing: f.get('facing'),
          key_features: f.get('key_features'),
          public_description: f.get('public_description')
        },
        private: {
          owner_name_cache: f.get('owner_name_cache'),
          owner_phone_cache: f.get('owner_phone_cache'),
          broker_name_cache: f.get('broker_name_cache'),
          broker_phone_cache: f.get('broker_phone_cache'),
          source_group_name: f.get('source_group_name'),
          exact_unit_or_plot_no: f.get('exact_unit_or_plot_no'),
          internal_floor_price_inr: floorVal ? Math.round(Number(floorVal) * 1e7) : null,
          commission_terms: f.get('commission_terms'),
          payment_structure_notes: f.get('payment_structure_notes'),
          internal_advisor_notes: f.get('internal_advisor_notes'),
          raw_whatsapp_text: f.get('raw_whatsapp_text')
        }
      };

      try {
        const res = await api(
          isNew ? '/api/crm/properties' : `/api/crm/properties/${encodeURIComponent(propertyId)}`,
          { method: isNew ? 'POST' : 'PUT', body: payload }
        );
        closeDrawer();
        showToast(`Saved ${res.item.property_id} (${res.item.listing_title}).`);
        if (state.activeTab === 'inventory') loadInventory();
        else loadOverview();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  // ==========================================================================
  // TAB 3: INTAKE STUDIO (WHATSAPP PARSER & EXCEL/CSV IMPORTER)
  // ==========================================================================
  document.getElementById('wa-load-sample').addEventListener('click', () => {
    document.getElementById('wa-raw').value =
      'DLF The Belaire Sec 54 | 4BHK + Servant 3065 sqft | Higher floor Tower D 172 | North East Aravalli facing | 2 car parkings | Semi-furnished | Asking 9.25 Cr closer 8.80 Cr | 75% cheque | 1% side by side brokerage | Keys with Rohit Malhotra 98110 45678';
  });

  async function runWhatsAppIntake(commit) {
    const rawText = document.getElementById('wa-raw').value.trim();
    const sourceGroup = document.getElementById('wa-source').value.trim();
    const box = document.getElementById('wa-preview-box');
    if (!rawText) {
      alert('Paste a WhatsApp broadcast message first.');
      return;
    }

    try {
      const data = await api('/api/crm/intake/whatsapp', {
        method: 'POST',
        body: { rawText, sourceGroup, commit }
      });

      if (commit) {
        showToast(`Staged ${data.item.property_id} (${data.item.listing_title}) in Pending Approval Queue.`);
        document.getElementById('wa-raw').value = '';
        box.hidden = true;
        switchTab('overview');
        return;
      }

      const d = data.publicDraft;
      const pv = data.privateVault;
      box.hidden = false;
      box.innerHTML = `
        <div class="two-col-grid">
          <div style="border:1px solid #b9dfc6;background:var(--ok-bg);padding:14px">
            <span class="eyebrow" style="color:var(--ok-ink)">PASS 1 · SANITIZED PUBLIC DRAFT</span>
            <strong>${esc(d.listing_title)}</strong>
            <p class="fineprint" style="margin:6px 0">
              Corridor: ${esc(d.corridor)} · ${esc(d.sector || 'Gurugram')}<br>
              Type: ${esc(d.property_type)} (${esc(d.transaction_type)})<br>
              Area: ${esc(d.area_value ? `${d.area_value} ${d.area_unit}` : 'To confirm')}<br>
              Public Price: <strong>${esc(d.price_text || (d.rent_value ? `₹${d.rent_value}/mo` : 'Price on Request'))}</strong><br>
              Features: ${esc(d.key_features || '—')}
            </p>
          </div>
          <div class="vault-panel" style="margin:0">
            <span class="eyebrow" style="color:var(--vault-ink)">PASS 2 · QUARANTINED TO PRIVATE VAULT</span>
            <p class="fineprint" style="margin:6px 0;color:var(--vault-ink)">
              Contact/Broker: <strong>${esc(pv.broker_name_cache || '—')}</strong><br>
              Phone Quarantined: <strong>${esc(pv.broker_phone_cache || 'None')}</strong><br>
              Exact Unit #: <strong>${esc(pv.exact_unit_or_plot_no || '—')}</strong><br>
              Floor/Closer Price: <strong>${esc(data.quarantineSummary.floorPriceQuarantined || '—')}</strong><br>
              Commission: <strong>${esc(pv.commission_terms || '—')}</strong><br>
              Payment Note: <strong>${esc(pv.payment_structure_notes || '—')}</strong>
            </p>
          </div>
        </div>
      `;
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('wa-preview-btn').addEventListener('click', () => runWhatsAppIntake(false));
  document.getElementById('wa-commit-btn').addEventListener('click', () => runWhatsAppIntake(true));

  function readFilePayload(file) {
    return new Promise((resolve, reject) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const reader = new FileReader();
      if (ext === 'xlsx') {
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          resolve({ format: 'xlsx', contentBase64: btoa(binary) });
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => resolve({ format: ext, text: String(reader.result) });
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  }

  document.getElementById('import-dryrun-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    if (!file) {
      alert('Choose an .xlsx, .csv, .tsv, or .json file first.');
      return;
    }
    const box = document.getElementById('import-preview-box');
    const commitBtn = document.getElementById('import-commit-btn');
    try {
      const payload = await readFilePayload(file);
      state.lastImportPayload = payload;
      const res = await api('/api/crm/intake/import', {
        method: 'POST',
        body: { ...payload, dryRun: true }
      });
      const s = res.summary;
      commitBtn.disabled = s.validRecords === 0;
      box.hidden = false;
      box.innerHTML = `
        <strong>Dry-Run Complete: ${s.validRecords} valid records parsed</strong>
        <p class="fineprint" style="margin:6px 0">
          New mandates: <strong>${s.newCount}</strong> · Existing updates: <strong>${s.updateCount}</strong> · Records with Private Fiduciary Vault fields: <strong>${s.privateVaultPopulated}</strong>
        </p>
        ${s.issues.length ? `<div class="form-error" style="margin-top:8px">${esc(s.issues.slice(0, 6).join('\n'))}</div>` : '<p class="fineprint" style="color:var(--ok-ink)">Zero schema errors. Ready to commit.</p>'}
      `;
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('import-commit-btn').addEventListener('click', async () => {
    if (!state.lastImportPayload) return;
    const commitBtn = document.getElementById('import-commit-btn');
    commitBtn.disabled = true;
    try {
      const res = await api('/api/crm/intake/import', {
        method: 'POST',
        body: { ...state.lastImportPayload, dryRun: false }
      });
      showToast(`Imported ${res.summary.validRecords} records into Master Database (${res.summary.newCount} new, ${res.summary.updateCount} updated).`);
      state.lastImportPayload = null;
      switchTab('inventory');
    } catch (err) {
      alert(err.message);
      commitBtn.disabled = false;
    }
  });

  // ==========================================================================
  // TAB 4: LEADS, DEAL PIPELINE & BUYER AUTO-MATCHER
  // ==========================================================================
  async function loadLeads() {
    const pillsEl = document.getElementById('lead-stage-pills');
    const stages = ['all', ...Object.keys(STAGE_LABELS)];
    pillsEl.innerHTML = stages.map((st) => `
      <button type="button" class="stage-pill-btn ${state.leadStageFilter === st ? 'active' : ''}" data-lead-stage="${st}">
        ${esc(st === 'all' ? 'All Stages' : STAGE_LABELS[st])}
      </button>
    `).join('');
    pillsEl.querySelectorAll('[data-lead-stage]').forEach((b) => {
      b.onclick = () => {
        state.leadStageFilter = b.dataset.leadStage;
        loadLeads();
      };
    });

    const data = await api(`/api/crm/leads?stage=${encodeURIComponent(state.leadStageFilter)}`);
    const tbody = document.getElementById('leads-tbody');
    if (!data.items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="fineprint">No leads in this pipeline stage.</td></tr>';
      return;
    }

    tbody.innerHTML = data.items.map((l) => `
      <tr class="clickable-row" data-open-lead="${esc(l.lead_id)}">
        <td class="mono-id">${esc(l.lead_id)}</td>
        <td>
          <strong>${esc(l.client_name)}</strong>
          <div class="fineprint">${esc(l.client_phone || l.client_email || 'No phone supplied')}</div>
        </td>
        <td>
          <strong>${esc(l.intent)} · ${esc(l.preferred_location || 'Gurugram')}</strong>
          <div class="fineprint">${esc((l.inquiry_message || l.primary_property_title || '').slice(0, 85))}</div>
        </td>
        <td>${esc(l.budget_text || '—')}</td>
        <td><span class="pill ${l.stage === 'new_inquiry' ? 'pill-pending' : 'pill-public'}">${esc(STAGE_LABELS[l.stage] || l.stage)}</span></td>
        <td><span class="fineprint">${esc(l.source_channel)}</span></td>
      </tr>
    `).join('');
  }

  document.getElementById('new-lead-btn').addEventListener('click', () => {
    openDrawer(
      'NEW CLIENT BRIEF',
      'Register Buyer / Advisory Lead',
      `
      <form id="new-lead-form" class="stack-form">
        <div class="form-grid-2">
          <div class="field">
            <label for="nl-name">Client Name *</label>
            <input id="nl-name" name="client_name" type="text" required placeholder="e.g. Rohan & Priya Kapoor">
          </div>
          <div class="field">
            <label for="nl-phone">Mobile / WhatsApp</label>
            <input id="nl-phone" name="client_phone" type="text" placeholder="+91 98111 XXXXX">
          </div>
        </div>
        <div class="form-grid-3">
          <div class="field">
            <label for="nl-intent">Intent</label>
            <select id="nl-intent" name="intent">
              <option>Buy</option>
              <option>Rent</option>
            </select>
          </div>
          <div class="field">
            <label for="nl-corridor">Primary Target Corridor</label>
            <select id="nl-corridor" name="preferred_location">
              ${CORRIDOR_OPTIONS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="nl-maxcr">Max Budget (Cr, for Auto-Match)</label>
            <input id="nl-maxcr" name="max_cr" type="number" step="any" min="0" placeholder="e.g. 12">
          </div>
        </div>
        <div class="field">
          <label for="nl-msg">Advisory Brief &amp; Non-Negotiables</label>
          <textarea id="nl-msg" name="inquiry_message" rows="3" placeholder="Configuration, possession timeline, commute, facing..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Create Lead &amp; Run Auto-Matcher →</button>
      </form>
      `
    );

    drawerBody.querySelector('#new-lead-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const maxCr = Number(f.get('max_cr'));
      const loc = f.get('preferred_location');
      const created = await api('/api/crm/leads', {
        method: 'POST',
        body: {
          client_name: f.get('client_name'),
          client_phone: f.get('client_phone'),
          intent: f.get('intent'),
          preferred_location: loc,
          corridors: loc ? [loc] : [],
          budget_text: maxCr > 0 ? `Up to ₹${maxCr} Cr` : null,
          max_budget_inr: maxCr > 0 ? Math.round(maxCr * 1e7) : null,
          inquiry_message: f.get('inquiry_message')
        }
      });
      loadLeads();
      openLeadDrawer(created.item.lead_id);
    });
  });

  async function openLeadDrawer(leadId) {
    const data = await api(`/api/crm/leads/${encodeURIComponent(leadId)}`);
    const l = data.lead;
    const req = data.requirement || {};
    const reqCorridors = JSON.parse(req.corridors_json || '[]');
    const reqCats = JSON.parse(req.categories_json || '[]');
    const minCr = req.min_budget_inr ? (req.min_budget_inr / 1e7) : '';
    const maxCr = req.max_budget_inr ? (req.max_budget_inr / 1e7) : '';

    openDrawer(
      `DEAL PIPELINE · ${l.lead_id}`,
      l.client_name,
      `
      <div class="form-grid-3" style="padding-bottom:14px;border-bottom:1px solid var(--line)">
        <div class="field">
          <label for="ld-stage">Pipeline Stage</label>
          <select id="ld-stage">
            ${Object.entries(STAGE_LABELS).map(([k, v]) => `<option value="${k}" ${l.stage === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Client Contact</label>
          <div>
            <strong>${esc(l.client_phone || 'No phone')}</strong>
            ${l.client_phone ? ` · <a class="btn-link" href="https://wa.me/${esc(l.client_phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}
          </div>
        </div>
        <div class="field">
          <label>Inbound Context</label>
          <div class="fineprint">${esc(l.source_channel)} (${esc(l.source_page || 'desk')})</div>
        </div>
      </div>

      ${l.inquiry_message ? `<p style="background:var(--canvas);padding:10px 12px;border-left:3px solid var(--ink);margin:14px 0;font-size:13px">${esc(l.inquiry_message)}</p>` : ''}

      ${l.selected_questions?.length ? `
        <div style="margin:10px 0">
          <span class="eyebrow">BUYER DUE-DILIGENCE QUESTIONS SELECTED ON WEBSITE</span>
          <ul style="margin:4px 0 0 18px;padding:0;font-size:12.5px;color:var(--muted)">
            ${l.selected_questions.map((q) => `<li>${esc(q)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <details style="margin:14px 0;border:1px solid var(--line);padding:12px 14px" ${!data.matches.length ? 'open' : ''}>
        <summary style="font-weight:600;cursor:pointer">Structured Buyer Requirement &amp; Auto-Match Criteria</summary>
        <form id="req-form" class="stack-form" style="margin-top:12px">
          <div class="field">
            <label>Target Corridors</label>
            <div class="filter-row">
              ${CORRIDOR_OPTIONS.map((c) => `
                <label class="checkbox-pill">
                  <input type="checkbox" name="corridor" value="${esc(c)}" ${reqCorridors.includes(c) ? 'checked' : ''}>
                  <span>${esc(c)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="field">
            <label>Asset Categories</label>
            <div class="filter-row">
              ${CATEGORY_OPTIONS.map(([val, label]) => `
                <label class="checkbox-pill">
                  <input type="checkbox" name="category" value="${val}" ${reqCats.includes(val) ? 'checked' : ''}>
                  <span>${esc(label)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="form-grid-3">
            <div class="field">
              <label for="rq-mincr">Min Budget (Cr)</label>
              <input id="rq-mincr" name="min_cr" type="number" step="any" min="0" value="${esc(minCr)}">
            </div>
            <div class="field">
              <label for="rq-maxcr">Max Budget (Cr)</label>
              <input id="rq-maxcr" name="max_cr" type="number" step="any" min="0" value="${esc(maxCr)}">
            </div>
            <div class="field">
              <label for="rq-beds">Min Bedrooms (BHK)</label>
              <input id="rq-beds" name="min_bedrooms" type="number" min="1" max="8" value="${esc(req.min_bedrooms ?? '')}">
            </div>
          </div>
          <label class="checkbox-pill" style="width:fit-content">
            <input type="checkbox" name="include_off_market" ${req.include_off_market !== 0 ? 'checked' : ''}>
            <span>Include Private Off-Market Vault Mandates (Owner/Broker details remain stripped from client links)</span>
          </label>
          <button type="submit" class="btn btn-secondary" style="width:fit-content">Update Brief &amp; Re-score Inventory</button>
        </form>
      </details>

      <div style="margin:18px 0">
        <div class="label-row" style="margin-bottom:10px">
          <div>
            <span class="eyebrow">AUTO-MATCHED INVENTORY (PUBLIC + OFF-MARKET VAULT)</span>
            <h3>${data.matches.length} Ranked Property Matches</h3>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="create-shortlist-btn">Generate Shareable Client Shortlist →</button>
        </div>

        <div id="shortlist-share-result"></div>

        <div id="lead-matches-list">
          ${data.matches.length === 0
            ? '<p class="fineprint">Adjust requirement corridors, categories, or budget above to discover matching mandates.</p>'
            : data.matches.slice(0, 12).map((m, idx) => `
              <label class="match-card">
                <input type="checkbox" name="sl-prop" value="${esc(m.property_id)}" ${idx < 3 ? 'checked' : ''} style="margin-top:4px">
                <div>
                  <strong>${esc(m.listing_title)}</strong>
                  <div class="fineprint">${esc(m.property_id)} · ${esc(m.corridor)}${m.sector ? ` · ${esc(m.sector)}` : ''} · <strong>${esc(m.display_price)}</strong></div>
                  <div class="fineprint" style="color:var(--ok-ink);margin-top:3px">${esc(m.match_reasons.join(' · '))}</div>
                </div>
                <div style="text-align:right">
                  <span class="match-score">${m.match_score}/100</span>
                  <div style="margin-top:4px">${pubBadge(m.publication_state)}</div>
                </div>
              </label>
            `).join('')}
        </div>
      </div>

      <div style="padding-top:16px;border-top:1px solid var(--line)">
        <span class="eyebrow">ADVISORY ACTIVITY TIMELINE</span>
        <form id="act-form" class="btn-row" style="margin:8px 0 14px">
          <select name="activity_type" style="width:150px">
            <option value="phone_call">Phone Call</option>
            <option value="whatsapp_out">WhatsApp Note</option>
            <option value="site_visit">Site Visit</option>
            <option value="note">Internal Note</option>
          </select>
          <input name="summary" type="text" required placeholder="Log call outcome, viewing feedback, or next step..." style="flex:1">
          <button type="submit" class="btn btn-secondary">Log Activity</button>
        </form>
        <div class="compact-list">
          ${(data.activities || []).map((a) => `
            <div class="compact-item">
              <div>
                <strong>${esc(a.activity_type.replace(/_/g, ' '))}</strong>
                <small>${esc(a.summary)}</small>
              </div>
              <span class="mono-id">${esc(a.created_at.slice(0, 16).replace('T', ' '))}</span>
            </div>
          `).join('')}
        </div>
      </div>
      `
    );

    drawerBody.querySelector('#ld-stage').addEventListener('change', async (e) => {
      await api(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        body: { stage: e.currentTarget.value }
      });
      showToast(`Moved ${l.client_name} to "${STAGE_LABELS[e.currentTarget.value]}".`);
      if (state.activeTab === 'leads') loadLeads();
    });

    drawerBody.querySelector('#req-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const corridors = [...form.querySelectorAll('input[name="corridor"]:checked')].map((el) => el.value);
      const categories = [...form.querySelectorAll('input[name="category"]:checked')].map((el) => el.value);
      const minV = Number(form.elements.min_cr.value);
      const maxV = Number(form.elements.max_cr.value);
      await api(`/api/crm/leads/${encodeURIComponent(leadId)}/requirement`, {
        method: 'PUT',
        body: {
          intent: l.intent,
          corridors,
          categories,
          min_budget_inr: minV > 0 ? Math.round(minV * 1e7) : null,
          max_budget_inr: maxV > 0 ? Math.round(maxV * 1e7) : null,
          min_bedrooms: form.elements.min_bedrooms.value || null,
          include_off_market: form.elements.include_off_market.checked
        }
      });
      openLeadDrawer(leadId);
    });

    drawerBody.querySelector('#create-shortlist-btn').addEventListener('click', async () => {
      const checked = [...drawerBody.querySelectorAll('input[name="sl-prop"]:checked')].map((el) => el.value);
      if (!checked.length) {
        alert('Tick at least one matched property to include in the client shortlist.');
        return;
      }
      const res = await api('/api/crm/shortlists', {
        method: 'POST',
        body: {
          lead_id: leadId,
          client_name: l.client_name,
          title: `AUM ESTATES — Curated Shortlist for ${l.client_name}`,
          property_ids: checked
        }
      });
      const waMsg = `Hello ${l.client_name}, I have prepared a curated property dossier based on your requirements (${checked.length} options): ${res.share_url}`;
      const phoneDigits = (l.client_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits || ''}?text=${encodeURIComponent(waMsg)}`;

      drawerBody.querySelector('#shortlist-share-result').innerHTML = `
        <div class="share-box">
          <strong>Private Client Shortlist Ready (Fiduciary-Sanitized)</strong>
          <div class="fineprint" style="margin:4px 0 8px">URL: <code>${esc(res.share_url)}</code></div>
          <div class="btn-row">
            <a class="btn btn-primary btn-sm" href="${esc(res.share_url)}" target="_blank" rel="noopener">Open Client Dossier ↗</a>
            <a class="btn btn-secondary btn-sm" href="${esc(waUrl)}" target="_blank" rel="noopener">Send via WhatsApp ↗</a>
          </div>
        </div>
      `;
      if (state.activeTab === 'leads') loadLeads();
    });

    drawerBody.querySelector('#act-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api(`/api/crm/leads/${encodeURIComponent(leadId)}/activities`, {
        method: 'POST',
        body: { activity_type: f.get('activity_type'), summary: f.get('summary') }
      });
      openLeadDrawer(leadId);
    });
  }

  // ==========================================================================
  // TAB 5: CONTACTS VAULT
  // ==========================================================================
  async function loadContacts() {
    const q = document.getElementById('cnt-q').value.trim();
    const type = document.getElementById('cnt-type').value;
    const data = await api(`/api/crm/contacts?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
    const tbody = document.getElementById('contacts-tbody');
    if (!data.items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="fineprint">No contacts found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.items.map((c) => `
      <tr>
        <td class="mono-id">${esc(c.contact_id)}</td>
        <td>
          <strong>${esc(c.full_name)}</strong>
          ${c.firm_or_syndicate ? `<div class="fineprint">${esc(c.firm_or_syndicate)}</div>` : ''}
        </td>
        <td><span class="pill pill-vault">${esc(c.contact_type.replace(/_/g, ' '))}</span></td>
        <td>
          <div>${esc(c.phone_primary || '—')}</div>
          ${c.email ? `<div class="fineprint">${esc(c.email)}</div>` : ''}
        </td>
        <td>${c.linked_properties || 0}</td>
        <td>${c.linked_leads || 0}</td>
      </tr>
    `).join('');
  }

  document.getElementById('cnt-q').addEventListener('input', loadContacts);
  document.getElementById('cnt-type').addEventListener('change', loadContacts);
  document.getElementById('new-contact-btn').addEventListener('click', () => {
    openDrawer(
      'RELATIONSHIP DIRECTORY',
      'Add Contact to Fiduciary Vault',
      `
      <form id="new-cnt-form" class="stack-form">
        <div class="form-grid-2">
          <div class="field">
            <label for="nc-name">Full Name *</label>
            <input id="nc-name" name="full_name" type="text" required>
          </div>
          <div class="field">
            <label for="nc-type">Role</label>
            <select id="nc-type" name="contact_type">
              <option value="buyer">Buyer / Investor</option>
              <option value="seller_owner">Property Owner / Seller</option>
              <option value="channel_broker">Channel Partner Broker</option>
              <option value="family_office">Family Office</option>
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="field">
            <label for="nc-firm">Firm / Syndicate / Office</label>
            <input id="nc-firm" name="firm_or_syndicate" type="text">
          </div>
          <div class="field">
            <label for="nc-phone">Primary Phone</label>
            <input id="nc-phone" name="phone_primary" type="text" placeholder="+91 98110 XXXXX">
          </div>
        </div>
        <div class="field">
          <label for="nc-email">Email</label>
          <input id="nc-email" name="email" type="email">
        </div>
        <div class="field">
          <label for="nc-notes">Confidential Relationship Notes</label>
          <textarea id="nc-notes" name="private_notes" rows="3"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Save Contact</button>
      </form>
      `
    );

    drawerBody.querySelector('#new-cnt-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api('/api/crm/contacts', {
        method: 'POST',
        body: Object.fromEntries(f.entries())
      });
      closeDrawer();
      showToast('Contact saved to Fiduciary Directory.');
      loadContacts();
    });
  });

  // ==========================================================================
  // TAB 6: STATIC PUBLISHER & AUDIT TRAIL
  // ==========================================================================
  async function runStaticPublish() {
    const btn = document.getElementById('publish-run-btn');
    const box = document.getElementById('publish-result-box');
    btn.disabled = true;
    try {
      const res = await api('/api/crm/publish', { method: 'POST', body: {} });
      const rel = res.release;
      box.hidden = false;
      box.innerHTML = `
        <span class="eyebrow" style="color:var(--ok-ink)">RELEASE VERIFIED &amp; ATOMICALLY WRITTEN</span>
        <h2>Release ${esc(rel.releaseId)}</h2>
        <p class="fineprint" style="margin:6px 0 12px">
          Compiled <strong>${rel.counts.publicProperties}</strong> approved public properties,
          <strong>${rel.counts.publicProjects}</strong> public projects, and
          <strong>${rel.counts.featuredCards}</strong> reconciled featured cards across
          <strong>${rel.writtenTargets.length}</strong> synchronized frontend targets.
        </p>
        <div class="mono-id">SHA-256 (public_inventory.js): ${esc(rel.hashes['public_inventory.js'])}</div>
      `;
      showToast(`Synchronized ${rel.counts.publicProperties} public mandates across all static frontends.`);
      loadAuditLogs();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('publish-run-btn').addEventListener('click', runStaticPublish);

  async function loadAuditLogs() {
    const data = await api('/api/crm/audit-logs');
    document.getElementById('audit-tbody').innerHTML = data.items.map((a) => `
      <tr>
        <td class="mono-id">${esc(a.created_at.slice(0, 19).replace('T', ' '))}</td>
        <td>${esc(a.actor_label)}</td>
        <td class="mono-id">${esc(a.entity_type)}:${esc(a.entity_id)}</td>
        <td><span class="pill pill-muted">${esc(a.action)}</span></td>
        <td>${esc(a.summary || '')}</td>
      </tr>
    `).join('');
  }

  // Bootstrap Session Check
  (async function init() {
    try {
      const sess = await api('/api/crm/auth/session');
      if (sess.authenticated) {
        state.user = sess.user;
        state.csrfToken = sess.csrfToken;
        showAppShell();
      } else {
        showAuthScreen();
      }
    } catch {
      showAuthScreen();
    }
  })();
})();
