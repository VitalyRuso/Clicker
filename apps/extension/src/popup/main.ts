import "./styles.css";
import { planLocalClick } from "../shared/planner";
import type { PageElementSnapshot, PageScanResult, PlannedAction, RuntimeResponse } from "../shared/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

type StatusMode = "normal" | "error" | "success";

type CandidateViewModel = {
  element: PageElementSnapshot;
  score: number;
};

let lastScan: PageScanResult | null = null;
let currentPlan: PlannedAction | null = null;

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <div>
        <p class="eyebrow">Browser Clicker Agent</p>
        <h1>ActionPilot</h1>
      </div>
      <span class="badge">MVP v0.2</span>
    </header>

    <section class="card">
      <label class="label" for="instruction">Instruction</label>
      <textarea id="instruction" rows="3" placeholder="Example: Click the search button"></textarea>
      <p class="helpText">Write what the assistant should do on the current page. Do not paste the page URL here.</p>

      <div class="buttonRow">
        <button id="scanButton">Scan page</button>
        <button id="planButton" class="secondary">Plan action</button>
      </div>
    </section>

    <section class="card pageCard">
      <h2>Current page</h2>
      <div id="pageBox" class="pageBox empty">No page scanned yet.</div>
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

    <section class="card" id="candidatesSection" hidden>
      <div class="sectionTitleRow">
        <h2>Top candidates</h2>
        <span class="smallBadge">manual select</span>
      </div>
      <p class="helpText">Click a candidate if the automatic target is not correct.</p>
      <div id="candidatesList" class="elementsList"></div>
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
const pageBox = document.querySelector<HTMLDivElement>("#pageBox")!;
const candidatesSection = document.querySelector<HTMLElement>("#candidatesSection")!;
const candidatesList = document.querySelector<HTMLDivElement>("#candidatesList")!;

function setStatus(message: string, mode: StatusMode = "normal") {
  statusElement.textContent = message;
  statusElement.dataset.mode = mode;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/www\.\S+/g, " ")
    .replace(/[^a-z0-9а-яёáéíóúüñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^www\./i.test(value.trim());
}

function meaningfulTokens(input: string): string[] {
  const stopWords = new Set([
    "click",
    "press",
    "tap",
    "button",
    "link",
    "the",
    "a",
    "an",
    "on",
    "to",
    "please",
    "open",
    "go",
    "find",
    "select",
    "input",
    "field"
  ]);

  return normalize(input)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function elementLabel(element: PageElementSnapshot): string {
  return [element.text, element.ariaLabel, element.placeholder, element.title].filter(Boolean).join(" | ") || `<${element.tagName}>`;
}

function elementMeta(element: PageElementSnapshot): string {
  const parts = [
    element.tagName,
    element.role ? `role=${element.role}` : "",
    element.inputType ? `type=${element.inputType}` : "",
    `${Math.round(element.rect.width)}x${Math.round(element.rect.height)}`,
    `id ${element.elementId}`
  ];

  return parts.filter(Boolean).join(" · ");
}

function elementSearchText(element: PageElementSnapshot): string {
  return normalize(
    [
      element.text,
      element.ariaLabel,
      element.placeholder,
      element.title,
      element.role,
      element.tagName,
      element.inputType
    ].join(" ")
  );
}

function scoreCandidate(instruction: string, element: PageElementSnapshot): number {
  const normalizedInstruction = normalize(instruction);
  const tokens = meaningfulTokens(instruction);
  const haystack = elementSearchText(element);

  if (!element.visible || !element.clickable || haystack.length === 0) {
    return 0;
  }

  let score = 0;

  if (normalizedInstruction && haystack.includes(normalizedInstruction)) {
    score += 50;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 18;
    }
  }

  if (element.tagName === "button") score += 10;
  if (element.role === "button") score += 8;
  if (element.tagName === "input") score += 7;
  if (element.tagName === "a") score += 5;
  if (element.rect.width > 0 && element.rect.height > 0) score += 5;

  return Math.min(score, 100);
}

function getTopCandidates(instruction: string, elements: PageElementSnapshot[], limit = 5): CandidateViewModel[] {
  const ranked = elements
    .map((element) => ({
      element,
      score: scoreCandidate(instruction, element)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    return ranked.slice(0, limit);
  }

  return elements.slice(0, limit).map((element) => ({ element, score: 0 }));
}

function getElementById(elementId: string): PageElementSnapshot | null {
  return lastScan?.elements.find((element) => element.elementId === elementId) ?? null;
}

function renderCurrentPage(scan: PageScanResult) {
  pageBox.className = "pageBox";
  pageBox.innerHTML = `
    <strong>${escapeHtml(scan.pageTitle || "Untitled page")}</strong>
    <span>${escapeHtml(scan.pageUrl)}</span>
  `;
}

function renderElements(elements: PageElementSnapshot[]) {
  countBadge.textContent = String(elements.length);

  if (elements.length === 0) {
    elementsList.className = "elementsList empty";
    elementsList.textContent = "No visible clickable elements were detected.";
    return;
  }

  const visibleElements = elements.slice(0, 30);
  const summary = elements.length > visibleElements.length
    ? `<p class="listSummary">Showing first ${visibleElements.length} of ${elements.length} detected elements.</p>`
    : "";

  elementsList.className = "elementsList";
  elementsList.innerHTML = `
    ${summary}
    ${visibleElements
      .map(
        (element) => `
          <article class="elementItem selectableItem" data-element-id="${escapeHtml(element.elementId)}" role="button" tabindex="0">
            <strong>${escapeHtml(elementLabel(element))}</strong>
            <span>${escapeHtml(elementMeta(element))}</span>
          </article>
        `
      )
      .join("")}
  `;
}

function renderCandidates(candidates: CandidateViewModel[]) {
  if (candidates.length === 0) {
    candidatesSection.hidden = true;
    candidatesList.innerHTML = "";
    return;
  }

  candidatesSection.hidden = false;
  candidatesList.innerHTML = candidates
    .map(
      ({ element, score }) => `
        <article class="elementItem candidateItem selectableItem" data-element-id="${escapeHtml(element.elementId)}" role="button" tabindex="0">
          <div class="candidateHeader">
            <strong>${escapeHtml(elementLabel(element))}</strong>
            <span class="scoreBadge">${score}/100</span>
          </div>
          <span>${escapeHtml(elementMeta(element))}</span>
        </article>
      `
    )
    .join("");
}

function renderPlan(plan: PlannedAction) {
  const targetElement = getElementById(plan.elementId);
  const targetLabel = plan.matchedText.trim() || (targetElement ? elementLabel(targetElement) : "");
  const canExecute = plan.confidence >= 60 && targetLabel.length > 0 && plan.risk !== "blocked";

  planSection.hidden = false;
  executeButton.disabled = !canExecute;

  planBox.innerHTML = `
    <p><strong>Action:</strong> click</p>
    <p><strong>Target:</strong> ${escapeHtml(targetLabel || "Unknown target")}</p>
    <p><strong>Element:</strong> ${escapeHtml(targetElement ? elementMeta(targetElement) : plan.elementId)}</p>
    <p><strong>Confidence:</strong> ${plan.confidence}/100</p>
    <p><strong>Reason:</strong> ${escapeHtml(plan.reason)}</p>
    ${
      canExecute
        ? ""
        : `<div class="warningBox">Execution is blocked because confidence is too low or the target is unclear. Select a candidate manually or write a more exact instruction.</div>`
    }
  `;
}

function createManualPlan(element: PageElementSnapshot): PlannedAction {
  const instruction = instructionInput.value.trim() || `Click ${elementLabel(element)}`;

  return {
    actionId: crypto.randomUUID(),
    kind: "click",
    elementId: element.elementId,
    confidence: 100,
    risk: "low",
    reason: "Target manually selected by the user from detected elements.",
    matchedText: elementLabel(element),
    instruction
  };
}

function selectElementManually(elementId: string) {
  const element = getElementById(elementId);

  if (!element) {
    setStatus("The selected element is no longer available. Scan the page again.", "error");
    return;
  }

  currentPlan = createManualPlan(element);
  renderPlan(currentPlan);
  setStatus("Manual target selected. Review the proposed action before executing.", "success");
}

async function sendMessage(request: unknown): Promise<RuntimeResponse> {
  return await chrome.runtime.sendMessage(request);
}

scanButton.addEventListener("click", async () => {
  currentPlan = null;
  planSection.hidden = true;
  candidatesSection.hidden = true;
  executeButton.disabled = true;
  setStatus("Scanning the active page...");

  try {
    const response = await sendMessage({ type: "SCAN_PAGE" });

    if (!response.ok || response.type !== "SCAN_PAGE_RESULT") {
      throw new Error(response.ok ? "Unexpected scan response." : response.error);
    }

    lastScan = response.payload;
    renderCurrentPage(lastScan);
    renderElements(lastScan.elements);
    setStatus(`Scanned ${lastScan.elements.length} visible clickable elements.`, "success");
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

  const instruction = instructionInput.value.trim();

  if (looksLikeUrl(instruction)) {
    setStatus("The Instruction field is not for URLs. Open the site in the browser, then write an action like: Click search.", "error");
    return;
  }

  const topCandidates = getTopCandidates(instruction, lastScan.elements);
  renderCandidates(topCandidates);

  const result = planLocalClick(instruction, lastScan.elements);

  if (!result.ok) {
    currentPlan = null;
    planSection.hidden = true;
    setStatus(result.reason, result.blocked ? "error" : "normal");

    if (result.candidates) {
      renderElements(result.candidates);
    }

    return;
  }

  currentPlan = result.plan;
  renderPlan(currentPlan);

  if (currentPlan.confidence < 60) {
    setStatus("The automatic match is weak. Select a candidate manually or write a more exact instruction.", "error");
    return;
  }

  setStatus("Review the proposed action. Execute only if it is correct.", "normal");
});

executeButton.addEventListener("click", async () => {
  if (!currentPlan) {
    setStatus("There is no confirmed action to execute.", "error");
    return;
  }

  if (executeButton.disabled) {
    setStatus("Execution is blocked. Select a clearer target first.", "error");
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

elementsList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const item = target.closest<HTMLElement>("[data-element-id]");

  if (!item) return;

  selectElementManually(item.dataset.elementId ?? "");
});

candidatesList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const item = target.closest<HTMLElement>("[data-element-id]");

  if (!item) return;

  selectElementManually(item.dataset.elementId ?? "");
});