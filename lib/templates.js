(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScopePingTemplates = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function message(key) {
    return typeof chrome !== "undefined" && chrome.i18n
      ? chrome.i18n.getMessage(key)
      : "";
  }

  function getBuiltInTemplates() {
    return [
      { id: "default", name: message("templateDefaultName"), text: message("templateDefault") },
      { id: "friendly", name: message("templateFriendlyName"), text: message("templateFriendly") }
    ].filter((template) => template.text);
  }

  function defaultTemplate() {
    const templates = getBuiltInTemplates();
    return templates[0] ? templates[0].text : "";
  }

  function render(template, values) {
    const substitutions = values || {};
    return String(template || "").replace(/\{\{([a-zA-Z]+)\}\}/g, (placeholder, key) =>
      Object.prototype.hasOwnProperty.call(substitutions, key)
        ? String(substitutions[key])
        : placeholder
    );
  }

  return { getBuiltInTemplates, defaultTemplate, render };
});
