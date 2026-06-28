import type { PageElementSnapshot, PageScanResult } from "./types";

export type BrowserTool =
  | "open_url"
  | "search_web"
  | "click_element"
  | "scroll_page"
  | "go_back"
  | "go_forward"
  | "ask_clarification";

export type LocalAgentCandidate = {
  id: string;
  tool: BrowserTool;
  title: string;
  subtitle: string;
  confidence: number;
  reason: string;
  risk: "low" | "medium" | "blocked";
  elementId?: string;
  url?: string;
  scrollDirection?: "up" | "down";
  matchedText?: string;
};

export type LocalAgentRequest = {
  message: string;
  scan?: PageScanResult | null;
};

export type LocalAgentResponse = {
  message: string;
  candidates: LocalAgentCandidate[];
  recommendedCandidateId?: string;
  needsScan: boolean;
};

const knownSites: Array<{ keys: string[]; title: string; url: string }> = [
  { keys: ["youtube", "ютуб", "ютюб"], title: "Open YouTube", url: "https://www.youtube.com" },
  { keys: ["google", "гугл"], title: "Open Google", url: "https://www.google.com" },
  { keys: ["gmail"], title: "Open Gmail", url: "https://mail.google.com" },
  { keys: ["github", "гитхаб"], title: "Open GitHub", url: "https://github.com" },
  { keys: ["chatgpt", "openai"], title: "Open ChatGPT", url: "https://chatgpt.com" },
  { keys: ["rae", "dle", "dictionary", "словарь"], title: "Open RAE dictionary", url: "https://dle.rae.es" }
];

const searchEngines: Array<{ keys: string[]; title: string; buildUrl: (query: string) => string }> = [
  {
    keys: ["youtube", "ютуб", "ютюб"],
    title: "Search on YouTube",
    buildUrl: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  },
  {
    keys: ["google", "гугл", "web", "internet"],
    title: "Search on Google",
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    keys: ["rae", "dle", "dictionary", "словарь"],
    title: "Search in RAE",
    buildUrl: (query) => `https://dle.rae.es/${encodeURIComponent(query)}`
  }
];

export function createLocalAgentPlan(request: LocalAgentRequest): LocalAgentResponse {
  const message = request.message.trim();

  if (!message) {
    return {
      message: "Tell me what you want to do.",
      candidates: [clarify("Write or say a command like “Open YouTube” or “Click search”.")],
      needsScan: false
    };
  }

  const directUrlCandidate = parseDirectUrl(message);
  if (directUrlCandidate) {
    return response("I found a website to open.", [directUrlCandidate], false);
  }

  const scrollCandidate = parseScroll(message);
  if (scrollCandidate) {
    return response("I can scroll the current page.", [scrollCandidate], false);
  }

  const historyCandidate = parseHistory(message);
  if (historyCandidate) {
    return response("I can navigate the browser history.", [historyCandidate], false);
  }

 const searchCandidate = parseSearch(message);
    if (searchCandidate) {
  return response("I can search this for you.", [searchCandidate], false);
}

const openSiteCandidate = parseKnownSiteOpen(message);
    if (openSiteCandidate) {
  return response("I found a website shortcut.", [openSiteCandidate], false);
}

  if (!request.scan) {
    return {
      message: "I need to analyze the current page before choosing a visible action.",
      candidates: [
        clarify("Analyze this page and suggest 4 actions."),
        ...fallbackGeneralCandidates(message)
      ],
      needsScan: true
    };
  }

  const clickCandidates = makeClickCandidates(message, request.scan.elements, 4);

  if (clickCandidates.length > 0) {
    return response("I found possible actions on this page.", clickCandidates, false);
  }

  return response(
    "I am not sure what you mean. Choose one option or ask again.",
    [
      clarify("Rephrase the command with the exact button or field name."),
      ...fallbackGeneralCandidates(message)
    ],
    false
  );
}

function response(message: string, candidates: LocalAgentCandidate[], needsScan: boolean): LocalAgentResponse {
  return {
    message,
    candidates,
    recommendedCandidateId: candidates[0]?.id,
    needsScan
  };
}

function parseDirectUrl(input: string): LocalAgentCandidate | null {
  const directUrl = input.match(/https?:\/\/[^\s]+/i)?.[0];

  if (directUrl) {
    return {
      id: crypto.randomUUID(),
      tool: "open_url",
      title: "Open website",
      subtitle: directUrl,
      confidence: 98,
      reason: "The command contains a direct URL.",
      risk: "low",
      url: directUrl
    };
  }

  const domain = input.match(/\b([a-z0-9-]+\.[a-z]{2,})(\/[^\s]*)?\b/i)?.[0];

  if (!domain) return null;

  return {
    id: crypto.randomUUID(),
    tool: "open_url",
    title: `Open ${domain}`,
    subtitle: `https://${domain}`,
    confidence: 92,
    reason: "The command contains a website domain.",
    risk: "low",
    url: `https://${domain}`
  };
}

function parseKnownSiteOpen(input: string): LocalAgentCandidate | null {
  const normalized = normalize(input);
  const looksLikeOpen =
  hasWord(normalized, "open") ||
  hasPhrase(normalized, "go to") ||
  hasPhrase(normalized, "go on") ||
  hasWord(normalized, "открой") ||
  hasWord(normalized, "открыть") ||
  hasWord(normalized, "зайди") ||
  hasWord(normalized, "зайти");

  if (!looksLikeOpen) return null;

  const site = knownSites.find((item) => item.keys.some((key) => normalized.includes(key)));

  if (!site) return null;

  return {
    id: crypto.randomUUID(),
    tool: "open_url",
    title: site.title,
    subtitle: site.url,
    confidence: 94,
    reason: "The command looks like a website navigation request.",
    risk: "low",
    url: site.url
  };
}

function parseSearch(input: string): LocalAgentCandidate | null {
  const normalized = normalize(input);
  const looksLikeSearch = hasAny(normalized, ["search", "find", "look for", "ищи", "найди", "поиск", "искать"]);

  if (!looksLikeSearch) return null;

  const engine =
    searchEngines.find((item) => item.keys.some((key) => normalized.includes(key))) ??
    searchEngines.find((item) => item.title === "Search on Google")!;

  const query = cleanupSearchQuery(input, engine.keys);

  if (!query) return null;

  return {
    id: crypto.randomUUID(),
    tool: "search_web",
    title: engine.title,
    subtitle: query,
    confidence: 88,
    reason: "The command looks like a search request.",
    risk: "low",
    url: engine.buildUrl(query)
  };
}

function parseScroll(input: string): LocalAgentCandidate | null {
  const normalized = normalize(input);

  if (hasAny(normalized, ["scroll down", "down", "ниже", "вниз", "прокрути вниз"])) {
    return {
      id: crypto.randomUUID(),
      tool: "scroll_page",
      title: "Scroll down",
      subtitle: "Move the current page down.",
      confidence: 95,
      reason: "The command asks to scroll down.",
      risk: "low",
      scrollDirection: "down"
    };
  }

  if (hasAny(normalized, ["scroll up", "up", "выше", "вверх", "прокрути вверх"])) {
    return {
      id: crypto.randomUUID(),
      tool: "scroll_page",
      title: "Scroll up",
      subtitle: "Move the current page up.",
      confidence: 95,
      reason: "The command asks to scroll up.",
      risk: "low",
      scrollDirection: "up"
    };
  }

  return null;
}

function parseHistory(input: string): LocalAgentCandidate | null {
  const normalized = normalize(input);

  if (hasAny(normalized, ["go back", "back", "назад", "вернись"])) {
    return {
      id: crypto.randomUUID(),
      tool: "go_back",
      title: "Go back",
      subtitle: "Navigate to the previous page.",
      confidence: 94,
      reason: "The command asks to go back.",
      risk: "low"
    };
  }

  if (hasAny(normalized, ["go forward", "forward", "вперед", "вперёд"])) {
    return {
      id: crypto.randomUUID(),
      tool: "go_forward",
      title: "Go forward",
      subtitle: "Navigate to the next page.",
      confidence: 94,
      reason: "The command asks to go forward.",
      risk: "low"
    };
  }

  return null;
}

function makeClickCandidates(input: string, elements: PageElementSnapshot[], limit: number): LocalAgentCandidate[] {
  return elements
    .map((element) => ({ element, score: scoreElement(input, element) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ element, score }, index) => ({
      id: crypto.randomUUID(),
      tool: "click_element",
      title: elementLabel(element),
      subtitle: elementMeta(element),
      confidence: index === 0 ? Math.max(score, 65) : score,
      reason: index === 0 ? "Best local match on the current page." : "Possible local match on the current page.",
      risk: score >= 45 ? "low" : "medium",
      elementId: element.elementId,
      matchedText: elementLabel(element)
    }));
}

function fallbackGeneralCandidates(input: string): LocalAgentCandidate[] {
  const search = parseSearch(`search google ${input}`) ?? clarify("Search this on Google.");

  return [
    search,
    {
      id: crypto.randomUUID(),
      tool: "open_url",
      title: "Open Google",
      subtitle: "https://www.google.com",
      confidence: 72,
      reason: "Fallback option for web navigation.",
      risk: "low",
      url: "https://www.google.com"
    },
    {
      id: crypto.randomUUID(),
      tool: "scroll_page",
      title: "Scroll down",
      subtitle: "Maybe the target is lower on the page.",
      confidence: 62,
      reason: "Fallback option for page exploration.",
      risk: "low",
      scrollDirection: "down"
    }
  ];
}

function clarify(subtitle: string): LocalAgentCandidate {
  return {
    id: crypto.randomUUID(),
    tool: "ask_clarification",
    title: "Ask clarification",
    subtitle,
    confidence: 50,
    reason: "The command is not specific enough.",
    risk: "low"
  };
}

function scoreElement(input: string, element: PageElementSnapshot): number {
  const tokens = meaningfulTokens(input);
  const haystack = normalize(
    [element.text, element.ariaLabel, element.placeholder, element.title, element.role, element.tagName, element.inputType].join(" ")
  );

  if (!element.visible || !element.clickable || haystack.length === 0) {
    return 0;
  }

  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) score += 24;
  }

  if (element.tagName === "button") score += 10;
  if (element.role === "button") score += 8;
  if (element.tagName === "input") score += 8;
  if (element.tagName === "a") score += 5;
  if (element.rect.width > 0 && element.rect.height > 0) score += 4;

  return Math.min(score, 100);
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
    "for",
    "открой",
    "нажми",
    "кнопку",
    "найди",
    "покажи"
  ]);

  return normalize(input)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function cleanupSearchQuery(input: string, engineKeys: string[]): string {
  let result = input;

 const removeWords = [
  "search",
  "find",
  "look for",
  "go look for",
  "google",
  "youtube",
  "rae",
  "dle",
  "please",
  "me",
  "for",
  "ищи",
  "найди",
  "поиск",
  "искать",
  "в",
  "на",
  ...engineKeys
];

  for (const word of removeWords) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), " ");
  }

  return result.replace(/\s+/g, " ").trim();
}

function elementLabel(element: PageElementSnapshot): string {
  return [element.text, element.ariaLabel, element.placeholder, element.title].filter(Boolean).join(" | ") || `<${element.tagName}>`;
}

function elementMeta(element: PageElementSnapshot): string {
  return [
    element.tagName,
    element.role ? `role=${element.role}` : "",
    element.inputType ? `type=${element.inputType}` : "",
    `${Math.round(element.rect.width)}x${Math.round(element.rect.height)}`
  ]
    .filter(Boolean)
    .join(" · ");
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

function hasAny(input: string, terms: string[]): boolean {
  return terms.some((term) => input.includes(term));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWord(input: string, word: string): boolean {
  return new RegExp(`(^|\\s)${escapeRegExp(word)}(\\s|$)`, "i").test(input);
}

function hasPhrase(input: string, phrase: string): boolean {
  return input.includes(phrase);
}