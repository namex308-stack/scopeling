const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const messages = JSON.parse(
  fs.readFileSync(path.join(root, "_locales/en/messages.json"), "utf8")
);

test("manifest uses only the requested extension permissions", () => {
  assert.deepEqual(manifest.permissions, ["storage", "alarms", "activeTab"]);
  assert.equal(Object.hasOwn(manifest, "host_permissions"), false);
  assert.equal(manifest.default_locale, "en");
});

test("all manifest-referenced scripts and extension pages exist", () => {
  const files = [
    manifest.background.service_worker,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    ...manifest.web_accessible_resources.flatMap((entry) => entry.resources)
  ];
  files.forEach((file) => assert.equal(fs.existsSync(path.join(root, file)), true, file));
});

test("all statically referenced interface strings have English messages", () => {
  const sources = [
    "content/message-injector.js",
    "content/ui/panel.js",
    "options/options.js",
    "options/options.html",
    "lib/templates.js"
  ];
  const missing = new Set();
  for (const source of sources) {
    const text = fs.readFileSync(path.join(root, source), "utf8");
    for (const match of text.matchAll(/\b(?:message|text|t)\(\s*["']([^"']+)["']/g)) {
      if (!messages[match[1]]) missing.add(match[1]);
    }
    for (const match of text.matchAll(/data-i18n(?:-placeholder)?=["']([^"']+)["']/g)) {
      if (!messages[match[1]]) missing.add(match[1]);
    }
  }
  for (const match of [manifest.name, manifest.description, manifest.action.default_title]) {
    const key = match.match(/^__MSG_(.+)__$/);
    if (key && !messages[key[1]]) missing.add(key[1]);
  }
  assert.deepEqual([...missing], []);
});
