const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadModule(fetchImpl, storage) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'lib', 'license.js'), 'utf8');
  const sandbox = { globalThis: {}, fetch: fetchImpl, chrome: { storage: { local: storage } } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.globalThis.ScopePingLicense;
}
function makeStorage(init) {
  const data = Object.assign({}, init);
  return {
    get: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of arr) if (k in data) out[k] = data[k];
      return out;
    },
    set: async (obj) => { Object.assign(data, obj); },
    remove: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete data[k];
    },
    _data: data
  };
}

test('verifyLicense invalid on empty', async () => {
  const lic = loadModule(async () => { throw new Error('no call'); }, makeStorage({}));
  const r = await lic.verifyLicense('');
  assert.equal(r.ok, false);
  assert.equal(r.status, 'invalid');
});

test('verifyLicense active on 200 active', async () => {
  const f = async () => ({ ok: true, json: async () => ({ data: { status: 'active', expires_at: '2030-01-01T00:00:00Z' } }) });
  const lic = loadModule(f, makeStorage({}));
  const r = await lic.verifyLicense('SCP-TEST-TEST-TEST');
  assert.equal(r.ok, true);
  assert.equal(r.status, 'active');
});

test('verifyLicense expired on 200 expired', async () => {
  const f = async () => ({ ok: true, json: async () => ({ data: { status: 'expired' } }) });
  const lic = loadModule(f, makeStorage({}));
  const r = await lic.verifyLicense('SCP-TEST-TEST-TEST');
  assert.equal(r.ok, false);
  assert.equal(r.status, 'expired');
});

test('activateLicense on network error does not mutate storage', async () => {
  const f = async () => { throw new Error('down'); };
  const st = makeStorage({});
  const lic = loadModule(f, st);
  const r = await lic.activateLicense('SCP-TEST-TEST-TEST');
  assert.equal(r.ok, false);
  assert.deepEqual(st._data, {});
});

test('activateLicense active stores flag and detail', async () => {
  const f = async () => ({ ok: true, json: async () => ({ data: { status: 'active', expires_at: '2030-01-01' } }) });
  const st = makeStorage({});
  const lic = loadModule(f, st);
  const r = await lic.activateLicense('SCP-AAA-BBB-CCC');
  assert.equal(r.ok, true);
  assert.equal(st._data.licensed, true);
  assert.equal(st._data.scopeping_license_detail.licenseKey, 'SCP-AAA-BBB-CCC');
});

test('deactivateLicense clears both keys', async () => {
  const st = makeStorage({ licensed: true, scopeping_license_detail: { licenseKey: 'x' } });
  const lic = loadModule(async () => ({ ok: true, json: async () => ({}) }), st);
  await lic.deactivateLicense();
  assert.equal(st._data.licensed, undefined);
  assert.equal(st._data.scopeping_license_detail, undefined);
});
