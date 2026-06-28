import type { PageElementSnapshot, PlannerResult } from "./types";
import { findBlockedTerm } from "./safety";

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
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
    "go"
  ]);

  return normalize(input)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
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

function scoreElement(instruction: string, element: PageElementSnapshot): number {
  const normalizedInstruction = normalize(instruction);
  const tokens = meaningfulTokens(instruction);
  const haystack = elementSearchText(element);

  let score = 0;

  if (!element.visible || !element.clickable) return 0;
  if (haystack.length === 0) return 0;

  if (normalizedInstruction.includes(haystack) || haystack.includes(normalizedInstruction)) {
    score += 60;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) score += 20;
  }

  if (element.tagName === "button") score += 12;
  if (element.role === "button") score += 10;
  if (element.tagName === "a") score += 6;
  if (element.rect.width > 0 && element.rect.height > 0) score += 5;

  return Math.min(score, 100);
}

export function planLocalClick(instruction: string, elements: PageElementSnapshot[]): PlannerResult {
  const trimmedInstruction = instruction.trim();
  const blockedTerm = findBlockedTerm(trimmedInstruction);

  if (!trimmedInstruction) {
    return {
      ok: false,
      blocked: false,
      reason: "Write an instruction first. Example: Click the login button."
    };
  }

  if (blockedTerm) {
    return {
      ok: false,
      blocked: true,
      reason: `Blocked for safety: the instruction contains or implies a restricted action: ${blockedTerm}.`
    };
  }

  const ranked = elements
    .map((element) => ({ element, score: scoreElement(trimmedInstruction, element) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      ok: false,
      blocked: false,
      reason: "No matching visible clickable element was found. Try scanning again or use more exact text.",
      candidates: elements.slice(0, 8)
    };
  }

  const best = ranked[0];
  const matchedText = [best.element.text, best.element.ariaLabel, best.element.placeholder, best.element.title]
    .filter(Boolean)
    .join(" | ") || best.element.tagName;

  if (best.score < 25) {
    return {
      ok: false,
      blocked: false,
      reason: "The best match is too weak. The extension should ask the user to choose manually.",
      candidates: ranked.slice(0, 5).map((item) => item.element)
    };
  }

  return {
    ok: true,
    plan: {
      actionId: crypto.randomUUID(),
      kind: "click",
      elementId: best.element.elementId,
      confidence: best.score,
      risk: "low",
      reason: `Best visible match for the instruction with score ${best.score}.`,
      matchedText,
      instruction: trimmedInstruction
    }
  };
}
