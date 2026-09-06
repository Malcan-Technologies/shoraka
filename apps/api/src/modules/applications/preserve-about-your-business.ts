/**
 * Keep historical About Your Business JSON on business_details when the issuer
 * step no longer sends those keys. Zod defaults would otherwise wipe them.
 * Also keep legacy `why_raising_funds.financing_for` when the current form
 * no longer collects it and the payload would store an empty string.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasOwnAbout(raw: Record<string, unknown>): boolean {
  return raw.about_your_business !== undefined || raw.aboutYourBusiness !== undefined;
}

function hasOwnAccountingSoftware(raw: Record<string, unknown>): boolean {
  const why = asRecord(raw.why_raising_funds) ?? asRecord(raw.whyRaisingFunds);
  if (!why) return false;
  return why.accounting_software !== undefined || why.accountingSoftware !== undefined;
}

export function preserveLegacyAboutYourBusinessFields(
  incomingParsed: Record<string, unknown>,
  rawPayload: unknown,
  existingBusinessDetails: unknown
): Record<string, unknown> {
  const raw = asRecord(rawPayload) ?? {};
  const existing = asRecord(existingBusinessDetails);
  const next = { ...incomingParsed };

  if (!hasOwnAbout(raw) && existing) {
    const existingAbout = existing.about_your_business ?? existing.aboutYourBusiness;
    if (existingAbout !== undefined) {
      next.about_your_business = existingAbout;
    }
  }

  if (!hasOwnAccountingSoftware(raw) && existing) {
    const existingWhy = asRecord(existing.why_raising_funds) ?? asRecord(existing.whyRaisingFunds);
    const existingAccounting = existingWhy?.accounting_software ?? existingWhy?.accountingSoftware;
    if (existingAccounting !== undefined) {
      const why = asRecord(next.why_raising_funds) ?? {};
      next.why_raising_funds = { ...why, accounting_software: existingAccounting };
    }
  }

  const existingWhy = asRecord(existing?.why_raising_funds) ?? asRecord(existing?.whyRaisingFunds);
  const existingFinancingFor = existingWhy?.financing_for ?? existingWhy?.financingFor;
  if (typeof existingFinancingFor === "string" && existingFinancingFor.trim()) {
    const why = asRecord(next.why_raising_funds) ?? {};
    const incomingFinancingFor =
      typeof why.financing_for === "string" ? why.financing_for.trim() : "";
    if (!incomingFinancingFor) {
      next.why_raising_funds = { ...why, financing_for: existingFinancingFor };
    }
  }

  return next;
}
