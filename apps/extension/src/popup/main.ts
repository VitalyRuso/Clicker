import "./styles.css";
import {
  createLocalAgentPlan,
  type BrowserTool,
  type LocalAgentCandidate
} from "../shared/localAgent";
import type {
  PageElementSnapshot,
  PageScanResult,
  PlannedAction,
  RuntimeResponse
} from "../shared/types";

type StatusMode = "normal" | "error" | "success";
type AssistantTheme = "professional" | "jarvis" | "soft";

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
let selectedCandidate: LocalAgentCandidate | null = null;
let candidates: LocalAgentCandidate[] = [];
let activeTheme: AssistantTheme = "soft";
let recognition: SpeechRecognitionLike | null = null;
let isListening = false;

app.innerHTML = `
  <main class="apShell" data-theme="${activeTheme}">
    <header class="apHero">
      <div>
        <p class="apEyebrow">Local Browser Agent</p>
        <h1>ActionPilot</h1>
        <p class="apSubTitle">Works locally. No server needed. Chat or speak, then confirm the action.</p>
      </div>
      <div class="apOrb" aria-hidden="true">
        <span></span>
      </div>
    </header>

    <section class="apCard apCommandCard">
      <div class="apQuestionRow">
        <div>
          <p class="apTinyLabel">Command</p>
          <h2>What should I do?</h2>
        </div>
        <button id="newChatButton" class="apIconButton" type="button">New chat</button>
      </div>

      <textarea
        id="instruction"
        class="apCommandInput"
        rows="2"
        placeholder="Try: Open YouTube / Search Google taxi Madrid / Click search / Scroll down"
      ></textarea>

      <div class="apQuickRow">
        <button class="apChip" data-example="Open YouTube">Open YouTube</button>
        <button class="apChip" data-example="Search Google taxi Madrid">Search Google</button>
        <button class="apChip" data-example="Scroll down">Scroll down</button>
      </div>

      <div class="apActionRow">
        <button id="voiceButton" class="apVoiceButton" type="button">🎙 Speak</button>
        <button id="analyzeButton" class="apPrimaryButton" type="button">Run local agent</button>
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
          <p class="apTinyLabel">Local agent result</p>
          <h2 id="resultTitle">I found possible actions</h2>
        </div>
        <span id="candidateCount" class="apCountBadge">0</span>
      </div>

      <div id="candidateCarousel" class="apCarousel"></div>

      <div class="apCarouselHint">
        Choose a card, say “first / second / confirm”, or ask again.
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
        <button id="executeButton" class="apExecuteButton" type="button">Execute</button>
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
          <p class="apTinyLabel">Brain</p>
          <strong>Local agent</strong>
        </div>
        <div>
          <p class="apTinyLabel">Server</p>
          <strong>Not required</strong>
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

function toolIcon(tool: BrowserTool): string {
  const icons: Record<BrowserTool, string> = {
    open_url: "🌐",
    search_web: "🔎",
    click_element: "👆",
    scroll_page: "↕️",
    go_back: "↩️",
    go_forward: "↪️",
    ask_clarification: "❔"
  };

  return icons[tool];
}

function toolLabel(tool: BrowserTool): string {
  const labels: Record<BrowserTool, string> = {
    open_url: "open",
    search_web: "search",
    click_element: "click",
    scroll_page: "scroll",
    go_back: "back",
    go_forward: "forward",
    ask_clarification: "clarify"
  };

  return labels[tool];
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
          <strong>${escapeHtml(
            [element.text, element.ariaLabel, element.placeholder, element.title]
              .filter(Boolean)
              .join(" | ") || `<${element.tagName}>`
          )}</strong>
          <span>${escapeHtml(
            [
              element.tagName,
              element.role ? `role=${element.role}` : "",
              element.inputType ? `type=${element.inputType}` : "",
              `${Math.round(element.rect.width)}x${Math.round(element.rect.height)}`
            ]
              .filter(Boolean)
              .join(" · ")
          )}</span>
        </article>
      `
    )
    .join("");
}

function renderCandidates(nextCandidates: LocalAgentCandidate[]) {
  candidates = nextCandidates.slice(0, 4);
  candidateCount.textContent = String(candidates.length);
  resultsSection.hidden = candidates.length === 0;
  resultTitle.textContent =
    candidates.length > 0
      ? `I found ${candidates.length} possible action${candidates.length === 1 ? "" : "s"}`
      : "No action found";

  candidateCarousel.innerHTML = candidates
    .map((candidate, index) => {
      const isSelected = selectedCandidate?.id === candidate.id;
      const badge = index === 0 ? "Recommended" : candidate.confidence >= 70 ? "Good match" : "Possible";

      return `
        <article class="apCandidateCard ${isSelected ? "isSelected" : ""}" data-candidate-id="${escapeHtml(candidate.id)}">
          <div class="apCandidateTop">
            <span class="apCandidateIcon">${toolIcon(candidate.tool)}</span>
            <span class="apCandidateBadge">${badge}</span>
          </div>
          <h3>${escapeHtml(candidate.title)}</h3>
          <p>${escapeHtml(candidate.subtitle)}</p>
          <div class="apConfidence">
            <div class="apConfidenceTop">
              <span>${toolLabel(candidate.tool)}</span>
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

function renderSelected(candidate: LocalAgentCandidate | null) {
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
  executeButton.disabled = candidate.risk === "blocked" || candidate.tool === "ask_clarification";
  renderCandidates(candidates);
}

function makePlannedClick(candidate: LocalAgentCandidate): PlannedAction {
  if (!candidate.elementId) {
    throw new Error("This action does not have a target element.");
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

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return tab.id;
}

async function openUrlInActiveTab(url: string) {
  const tabId = await getActiveTabId();
  await chrome.tabs.update(tabId, { url });
}

async function scrollActivePage(direction: "up" | "down") {
  const tabId = await getActiveTabId();

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [direction],
    func: (scrollDirection: "up" | "down") => {
      window.scrollBy({
        top: scrollDirection === "down" ? Math.round(window.innerHeight * 0.75) : -Math.round(window.innerHeight * 0.75),
        behavior: "smooth"
      });
    }
  });
}

async function goBack() {
  const tabId = await getActiveTabId();
  await chrome.tabs.goBack(tabId);
}

async function goForward() {
  const tabId = await getActiveTabId();
  await chrome.tabs.goForward(tabId);
}

async function analyzeCommand() {
  const message = instructionInput.value.trim();

  if (!message) {
    setStatus("Write or say a command first.", "error");
    return;
  }

  renderSelected(null);
  setStatus("Local agent is thinking...", "normal");

  try {
    let plan = createLocalAgentPlan({
      message,
      scan: lastScan
    });

    if (plan.needsScan) {
      setStatus("Analyzing the active page locally...", "normal");
      lastScan = await scanActivePage();
      renderPage(lastScan);
      renderDeveloperElements(lastScan.elements);

      plan = createLocalAgentPlan({
        message,
        scan: lastScan
      });
    }

    renderCandidates(plan.candidates);
    renderSelected(plan.candidates.find((candidate) => candidate.id === plan.recommendedCandidateId) ?? plan.candidates[0] ?? null);
    setStatus(plan.message, "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown local agent error.";
    setStatus(errorMessage, "error");
  }
}

async function executeSelectedAction() {
  if (!selectedCandidate) {
    setStatus("Select an action first.", "error");
    return;
  }

  if (selectedCandidate.tool === "ask_clarification") {
    setStatus("Ask again with more detail.", "normal");
    instructionInput.focus();
    return;
  }

  setStatus("Executing confirmed action...", "normal");

  try {
    if (selectedCandidate.tool === "open_url" || selectedCandidate.tool === "search_web") {
      if (!selectedCandidate.url) {
        throw new Error("No URL found for this action.");
      }

      await openUrlInActiveTab(selectedCandidate.url);
      setStatus("Done. Website opened.", "success");
      return;
    }

    if (selectedCandidate.tool === "scroll_page") {
      await scrollActivePage(selectedCandidate.scrollDirection ?? "down");
      setStatus("Done. Page scrolled.", "success");
      return;
    }

    if (selectedCandidate.tool === "go_back") {
      await goBack();
      setStatus("Done. Went back.", "success");
      return;
    }

    if (selectedCandidate.tool === "go_forward") {
      await goForward();
      setStatus("Done. Went forward.", "success");
      return;
    }

    if (selectedCandidate.tool === "click_element") {
      const plan = makePlannedClick(selectedCandidate);

      const response = await sendMessage({
        type: "EXECUTE_ACTION",
        payload: { action: plan }
      });

      if (!response.ok || response.type !== "EXECUTE_ACTION_RESULT") {
        throw new Error(response.ok ? "Unexpected execution response." : response.error);
      }

      setStatus(response.payload.message, response.payload.ok ? "success" : "error");
      return;
    }

    setStatus("This tool is not executable yet.", "error");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown execution error.";
    setStatus(errorMessage, "error");
  }
}

function selectCandidateByIndex(index: number) {
  const candidate = candidates[index];

  if (!candidate) {
    setStatus("That option is not available.", "error");
    return;
  }

  renderSelected(candidate);
  setStatus(`Selected: ${candidate.title}`, "success");
}

function handleVoiceShortcut(transcript: string): boolean {
  const text = transcript.toLowerCase().trim();

  if (["first", "first one", "one", "первый", "первая"].includes(text)) {
    selectCandidateByIndex(0);
    return true;
  }

  if (["second", "second one", "two", "второй", "вторая"].includes(text)) {
    selectCandidateByIndex(1);
    return true;
  }

  if (["third", "third one", "three", "третий", "третья"].includes(text)) {
    selectCandidateByIndex(2);
    return true;
  }

  if (["fourth", "fourth one", "four", "четвертый", "четвёртый", "четвертая", "четвёртая"].includes(text)) {
    selectCandidateByIndex(3);
    return true;
  }

  if (["confirm", "execute", "yes", "да", "подтверждаю", "выполни"].includes(text)) {
    void executeSelectedAction();
    return true;
  }

  if (["cancel", "stop", "no", "нет", "отмена"].includes(text)) {
    renderSelected(null);
    setStatus("Cancelled.", "normal");
    return true;
  }

  return false;
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

    if (handleVoiceShortcut(transcript)) {
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
  setStatus("Refine your command and run the local agent again.", "normal");
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