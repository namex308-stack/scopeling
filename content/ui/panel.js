(function (root) {
  function text(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions || []);
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  async function mountPanel(siteNameKey) {
    const existing = document.getElementById("scopeping-shadow-host");
    if (existing) return existing.scopePingPanel;

    const cssResponse = await fetch(chrome.runtime.getURL("content/ui/panel.css"));
    if (!cssResponse.ok) throw new Error("Could not load the bundled ScopePing panel styles.");
    const cssText = await cssResponse.text();

    const host = document.createElement("div");
    host.id = "scopeping-shadow-host";
    document.documentElement.append(host);
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = cssText;

    const panel = element("section", "panel hidden");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", text("panelLabel"));
    panel.dir = text("direction") || "ltr";
    panel.innerHTML = `
      <header class="panel-header">
        <div><h1 class="brand"></h1><div class="site"></div></div>
        <button class="close secondary" type="button">×</button>
      </header>
      <main>
        <p class="privacy"></p>
        <p class="client"></p>
        <p class="hint"></p>
        <p class="warning hidden"></p>
        <section class="status-card hidden" aria-live="polite">
          <div class="status"></div>
          <p class="message"></p>
          <div class="matched-label"></div>
          <p class="matched-scope"></p>
          <p class="explanation"></p>
        </section>
        <div class="draft-fields hidden">
          <label class="price-label" for="price"></label>
          <input id="price" type="text" autocomplete="off">
          <label class="draft-label" for="draft"></label>
          <textarea id="draft" spellcheck="true"></textarea>
          <p class="manual-reminder"></p>
          <button class="copy" type="button"></button>
        </div>
        <button class="manage secondary hidden" type="button"></button>
      </main>`;
    shadow.append(style, panel);

    panel.querySelector(".brand").textContent = text("extensionName");
    panel.querySelector(".site").textContent = text(siteNameKey);
    panel.querySelector(".close").setAttribute("aria-label", text("closePanel"));
    panel.querySelector(".privacy").textContent = text("privacyNotice");
    panel.querySelector(".price-label").textContent = text("extraPriceLabel");
    panel.querySelector("#price").placeholder = text("extraPricePlaceholder");
    panel.querySelector(".draft-label").textContent = text("draftLabel");
    panel.querySelector(".manual-reminder").textContent = text("manualSendReminder");
    panel.querySelector(".copy").textContent = text("copyDraft");
    panel.querySelector(".manage").textContent = text("openOptions");

    const clientNode = panel.querySelector(".client");
    const hintNode = panel.querySelector(".hint");
    const warningNode = panel.querySelector(".warning");
    const statusCard = panel.querySelector(".status-card");
    const statusNode = panel.querySelector(".status");
    const messageNode = panel.querySelector(".message");
    const matchedLabel = panel.querySelector(".matched-label");
    const matchedScope = panel.querySelector(".matched-scope");
    const explanation = panel.querySelector(".explanation");
    const draftFields = panel.querySelector(".draft-fields");
    const priceInput = panel.querySelector("#price");
    const draftInput = panel.querySelector("#draft");
    const copyButton = panel.querySelector(".copy");
    const manageButton = panel.querySelector(".manage");
    let activeClient = null;
    let activeAnalysis = null;

    function updateDraft() {
      if (!activeClient || !activeAnalysis ||
          activeAnalysis.status !== "possiblyOutOfScope") {
        draftInput.value = "";
        return;
      }
      const template = activeClient.template || ScopePingTemplates.defaultTemplate();
      draftInput.value = ScopePingTemplates.render(template, {
        clientName: activeClient.name,
        item: activeAnalysis.primaryText || "",
        price: priceInput.value.trim() || text("priceToAgree")
      });
    }

    function show(view) {
      activeClient = view.client || null;
      activeAnalysis = view.analysis || null;
      priceInput.value = "";
      draftInput.value = "";
      copyButton.textContent = text("copyDraft");
      panel.classList.remove("hidden");
      clientNode.textContent = activeClient
        ? text("activeClientName", [activeClient.name])
        : "";
      hintNode.textContent = "";
      warningNode.textContent = "";
      warningNode.classList.add("hidden");
      statusCard.classList.add("hidden");
      draftFields.classList.add("hidden");
      manageButton.classList.add("hidden");

      if (view.kind === "license") {
        hintNode.textContent = text("licenseRequired");
        manageButton.classList.remove("hidden");
      } else if (view.kind === "noClient") {
        hintNode.textContent = text("noActiveClient");
        manageButton.classList.remove("hidden");
      } else if (view.kind === "needsScope") {
        hintNode.textContent = text("saveScopeFirst");
        manageButton.classList.remove("hidden");
      } else if (view.kind === "empty") {
        hintNode.textContent = text("emptyMessage");
      } else if (view.kind === "error") {
        hintNode.textContent = text("reviewError");
        manageButton.classList.remove("hidden");
      } else {
        renderAnalysis(view);
      }

      if (view.truncated) {
        warningNode.textContent = text("longMessageTrimmed");
        warningNode.classList.remove("hidden");
      }
      if (!manageButton.classList.contains("hidden")) manageButton.focus();
    }

    function renderAnalysis(view) {
      const analysis = view.analysis;
      if (!analysis || analysis.status === "empty") {
        hintNode.textContent = text("emptyMessage");
        return;
      }
      if (analysis.status === "needsScope") {
        hintNode.textContent = text("saveScopeFirst");
        manageButton.classList.remove("hidden");
        return;
      }

      statusCard.classList.remove("hidden", "within", "outside");
      const possiblyOut = analysis.status === "possiblyOutOfScope";
      statusCard.classList.add(possiblyOut ? "outside" : "within");
      statusNode.textContent = text(possiblyOut
        ? "possiblyOutOfScope"
        : "withinScope");
      messageNode.textContent = analysis.primaryText || view.message;
      matchedLabel.textContent = text(possiblyOut
        ? "closestScopeLabel"
        : "matchedScopeLabel");
      matchedScope.textContent = analysis.matchingScopeItem || text("noScopeMatch");
      explanation.textContent = text("scoreExplanation", [
        Number(analysis.bestScore || 0).toFixed(2),
        Number(analysis.threshold).toFixed(2)
      ]);

      if (possiblyOut) {
        draftFields.classList.remove("hidden");
        updateDraft();
      }
    }

    panel.querySelector(".close").addEventListener("click", () => {
      panel.classList.add("hidden");
    });
    manageButton.addEventListener("click", () => {
      chrome.runtime.openOptionsPage().catch(() => {
        hintNode.textContent = text("reviewError");
      });
    });
    priceInput.addEventListener("input", updateDraft);
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(draftInput.value);
        copyButton.textContent = text("copied");
        setTimeout(() => { copyButton.textContent = text("copyDraft"); }, 1400);
      } catch (error) {
        console.warn(text("clipboardWarning"), error);
        draftInput.focus();
        draftInput.select();
        explanation.textContent = text("copyManually");
      }
    });

    const api = { open: show };
    host.scopePingPanel = api;
    return api;
  }

  root.ScopePingPanel = { mountPanel };
})(typeof globalThis !== "undefined" ? globalThis : this);
