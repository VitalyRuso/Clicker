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

export function findBlockedTerm(input: string): string | null {
  const normalized = input.toLowerCase();
  return BLOCKED_TERMS.find((term) => normalized.includes(term)) ?? null;
}

export function isInstructionBlocked(input: string): boolean {
  return findBlockedTerm(input) !== null;
}
