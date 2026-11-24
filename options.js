(function () {
  'use strict';
  const CHECKOUT_URL = 'https://your-domain.example/checkout/'; // سيتم تحديثه لاحقاً
  const $ = (id) => document.getElementById(id);

  async function refresh() {
    const s = await globalThis.ScopePingLicense.getLicenseStatus();
    const box = $('status-box');
    box.className = 'status';
    if (s.isPro) {
      box.classList.add('pro');
      box.textContent = 'Pro Activated' + (s.expiresAt ? ' (Expires: ' + s.expiresAt + ')' : '');
      $('deactivate-btn').hidden = false;
      $('activate-btn').disabled = true;
      $('license-input').value = s.licenseKey || '';
      $('license-input').disabled = true;
    } else {
      box.classList.add('free');
      box.textContent = 'Free Version';
      $('deactivate-btn').hidden = true;
      $('activate-btn').disabled = false;
      $('license-input').disabled = false;
      $('license-input').value = '';
    }
  }

  function msg(t, isErr) {
    const el = $('message-box');
    el.textContent = t;
    el.style.color = isErr ? '#dc2626' : '#059669';
  }

  $('activate-btn').addEventListener('click', async () => {
    const key = $('license-input').value.trim();
    if (!key) { msg('Please enter a license key.', true); return; }
    $('activate-btn').disabled = true;
    msg('Verifying with Paddle...', false);
    try {
      const r = await globalThis.ScopePingLicense.activateLicense(key);
      if (r.ok) { msg('License activated successfully!', false); await refresh(); }
      else if (r.status === 'expired') { msg('This license has expired.', true); $('activate-btn').disabled = false; }
      else { msg('Invalid license key.', true); $('activate-btn').disabled = false; }
    } catch (_e) {
      msg('Network error. Please try again.', true);
      $('activate-btn').disabled = false;
    }
  });

  $('deactivate-btn').addEventListener('click', async () => {
    await globalThis.ScopePingLicense.deactivateLicense();
    msg('License removed.', false);
    await refresh();
  });

  $('upgrade-btn').addEventListener('click', () => window.open(CHECKOUT_URL, '_blank'));
  refresh();
})();