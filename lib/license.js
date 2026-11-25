// ScopePing - License verification via Paddle.
// Privacy: no message content ever leaves the device. Only api.paddle.com is contacted.
(function () {
  'use strict';

  const VERIFY_URL = 'https://api.paddle.com/licenses/verify';
  const FLAG_KEY = 'licensed';
  const DETAIL_KEY = 'scopeping_license_detail';

  async function verifyLicense(key) {
    if (!key || typeof key !== 'string' || !key.trim()) {
      return { ok: false, status: 'invalid' };
    }
    let resp;
    try {
      resp = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: key.trim() })
      });
    } catch (_e) {
      return { ok: false, status: 'invalid', data: { error: 'network' } };
    }
    if (!resp.ok) return { ok: false, status: 'invalid', data: { httpStatus: resp.status } };
    let json;
    try { json = await resp.json(); }
    catch (_e) { return { ok: false, status: 'invalid', data: { error: 'parse' } }; }
    const s = json && json.data && json.data.status;
    if (s === 'active') return { ok: true, status: 'active', data: json.data };
    if (s === 'expired') return { ok: false, status: 'expired', data: json.data };
    return { ok: false, status: 'invalid', data: json };
  }

  async function getLicenseStatus() {
    const got = await chrome.storage.local.get([FLAG_KEY, DETAIL_KEY]);
    const d = got[DETAIL_KEY] || {};
    return {
      isPro: got[FLAG_KEY] === true,
      licenseKey: d.licenseKey || null,
      activatedAt: d.activatedAt || null,
      expiresAt: d.expiresAt || null
    };
  }

  async function activateLicense(key) {
    const res = await verifyLicense(key);
    if (!res.ok) return res;
    const detail = {
      licenseKey: key.trim(),
      activatedAt: new Date().toISOString(),
      expiresAt: res.data && res.data.expires_at ? res.data.expires_at : null
    };
    await chrome.storage.local.set({ [FLAG_KEY]: true, [DETAIL_KEY]: detail });
    return { ok: true, status: 'active', data: detail };
  }

  async function deactivateLicense() {
    await chrome.storage.local.remove([FLAG_KEY, DETAIL_KEY]);
    return { isPro: false };
  }

  globalThis.ScopePingLicense = {
    verifyLicense, getLicenseStatus, activateLicense, deactivateLicense,
    FLAG_KEY, DETAIL_KEY
  };
})();
