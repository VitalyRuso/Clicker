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

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  candidates?: LocalAgentCandidate[];
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
let selectedCandidate: LocalAgentCandidate | null = null;
let latestCandidates: LocalAgentCandidate[] = [];
let messages: ChatMessage[] = [];
let activeTheme: AssistantTheme = "soft";
let recognition: SpeechRecognitionLike | null = null;
let isListening = false;

const autoRunTools = new Set<BrowserTool>([
  "open_url",
  "search_web",
  "scroll_page",
  "go_back",
  "go_forward"
]);

app.innerHTML = `
  <main class="apChatShell" data-theme="${activeTheme}">
    <header class="apChatHeader">
      <div class="apBrandBlock">
        <span class="apMiniOrb"></span>
        <div>
          <p class="apEyebrow">Local Browser Agent</p>
          <h1>ActionPilot</h1>
        </div>
      </div>
      <button id="newChatButton" class="apHeaderButton" type="button">New chat</button>
    </header>

    <section id="chatThread" class="apChatThread"></section>

    <section id="selectedDock" class="apSelectedDock" hidden>
      <div>
        <p class="apTinyLabel">Selected action</p>
        <strong id="selectedTitle">Nothing selected</strong>
        <span id="selectedReason"></span>
      </div>
      <button id="executeButton" class="apExecuteMiniButton" type="button">Execute</button>
    </section>

    <details class="apDevDrawer">
      <summary>Developer details</summary>
      <div class="apDevGrid">
        <div>
          <p class="apTinyLabel">Detected</p>
          <strong id="elementsCount">0</strong>
        </div>
        <div>
          <p class="apTinyLabel">Brain</p>
          <strong>Local agent</strong>
        </div>
        <div>
          <p class="apTinyLabel">Server</p>
          <strong>None</strong>
        </div>
      </div>
      <div id="pageBox" class="apPageBox">No page analyzed yet.</div>
      <div id="elementsList" class="apElementsList">No scan yet.</div>
    </details>

    <footer class="apComposer">
      <textarea
        id="instruction"
        rows="1"
        placeholder="Ask ActionPilot..."
      ></textarea>
      <div class="apComposerActions">
        <button id="voiceButton" type="button">🎙</button>
        <button id="sendButton" type="button">Send</button>
      </div>
    </footer>

    <section class="apThemeDock apChatThemeDock">
      <button class="apThemeButton" data-theme="professional">Professional</button>
      <button class="apThemeButton" data-theme="jarvis">Jarvis</button>
      <button class="apThemeButton" data-theme="soft">Soft</button>
    </section>
  </main>
`;

const shell = document.querySelector<HTMLElement>(".apChatShell")!;
const chatThread = document.querySelector<HTMLDivElement>("#chatThread")!;
const instructionInput = document.querySelector<HTMLTextAreaElement>("#instruction")!;
const sendButton = document.querySelector<HTMLButtonElement>("#sendButton")!;
const voiceButton = document.querySelector<HTMLButtonElement>("#voiceButton")!;
const newChatButton = document.querySelector<HTMLButtonElement>("#newChatButton")!;
const selectedDock = document.querySelector<HTMLElement>("#selectedDock")!;
const selectedTitle = document.querySelector<HTMLElement>("#selectedTitle")!;
const selectedReason = document.querySelector<HTMLElement>("#selectedReason")!;
const executeButton = document.querySelector<HTMLButtonElement>("#executeButton")!;
const pageBox = document.querySelector<HTMLDivElement>("#pageBox")!;
const elementsCount = document.querySelector<HTMLElement>("#elementsCount")!;
const elementsList = document.querySelector<HTMLDivElement>("#elementsList")!;

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

function runningText(candidate: LocalAgentCandidate): string {
  if (candidate.tool === "search_web") {
    return `Searching: ${candidate.subtitle}...`;
  }

  if (candidate.tool === "open_url") {
    return `Opening: ${candidate.title.replace(/^Open\s+/i, "")}...`;
  }

  if (candidate.tool === "scroll_page") {
    return `${candidate.title}...`;
  }

  if (candidate.tool === "go_back") {
    return "Going back...";
  }

  if (candidate.tool === "go_forward") {
    return "Going forward...";
  }

  return `I can do this: ${candidate.title}. Waiting for confirmation.`;
}

function doneText(candidate: LocalAgentCandidate): string {
  if (candidate.tool === "search_web") {
    return `Done. Search results opened for “${candidate.subtitle}”.`;
  }

  if (candidate.tool === "open_url") {
    return `Done. Opened ${candidate.title.replace(/^Open\s+/i, "")}.`;
  }

  if (candidate.tool === "scroll_page") {
    return "Done. Page scrolled.";
  }

  if (candidate.tool === "go_back") {
    return "Done. Went back.";
  }

  if (candidate.tool === "go_forward") {
    return "Done. Went forward.";
  }

  return "Done.";
}

function addMessage(message: Omit<ChatMessage, "id">) {
  messages.push({
    id: crypto.randomUUID(),
    ...message
  });

  renderMessages();
}

function updateLastAssistantMessage(text: string, candidates?: LocalAgentCandidate[]) {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  if (!lastAssistant) {
    addMessage({ role: "assistant", text, candidates });
    return;
  }

  lastAssistant.text = text;
  lastAssistant.candidates = candidates;
  renderMessages();
}

function renderMessages() {
  chatThread.innerHTML = messages
    .map((message) => {
      const candidateHtml = message.candidates?.length
        ? renderCandidateCarousel(message.candidates)
        : "";

      return `
        <article class="apChatMessage ${message.role === "user" ? "isUser" : "isAssistant"}">
          <div class="apBubble">
            <p>${escapeHtml(message.text)}</p>
            ${candidateHtml}
          </div>
        </article>
      `;
    })
    .join("");

  chatThread.scrollTop = chatThread.scrollHeight;
}

function renderCandidateCarousel(candidates: LocalAgentCandidate[]): string {
  return `
    <div class="apChatCarousel">
      ${candidates
        .slice(0, 4)
        .map((candidate, index) => {
          const isSelected = selectedCandidate?.id === candidate.id;
          const badge = index === 0 ? "Recommended" : candidate.confidence >= 70 ? "Good match" : "Possible";

          return `
            <article class="apChatCandidate ${isSelected ? "isSelected" : ""}" data-candidate-id="${escapeHtml(candidate.id)}">
              <div class="apChatCandidateTop">
                <span>${toolIcon(candidate.tool)}</span>
                <em>${badge}</em>
              </div>
              <h3>${escapeHtml(candidate.title)}</h3>
              <p>${escapeHtml(candidate.subtitle)}</p>
              <div class="apMiniConfidence">
                <span>${toolLabel(candidate.tool)}</span>
                <strong>${candidate.confidence}%</strong>
              </div>
              <div class="apMiniBar">
                <span style="width: ${candidate.confidence}%"></span>
              </div>
              <button type="button" data-candidate-id="${escapeHtml(candidate.id)}">
                ${isSelected ? "Selected" : "Select"}
              </button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderSelected(candidate: LocalAgentCandidate | null) {
  selectedCandidate = candidate;
  selectedDock.hidden = !candidate;

  if (!candidate) {
    selectedTitle.textContent = "Nothing selected";
    selectedReason.textContent = "";
    executeButton.disabled = true;
    renderMessages();
    return;
  }

  selectedTitle.textContent = candidate.title;
  selectedReason.textContent = candidate.reason;
  executeButton.disabled = candidate.tool === "ask_clarification" || candidate.risk === "blocked";
  renderMessages();
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

async function sendRuntimeMessage(request: unknown): Promise<RuntimeResponse> {
  return await chrome.runtime.sendMessage(request);
}

async function scanActivePage(): Promise<PageScanResult> {
  const response = await sendRuntimeMessage({ type: "SCAN_PAGE" });

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

async function executeCandidate(candidate: LocalAgentCandidate): Promise<string> {
  if (candidate.tool === "ask_clarification") {
    instructionInput.focus();
    return "Ask again with more detail.";
  }

  if (candidate.tool === "open_url" || candidate.tool === "search_web") {
    if (!candidate.url) {
      throw new Error("No URL found for this action.");
    }

    await openUrlInActiveTab(candidate.url);
    return doneText(candidate);
  }

  if (candidate.tool === "scroll_page") {
    await scrollActivePage(candidate.scrollDirection ?? "down");
    return doneText(candidate);
  }

  if (candidate.tool === "go_back") {
    await goBack();
    return doneText(candidate);
  }

  if (candidate.tool === "go_forward") {
    await goForward();
    return doneText(candidate);
  }

  if (candidate.tool === "click_element") {
    const plan = makePlannedClick(candidate);

    const response = await sendRuntimeMessage({
      type: "EXECUTE_ACTION",
      payload: { action: plan }
    });

    if (!response.ok || response.type !== "EXECUTE_ACTION_RESULT") {
      throw new Error(response.ok ? "Unexpected execution response." : response.error);
    }

    return response.payload.message;
  }

  return "This action is not executable yet.";
}

async function submitCommand() {
  const message = instructionInput.value.trim();

  if (!message) {
    return;
  }

  instructionInput.value = "";
  renderSelected(null);
  addMessage({ role: "user", text: message });
  addMessage({ role: "assistant", text: "Thinking locally..." });

  try {
    let plan = createLocalAgentPlan({
      message,
      scan: lastScan
    });

    if (plan.needsScan) {
      updateLastAssistantMessage("Analyzing the active page...");
      lastScan = await scanActivePage();
      renderPage(lastScan);
      renderDeveloperElements(lastScan.elements);

      plan = createLocalAgentPlan({
        message,
        scan: lastScan
      });
    }

    latestCandidates = plan.candidates.slice(0, 4);
    const recommendedCandidate =
      latestCandidates.find((candidate) => candidate.id === plan.recommendedCandidateId) ??
      latestCandidates[0] ??
      null;

    if (recommendedCandidate && autoRunTools.has(recommendedCandidate.tool) && recommendedCandidate.confidence >= 85) {
      updateLastAssistantMessage(runningText(recommendedCandidate));
      const result = await executeCandidate(recommendedCandidate);
      addMessage({ role: "assistant", text: result });
      return;
    }

    updateLastAssistantMessage(plan.message, latestCandidates);
    renderSelected(recommendedCandidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown local agent error.";
    updateLastAssistantMessage(message);
  }
}

function selectCandidateByIndex(index: number) {
  const candidate = latestCandidates[index];

  if (!candidate) {
    addMessage({ role: "assistant", text: "That option is not available." });
    return;
  }

  renderSelected(candidate);
  addMessage({ role: "assistant", text: `Selected: ${candidate.title}. Say “confirm” or press Execute.` });
}

async function executeSelectedAction() {
  if (!selectedCandidate) {
    addMessage({ role: "assistant", text: "Select an action first." });
    return;
  }

  addMessage({ role: "assistant", text: `Executing: ${selectedCandidate.title}...` });

  try {
    const result = await executeCandidate(selectedCandidate);
    addMessage({ role: "assistant", text: result });
    renderSelected(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error.";
    addMessage({ role: "assistant", text: message });
  }
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
    addMessage({ role: "assistant", text: "Cancelled." });
    return true;
  }

  return false;
}

function startVoiceInput() {
  const SpeechRecognitionClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    addMessage({ role: "assistant", text: "Voice input is not supported in this browser. Use chat mode." });
    return;
  }

  if (isListening && recognition) {
    recognition.abort();
    isListening = false;
    voiceButton.textContent = "🎙";
    addMessage({ role: "assistant", text: "Voice input stopped." });
    return;
  }

  recognition = new SpeechRecognitionClass();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";

    if (!transcript) {
      addMessage({ role: "assistant", text: "I did not hear a command. Try again." });
      return;
    }

    if (handleVoiceShortcut(transcript)) {
      return;
    }

    instructionInput.value = transcript;
    void submitCommand();
  };

  recognition.onerror = (event) => {
    addMessage({ role: "assistant", text: `Voice error: ${event.error ?? "unknown"}. Use chat mode if needed.` });
  };

  recognition.onend = () => {
    isListening = false;
    voiceButton.textContent = "🎙";
  };

  isListening = true;
  voiceButton.textContent = "●";
  addMessage({ role: "assistant", text: "Listening. Say what you want to do." });
  recognition.start();
}

function newChat() {
  instructionInput.value = "";
  lastScan = null;
  latestCandidates = [];
  selectedCandidate = null;
  messages = [];
  renderPage(null);
  renderDeveloperElements([]);
  renderSelected(null);
  addMessage({
    role: "assistant",
    text: "Ready. Ask me to open a site, search, scroll, go back, or click something on the page."
  });
  instructionInput.focus();
}

sendButton.addEventListener("click", () => {
  void submitCommand();
});

executeButton.addEventListener("click", () => {
  void executeSelectedAction();
});

voiceButton.addEventListener("click", () => {
  startVoiceInput();
});

newChatButton.addEventListener("click", () => {
  newChat();
});

chatThread.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const card = target.closest<HTMLElement>("[data-candidate-id]");

  if (!card) return;

  const candidate = latestCandidates.find((item) => item.id === card.dataset.candidateId);

  if (!candidate) return;

  renderSelected(candidate);
  addMessage({ role: "assistant", text: `Selected: ${candidate.title}. Say “confirm” or press Execute.` });
});

document.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.theme as AssistantTheme;
    activeTheme = theme;
    shell.dataset.theme = activeTheme;
  });
});

instructionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void submitCommand();
  }
});

newChat();