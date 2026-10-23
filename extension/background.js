/**
 * Background Service Worker (Manifest V3)
 * Coordinates health pings, badge status and tab communication.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "AI" });
  chrome.action.setBadgeBackgroundColor({ color: "#1652F0" });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHECK_HEALTH") {
    fetch("http://127.0.0.1:8000/api/live/health")
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});
