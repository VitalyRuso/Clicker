type RectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageElementSnapshot = {
  elementId: string;
  tagName: string;
  text: string;
  ariaLabel: string;
  placeholder: string;
  title: string;
  role: string;
  inputType: string;
  href: string;
  rect: RectSnapshot;
  visible: boolean;
  clickable: boolean;
};

type PageScanResult = {
  pageTitle: string;
  pageUrl: string;
  scannedAtIso: string;
  elements: PageElementSnapshot[];
};

type ExecuteActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

type RuntimeRequest =
  | { type: "SCAN_PAGE" }
  | {
      type: "EXECUTE_ACTION";
      payload: {
        action: {
          elementId: string;
          instruction: string;
        };
      };
    };

type RuntimeResponse =
  | { ok: true; type: "SCAN_PAGE_RESULT"; payload: PageScanResult }
  | { ok: true; type: "EXECUTE_ACTION_RESULT"; payload: ExecuteActionResult }
  | { ok: false; error: string };

type PingRequest = { type: "PING_ACTION_PILOT" };

const globalWindow = window as Window & {
  __ACTION_PILOT_CONTENT_SCRIPT_READY__?: boolean;
};

if (!globalWindow.__ACTION_PILOT_CONTENT_SCRIPT_READY__) {
  globalWindow.__ACTION_PILOT_CONTENT_SCRIPT_READY__ = true;

  const BLOCKED_TERMS = [
    "captcha",
    "2fa",
    "two factor",
    "password",
    "passcode",
    "bank",
    "payment",
    "pay",
    "purchase",
    "buy now",
    "checkout",
    "delete account",
    "remove account",
    "transfer money",
    "wire transfer",
    "crypto",
    "wallet"
  ];

  const cache = new Map<string, Element>();

  function findBlockedTerm(input: string): string | null {
    const normalized = input.toLowerCase();
    return BLOCKED_TERMS.find((term) => normalized.includes(term)) ?? null;
  }

  function trimText(value: string | null | undefined, maxLength = 120): string {
    return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function rectSnapshot(element: Element): RectSnapshot {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function isVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0
    );
  }

  function isClickableCandidate(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase() ?? "";
    const style = window.getComputedStyle(element);
    const hasClickHandler = typeof (element as HTMLElement).onclick === "function";

    return (
      tagName === "button" ||
      tagName === "a" ||
      tagName === "summary" ||
      tagName === "select" ||
      tagName === "textarea" ||
      tagName === "input" ||
      role === "button" ||
      role === "link" ||
      style.cursor === "pointer" ||
      hasClickHandler
    );
  }

  function snapshotElement(element: Element, index: number): PageElementSnapshot {
    const input = element instanceof HTMLInputElement ? element : null;
    const anchor = element instanceof HTMLAnchorElement ? element : null;
    const elementId = `ap-${index}-${Math.random().toString(36).slice(2, 8)}`;

    cache.set(elementId, element);

    return {
      elementId,
      tagName: element.tagName.toLowerCase(),
      text: trimText(element.textContent),
      ariaLabel: trimText(element.getAttribute("aria-label")),
      placeholder: trimText(input?.placeholder),
      title: trimText(element.getAttribute("title")),
      role: trimText(element.getAttribute("role")),
      inputType: trimText(input?.type),
      href: trimText(anchor?.href, 180),
      rect: rectSnapshot(element),
      visible: isVisible(element),
      clickable: isClickableCandidate(element)
    };
  }

  function scanPage(): PageScanResult {
    cache.clear();

    const selector = [
      "button",
      "a[href]",
      "input",
      "select",
      "textarea",
      "summary",
      "[role='button']",
      "[role='link']",
      "[aria-label]",
      "[onclick]"
    ].join(",");

    const elements = Array.from(document.querySelectorAll(selector))
      .filter((element) => isClickableCandidate(element) && isVisible(element))
      .slice(0, 250)
      .map(snapshotElement);

    return {
      pageTitle: document.title,
      pageUrl: window.location.href,
      scannedAtIso: new Date().toISOString(),
      elements
    };
  }

  function executeClick(elementId: string, instruction: string): ExecuteActionResult {
    const blockedTerm = findBlockedTerm(instruction);

    if (blockedTerm) {
      return {
        ok: false,
        message: `Execution blocked for safety: ${blockedTerm}.`
      };
    }

    const element = cache.get(elementId);

    if (!element) {
      return {
        ok: false,
        message: "The target element is no longer available. Scan the page again."
      };
    }

    if (!isVisible(element)) {
      return {
        ok: false,
        message: "The target element is no longer visible."
      };
    }

    (element as HTMLElement).scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "smooth"
    });

    window.setTimeout(() => {
      (element as HTMLElement).click();
    }, 120);

    return {
      ok: true,
      message: "Click executed on the confirmed visible element."
    };
  }

  chrome.runtime.onMessage.addListener((request: RuntimeRequest | PingRequest, _sender, sendResponse) => {
    try {
      if (request.type === "PING_ACTION_PILOT") {
        sendResponse({ ok: true });
        return true;
      }

      if (request.type === "SCAN_PAGE") {
        const payload = scanPage();
        sendResponse({ ok: true, type: "SCAN_PAGE_RESULT", payload } satisfies RuntimeResponse);
        return true;
      }

      if (request.type === "EXECUTE_ACTION") {
        const payload = executeClick(request.payload.action.elementId, request.payload.action.instruction);
        sendResponse({ ok: true, type: "EXECUTE_ACTION_RESULT", payload } satisfies RuntimeResponse);
        return true;
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown content script error.";
      sendResponse({ ok: false, error: message } satisfies RuntimeResponse);
      return true;
    }
  });
}