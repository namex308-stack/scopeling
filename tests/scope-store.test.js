const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../lib/scopeStore.js");

const data = {};
global.chrome = {
  storage: {
    local: {
      async get(key) {
        return { [key]: data[key] };
      },
      async set(values) {
        Object.assign(data, values);
      }
    }
  }
};

test("requires Chrome local storage rather than silently persisting elsewhere", async () => {
  const chrome = global.chrome;
  delete global.chrome;
  try {
    await assert.rejects(store.getClients(), /local storage is unavailable/);
  } finally {
    global.chrome = chrome;
  }
});

test("supports local client and individual scope CRUD", async () => {
  Object.keys(data).forEach((key) => delete data[key]);
  const client = await store.saveClient({
    name: "Northstar",
    scope: ["Landing-page copy"],
    threshold: 0.4
  });
  assert.equal(client.scope.length, 1);
  assert.equal(client.scope[0].text, "Landing-page copy");
  assert.equal(data.scopePingClients[0].name, "Northstar");

  const withAdded = await store.saveScopeItem(client.id, "Responsive layout");
  const added = withAdded.scope[1];
  assert.equal(added.text, "Responsive layout");

  const updated = await store.updateScopeItem(client.id, added.id, "Mobile layout");
  assert.equal(updated.scope[1].text, "Mobile layout");

  const withoutItem = await store.deleteScopeItem(client.id, added.id);
  assert.deepEqual(withoutItem.scope.map((item) => item.text), ["Landing-page copy"]);
  await store.setActiveClientId(client.id);
  assert.equal((await store.getActiveClient()).id, client.id);

  await store.deleteClient(client.id);
  assert.deepEqual(await store.getClients(), []);
  assert.equal(await store.getActiveClientId(), null);
});

test("reads existing string-based scopes with the default threshold", async () => {
  data.scopePingClients = [{
    id: "legacy",
    name: "Legacy client",
    scope: ["Responsive layout"]
  }];
  const [client] = await store.getClients();
  const [readAgain] = await store.getClients();
  assert.equal(client.scope[0].text, "Responsive layout");
  assert.equal(client.threshold, store.DEFAULT_THRESHOLD);
  assert.equal(client.scope[0].id, readAgain.scope[0].id);
});

test("rejects empty names and invalid thresholds", async () => {
  await assert.rejects(
    store.saveClient({ name: " ", scope: [] }),
    /client name is required/
  );
  await assert.rejects(
    store.saveClient({ name: "Client", scope: [], threshold: 2 }),
    /threshold must be between 0 and 1/
  );
});

test("stores only the local license flag and replaces clients from a backup", async () => {
  Object.keys(data).forEach((key) => delete data[key]);
  assert.equal(await store.isLicensed(), false);
  await store.setLicensed();
  assert.equal(data.licensed, true);

  const imported = await store.replaceClients([{
    id: "restored",
    name: "Restored client",
    scope: ["Approved design"],
    template: "Hi {{clientName}}",
    threshold: 0.3
  }]);
  assert.equal(imported[0].id, "restored");
  assert.equal(data.scopePingActiveClient, "restored");
  assert.equal(data.licensed, true);
});
