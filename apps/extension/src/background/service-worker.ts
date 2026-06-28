import type { RuntimeRequest, RuntimeResponse } from "../shared/types";

const CONTENT_SCRIPT_FILE = "assets/content.js";

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab;
}

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^(chrome|edge|about|devtools|chrome-extension):/i.test(url);
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_ACTION_PILOT" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE]
    });
  }
}

async function forwardToContentScript(request: RuntimeRequest): Promise<RuntimeResponse> {
  const tab = await getActiveTab();

  if (isRestrictedUrl(tab.url)) {
    return {
      ok: false,
      error: "This browser page is restricted. Open a normal webpage and try again."
    };
  }

  await ensureContentScript(tab.id!);
  return await chrome.tabs.sendMessage(tab.id!, request);
}

chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse) => {
  if (request.type !== "SCAN_PAGE" && request.type !== "EXECUTE_ACTION") {
    return false;
  }

  forwardToContentScript(request)
    .then(sendResponse)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown extension error.";
      sendResponse({ ok: false, error: message } satisfies RuntimeResponse);
    });

  return true;
});
