(function () {
  'use strict';
  async function refresh() {
    const s = await globalThis.ScopePingLicense.getLicenseStatus();
    const b = document.getElementById('badge');
    b.className = 'badge ' + (s.isPro ? 'pro' : 'free');
    b.textContent = s.isPro ? 'Pro' : 'Free';
  }
  document.getElementById('options-btn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  refresh();
})();
