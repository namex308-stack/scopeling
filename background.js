const DAILY_STATE_KEY = "scopePingDailyFlagged";
const DAILY_ALARM = "scopePingDailyBadgeReset";
const ALARM_PERIOD_MINUTES = 60;
const MAX_TRACKED_MESSAGE_KEYS = 50000;

chrome.action.setBadgeBackgroundColor({ color: "#B45309" }, () => {
  if (chrome.runtime.lastError) {
    console.error("ScopePing could not set the badge color.", chrome.runtime.lastError);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  ensureDailyAlarm();
  refreshDailyBadge();
  if (details.reason === "install") openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => {
  ensureDailyAlarm();
  refreshDailyBadge();
});
chrome.action.onClicked.addListener(openOptionsPage);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) refreshDailyBadge();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "scopeping:message-review" ||
      !sender.tab || !Number.isInteger(sender.tab.id) ||
      typeof message.flagged !== "boolean" ||
      typeof message.messageKey !== "string" ||
      !message.messageKey.trim() || message.messageKey.length > 64) {
    return false;
  }

  recordReview(message.messageKey, message.flagged, (error, count) => {
    if (error) {
      console.error("ScopePing could not update today's local badge count.", error);
      sendResponse({ ok: false });
      return;
    }
    sendResponse({ ok: true, count });
  });
  return true;
});

function openOptionsPage() {
  chrome.runtime.openOptionsPage().catch((error) =>
    console.error("ScopePing could not open Options.", error)
  );
}

function ensureDailyAlarm() {
  chrome.alarms.get(DAILY_ALARM, (alarm) => {
    if (chrome.runtime.lastError) {
      console.error("ScopePing could not check its daily badge alarm.", chrome.runtime.lastError);
      return;
    }
    if (!alarm) {
      chrome.alarms.create(DAILY_ALARM, { periodInMinutes: ALARM_PERIOD_MINUTES });
    }
  });
}

function localDayId(date) {
  // Use the user's local calendar day so the badge matches "today" in their timezone.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyDailyState() {
  return { day: localDayId(new Date()), count: 0, seen: [] };
}

function normalizeDailyState(value) {
  const today = localDayId(new Date());
  if (!value || value.day !== today || !Number.isSafeInteger(value.count) ||
      value.count < 0 || !Array.isArray(value.seen)) {
    return emptyDailyState();
  }
  return {
    day: today,
    count: value.count,
    seen: value.seen.filter((key) => typeof key === "string" && key.length <= 160)
      .slice(-MAX_TRACKED_MESSAGE_KEYS)
  };
}

function recordReview(messageKey, flagged, done) {
  // Persist only opaque message keys and a count; message contents stay in the page.
  chrome.storage.local.get(DAILY_STATE_KEY, (stored) => {
    if (chrome.runtime.lastError) {
      done(chrome.runtime.lastError);
      return;
    }

    const previous = stored[DAILY_STATE_KEY];
    const state = normalizeDailyState(previous);
    if (!flagged || state.seen.includes(messageKey)) {
      if (!previous || previous.day !== state.day) {
        saveDailyState(state, done);
      } else {
        done(null, state.count);
      }
      return;
    }

    // Keep storage bounded; stop increasing rather than lose deduplication at the cap.
    if (state.seen.length >= MAX_TRACKED_MESSAGE_KEYS) {
      done(null, state.count);
      return;
    }
    state.count += 1;
    state.seen.push(messageKey);
    saveDailyState(state, done);
  });
}

function refreshDailyBadge() {
  // The periodic alarm notices local midnight and rolls the daily counter over.
  chrome.storage.local.get(DAILY_STATE_KEY, (stored) => {
    if (chrome.runtime.lastError) {
      console.error("ScopePing could not read today's local badge count.", chrome.runtime.lastError);
      return;
    }

    const previous = stored[DAILY_STATE_KEY];
    const state = normalizeDailyState(previous);
    if (!previous || previous.day !== state.day ||
        !Number.isSafeInteger(previous.count) || !Array.isArray(previous.seen)) {
      saveDailyState(state);
      return;
    }
    updateBadge(state.count);
  });
}

function saveDailyState(state, done) {
  chrome.storage.local.set({ [DAILY_STATE_KEY]: state }, () => {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError;
      if (done) done(error);
      else console.error("ScopePing could not save today's local badge count.", error);
      return;
    }
    updateBadge(state.count, done);
  });
}

function updateBadge(count, done) {
  const text = count > 99 ? "99+" : (count ? String(count) : "");
  chrome.action.setBadgeText({ text }, () => {
    const error = chrome.runtime.lastError || null;
    if (error) console.error("ScopePing could not update the extension badge.", error);
    if (done) done(error, count);
  });
}
