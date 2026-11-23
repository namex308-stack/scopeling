(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScopePingStore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CLIENTS_KEY = "scopePingClients";
  const ACTIVE_CLIENT_KEY = "scopePingActiveClient";
  const LICENSED_KEY = "licensed";
  const DEFAULT_THRESHOLD = 0.35;

  function getLocalStorage() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      throw new Error("ScopePing local storage is unavailable.");
    }
    return chrome.storage.local;
  }

  function makeId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `scope-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function legacyScopeId(index, text) {
    let hash = 0;
    for (let position = 0; position < text.length; position += 1) {
      hash = (hash * 31 + text.charCodeAt(position)) >>> 0;
    }
    return `legacy-${index}-${hash.toString(36)}`;
  }

  function normalizeScope(items, previousItems) {
    const previousByText = new Map();
    (Array.isArray(previousItems) ? previousItems : [])
      .filter((item) => item && typeof item === "object" &&
        typeof item.text === "string" && typeof item.id === "string")
      .forEach((item) => {
        const ids = previousByText.get(item.text) || [];
        ids.push(item.id);
        previousByText.set(item.text, ids);
      });
    return (Array.isArray(items) ? items : [])
      .map((item) => typeof item === "string" ? { text: item } : item)
      .filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item, index) => {
        const text = item.text.trim();
        const priorIds = previousByText.get(text);
        const priorId = item.id || (priorIds && priorIds.shift());
        return {
          id: priorId || (previousItems ? legacyScopeId(index, text) : makeId()),
          text
        };
      });
  }

  async function getClients() {
    const stored = await getLocalStorage().get(CLIENTS_KEY);
    if (!Array.isArray(stored[CLIENTS_KEY])) return [];
    return stored[CLIENTS_KEY].map((client) => ({
      ...client,
      scope: normalizeScope(client.scope, client.scope),
      template: typeof client.template === "string" ? client.template : "",
      threshold: Number.isFinite(client.threshold) ? client.threshold : DEFAULT_THRESHOLD
    }));
  }

  async function getClient(clientId) {
    return (await getClients()).find((client) => client.id === clientId) || null;
  }

  async function saveClient(input) {
    if (!input || typeof input.name !== "string" || !input.name.trim()) {
      throw new Error("A client name is required.");
    }
    const clients = await getClients();
    const previous = clients.find((client) => client.id === input.id);
    const threshold = input.threshold === undefined
      ? (previous ? previous.threshold : DEFAULT_THRESHOLD)
      : Number(input.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new Error("The matching threshold must be between 0 and 1.");
    }
    const client = {
      id: previous ? previous.id : (input.id || makeId()),
      name: input.name.trim(),
      scope: normalizeScope(input.scope, previous ? previous.scope : null),
      template: typeof input.template === "string" ? input.template.trim() : "",
      threshold
    };
    const index = clients.findIndex((item) => item.id === client.id);
    if (index >= 0) clients[index] = client;
    else clients.push(client);
    await getLocalStorage().set({ [CLIENTS_KEY]: clients });
    return client;
  }

  async function deleteClient(clientId) {
    const clients = (await getClients()).filter((client) => client.id !== clientId);
    await getLocalStorage().set({ [CLIENTS_KEY]: clients });
    if (await getActiveClientId() === clientId) {
      await getLocalStorage().set({ [ACTIVE_CLIENT_KEY]: null });
    }
  }

  async function saveScopeItem(clientId, text) {
    const client = await getClient(clientId);
    if (!client) throw new Error("The selected client was not found.");
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("A scope item cannot be empty.");
    }
    return saveClient({
      ...client,
      scope: [...client.scope, { id: makeId(), text: text.trim() }]
    });
  }

  async function updateScopeItem(clientId, scopeId, text) {
    const client = await getClient(clientId);
    if (!client) throw new Error("The selected client was not found.");
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("A scope item cannot be empty.");
    }
    const found = client.scope.some((item) => item.id === scopeId);
    if (!found) throw new Error("The selected scope item was not found.");
    return saveClient({
      ...client,
      scope: client.scope.map((item) =>
        item.id === scopeId ? { ...item, text: text.trim() } : item
      )
    });
  }

  async function deleteScopeItem(clientId, scopeId) {
    const client = await getClient(clientId);
    if (!client) throw new Error("The selected client was not found.");
    return saveClient({
      ...client,
      scope: client.scope.filter((item) => item.id !== scopeId)
    });
  }

  async function getActiveClientId() {
    const stored = await getLocalStorage().get(ACTIVE_CLIENT_KEY);
    return stored[ACTIVE_CLIENT_KEY] || null;
  }

  async function setActiveClientId(clientId) {
    if (clientId && !(await getClient(clientId))) {
      throw new Error("The selected client was not found.");
    }
    await getLocalStorage().set({ [ACTIVE_CLIENT_KEY]: clientId || null });
  }

  async function getActiveClient() {
    const activeId = await getActiveClientId();
    return activeId ? getClient(activeId) : null;
  }

  async function isLicensed() {
    const stored = await getLocalStorage().get(LICENSED_KEY);
    return stored[LICENSED_KEY] === true;
  }

  async function setLicensed() {
    await getLocalStorage().set({ [LICENSED_KEY]: true });
  }

  async function replaceClients(importedClients) {
    if (!Array.isArray(importedClients)) {
      throw new Error("The backup must contain a client list.");
    }

    const ids = new Set();
    const clients = importedClients.map((input) => {
      if (!input || typeof input.name !== "string" || !input.name.trim()) {
        throw new Error("Every imported client needs a name.");
      }
      if (!Array.isArray(input.scope)) {
        throw new Error("Every imported client needs a scope list.");
      }
      const threshold = input.threshold === undefined
        ? DEFAULT_THRESHOLD
        : Number(input.threshold);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new Error("An imported matching threshold is invalid.");
      }
      let id = typeof input.id === "string" && input.id ? input.id : makeId();
      if (ids.has(id)) id = makeId();
      ids.add(id);
      return {
        id,
        name: input.name.trim(),
        scope: normalizeScope(input.scope, null),
        template: typeof input.template === "string" ? input.template.trim() : "",
        threshold
      };
    });

    const firstClientId = clients.length ? clients[0].id : null;
    await getLocalStorage().set({
      [CLIENTS_KEY]: clients,
      [ACTIVE_CLIENT_KEY]: firstClientId
    });
    return clients;
  }

  return {
    DEFAULT_THRESHOLD,
    getClients,
    getClient,
    saveClient,
    deleteClient,
    saveScopeItem,
    updateScopeItem,
    deleteScopeItem,
    getActiveClientId,
    setActiveClientId,
    getActiveClient,
    isLicensed,
    setLicensed,
    replaceClients
  };
});
