import "./styles.css";
import { planLocalClick } from "../shared/planner";
import type { PageElementSnapshot, PageScanResult, PlannedAction, RuntimeResponse } from "../shared/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

let lastScan: PageScanResult | null = null;
let currentPlan: PlannedAction | null = null;

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <div>
        <p class="eyebrow">Browser Clicker Agent</p>
        <h1>ActionPilot</h1>
      </div>
      <span class="badge">MVP v0.1</span>
    </header>

    <section class="card">
      <label class="label" for="instruction">Instruction</label>
      <textarea id="instruction" rows="3" placeholder="Example: Click the login button"></textarea>
      <div class="buttonRow">
        <button id="scanButton">Scan page</button>
        <button id="planButton" class="secondary">Plan action</button>
      </div>
    </section>

    <section class="card statusCard">
      <h2>Status</h2>
      <p id="status">Open a normal webpage, then scan the page.</p>
    </section>

    <section class="card" id="planSection" hidden>
      <h2>Proposed action</h2>
      <div id="planBox" class="planBox"></div>
      <button id="executeButton" class="dangerSafe">Execute confirmed action</button>
    </section>

    <section class="card">
      <div class="sectionTitleRow">
        <h2>Detected elements</h2>
        <span id="countBadge" class="countBadge">0</span>
      </div>
      <div id="elementsList" class="elementsList empty">No scan yet.</div>
    </section>
  </main>
`;

const instructionInput = document.querySelector<HTMLTextAreaElement>("#instruction")!;
const scanButton = document.querySelector<HTMLButtonElement>("#scanButton")!;
const planButton = document.querySelector<HTMLButtonElement>("#planButton")!;
const executeButton = document.querySelector<HTMLButtonElement>("#executeButton")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const elementsList = document.querySelector<HTMLDivElement>("#elementsList")!;
const countBadge = document.querySelector<HTMLSpanElement>("#countBadge")!;
const planSection = document.querySelector<HTMLElement>("#planSection")!;
const planBox = document.querySelector<HTMLDivElement>("#planBox")!;

function setStatus(message: string, mode: "normal" | "error" | "success" = "normal") {
  statusElement.textContent = message;
  statusElement.dataset.mode = mode;
}

function elementLabel(element: PageElementSnapshot): string {
  return [element.text, element.ariaLabel, element.placeholder, element.title]
    .filter(Boolean)
    .join(" | ") || `<${element.tagName}>`;
}

function renderElements(elements: PageElementSnapshot[]) {
  countBadge.textContent = String(elements.length);

  if (elements.length === 0) {
    elementsList.className = "elementsList empty";
    elementsList.textContent = "No visible clickable elements were detected.";
    return;
  }

  elementsList.className = "elementsList";
  elementsList.innerHTML = elements
    .slice(0, 40)
    .map(
      (element) => `
        <article class="elementItem">
          <strong>${escapeHtml(elementLabel(element))}</strong>
          <span>${escapeHtml(element.tagName)} · ${Math.round(element.rect.width)}x${Math.round(element.rect.height)} · id ${escapeHtml(element.elementId)}</span>
        </article>
      `
    )
    .join("");
}

function renderPlan(plan: PlannedAction) {
  planSection.hidden = false;
  planBox.innerHTML = `
    <p><strong>Action:</strong> click</p>
    <p><strong>Target:</strong> ${escapeHtml(plan.matchedText)}</p>
    <p><strong>Confidence:</strong> ${plan.confidence}/100</p>
    <p><strong>Reason:</strong> ${escapeHtml(plan.reason)}</p>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendMessage(request: unknown): Promise<RuntimeResponse> {
  return await chrome.runtime.sendMessage(request);
}

scanButton.addEventListener("click", async () => {
  currentPlan = null;
  planSection.hidden = true;
  setStatus("Scanning the active page...");

  try {
    const response = await sendMessage({ type: "SCAN_PAGE" });

    if (!response.ok || response.type !== "SCAN_PAGE_RESULT") {
      throw new Error(response.ok ? "Unexpected scan response." : response.error);
    }

    lastScan = response.payload;
    renderElements(lastScan.elements);
    setStatus(`Scanned ${lastScan.elements.length} visible clickable elements on: ${lastScan.pageTitle || "Untitled page"}.`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error.";
    setStatus(message, "error");
  }
});

planButton.addEventListener("click", () => {
  if (!lastScan) {
    setStatus("Scan the page before planning an action.", "error");
    return;
  }

  const result = planLocalClick(instructionInput.value, lastScan.elements);

  if (!result.ok) {
    currentPlan = null;
    planSection.hidden = true;
    setStatus(result.reason, result.blocked ? "error" : "normal");
    if (result.candidates) renderElements(result.candidates);
    return;
  }

  currentPlan = result.plan;
  renderPlan(currentPlan);
  setStatus("Review the proposed action. Execute only if it is correct.", "normal");
});

executeButton.addEventListener("click", async () => {
  if (!currentPlan) {
    setStatus("There is no confirmed action to execute.", "error");
    return;
  }

  setStatus("Executing confirmed action...");

  try {
    const response = await sendMessage({
      type: "EXECUTE_ACTION",
      payload: { action: currentPlan }
    });

    if (!response.ok || response.type !== "EXECUTE_ACTION_RESULT") {
      throw new Error(response.ok ? "Unexpected execution response." : response.error);
    }

    setStatus(response.payload.message, response.payload.ok ? "success" : "error");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error.";
    setStatus(message, "error");
  }
});
