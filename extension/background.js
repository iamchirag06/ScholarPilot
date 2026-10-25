/**
 * ScholarPilot Chrome Extension - Background Service Worker (Manifest V3)
 */

const DEFAULT_BACKEND_URL = "http://localhost:8000";

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("[ScholarPilot] Background service worker initialized.");
  chrome.storage.local.set({
    backendUrl: DEFAULT_BACKEND_URL,
    activeSession: null,
  });
});

// Message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_SESSION") {
    handleFetchSession(message.sessionId, message.backendUrl)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "MAP_FIELDS") {
    handleMapFields(message.payload, message.backendUrl)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "UPDATE_BADGE") {
    if (sender.tab && sender.tab.id) {
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: message.text || "" });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: message.color || "#10b981" });
    }
    sendResponse({ success: true });
    return false;
  }
});

async function handleFetchSession(sessionId, overrideUrl) {
  const store = await chrome.storage.local.get(["backendUrl"]);
  const baseUrl = (overrideUrl || store.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, "");
  const targetUrl = `${baseUrl}/api/v1/autofill/session/${encodeURIComponent(sessionId)}`;

  const res = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to retrieve session (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  // Cache active session payload
  await chrome.storage.local.set({ activeSession: data });
  return data;
}

async function handleMapFields(payload, overrideUrl) {
  const store = await chrome.storage.local.get(["backendUrl"]);
  const baseUrl = (overrideUrl || store.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, "");
  const targetUrl = `${baseUrl}/api/v1/autofill/map`;

  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Field mapping request failed with HTTP ${res.status}`);
  }

  return await res.json();
}
