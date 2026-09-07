import {
  omitRecordId,
  pickKnownKeys,
  toOperatorShareCapitalPatch,
  OPERATOR_ADVISOR_BODY_KEYS,
  OPERATOR_FINANCIAL_STATEMENT_BODY_KEYS,
  OPERATOR_INTEREST_BODY_KEYS,
  OPERATOR_OFFICER_BODY_KEYS,
  OPERATOR_SHAREHOLDER_BODY_KEYS,
} from "@cashsouk/types";

export function shorakaShareCapitalPayload(
  shareCapital: Record<string, unknown> | null | undefined,
  kind: "SDN_BHD" | "LLP"
): Record<string, unknown> {
  return toOperatorShareCapitalPatch(shareCapital ?? {}, kind);
}

export function shorakaShareholderPayload(row: Record<string, unknown>): Record<string, unknown> {
  return pickKnownKeys(omitRecordId(row), OPERATOR_SHAREHOLDER_BODY_KEYS);
}

export function shorakaOfficerPayload(row: Record<string, unknown>): Record<string, unknown> {
  return pickKnownKeys(omitRecordId(row), OPERATOR_OFFICER_BODY_KEYS);
}

export function shorakaAdvisorPayload(row: Record<string, unknown>): Record<string, unknown> {
  return pickKnownKeys(omitRecordId(row), OPERATOR_ADVISOR_BODY_KEYS);
}

export function shorakaInterestPayload(row: Record<string, unknown>): Record<string, unknown> {
  return pickKnownKeys(omitRecordId(row), OPERATOR_INTEREST_BODY_KEYS);
}

export function shorakaFinancialPayload(row: Record<string, unknown>): Record<string, unknown> {
  return pickKnownKeys(omitRecordId(row), OPERATOR_FINANCIAL_STATEMENT_BODY_KEYS);
}
