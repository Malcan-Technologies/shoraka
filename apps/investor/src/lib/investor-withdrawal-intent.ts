const WITHDRAWAL_INTENT_STORAGE_PREFIX = "investor-withdrawal-intent";

type PersistedWithdrawalIntent = {
  intentId: string;
  amount: number;
};

function getWithdrawalIntentStorageKey(investorOrganizationId: string) {
  return `${WITHDRAWAL_INTENT_STORAGE_PREFIX}:${investorOrganizationId}`;
}

function makeWithdrawalIntentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readPersistedWithdrawalIntent(
  investorOrganizationId: string
): PersistedWithdrawalIntent | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(getWithdrawalIntentStorageKey(investorOrganizationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedWithdrawalIntent;
    if (!parsed.intentId || typeof parsed.amount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedWithdrawalIntent(
  investorOrganizationId: string,
  value: PersistedWithdrawalIntent
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getWithdrawalIntentStorageKey(investorOrganizationId),
    JSON.stringify(value)
  );
}

export function getOrCreateInvestorWithdrawalIntent(
  investorOrganizationId: string,
  amount: number
): string {
  const existing = readPersistedWithdrawalIntent(investorOrganizationId);
  if (existing && existing.amount === amount) {
    return existing.intentId;
  }

  const intentId = makeWithdrawalIntentId();
  writePersistedWithdrawalIntent(investorOrganizationId, { intentId, amount });
  return intentId;
}

export function clearInvestorWithdrawalIntent(investorOrganizationId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getWithdrawalIntentStorageKey(investorOrganizationId));
}
