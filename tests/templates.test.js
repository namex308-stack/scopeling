const test = require("node:test");
const assert = require("node:assert/strict");
const templates = require("../lib/templates.js");

test("renders named placeholders without interpreting template content as markup", () => {
  const rendered = templates.render(
    "Hi {{clientName}}: {{item}} for {{price}}.",
    {
      clientName: "Northstar",
      item: "a pricing calculator",
      price: "$250"
    }
  );
  assert.equal(rendered, "Hi Northstar: a pricing calculator for $250.");
});

test("leaves unknown placeholders visible for the user to correct", () => {
  assert.equal(templates.render("Hello {{unknown}}", {}), "Hello {{unknown}}");
});
