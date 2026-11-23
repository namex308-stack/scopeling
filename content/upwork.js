(function () {
  function cleanTextNode(container) {
    const selector = "[data-test='message-text'], [data-testid*='message-text'], .air3-chat-message-text";
    const body = container.matches(selector) ? container : container.querySelector(selector) || container;
    const copy = body.cloneNode(true);
    copy.querySelectorAll("[data-scopeping-ui]").forEach((node) => node.remove());
    return (copy.innerText || copy.textContent || "").trim();
  }

  ScopePingMessageInjector.start({
    siteNameKey: "siteUpwork",
    containerSelectors: [
      "main [data-test='message']",
      "main [data-testid*='message']",
      "main [data-test='message-text']",
      "[role='log'] [data-test*='message']"
    ],
    layoutIndicatorSelectors: [
      "main [data-testid*='message']",
      "main [data-test*='message']",
      "main [class*='chat-message']"
    ],
    toContainer(node) {
      return node.closest(
        "[data-test='message'], [data-testid*='message'], .air3-chat-message"
      ) || node;
    },
    getMessageText: cleanTextNode,
    getStableId(container) {
      return container.getAttribute("data-message-id") ||
        container.getAttribute("data-test-message-id") ||
        container.id ||
        "";
    },
    getButtonAnchor(container) {
      return container.querySelector(
        ".air3-chat-message-header, [data-test*='message-header']"
      );
    }
  });
})();
