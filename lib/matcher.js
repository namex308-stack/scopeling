(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScopePingMatcher = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_THRESHOLD = 0.35;
  const MAX_MESSAGE_LENGTH = 30000;
  const MAX_SENTENCES = 100;
  const KEYWORD_WEIGHT = 0.7;
  const PHRASE_BONUS = 0.3;
  // Common grammar words do not describe deliverables and therefore do not earn overlap.
  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "could", "for",
    "from", "have", "i", "in", "is", "it", "of", "on", "or", "our", "please",
    "that", "the", "this", "to", "we", "with", "you", "your"
  ]);
  // These action/request cues make a sentence eligible for an out-of-scope suggestion.
  const TASK_LIKE_PATTERN =
    /\b(?:add|adds|adding|added|change|changes|changing|changed|also|can\s+you|quick|quickly|extra|another|new|include|create|build|write|update|modify|expand|additional|redo|fix)\b/i;

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    return [...new Set(normalize(text)
      .split(" ")
      .filter((word) => word && !STOP_WORDS.has(word)))];
  }

  function splitSentences(text) {
    return String(text || "")
      .split(/(?<=[.!?])\s+|\r?\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function scoreScopeItem(sentence, scopeItem) {
    const scopeText = typeof scopeItem === "string" ? scopeItem : scopeItem.text;
    const messageTokens = tokenize(sentence);
    const scopeTokens = tokenize(scopeText);
    const messageSet = new Set(messageTokens);
    const overlap = scopeTokens.filter((word) => messageSet.has(word));
    const keywordOverlap = scopeTokens.length ? overlap.length / scopeTokens.length : 0;
    const normalizedSentence = ` ${normalize(sentence)} `;
    const normalizedPhrase = normalize(scopeText);
    const phraseMatch = Boolean(
      normalizedPhrase && normalizedSentence.includes(` ${normalizedPhrase} `)
    );

    // Per item: 70% exact-token coverage plus a 30% bonus for the whole approved phrase.
    const score = Math.min(1, keywordOverlap * KEYWORD_WEIGHT +
      (phraseMatch ? PHRASE_BONUS : 0));
    return {
      scopeText,
      keywordOverlap,
      phraseMatch,
      score
    };
  }

  function analyzeMessage(message, scopeItems, threshold) {
    const rawMessage = String(message || "");
    const tooLong = rawMessage.length > MAX_MESSAGE_LENGTH;
    const boundedMessage = rawMessage.slice(0, MAX_MESSAGE_LENGTH);
    const scope = (Array.isArray(scopeItems) ? scopeItems : [])
      .filter((item) => item && (typeof item === "string" || typeof item.text === "string"))
      .filter((item) => (typeof item === "string" ? item : item.text).trim());
    const actualThreshold = threshold === undefined ? DEFAULT_THRESHOLD : Number(threshold);
    if (!Number.isFinite(actualThreshold) || actualThreshold < 0 || actualThreshold > 1) {
      throw new Error("The matching threshold must be between 0 and 1.");
    }

    const allSentences = splitSentences(boundedMessage);
    const manySentences = allSentences.length > MAX_SENTENCES;
    const sentences = allSentences.slice(0, MAX_SENTENCES).map((text) => {
      // Only a task-like request can be suspected; unrelated text is never flagged.
      const taskLike = TASK_LIKE_PATTERN.test(text);
      const scores = scope.map((item) => scoreScopeItem(text, item))
        .sort((left, right) => right.score - left.score);
      const bestMatch = scores[0] || null;
      // Compare against the best-scoring scope item; below-threshold requests are suggestions only.
      const suspected = Boolean(scope.length && taskLike &&
        (!bestMatch || bestMatch.score < actualThreshold));
      return {
        text,
        taskLike,
        suspected,
        bestScore: bestMatch ? bestMatch.score : 0,
        matchedScope: bestMatch ? bestMatch.scopeText : "",
        scores
      };
    });
    const suspected = sentences.find((sentence) => sentence.suspected) || null;
    const closestMatch = sentences
      .flatMap((sentence) => sentence.scores.map((score) => ({ ...score, sentence })))
      .sort((left, right) => right.score - left.score)[0] || null;
    const status = !boundedMessage.trim()
      ? "empty"
      : scope.length === 0
        ? "needsScope"
        : suspected
          ? "possiblyOutOfScope"
          : "withinScope";

    return {
      threshold: actualThreshold,
      needsScope: scope.length === 0,
      status,
      truncated: tooLong || manySentences,
      primaryText: suspected ? suspected.text : (closestMatch ? closestMatch.sentence.text : ""),
      matchingScopeItem: suspected
        ? suspected.matchedScope
        : (closestMatch ? closestMatch.scopeText : ""),
      bestScore: suspected
        ? suspected.bestScore
        : (closestMatch ? closestMatch.score : 0),
      sentences,
      suspected: sentences.filter((sentence) => sentence.suspected),
      likelyInScope: sentences.filter((sentence) =>
        sentence.taskLike && scope.length && !sentence.suspected)
    };
  }

  return {
    DEFAULT_THRESHOLD,
    MAX_MESSAGE_LENGTH,
    MAX_SENTENCES,
    normalize,
    tokenize,
    splitSentences,
    scoreScopeItem,
    analyzeMessage
  };
});
