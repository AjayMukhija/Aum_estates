(function () {
  'use strict';
  const pending = new Map();
  const newKey = () => window.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function notice(ok) {
    let el = document.getElementById('aum-enquiry-status');
    if (!el) {
      el = document.createElement('p');
      el.id = 'aum-enquiry-status';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;max-width:520px;margin:auto;padding:14px;background:#fff;color:#171717;border:1px solid #777;z-index:9999;font:14px/1.5 sans-serif;box-shadow:0 2px 12px #0003';
      document.body.append(el);
    }
    el.textContent = ok ? 'Enquiry recorded with the advisory desk. You can also send your message on WhatsApp.' : 'Desk recording is unavailable. Please send your WhatsApp message or call the advisory desk.';
    setTimeout(() => el.remove(), 10000);
  }

  // Return a durable acknowledgement; retry transient failures using the SAME
  // idempotency key, so an uncertain response cannot create a second lead.
  window.AUM_CAPTURE_INQUIRY = function (body) {
    const fingerprint = JSON.stringify(body);
    const previous = pending.get(fingerprint);
    if (previous && Date.now() - previous.at < 30000) return previous.promise;
    const payload = { ...body, idempotency_key: body.idempotency_key || newKey() };
    const promise = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('/api/public/inquiries', {
            method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
          });
          const data = await response.json().catch(() => null);
          if (response.ok && data?.ok && data.lead_id) return data;
          if (response.status < 500 && response.status !== 429) throw Object.assign(new Error('Enquiry was not recorded'), { permanent: true });
        } catch (err) {
          if (err.permanent || attempt === 2) throw err;
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      throw new Error('Advisory desk unavailable');
    })();
    pending.set(fingerprint, { at: Date.now(), promise });
    if (pending.size > 100) pending.delete(pending.keys().next().value);
    return promise;
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-featured-inquiry]');
    if (link) window.AUM_CRM_HOOK({ action: 'inquire_whatsapp', property_id: link.dataset.featuredInquiry, source: 'featured_property' });
  });

  window.AUM_CRM_HOOK = function (actionOrPayload, maybePayload) {
    const payload = typeof actionOrPayload === 'string' ? { action: actionOrPayload, ...maybePayload } : { ...actionOrPayload };
    payload.timestamp ||= new Date().toISOString();
    try { window._AUM_CRM_LISTENER?.(payload); } catch (err) { console.error('CRM listener failed', err); }
    window.dispatchEvent(new CustomEvent('aum:lead', { detail: payload }));
    if (!['inquire_whatsapp', 'register_mandate', 'advisor_inquiry'].includes(payload.action)) return Promise.resolve(null);
    const request = window.AUM_CAPTURE_INQUIRY({
      client_name: payload.name || payload.client_name || 'Website Visitor',
      client_phone: payload.phone || payload.client_phone || null,
      preferred_location: payload.corridor || payload.location || 'Gurugram',
      budget_text: payload.budget || payload.price || null,
      property_id: payload.property_id || null,
      source_channel: payload.action, source_page: payload.source || location.pathname,
      message: payload.notes || (payload.title ? `Inquiry regarding ${payload.title}` : null)
    });
    // The hook is also used by external-link clicks, which do not await it.
    request.then(() => notice(true), () => notice(false));
    return request;
  };
})();
