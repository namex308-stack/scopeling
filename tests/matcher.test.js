const test = require("node:test");
const assert = require("node:assert/strict");
const matcher = require("../lib/matcher.js");

test("flags a task-like request below the best scope-item threshold", () => {
  const result = matcher.analyzeMessage(
    "Can you also add a pricing calculator?",
    ["Landing-page copy", "Responsive layout"],
    0.35
  );
  assert.equal(result.suspected.length, 1);
  assert.equal(result.status, "possiblyOutOfScope");
  assert.equal(result.suspected[0].bestScore, 0);
  assert.equal(result.suspected[0].scores.length, 2);
});

test("whole approved phrases raise a task-like match above threshold", () => {
  const result = matcher.analyzeMessage(
    "Can you also update responsive layout?",
    ["Responsive layout"],
    0.35
  );
  assert.equal(result.suspected.length, 0);
  assert.equal(result.status, "withinScope");
  assert.equal(result.likelyInScope.length, 1);
  assert.equal(result.likelyInScope[0].scores[0].phraseMatch, true);
  assert.equal(result.likelyInScope[0].bestScore, 1);
});

test("threshold is configurable and a sentence with no task cue is not flagged", () => {
  const message = "Can you also update responsive layout";
  const scope = ["Responsive layout for the main website project"];
  assert.equal(matcher.analyzeMessage(message, scope, 0.25).suspected.length, 0);
  assert.equal(matcher.analyzeMessage(message, scope, 0.30).suspected.length, 1);
  assert.equal(
    matcher.analyzeMessage("The existing responsive layout looks good.", scope, 0.8)
      .suspected.length,
    0
  );
});

test("scope item scoring explains token overlap and phrase matching", () => {
  const score = matcher.scoreScopeItem(
    "Please add landing page copy",
    "Landing page copy"
  );
  assert.equal(score.keywordOverlap, 1);
  assert.equal(score.phraseMatch, true);
  assert.equal(score.score, 1);
});

test("empty scope requests review without calling the request out of scope", () => {
  const result = matcher.analyzeMessage("Could you add a dashboard?", [], 0.35);
  assert.equal(result.needsScope, true);
  assert.equal(result.status, "needsScope");
  assert.equal(result.suspected.length, 0);
});

test("marks empty and overlong messages without throwing", () => {
  const empty = matcher.analyzeMessage(" \n ", ["Approved item"]);
  assert.equal(empty.status, "empty");

  const long = matcher.analyzeMessage("word ".repeat(7000), ["Approved item"]);
  assert.equal(long.truncated, true);
  assert.ok(long.primaryText.length <= matcher.MAX_MESSAGE_LENGTH);
});
