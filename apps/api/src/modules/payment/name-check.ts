import { NameCheckResult } from "@prisma/client";

const NOISE_TOKENS = new Set(["BIN", "BINTI", "BT", "BTE"]);

/**
 * Normalize a person/company name for AML matching:
 * uppercase, collapse whitespace, strip punctuation.
 */
export function normalizeNameForCheck(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function stripAlias(value: string): string {
  const atIndex = value.indexOf("@");
  return atIndex >= 0 ? value.slice(0, atIndex).trim() : value;
}

function filterConnectorTokens(tokens: string[]): string[] {
  const filtered: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (NOISE_TOKENS.has(token)) {
      continue;
    }

    if (token === "A" && i + 1 < tokens.length && (tokens[i + 1] === "L" || tokens[i + 1] === "P")) {
      i += 1;
      continue;
    }
    if (token === "S" && i + 1 < tokens.length && tokens[i + 1] === "O") {
      i += 1;
      continue;
    }
    if (token === "D" && i + 1 < tokens.length && tokens[i + 1] === "O") {
      i += 1;
      continue;
    }

    filtered.push(token);
  }

  return filtered;
}

export function tokenizeNameForCheck(value: string): string[] {
  const withoutAlias = stripAlias(value);
  const normalized = normalizeNameForCheck(withoutAlias);
  if (!normalized) {
    return [];
  }

  return filterConnectorTokens(normalized.split(" ").filter(Boolean));
}

function tokenMultisetKey(tokens: string[]): string {
  return [...tokens].sort().join("\0");
}

function multisetEquals(a: string[], b: string[]): boolean {
  return tokenMultisetKey(a) === tokenMultisetKey(b);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function isSubsetOrSuperset(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  const aInB = [...setA].every((token) => setB.has(token));
  const bInA = [...setB].every((token) => setA.has(token));
  return aInB || bInA;
}

function normalizeCompanyName(value: string): string | null {
  const normalized = normalizeNameForCheck(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\bSDN\s+BHD\b/g, "SDN BHD");
}

export type NameCheckInput = {
  expectedVariants: string[];
  payerName: string | null | undefined;
  isCompany?: boolean;
};

export type NameCheckOutcome = {
  decision: NameCheckResult;
  score: number;
  matchedVariant: string | null;
};

function evaluatePersonalMatch(
  payerTokens: string[],
  expectedVariants: string[]
): NameCheckOutcome {
  let bestScore = -1;
  let bestVariant: string | null = null;

  for (const variant of expectedVariants) {
    const expectedTokens = tokenizeNameForCheck(variant);
    if (expectedTokens.length === 0) {
      continue;
    }

    if (multisetEquals(payerTokens, expectedTokens)) {
      return { decision: NameCheckResult.PASS, score: 1, matchedVariant: variant };
    }

    const score = jaccardSimilarity(payerTokens, expectedTokens);
    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }

  if (bestVariant === null) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  const expectedTokens = tokenizeNameForCheck(bestVariant);
  if (
    isSubsetOrSuperset(payerTokens, expectedTokens) ||
    bestScore >= 0.5
  ) {
    return { decision: NameCheckResult.REVIEW, score: bestScore, matchedVariant: bestVariant };
  }

  return { decision: NameCheckResult.FAIL, score: bestScore, matchedVariant: bestVariant };
}

function evaluateCompanyMatch(
  payerName: string,
  expectedVariants: string[]
): NameCheckOutcome {
  const normalizedPayer = normalizeCompanyName(payerName);
  if (!normalizedPayer) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  let bestScore = -1;
  let bestVariant: string | null = null;

  for (const variant of expectedVariants) {
    const normalizedExpected = normalizeCompanyName(variant);
    if (!normalizedExpected) {
      continue;
    }

    if (normalizedPayer === normalizedExpected) {
      return { decision: NameCheckResult.PASS, score: 1, matchedVariant: variant };
    }

    const payerTokens = tokenizeNameForCheck(normalizedPayer);
    const expectedTokens = tokenizeNameForCheck(normalizedExpected);
    const score = jaccardSimilarity(payerTokens, expectedTokens);
    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }

  if (bestVariant === null) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  if (bestScore >= 0.5) {
    return { decision: NameCheckResult.REVIEW, score: bestScore, matchedVariant: bestVariant };
  }

  return { decision: NameCheckResult.FAIL, score: bestScore, matchedVariant: bestVariant };
}

/** Token-based name check with PASS / REVIEW / FAIL / NAME_UNAVAILABLE outcomes. */
export function runNameCheck(input: NameCheckInput): NameCheckOutcome {
  if (!input.payerName?.trim()) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  const payerTokens = tokenizeNameForCheck(input.payerName);
  if (payerTokens.length === 0) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  const expectedVariants = input.expectedVariants
    .map((variant) => variant.trim())
    .filter(Boolean);

  if (expectedVariants.length === 0) {
    return { decision: NameCheckResult.NAME_UNAVAILABLE, score: 0, matchedVariant: null };
  }

  if (input.isCompany) {
    return evaluateCompanyMatch(input.payerName, expectedVariants);
  }

  return evaluatePersonalMatch(payerTokens, expectedVariants);
}
