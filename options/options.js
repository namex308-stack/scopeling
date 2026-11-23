(function () {
  const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions || []);
  const licenseGate = document.getElementById("license-gate");
  const application = document.getElementById("application");
  const licenseForm = document.getElementById("license-form");
  const licenseKeyInput = document.getElementById("license-key");
  const licenseStatus = document.getElementById("license-status");
  const onboarding = document.getElementById("onboarding");
  const onboardingStatus = document.getElementById("onboarding-status");
  const manager = document.getElementById("manager");
  const form = document.getElementById("client-form");
  const list = document.getElementById("client-list");
  const nameInput = document.getElementById("client-name");
  const scopeInput = document.getElementById("scope");
  const templateInput = document.getElementById("template");
  const presetInput = document.getElementById("template-preset");
  const thresholdInput = document.getElementById("threshold");
  const thresholdOutput = document.getElementById("threshold-value");
  const title = document.getElementById("form-title");
  const status = document.getElementById("status");
  const backupStatus = document.getElementById("backup-status");
  const deleteButton = document.getElementById("delete-client");
  const importInput = document.getElementById("import-scopes");
  let editingId = null;
  let templates = [];
  let firstClientName = "";
  let firstClientScope = [];

  function localizeDocument() {
    document.documentElement.dir = t("direction") || "ltr";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
  }

  // TODO: replace with Paddle License API call after Paddle account
  // setup — endpoint: https://sandbox-api.paddle.com/license/validate
  // Keep the license provider integration isolated in this function.
  async function validateLicense(key) {
    return /^SCP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(key || "").trim());
  }

  function showMessage(node, key, isError, substitutions) {
    node.textContent = key ? t(key, substitutions || []) : "";
    node.classList.toggle("error", Boolean(isError));
  }

  function resetOnboardingDraft() {
    firstClientName = "";
    firstClientScope = [];
    document.getElementById("first-client-name").value = "";
    document.getElementById("first-client-scope").value = "";
  }

  function fillTemplatePresets() {
    const defaultTemplate = ScopePingTemplates.defaultTemplate();
    presetInput.replaceChildren();
    const customOption = document.createElement("option");
    customOption.value = "";
    customOption.textContent = t("customTemplate");
    presetInput.append(customOption);
    templates = ScopePingTemplates.getBuiltInTemplates();
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      presetInput.append(option);
    });
    templateInput.value = defaultTemplate;
  }

  function setForm(client) {
    editingId = client ? client.id : null;
    document.getElementById("client-id").value = editingId || "";
    nameInput.value = client ? client.name : "";
    scopeInput.value = client ? client.scope.map((item) => item.text).join("\n") : "";
    templateInput.value = client && client.template
      ? client.template
      : ScopePingTemplates.defaultTemplate();
    thresholdInput.value = client ? String(client.threshold) : "0.35";
    title.textContent = t(client ? "editClient" : "newClient");
    deleteButton.classList.toggle("hidden", !client);
    const selected = templates.find((item) => item.text === templateInput.value);
    presetInput.value = selected ? selected.id : "";
    updateThresholdLabel();
    showMessage(status, "", false);
  }

  function updateThresholdLabel() {
    thresholdOutput.textContent = t("thresholdValue", [
      Number(thresholdInput.value).toFixed(2)
    ]);
  }

  async function renderClients() {
    const [clients, activeId] = await Promise.all([
      ScopePingStore.getClients(),
      ScopePingStore.getActiveClientId()
    ]);
    list.replaceChildren();
    if (!clients.length) {
      const empty = document.createElement("p");
      empty.className = "help";
      empty.textContent = t("noClients");
      list.append(empty);
      return;
    }

    clients.forEach((client) => {
      const row = document.createElement("div");
      row.className = "client-row";
      const activate = document.createElement("button");
      activate.type = "button";
      activate.className = `client-name secondary${activeId === client.id ? " active" : ""}`;
      activate.textContent = activeId === client.id
        ? t("activeClientName", [client.name])
        : client.name;
      activate.setAttribute("aria-pressed", String(activeId === client.id));
      activate.addEventListener("click", async () => {
        try {
          await ScopePingStore.setActiveClientId(client.id);
          await renderClients();
          showMessage(status, "activeClientSaved", false);
        } catch (error) {
          console.error("ScopePing could not activate the client.", error);
          showMessage(status, "operationError", true);
        }
      });

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = t("editClient");
      edit.addEventListener("click", () => setForm(client));
      row.append(activate, edit);
      list.append(row);
    });
  }

  async function showWorkspace() {
    const clients = await ScopePingStore.getClients();
    if (!clients.length) {
      manager.classList.add("hidden");
      onboarding.classList.remove("hidden");
      resetOnboardingDraft();
      goToOnboardingStep(1);
      return;
    }
    onboarding.classList.add("hidden");
    manager.classList.remove("hidden");
    setForm(null);
    await renderClients();
  }

  function goToOnboardingStep(step) {
    document.getElementById("step-one").classList.toggle("hidden", step !== 1);
    document.getElementById("step-two").classList.toggle("hidden", step !== 2);
    document.getElementById("step-three").classList.toggle("hidden", step !== 3);
    document.getElementById("step-indicator").textContent =
      t("onboardingProgress", [String(step)]);
    showMessage(onboardingStatus, "", false);
    if (step === 2) {
      document.getElementById("first-client-preview").textContent = firstClientName;
      document.getElementById("first-client-scope").value = firstClientScope.join("\n");
    }
  }

  async function exportScopes() {
    const clients = await ScopePingStore.getClients();
    const backup = {
      format: "ScopePingBackup",
      version: 1,
      exportedAt: new Date().toISOString(),
      clients
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scopeping-backup.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage(backupStatus, "exportComplete", false);
  }

  async function importScopes(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showMessage(backupStatus, "importTooLarge", true);
      return;
    }
    try {
      const backup = JSON.parse(await file.text());
      if (!backup || backup.format !== "ScopePingBackup" ||
          backup.version !== 1 || !Array.isArray(backup.clients)) {
        throw new Error("Unsupported backup format.");
      }
      if (!window.confirm(t("importConfirm"))) return;
      await ScopePingStore.replaceClients(backup.clients);
      setForm(null);
      await showWorkspace();
      showMessage(backupStatus, "importComplete", false);
    } catch (error) {
      console.error("ScopePing could not import the scope backup.", error);
      showMessage(backupStatus, "importInvalid", true);
    } finally {
      importInput.value = "";
    }
  }

  licenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = licenseKeyInput.value.trim();
    try {
      if (!(await validateLicense(key))) {
        showMessage(licenseStatus, "licenseInvalid", true);
        return;
      }
      await ScopePingStore.setLicensed();
      licenseKeyInput.value = "";
      licenseGate.classList.add("hidden");
      application.classList.remove("hidden");
      await showWorkspace();
    } catch (error) {
      console.error("ScopePing could not activate its local license.", error);
      showMessage(licenseStatus, "operationError", true);
    }
  });

  document.getElementById("step-one-next").addEventListener("click", () => {
    const value = document.getElementById("first-client-name").value.trim();
    if (!value) {
      showMessage(onboardingStatus, "clientNameRequired", true);
      return;
    }
    firstClientName = value;
    goToOnboardingStep(2);
  });
  document.getElementById("step-two-back").addEventListener("click", () => goToOnboardingStep(1));
  document.getElementById("step-two-next").addEventListener("click", () => {
    firstClientScope = document.getElementById("first-client-scope").value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!firstClientScope.length) {
      showMessage(onboardingStatus, "scopeRequired", true);
      return;
    }
    goToOnboardingStep(3);
  });
  document.getElementById("finish-onboarding").addEventListener("click", async () => {
    try {
      const client = await ScopePingStore.saveClient({
        name: firstClientName,
        scope: firstClientScope,
        template: ScopePingTemplates.defaultTemplate()
      });
      await ScopePingStore.setActiveClientId(client.id);
      await showWorkspace();
      showMessage(status, "onboardingComplete", false);
    } catch (error) {
      console.error("ScopePing could not save the onboarding client.", error);
      showMessage(onboardingStatus, "operationError", true);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!nameInput.value.trim()) {
      nameInput.setCustomValidity(t("clientNameRequired"));
      nameInput.reportValidity();
      return;
    }
    nameInput.setCustomValidity("");

    try {
      const saved = await ScopePingStore.saveClient({
        id: editingId || undefined,
        name: nameInput.value,
        scope: scopeInput.value.split(/\r?\n/),
        template: templateInput.value,
        threshold: Number(thresholdInput.value)
      });
      await ScopePingStore.setActiveClientId(saved.id);
      setForm(saved);
      await renderClients();
      showMessage(status, "clientSaved", false);
    } catch (error) {
      console.error("ScopePing could not save the client.", error);
      showMessage(status, "operationError", true);
    }
  });

  nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
  document.getElementById("new-client").addEventListener("click", () => setForm(null));
  deleteButton.addEventListener("click", async () => {
    if (!editingId || !window.confirm(t("deleteConfirm"))) return;
    try {
      await ScopePingStore.deleteClient(editingId);
      await showWorkspace();
      showMessage(status, "clientDeleted", false);
    } catch (error) {
      console.error("ScopePing could not delete the client.", error);
      showMessage(status, "operationError", true);
    }
  });
  thresholdInput.addEventListener("input", updateThresholdLabel);
  presetInput.addEventListener("change", () => {
    const selected = templates.find((template) => template.id === presetInput.value);
    if (selected) templateInput.value = selected.text;
  });
  document.getElementById("export-scopes").addEventListener("click", () => {
    exportScopes().catch((error) => {
      console.error("ScopePing could not export the scope backup.", error);
      showMessage(backupStatus, "operationError", true);
    });
  });
  document.getElementById("import-scopes-button").addEventListener("click", () => {
    importInput.click();
  });
  importInput.addEventListener("change", () => importScopes(importInput.files[0]));

  async function initialize() {
    localizeDocument();
    fillTemplatePresets();
    if (await ScopePingStore.isLicensed()) {
      licenseGate.classList.add("hidden");
      application.classList.remove("hidden");
      await showWorkspace();
    }
  }

  initialize().catch((error) => {
    console.error("ScopePing Options could not initialize.", error);
    showMessage(licenseStatus, "operationError", true);
  });
})();
