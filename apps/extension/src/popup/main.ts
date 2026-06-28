import "./styles.css";
import { planLocalClick } from "../shared/planner";
import type { PageElementSnapshot, PageScanResult, PlannedAction, RuntimeResponse } from "../shared/types";

type StatusMode = "normal" | "error" | "success";
type AssistantActionKind = "click" | "open_url" | "ask_clarification";
type AssistantTheme = "professional" | "jarvis" | "soft";

type AssistantCandidate = {
  id: string;
  kind: AssistantActionKind;
  title: string;
  subtitle: string;
  confidence: number;
  reason: string;
  risk: "low" | "medium" | "blocked";
  source: "local" | "navigation" | "manual";
  elementId?: string;
  url?: string;
  matchedText?: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal: boolean;
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

let lastScan: PageScanResult | null = null;
let selectedCandidate: AssistantCandidate | null = null;
let candidates: AssistantCandidate[] = [];
let activeTheme: AssistantTheme = "jarvis";
let recognition: SpeechRecognitionLike | null = null;
let isListening = false;

app.innerHTML = `
  <main class="apShell" data-theme="${activeTheme}">
    <header class="apHero">
      <div>
        <p class="apEyebrow">Voice Browser Assistant</p>
        <h1>ActionPilot</h1>
        <p class="apSubTitle">Tell the browser what you want. Choose the right action. Confirm. Done.</p>
      </div>
      <div class="apOrb" aria-hidden="true">
        <span></span>
      </div>
    </header>

    <section class="apCard apCommandCard">
      <div class="apQuestionRow">
        <div>
          <p class="apTinyLabel">Command</p>
          <h2>What do you want me to do?</h2>
        </div>
        <button id="newChatButton" class="apIconButton" type="button">New chat</button>
      </div>

      <textarea
        id="instruction"
        class="apCommandInput"
        rows="3"
        placeholder="Try: Open YouTube / Click the search button / Scroll down"
      ></textarea>

      <div class="apQuickRow">
        <button class="apChip" data-example="Open YouTube">Open YouTube</button>
        <button class="apChip" data-example="Click the search button">Click search</button>
        <button class="apChip" data-example="Click login">Click login</button>
      </div>

      <div class="apActionRow">
        <button id="voiceButton" class="apVoiceButton" type="button">🎙 Speak</button>
        <button id="analyzeButton" class="apPrimaryButton" type="button">Analyze page</button>
      </div>
    </section>

    <section class="apCard apStatusCard">
      <div class="apStatusTop">
        <span class="apPulseDot"></span>
        <p id="status">Ready. Write or say a command.</p>
      </div>
      <div id="pageBox" class="apPageBox">No page analyzed yet.</div>
    </section>

    <section class="apCard" id="resultsSection" hidden>
      <div class="apSectionHeader">
        <div>
          <p class="apTinyLabel">Assistant result</p>
          <h2 id="resultTitle">I found possible actions</h2>
        </div>
        <span id="candidateCount" class="apCountBadge">0</span>
      </div>

      <div id="candidateCarousel" class="apCarousel"></div>

      <div class="apCarouselHint">
        Choose a card, or later say: “first”, “second”, “confirm”, “cancel”.
      </div>
    </section>

    <section class="apCard" id="selectedSection" hidden>
      <div class="apSectionHeader">
        <div>
          <p class="apTinyLabel">Selected action</p>
          <h2 id="selectedTitle">Nothing selected</h2>
        </div>
        <span id="selectedConfidence" class="apCountBadge">0%</span>
      </div>

      <p id="selectedReason" class="apSelectedReason"></p>

      <div class="apActionRow">
        <button id="askAgainButton" class="apSecondaryButton" type="button">Ask again</button>
        <button id="executeButton" class="apExecuteButton" type="button">Execute confirmed action</button>
      </div>
    </section>

    <details class="apCard apAdvanced">
      <summary>Developer details</summary>
      <div class="apAdvancedGrid">
        <div>
          <p class="apTinyLabel">Detected elements</p>
          <strong id="elementsCount">0</strong>
        </div>
        <div>
          <p class="apTinyLabel">Planner</p>
          <strong>Local adapter</strong>
        </div>
        <div>
          <p class="apTinyLabel">Agent ready</p>
          <strong>Contract prepared</strong>
        </div>
      </div>
      <div id="elementsList" class="apElementsList">No scan yet.</div>
    </details>

    <section class="apThemeDock">
      <button class="apThemeButton" data-theme="professional">Professional</button>
      <button class="apThemeButton" data-theme="jarvis">Jarvis</button>
      <button class="apThemeButton" data-theme="soft">Soft</button>
    </section>
  </main>
`;

const shell = document.querySelector<HTMLElement>(".apShell")!;
const instructionInput = document.querySelector<HTMLTextAreaElement>("#instruction")!;
const analyzeButton = document.querySelector<HTMLButtonElement>("#analyzeButton")!;
const voiceButton = document.querySelector<HTMLButtonElement>("#voiceButton")!;
const executeButton = document.querySelector<HTMLButtonElement>("#executeButton")!;
const askAgainButton = document.querySelector<HTMLButtonElement>("#askAgainButton")!;
const newChatButton = document.querySelector<HTMLButtonElement>("#newChatButton")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const pageBox = document.querySelector<HTMLDivElement>("#pageBox")!;
const resultsSection = document.querySelector<HTMLElement>("#resultsSection")!;
const selectedSection = document.querySelector<HTMLElement>("#selectedSection")!;
const candidateCarousel = document.querySelector<HTMLDivElement>("#candidateCarousel")!;
const candidateCount = document.querySelector<HTMLSpanElement>("#candidateCount")!;
const resultTitle = document.querySelector<HTMLHeadingElement>("#resultTitle")!;
const selectedTitle = document.querySelector<HTMLHeadingElement>("#selectedTitle")!;
const selectedConfidence = document.querySelector<HTMLSpanElement>("#selectedConfidence")!;
const selectedReason = document.querySelector<HTMLParagraphElement>("#selectedReason")!;
const elementsCount = document.querySelector<HTMLElement>("#elementsCount")!;
const elementsList = document.querySelector<HTMLDivElement>("#elementsList")!;

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
    .replace(/[^a-z0-9а-яёáéíóúüñ\s.-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    "field",
    "me",
    "for"
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
    `${Math.round(element.rect.width)}x${Math.round(element.rect.height)}`
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
    score += 45;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 20;
    }
  }

  if (element.tagName === "button") score += 10;
  if (element.role === "button") score += 8;
  if (element.tagName === "input") score += 8;
  if (element.tagName === "a") score += 5;
  if (element.rect.width > 0 && element.rect.height > 0) score += 4;

  return Math.min(score, 100);
}

function getNavigationCandidate(instruction: string): AssistantCandidate | null {
  const value = instruction.trim();
  const normalized = normalize(value);

  const directUrlMatch = value.match(/https?:\/\/[^\s]+/i);
  if (directUrlMatch) {
    return {
      id: crypto.randomUUID(),
      kind: "open_url",
      title: "Open website",
      subtitle: directUrlMatch[0],
      confidence: 96,
      reason: "The command contains a direct URL.",
      risk: "low",
      source: "navigation",
      url: directUrlMatch[0]
    };
  }

  const domainMatch = value.match(/\b([a-z0-9-]+\.[a-z]{2,})(\/[^\s]*)?\b/i);
  if (domainMatch) {
    return {
      id: crypto.randomUUID(),
      kind: "open_url",
      title: `Open ${domainMatch[1]}`,
      subtitle: `https://${domainMatch[0]}`,
      confidence: 90,
      reason: "The command contains a website domain.",
      risk: "low",
      source: "navigation",
      url: `https://${domainMatch[0]}`
    };
  }

  const knownSites: Array<{ keys: string[]; title: string; url: string }> = [
    { keys: ["youtube", "yt"], title: "Open YouTube", url: "https://www.youtube.com" },
    { keys: ["google"], title: "Open Google", url: "https://www.google.com" },
    { keys: ["gmail"], title: "Open Gmail", url: "https://mail.google.com" },
    { keys: ["rae", "dle"], title: "Open RAE dictionary", url: "https://dle.rae.es" },
    { keys: ["github"], title: "Open GitHub", url: "https://github.com" },
    { keys: ["chatgpt", "openai"], title: "Open ChatGPT", url: "https://chatgpt.com" }
  ];

  const site = knownSites.find((item) => item.keys.some((key) => normalized.includes(key)));

  if (!site) {
    return null;
  }

  if (!normalized.includes("open") && !normalized.includes("go") && !normalized.includes("открой")) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    kind: "open_url",
    title: site.title,
    subtitle: site.url,
    confidence: 92,
    reason: "The command looks like a website navigation request.",
    risk: "low",
    source: "navigation",
    url: site.url
  };
}

function makeClickCandidates(instruction: string, elements: PageElementSnapshot[], limit = 4): AssistantCandidate[] {
  const ranked = elements
    .map((element) => ({
      element,
      score: scoreCandidate(instruction, element)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ element, score }, index) => ({
    id: crypto.randomUUID(),
    kind: "click",
    title: elementLabel(element),
    subtitle: elementMeta(element),
    confidence: index === 0 ? Math.max(score, 60) : score,
    reason:
      index === 0
        ? "Best visible match found on the active page."
        : "Possible visible match found on the active page.",
    risk: score >= 45 ? "low" : "medium",
    source: "local",
    elementId: element.elementId,
    matchedText: elementLabel(element)
  }));
}

function makeClarificationCandidate(): AssistantCandidate {
  return {
    id: crypto.randomUUID(),
    kind: "ask_clarification",
    title: "Ask a clearer question",
    subtitle: "The assistant needs a more specific command.",
    confidence: 50,
    reason: "The current command is too broad or no strong visible target was found.",
    risk: "low",
    source: "local"
  };
}

function renderPage(scan: PageScanResult | null) {
  if (!scan) {
    pageBox.textContent = "No page analyzed yet.";
    return;
  }

  pageBox.innerHTML = `
    <strong>${escapeHtml(scan.pageTitle || "Untitled page")}</strong>
    <span>${escapeHtml(scan.pageUrl)}</span>
  `;
}

function renderDeveloperElements(elements: PageElementSnapshot[]) {
  elementsCount.textContent = String(elements.length);

  if (elements.length === 0) {
    elementsList.textContent = "No visible clickable elements detected.";
    return;
  }

  elementsList.innerHTML = elements
    .slice(0, 20)
    .map(
      (element) => `
        <article>
          <strong>${escapeHtml(elementLabel(element))}</strong>
          <span>${escapeHtml(elementMeta(element))}</span>
        </article>
      `
    )
    .join("");
}

function renderCandidates(nextCandidates: AssistantCandidate[]) {
  candidates = nextCandidates;
  candidateCount.textContent = String(candidates.length);
  resultsSection.hidden = candidates.length === 0;
  resultTitle.textContent =
    candidates.length > 0 ? `I found ${candidates.length} possible action${candidates.length === 1 ? "" : "s"}` : "No action found";

  candidateCarousel.innerHTML = candidates
    .map((candidate, index) => {
      const isSelected = selectedCandidate?.id === candidate.id;
      const badge = index === 0 ? "Recommended" : candidate.confidence >= 70 ? "Good match" : "Possible";
      const icon = candidate.kind === "open_url" ? "🌐" : candidate.kind === "click" ? "👆" : "❔";

      return `
        <article class="apCandidateCard ${isSelected ? "isSelected" : ""}" data-candidate-id="${escapeHtml(candidate.id)}">
          <div class="apCandidateTop">
            <span class="apCandidateIcon">${icon}</span>
            <span class="apCandidateBadge">${badge}</span>
          </div>
          <h3>${escapeHtml(candidate.title)}</h3>
          <p>${escapeHtml(candidate.subtitle)}</p>
          <div class="apConfidence">
            <div class="apConfidenceTop">
              <span>${candidate.kind}</span>
              <strong>${candidate.confidence}%</strong>
            </div>
            <div class="apConfidenceBar">
              <span style="width: ${candidate.confidence}%"></span>
            </div>
          </div>
          <p class="apReason">${escapeHtml(candidate.reason)}</p>
          <button class="apSelectButton" data-candidate-id="${escapeHtml(candidate.id)}" type="button">
            ${isSelected ? "Selected" : "Select"}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderSelected(candidate: AssistantCandidate | null) {
  selectedCandidate = candidate;
  selectedSection.hidden = !candidate;

  if (!candidate) {
    selectedTitle.textContent = "Nothing selected";
    selectedReason.textContent = "";
    selectedConfidence.textContent = "0%";
    executeButton.disabled = true;
    return;
  }

  selectedTitle.textContent = candidate.title;
  selectedReason.textContent = candidate.reason;
  selectedConfidence.textContent = `${candidate.confidence}%`;
  executeButton.disabled = candidate.risk === "blocked" || candidate.kind === "ask_clarification";
  renderCandidates(candidates);
}

function makePlannedAction(candidate: AssistantCandidate): PlannedAction {
  if (!candidate.elementId) {
    throw new Error("This candidate does not have a target element.");
  }

  return {
    actionId: crypto.randomUUID(),
    kind: "click",
    elementId: candidate.elementId,
    confidence: candidate.confidence,
    risk: candidate.risk,
    reason: candidate.reason,
    matchedText: candidate.matchedText ?? candidate.title,
    instruction: instructionInput.value.trim()
  };
}

async function sendMessage(request: unknown): Promise<RuntimeResponse> {
  return await chrome.runtime.sendMessage(request);
}

async function scanActivePage(): Promise<PageScanResult> {
  const response = await sendMessage({ type: "SCAN_PAGE" });

  if (!response.ok || response.type !== "SCAN_PAGE_RESULT") {
    throw new Error(response.ok ? "Unexpected scan response." : response.error);
  }

  return response.payload;
}

async function openUrlInActiveTab(url: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  await chrome.tabs.update(tab.id, { url });
}

async function analyzeCommand() {
  const instruction = instructionInput.value.trim();

  if (!instruction) {
    setStatus("Write or say a command first.", "error");
    return;
  }

  selectedCandidate = null;
  renderSelected(null);
  setStatus("Analyzing your command...", "normal");

  const navigationCandidate = getNavigationCandidate(instruction);

  if (navigationCandidate) {
    lastScan = null;
    renderPage(null);
    renderDeveloperElements([]);
    renderCandidates([navigationCandidate]);
    renderSelected(navigationCandidate);
    setStatus("I found a navigation action. Review it before executing.", "success");
    return;
  }

  try {
    setStatus("Scanning the active page...", "normal");

    const scan = await scanActivePage();
    lastScan = scan;
    renderPage(scan);
    renderDeveloperElements(scan.elements);

    const plannerSafetyCheck = planLocalClick(instruction, scan.elements);

    if (!plannerSafetyCheck.ok && plannerSafetyCheck.blocked) {
      renderCandidates([]);
      setStatus(plannerSafetyCheck.reason, "error");
      return;
    }

    const clickCandidates = makeClickCandidates(instruction, scan.elements, 4);
    const finalCandidates = clickCandidates.length > 0 ? clickCandidates : [makeClarificationCandidate()];

    renderCandidates(finalCandidates);
    renderSelected(finalCandidates[0] ?? null);
    setStatus("Choose the best card, then execute only if it is correct.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analyze error.";
    setStatus(message, "error");
  }
}

async function executeSelectedAction() {
  if (!selectedCandidate) {
    setStatus("Select an action first.", "error");
    return;
  }

  if (selectedCandidate.kind === "ask_clarification") {
    setStatus("Ask a clearer command in the input field.", "normal");
    instructionInput.focus();
    return;
  }

  setStatus("Executing confirmed action...", "normal");

  try {
    if (selectedCandidate.kind === "open_url") {
      if (!selectedCandidate.url) {
        throw new Error("No URL found for this action.");
      }

      await openUrlInActiveTab(selectedCandidate.url);
      setStatus("Website opened.", "success");
      return;
    }

    const plan = makePlannedAction(selectedCandidate);

    const response = await sendMessage({
      type: "EXECUTE_ACTION",
      payload: { action: plan }
    });

    if (!response.ok || response.type !== "EXECUTE_ACTION_RESULT") {
      throw new Error(response.ok ? "Unexpected execution response." : response.error);
    }

    setStatus(response.payload.message, response.payload.ok ? "success" : "error");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error.";
    setStatus(message, "error");
  }
}

function startVoiceInput() {
  const SpeechRecognitionClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    setStatus("Voice input is not supported in this browser. Use chat mode.", "error");
    return;
  }

  if (isListening && recognition) {
    recognition.abort();
    isListening = false;
    voiceButton.textContent = "🎙 Speak";
    setStatus("Voice input stopped.", "normal");
    return;
  }

  recognition = new SpeechRecognitionClass();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";

    if (!transcript) {
      setStatus("I did not hear a command. Try again.", "error");
      return;
    }

    instructionInput.value = transcript;
    setStatus(`You said: "${transcript}"`, "success");
    void analyzeCommand();
  };

  recognition.onerror = (event) => {
    setStatus(`Voice error: ${event.error ?? "unknown"}. Use chat mode if needed.`, "error");
  };

  recognition.onend = () => {
    isListening = false;
    voiceButton.textContent = "🎙 Speak";
  };

  isListening = true;
  voiceButton.textContent = "Listening...";
  setStatus("Listening. Say what you want to do.", "normal");
  recognition.start();
}

function newChat() {
  instructionInput.value = "";
  lastScan = null;
  candidates = [];
  selectedCandidate = null;
  renderPage(null);
  renderDeveloperElements([]);
  renderCandidates([]);
  renderSelected(null);
  setStatus("New chat started. Write or say a command.", "normal");
  instructionInput.focus();
}

analyzeButton.addEventListener("click", () => {
  void analyzeCommand();
});

executeButton.addEventListener("click", () => {
  void executeSelectedAction();
});

voiceButton.addEventListener("click", () => {
  startVoiceInput();
});

askAgainButton.addEventListener("click", () => {
  instructionInput.focus();
  setStatus("Refine your command and analyze again.", "normal");
});

newChatButton.addEventListener("click", () => {
  newChat();
});

candidateCarousel.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const card = target.closest<HTMLElement>("[data-candidate-id]");

  if (!card) return;

  const candidate = candidates.find((item) => item.id === card.dataset.candidateId);

  if (!candidate) return;

  renderSelected(candidate);
  setStatus("Action selected. Review it before executing.", "success");
});

document.querySelectorAll<HTMLButtonElement>("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    instructionInput.value = button.dataset.example ?? "";
    instructionInput.focus();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.theme as AssistantTheme;
    activeTheme = theme;
    shell.dataset.theme = activeTheme;
  });
});

instructionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    void analyzeCommand();
  }
});