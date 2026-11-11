/* AUM ESTATES / Study 06 — switch between the working sketchbook and
 * the customer-facing composition without losing architecture/theme state.
 */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const control = document.getElementById('previewModeToggle');
    const key = 'aum-estates-presentation-study-06';
    const params = new URLSearchParams(location.search);
    let stored = null;
    try { stored = localStorage.getItem(key); } catch { /* Optional persistence. */ }
    let preview = params.has('presentation')
      ? params.get('presentation') === '1'
      : stored === 'preview';

    function apply(updateUrl = true) {
      root.dataset.presentation = preview ? 'preview' : 'study';
      control.setAttribute('aria-pressed', String(preview));
      control.setAttribute('aria-label', preview
        ? 'Return to architectural design study controls'
        : 'Show the concept as a visitor would see it');
      if(preview) {
        const panel = document.getElementById('studyPanel');
        panel.hidden = true;
        document.getElementById('studyToggle').setAttribute('aria-expanded','false');
      }
      try { localStorage.setItem(key, preview ? 'preview' : 'study'); } catch { /* Controls remain functional. */ }
      if(updateUrl) {
        try {
          const url = new URL(location.href);
          if(preview) url.searchParams.set('presentation','1');
          else url.searchParams.delete('presentation');
          history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
        } catch (e) {
          /* Fallback for file:// or restricted iframe sandbox */
        }
      }
    }

    control.addEventListener('click', () => {
      preview = !preview;
      apply();
    });
    apply();
  });
})();
