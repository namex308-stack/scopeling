(function (root) {
  const MAX_MESSAGE_LENGTH = 30000;
  const OBSERVER_DELAY_MS = 350;

  function message(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions || []);
  }

  function start(config) {
    let panel;
    let licensed = false;
    let scanTimer = 0;
    let latestReview = 0;
    let warned = false;

    function warnOnce() {
      if (warned) return;
      warned = true;
      console.warn(message("integrationWarning", [message(config.siteNameKey)]));
    }

    function query(selector) {
      try {
        return [...document.querySelectorAll(selector)];
      } catch (error) {
        warnOnce();
        return [];
      }
    }

    function findMessageContainers() {
      for (const selectorGroup of config.containerSelectors) {
        const nodes = query(selectorGroup);
        const containers = [];
        const seen = new Set();
        for (const node of nodes) {
          if (!node.isConnected || node.closest("[data-scopeping-ui]")) continue;
          const container = config.toContainer(node);
          if (!container || !container.isConnected || seen.has(container)) continue;
          if (container.closest("[data-scopeping-ui]")) continue;
          seen.add(container);
          containers.push(container);
        }
        if (containers.length) return containers;
      }
      return [];
    }

    function createShield(container) {
      if (container.querySelector("[data-scopeping-control]")) return;
      const host = document.createElement("span");
      host.dataset.scopepingControl = "true";
      host.setAttribute("data-scopeping-ui", "");
      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = `
        :host{display:inline-flex;vertical-align:middle;margin-inline:6px}
        button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:4px;border:1px solid #d0d5dd;border-radius:50%;background:#fff;color:#2457a6;cursor:pointer}
        button:hover,button:focus-visible{background:#eff4ff;outline:2px solid #9dbdf2;outline-offset:1px}
        svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", message("reviewMessageButton"));
      button.title = message("reviewMessageButton");
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 19 6v5c0 4.7-2.9 8.3-7 10-4.1-1.7-7-5.3-7-10V6l7-3Z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const requestId = ++latestReview;
        reviewMessage(container, requestId).catch((error) => {
          warnOnce();
          if (panel && requestId === latestReview) panel.open({ kind: "error", error });
        });
      });
      shadow.append(style, button);

      const anchor = config.getButtonAnchor(container) || container;
      if (anchor === container) container.prepend(host);
      else anchor.append(host);
    }

    function scan() {
      scanTimer = 0;
      if (!licensed || !panel) return;
      try {
        const containers = findMessageContainers();
        containers.forEach(createShield);
        if (!containers.length && config.layoutIndicatorSelectors.some((selector) =>
          query(selector).length > 0)) {
          warnOnce();
        }
      } catch (error) {
        warnOnce();
      }
    }

    function scheduleScan() {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, OBSERVER_DELAY_MS);
    }

    async function reviewMessage(container, requestId) {
      const rawText = config.getMessageText(container);
      const messageText = String(rawText || "").trim();
      if (!messageText) {
        if (requestId === latestReview) panel.open({ kind: "empty" });
        return;
      }

      const truncated = messageText.length > MAX_MESSAGE_LENGTH;
      const boundedMessage = messageText.slice(0, MAX_MESSAGE_LENGTH);
      if (!(await ScopePingStore.isLicensed())) {
        if (requestId === latestReview) panel.open({ kind: "license" });
        return;
      }
      const client = await ScopePingStore.getActiveClient();
      if (!client) {
        if (requestId === latestReview) panel.open({ kind: "noClient" });
        return;
      }
      const analysis = ScopePingMatcher.analyzeMessage(
        boundedMessage,
        client.scope,
        client.threshold
      );
      if (requestId === latestReview) {
        panel.open({
          kind: analysis.status,
          client,
          message: boundedMessage,
          analysis,
          truncated: truncated || analysis.truncated
        });
      }

      if (analysis.status === "possiblyOutOfScope") {
        const messageKey = await createMessageKey(container, boundedMessage);
        chrome.runtime.sendMessage({
          type: "scopeping:message-review",
          messageKey,
          flagged: true
        }).then((response) => {
          if (!response || !response.ok) warnOnce();
        }).catch(() => warnOnce());
      }
    }

    async function createMessageKey(container, messageText) {
      const stableId = config.getStableId(container);
      const identity = `${location.host}:${location.pathname}:${stableId || messageText}`;
      const bytes = new TextEncoder().encode(identity);
      if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
        try {
          const digest = await crypto.subtle.digest("SHA-256", bytes);
          return [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        } catch (error) {
          warnOnce();
        }
      }
      let first = 2166136261;
      let second = 2246822519;
      for (const byte of bytes) {
        first = Math.imul(first ^ byte, 16777619) >>> 0;
        second = Math.imul(second ^ byte, 3266489917) >>> 0;
      }
      return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
    }

    async function initialize() {
      panel = await ScopePingPanel.mountPanel(config.siteNameKey);
      licensed = await ScopePingStore.isLicensed();
      const observedRoot = document.body || document.documentElement;
      const observer = new MutationObserver(scheduleScan);
      observer.observe(observedRoot, { childList: true, subtree: true, characterData: true });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.licensed) {
          licensed = changes.licensed.newValue === true;
          scheduleScan();
        }
      });
      scheduleScan();
    }

    initialize().catch(() => warnOnce());
  }

  root.ScopePingMessageInjector = { start };
})(typeof globalThis !== "undefined" ? globalThis : this);
