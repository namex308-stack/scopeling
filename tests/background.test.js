const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createServiceWorker() {
  const data = {};
  const listeners = {
    actionClick: [],
    alarm: [],
    installed: [],
    startup: [],
    message: []
  };
  let badgeText = "";
  let alarm = null;
  const event = (list) => ({ addListener: (listener) => list.push(listener) });
  const chrome = {
    runtime: {
      lastError: null,
      onInstalled: event(listeners.installed),
      onStartup: event(listeners.startup),
      onMessage: event(listeners.message),
      openOptionsPage: () => Promise.resolve()
    },
    action: {
      onClicked: event(listeners.actionClick),
      setBadgeBackgroundColor: (_options, callback) => callback(),
      setBadgeText: (options, callback) => {
        badgeText = options.text;
        callback();
      }
    },
    alarms: {
      onAlarm: event(listeners.alarm),
      get: (_name, callback) => callback(alarm),
      create: (name, options) => { alarm = { name, ...options }; }
    },
    storage: {
      local: {
        get: (key, callback) => setTimeout(() => {
          callback({ [key]: data[key] === undefined ? undefined : structuredClone(data[key]) });
        }, 0),
        set: (values, callback) => setTimeout(() => {
          Object.assign(data, structuredClone(values));
          callback();
        }, 0)
      }
    }
  };

  const source = fs.readFileSync(require.resolve("../background.js"), "utf8");
  vm.runInNewContext(source, { chrome, console, Date, Number, Object, Promise });
  return { chrome, data, listeners, get badgeText() { return badgeText; }, get alarm() { return alarm; } };
}

test("counts unique flagged messages for the local day and resets on the alarm", async () => {
  const worker = createServiceWorker();
  worker.listeners.installed[0]({ reason: "install" });
  assert.equal(worker.alarm.name, "scopePingDailyBadgeReset");
  assert.equal(worker.alarm.periodInMinutes, 60);
  await new Promise((resolve) => setTimeout(resolve, 20));

  const response = await new Promise((resolve) => {
    worker.listeners.message[0](
      {
        type: "scopeping:message-review",
        messageKey: "a".repeat(64),
        flagged: true,
        text: "must not be stored"
      },
      { tab: { id: 17 } },
      resolve
    );
  });
  assert.equal(response.ok, true);
  assert.equal(worker.badgeText, "1");
  assert.deepEqual(worker.data.scopePingDailyFlagged.seen, ["a".repeat(64)]);
  assert.equal(JSON.stringify(worker.data).includes("must not be stored"), false);

  await new Promise((resolve) => {
    worker.listeners.message[0](
      { type: "scopeping:message-review", messageKey: "a".repeat(64), flagged: true },
      { tab: { id: 17 } },
      resolve
    );
  });
  assert.equal(worker.data.scopePingDailyFlagged.count, 1);

  await new Promise((resolve) => {
    worker.listeners.message[0](
      { type: "scopeping:message-review", messageKey: "b".repeat(64), flagged: true },
      { tab: { id: 18 } },
      resolve
    );
  });
  assert.equal(worker.badgeText, "2");

  worker.data.scopePingDailyFlagged.day = "2000-01-01";
  worker.listeners.alarm[0]({ name: "scopePingDailyBadgeReset" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(worker.data.scopePingDailyFlagged.count, 0);
  assert.deepEqual(worker.data.scopePingDailyFlagged.seen, []);
  assert.equal(worker.badgeText, "");
});
