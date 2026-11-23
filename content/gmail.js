(function () {
  function cleanTextNode(container) {
    const body = container.matches(".a3s, [data-message-text]")
      ? container
      : container.querySelector(".a3s, [data-message-text]") || container;
    const copy = body.cloneNode(true);
    copy.querySelectorAll("[data-scopeping-ui]").forEach((node) => node.remove());
    return (copy.innerText || copy.textContent || "").trim();
  }

  ScopePingMessageInjector.start({
    siteNameKey: "siteGmail",
    containerSelectors: [
      "[role='main'] .adn",
      "[role='main'] [data-message-id]",
      "[role='main'] .a3s"
    ],
    layoutIndicatorSelectors: [
      "[role='main'] [class*='message-body']",
      "[role='main'] [class*='message-content']",
      "[role='main'] [data-legacy-message-id]"
    ],
    toContainer(node) {
      return node.closest(".adn") || node.closest("[data-message-id]") || node;
    },
    getMessageText: cleanTextNode,
    getStableId(container) {
      const nestedId = container.querySelector("[data-message-id], [data-legacy-message-id]");
      return container.getAttribute("data-message-id") ||
        container.getAttribute("data-legacy-message-id") ||
        (nestedId && (nestedId.getAttribute("data-message-id") ||
          nestedId.getAttribute("data-legacy-message-id"))) ||
        container.id ||
        "";
    },
    getButtonAnchor(container) {
      return container.querySelector(".gE, .ha, [data-message-header]");
    }
  });
})();
