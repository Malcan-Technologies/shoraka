/**
 * CashSouk ComRep requiredness: default REQUIRED for profile/data-entry fields
 * that map to a ComRep column, unless the SC manual gives an explicit exception.
 * This is a CashSouk completeness policy, not an SC-mandatory list.
 */

import {
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
} from "./financial-field-labels";
import { SC_MONTHLY_ISSUER_FINANCIAL_LABELS } from "./comrep-field-copy";
import { isScIntegerWithoutDecimal } from "./comrep-normalization";
import {
  OPERATOR_ADVISOR_TYPES,
  SC_COMPANY_TYPES,
  SC_DESIGNATIONS,
  SC_GENDERS,
  SC_IDENTITY_PREFIXES,
  SC_PERSON_KINDS,
  SC_SHARE_TYPES,
} from "./comrep-profile";
import { isValidProfilePhone } from "./profile-phone";

export const SC_OUTSIDE_MALAYSIA = "Outside Malaysia";

export type ComrepFieldIssue = {
  field: string;
  label: string;
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

export function trimToNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidNumberValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value.replace(/,/g, "")));
  }
  return false;
}

export function isScPostcodeRequired(state: unknown): boolean {
  return trimToNull(state) !== SC_OUTSIDE_MALAYSIA;
}

export function requiredTextIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  if (!isBlank(value)) return null;
  return { field, label, message: `${label} is required.` };
}

export function requiredEmailIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  const text = trimToNull(value);
  if (!text) return { field, label, message: `${label} is required.` };
  if (!isValidEmail(text)) return { field, label, message: `Enter a valid e-mail address.` };
  return null;
}

export function optionalEmailIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  if (isBlank(value)) return null;
  return requiredEmailIssue(value, field, label);
}

export function phoneInvalidMessage(label: string): string {
  return /contact/i.test(label) ? "Enter a valid contact number." : "Enter a valid phone number.";
}

export function phoneFormatIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  if (isBlank(value)) return null;
  const text = typeof value === "string" ? value : String(value);
  if (isValidProfilePhone(text)) return null;
  return { field, label, message: phoneInvalidMessage(label) };
}

export function requiredPhoneIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  const blank = requiredTextIssue(value, field, label);
  if (blank) return blank;
  return phoneFormatIssue(value, field, label);
}

export function optionalIdentityFormatIssue(
  value: unknown,
  kind: "NRIC" | "ROC" | "PASSPORT",
  field: string,
  label: string
): ComrepFieldIssue | null {
  if (isBlank(value)) return null;
  return identityFormatIssue(value, kind, field, label);
}

function percentCapIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 100) return null;
  } else if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/%/g, "").replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 100) return null;
  } else {
    return null;
  }
  return { field, label, message: "Enter a percentage of 100 or less." };
}

export function requiredDateIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  const text =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString().slice(0, 10)
      : trimToNull(value);
  if (!text) return { field, label, message: `${label} is required.` };
  if (!isValidIsoDate(text) && Number.isNaN(new Date(text).getTime())) {
    return { field, label, message: `${label} must be a valid date.` };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !isValidIsoDate(text)) {
    return { field, label, message: `${label} must be a valid date.` };
  }
  return null;
}

export function requiredEnumIssue(
  value: unknown,
  allowed: readonly string[],
  field: string,
  label: string
): ComrepFieldIssue | null {
  const text = trimToNull(value);
  if (!text) return { field, label, message: `Select a ${label}.` };
  if (!allowed.includes(text)) return { field, label, message: `Select a valid ${label}.` };
  return null;
}

export function requiredNumberIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  if (isValidNumberValue(value)) return null;
  return { field, label, message: `${label} is required.` };
}

export function requiredIntegerIssue(value: unknown, field: string, label: string): ComrepFieldIssue | null {
  const missing = requiredNumberIssue(value, field, label);
  if (missing) return missing;
  if (!isScIntegerWithoutDecimal(value)) {
    return { field, label, message: `${label} must be a whole number.` };
  }
  return null;
}

export function requiredPostcodeIssue(
  postcode: unknown,
  state: unknown,
  field: string,
  label: string
): ComrepFieldIssue | null {
  if (!isScPostcodeRequired(state)) return null;
  return requiredTextIssue(postcode, field, label);
}

export function firstIssueMessage(issues: ComrepFieldIssue[]): string | null {
  return issues[0]?.message ?? null;
}

export function issuesByField(issues: ComrepFieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    if (!map[issue.field]) map[issue.field] = issue.message;
  }
  return map;
}

export function identityFormatIssue(
  value: unknown,
  kind: "NRIC" | "ROC" | "PASSPORT",
  field: string,
  label: string
): ComrepFieldIssue | null {
  const blank = requiredTextIssue(value, field, label);
  if (blank) return blank;
  if (kind === "PASSPORT") return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (/[^A-Za-z0-9]/.test(raw)) {
    return {
      field,
      label,
      message: `${label} must not include dashes, spaces, or special characters.`,
    };
  }
  return null;
}

export function validateIssuerFinancialFieldsPatch(
  fields: Record<string, unknown>
): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  const known = new Set<string>([...ISSUER_PROFILE_BALANCE_SHEET_KEYS, ...ISSUER_PROFILE_PNL_KEYS]);
  for (const [key, value] of Object.entries(fields)) {
    if (!known.has(key) || !isIssuerFinancialFieldRequired(key)) continue;
    const label = SC_MONTHLY_ISSUER_FINANCIAL_LABELS[key] ?? key;
    push(issues, requiredNumberIssue(value, key, label));
  }
  return issues;
}

const SHARE_CAPITAL_PATCH_LABELS: Record<string, string> = {
  ordinaryUnits: "Ordinary (for Sdn Bhd) — No. of Shares",
  ordinaryAmount: "Ordinary (for Sdn Bhd) — Nominal Value (RM)",
  preferenceUnits: "Preference (for Sdn Bhd) — No. of Shares",
  preferenceAmount: "Preference (for Sdn Bhd) — Nominal Value (RM)",
  othersUnits: "Others (for Sdn Bhd) — No. of Shares",
  othersAmount: "Others (for Sdn Bhd) — Nominal Value (RM)",
  totalPaidUpCapital: "Total paid up capital (for Sdn Bhd)",
  llpMembersCapitalUnits: "Members' Capital — No. of Shares",
  llpMembersCapitalAmount: "Members' Capital — Nominal Value (RM)",
  llpSubordinatedLoansUnits: "Subordinated Loans — No. of Shares",
  llpSubordinatedLoansAmount: "Subordinated Loans — Nominal Value (RM)",
  totalLlp: "Total Limited Liability Partnership",
};

const SHARE_CAPITAL_INTEGER_KEYS = new Set([
  "ordinaryUnits",
  "preferenceUnits",
  "othersUnits",
  "totalPaidUpCapital",
  "llpMembersCapitalUnits",
  "llpSubordinatedLoansUnits",
]);

export function validateOperatorShareCapitalPatch(patch: Record<string, unknown>): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  for (const [key, label] of Object.entries(SHARE_CAPITAL_PATCH_LABELS)) {
    if (!present(patch, key)) continue;
    if (SHARE_CAPITAL_INTEGER_KEYS.has(key)) {
      push(issues, requiredIntegerIssue(patch[key], key, label));
    } else {
      push(issues, requiredNumberIssue(patch[key], key, label));
    }
  }
  if (present(patch, "llpMembersReservesUnits") && !isBlank(patch.llpMembersReservesUnits)) {
    push(
      issues,
      requiredIntegerIssue(
        patch.llpMembersReservesUnits,
        "llpMembersReservesUnits",
        "Members' Reserves — No. of Shares"
      )
    );
  }
  return issues;
}

function rejectClearedAddress(
  patch: Record<string, unknown>,
  key: string,
  labels: { object: string; line1: string; state: string; postcode: string }
): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  if (!present(patch, key)) return issues;
  const value = patch[key];
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ field: key, label: labels.object, message: `${labels.object} is required.` });
    return issues;
  }
  const address = value as Record<string, unknown>;
  if (present(address, "line1")) {
    push(issues, requiredTextIssue(address.line1, `${key}.line1`, labels.line1));
  }
  if (present(address, "state")) {
    push(issues, requiredTextIssue(address.state, `${key}.state`, labels.state));
  }
  if (present(address, "postalCode") || present(address, "state")) {
    const state = present(address, "state") ? address.state : undefined;
    if (present(address, "postalCode") || (state !== undefined && isScPostcodeRequired(state))) {
      push(issues, requiredPostcodeIssue(address.postalCode, address.state, `${key}.postalCode`, labels.postcode));
    }
  }
  return issues;
}

function push(issues: ComrepFieldIssue[], issue: ComrepFieldIssue | null): void {
  if (issue) issues.push(issue);
}

function present(patch: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

/** PATCH: omit is allowed; explicit empty/null of a required field is not. */
export function rejectClearedRequiredText(
  patch: Record<string, unknown>,
  key: string,
  label: string
): ComrepFieldIssue | null {
  if (!present(patch, key)) return null;
  return requiredTextIssue(patch[key], key, label);
}

export function rejectClearedRequiredEmail(
  patch: Record<string, unknown>,
  key: string,
  label: string
): ComrepFieldIssue | null {
  if (!present(patch, key)) return null;
  return requiredEmailIssue(patch[key], key, label);
}

export function rejectClearedRequiredDate(
  patch: Record<string, unknown>,
  key: string,
  label: string
): ComrepFieldIssue | null {
  if (!present(patch, key)) return null;
  return requiredDateIssue(patch[key], key, label);
}

export function rejectClearedRequiredEnum(
  patch: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  label: string
): ComrepFieldIssue | null {
  if (!present(patch, key)) return null;
  return requiredEnumIssue(patch[key], allowed, key, label);
}

export function rejectClearedRequiredNumber(
  patch: Record<string, unknown>,
  key: string,
  label: string
): ComrepFieldIssue | null {
  if (!present(patch, key)) return null;
  return requiredNumberIssue(patch[key], key, label);
}

export const ISSUER_OPTIONAL_FINANCIAL_KEYS = [
  "equity_share_application",
  "equity_share_premium",
  "equity_minority",
] as const;

export function isIssuerFinancialFieldRequired(key: string): boolean {
  return !(ISSUER_OPTIONAL_FINANCIAL_KEYS as readonly string[]).includes(key);
}

export function validateIssuerFinancialFields(
  fields: Record<string, unknown>
): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  for (const key of [...ISSUER_PROFILE_BALANCE_SHEET_KEYS, ...ISSUER_PROFILE_PNL_KEYS]) {
    if (!isIssuerFinancialFieldRequired(key)) continue;
    const label = SC_MONTHLY_ISSUER_FINANCIAL_LABELS[key] ?? key;
    push(issues, requiredNumberIssue(fields[key], key, label));
  }
  return issues;
}

export function validateIssuerCompanyForm(input: {
  scCompanyType?: unknown;
  dateOfIncorporation?: unknown;
  dateOfCommencement?: unknown;
  countryOfIncorporation?: unknown;
  phoneNumber?: unknown;
  name?: unknown;
  includeName?: boolean;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  if (input.includeName) {
    push(issues, requiredTextIssue(input.name, "name", "Name of Issuer"));
  }
  push(issues, requiredEnumIssue(input.scCompanyType, SC_COMPANY_TYPES, "scCompanyType", "Type of Company"));
  push(
    issues,
    requiredDateIssue(input.dateOfIncorporation, "dateOfIncorporation", "Date of Incorporation (dd/mm/yyyy)")
  );
  push(
    issues,
    requiredDateIssue(input.dateOfCommencement, "dateOfCommencement", "Date of Commencement (dd/mm/yyyy)")
  );
  push(
    issues,
    requiredTextIssue(input.countryOfIncorporation, "countryOfIncorporation", "Country of Incorporation")
  );
  if (input.phoneNumber !== undefined && input.phoneNumber != null && String(input.phoneNumber).trim() !== "") {
    push(issues, requiredPhoneIssue(input.phoneNumber, "phoneNumber", "Phone Number"));
  }
  return issues;
}

/** ComRep [02000] E-mail Address and Phone Number live on current Contact Person. */
export function validateIssuerContactPersonForm(input: {
  email?: unknown;
  contact?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredEmailIssue(input.email, "contactPersonEmail", "E-mail Address"));
  push(issues, requiredPhoneIssue(input.contact, "contactPersonPhone", "Phone Number"));
  return issues;
}

export function validateIssuerAddressForm(input: {
  registeredLine1?: unknown;
  registeredState?: unknown;
  registeredPostalCode?: unknown;
  businessLine1?: unknown;
  businessState?: unknown;
  businessPostalCode?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredTextIssue(input.registeredLine1, "registeredAddress.line1", "Registered Address"));
  push(issues, requiredTextIssue(input.registeredState, "registeredAddress.state", "Registered Address - State"));
  push(
    issues,
    requiredPostcodeIssue(
      input.registeredPostalCode,
      input.registeredState,
      "registeredAddress.postalCode",
      "Registered Address - Postcode"
    )
  );
  push(issues, requiredTextIssue(input.businessLine1, "businessAddress.line1", "Business Address"));
  push(issues, requiredTextIssue(input.businessState, "businessAddress.state", "Business Address - State"));
  push(
    issues,
    requiredPostcodeIssue(
      input.businessPostalCode,
      input.businessState,
      "businessAddress.postalCode",
      "Business Address - Postcode"
    )
  );
  return issues;
}

export function validateInvestorPersonalForm(input: {
  gender?: unknown;
  nationality?: unknown;
  state?: unknown;
  postalCode?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredEnumIssue(input.gender, ["MALE", "FEMALE"], "gender", "Gender"));
  push(issues, requiredTextIssue(input.nationality, "nationality", "Nationality/Country"));
  push(issues, requiredTextIssue(input.state, "state", "Business/Residential Address - State"));
  push(
    issues,
    requiredPostcodeIssue(
      input.postalCode,
      input.state,
      "postalCode",
      "Business/Residential Address - Postcode"
    )
  );
  return issues;
}

export function validateInvestorCorporateForm(input: {
  dateOfIncorporation?: unknown;
  countryOfIncorporation?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(
    issues,
    requiredDateIssue(
      input.dateOfIncorporation,
      "dateOfIncorporation",
      "Date of Birth/Incorporation (dd/mm/yyyy)"
    )
  );
  push(
    issues,
    requiredTextIssue(input.countryOfIncorporation, "countryOfIncorporation", "Nationality/Country")
  );
  return issues;
}

export function validateOperatorGeneral(input: {
  name?: unknown;
  registrationNumber?: unknown;
  trusteeRegistrationNumber?: unknown;
  scCompanyType?: unknown;
  responsiblePersonName?: unknown;
  responsiblePersonPhone?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredTextIssue(input.name, "name", "Name of RMO"));
  push(
    issues,
    identityFormatIssue(input.registrationNumber, "ROC", "registrationNumber", "Company Registration Number")
  );
  push(issues, requiredEnumIssue(input.scCompanyType, SC_COMPANY_TYPES, "scCompanyType", "Type of Company"));
  push(
    issues,
    requiredTextIssue(input.responsiblePersonName, "responsiblePersonName", "Name of Responsible Person")
  );
  push(issues, requiredPhoneIssue(input.responsiblePersonPhone, "responsiblePersonPhone", "Contact Number"));
  push(
    issues,
    optionalIdentityFormatIssue(
      input.trusteeRegistrationNumber,
      "ROC",
      "trusteeRegistrationNumber",
      "Trustee Company Registration Number"
    )
  );
  return issues;
}

export function validateOperatorGeneralPatch(patch: Record<string, unknown>): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, rejectClearedRequiredText(patch, "name", "Name of RMO"));
  if (present(patch, "registrationNumber")) {
    push(
      issues,
      identityFormatIssue(patch.registrationNumber, "ROC", "registrationNumber", "Company Registration Number")
    );
  }
  push(issues, rejectClearedRequiredEnum(patch, "scCompanyType", SC_COMPANY_TYPES, "Type of Company"));
  push(issues, rejectClearedRequiredText(patch, "responsiblePersonName", "Name of Responsible Person"));
  if (present(patch, "responsiblePersonPhone")) {
    push(issues, requiredPhoneIssue(patch.responsiblePersonPhone, "responsiblePersonPhone", "Contact Number"));
  }
  if (present(patch, "trusteeRegistrationNumber")) {
    push(
      issues,
      optionalIdentityFormatIssue(
        patch.trusteeRegistrationNumber,
        "ROC",
        "trusteeRegistrationNumber",
        "Trustee Company Registration Number"
      )
    );
  }
  return issues;
}

export function validateIssuerMasterPatch(
  patch: Record<string, unknown>,
  portal: "issuer" | "investor"
): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  if (portal === "issuer") {
    push(issues, rejectClearedRequiredText(patch, "name", "Name of Issuer"));
    if (present(patch, "phoneNumber") && patch.phoneNumber != null && String(patch.phoneNumber).trim() !== "") {
      push(issues, requiredPhoneIssue(patch.phoneNumber, "phoneNumber", "Phone Number"));
    }
    push(
      issues,
      rejectClearedRequiredDate(patch, "dateOfIncorporation", "Date of Incorporation (dd/mm/yyyy)")
    );
    push(
      issues,
      rejectClearedRequiredDate(patch, "dateOfCommencement", "Date of Commencement (dd/mm/yyyy)")
    );
    push(issues, rejectClearedRequiredText(patch, "countryOfIncorporation", "Country of Incorporation"));
    push(issues, rejectClearedRequiredEnum(patch, "scCompanyType", SC_COMPANY_TYPES, "Type of Company"));
    issues.push(
      ...rejectClearedAddress(patch, "registeredAddress", {
        object: "Registered Address",
        line1: "Registered Address",
        state: "Registered Address - State",
        postcode: "Registered Address - Postcode",
      })
    );
    issues.push(
      ...rejectClearedAddress(patch, "businessAddress", {
        object: "Business Address",
        line1: "Business Address",
        state: "Business Address - State",
        postcode: "Business Address - Postcode",
      })
    );
  } else {
    push(
      issues,
      rejectClearedRequiredDate(patch, "dateOfIncorporation", "Date of Birth/Incorporation (dd/mm/yyyy)")
    );
    push(issues, rejectClearedRequiredDate(patch, "dateOfBirth", "Date of Birth/Incorporation (dd/mm/yyyy)"));
    push(issues, rejectClearedRequiredText(patch, "countryOfIncorporation", "Nationality/Country"));
    push(issues, rejectClearedRequiredText(patch, "nationality", "Nationality/Country"));
    push(issues, rejectClearedRequiredText(patch, "name", "Investor Name"));
    if (present(patch, "gender")) {
      const gender = trimToNull(patch.gender);
      if (!gender) {
        issues.push({ field: "gender", label: "Gender", message: "Gender is required." });
      } else if (!(SC_GENDERS as readonly string[]).includes(gender)) {
        issues.push({
          field: "gender",
          label: "Gender",
          message: "Select a valid Gender.",
        });
      }
    }
    if (present(patch, "residentialAddress") && patch.residentialAddress && typeof patch.residentialAddress === "object") {
      const address = patch.residentialAddress as Record<string, unknown>;
      if (present(address, "state") || present(address, "postalCode")) {
        push(
          issues,
          requiredTextIssue(address.state, "residentialAddress.state", "Business/Residential Address - State")
        );
        push(
          issues,
          requiredPostcodeIssue(
            address.postalCode,
            address.state,
            "residentialAddress.postalCode",
            "Business/Residential Address - Postcode"
          )
        );
      }
    }
  }
  return issues;
}

export function validateOperatorShareCapital(
  input: Record<string, unknown>,
  kind: "SDN_BHD" | "LLP"
): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  if (kind === "SDN_BHD") {
    push(issues, requiredIntegerIssue(input.ordinaryUnits, "ordinaryUnits", "Ordinary (for Sdn Bhd) — No. of Shares"));
    push(issues, requiredNumberIssue(input.ordinaryAmount, "ordinaryAmount", "Ordinary (for Sdn Bhd) — Nominal Value (RM)"));
    push(issues, requiredIntegerIssue(input.preferenceUnits, "preferenceUnits", "Preference (for Sdn Bhd) — No. of Shares"));
    push(
      issues,
      requiredNumberIssue(input.preferenceAmount, "preferenceAmount", "Preference (for Sdn Bhd) — Nominal Value (RM)")
    );
    push(issues, requiredIntegerIssue(input.othersUnits, "othersUnits", "Others (for Sdn Bhd) — No. of Shares"));
    push(issues, requiredNumberIssue(input.othersAmount, "othersAmount", "Others (for Sdn Bhd) — Nominal Value (RM)"));
    push(
      issues,
      requiredIntegerIssue(input.totalPaidUpCapital, "totalPaidUpCapital", "Total paid up capital (for Sdn Bhd)")
    );
  } else {
    push(
      issues,
      requiredIntegerIssue(input.llpMembersCapitalUnits, "llpMembersCapitalUnits", "Members' Capital — No. of Shares")
    );
    push(
      issues,
      requiredNumberIssue(
        input.llpMembersCapitalAmount,
        "llpMembersCapitalAmount",
        "Members' Capital — Nominal Value (RM)"
      )
    );
    push(
      issues,
      requiredIntegerIssue(
        input.llpSubordinatedLoansUnits,
        "llpSubordinatedLoansUnits",
        "Subordinated Loans — No. of Shares"
      )
    );
    push(
      issues,
      requiredNumberIssue(
        input.llpSubordinatedLoansAmount,
        "llpSubordinatedLoansAmount",
        "Subordinated Loans — Nominal Value (RM)"
      )
    );
    push(
      issues,
      requiredNumberIssue(input.totalLlp, "totalLlp", "Total Limited Liability Partnership")
    );
  }
  return issues;
}

export function validateOperatorShareholder(input: {
  entityType?: unknown;
  holderType?: unknown;
  name?: unknown;
  salutation?: unknown;
  identityNumber?: unknown;
  dateOfBirth?: unknown;
  dateOfIncorporation?: unknown;
  nationality?: unknown;
  address?: unknown;
  dateAcquired?: unknown;
  shareType?: unknown;
  shareTypeOther?: unknown;
  shareholdingUnits?: unknown;
  shareholdingAmount?: unknown;
  shareholdingPercentage?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  const corporate = input.entityType === "CORPORATE";
  const individual = !corporate;
  push(issues, requiredTextIssue(input.name, "name", "Name"));
  if (individual) {
    push(issues, requiredTextIssue(input.salutation, "salutation", "Salutation"));
    push(issues, requiredDateIssue(input.dateOfBirth, "dateOfBirth", "Date of Birth (dd/mm/yyyy)"));
  } else {
    push(
      issues,
      requiredDateIssue(
        input.dateOfIncorporation,
        "dateOfIncorporation",
        "Date of Incorporation (dd/mm/yyyy)"
      )
    );
  }
  const identityKind: "NRIC" | "ROC" | "PASSPORT" = corporate
    ? "ROC"
    : trimToNull(input.nationality)?.toUpperCase() === "MALAYSIA" || !trimToNull(input.nationality)
      ? "NRIC"
      : "PASSPORT";
  push(issues, identityFormatIssue(input.identityNumber, identityKind, "identityNumber", "IC/Passport number"));
  push(issues, requiredTextIssue(input.nationality, "nationality", "Nationality"));
  push(issues, requiredTextIssue(input.address, "address", "Address"));
  push(issues, requiredDateIssue(input.dateAcquired, "dateAcquired", "Date Acquired (dd/mm/yyyy)"));
  push(issues, requiredEnumIssue(input.shareType, SC_SHARE_TYPES, "shareType", "Type of Shares"));
  if (input.shareType === "OTHERS") {
    push(
      issues,
      requiredTextIssue(input.shareTypeOther, "shareTypeOther", "Type of Shares - Others (please specify)")
    );
  }
  push(issues, requiredNumberIssue(input.shareholdingUnits, "shareholdingUnits", "Shareholding Units (Unit)"));
  push(issues, requiredNumberIssue(input.shareholdingAmount, "shareholdingAmount", "Shareholding Amount (RM)"));
  push(
    issues,
    requiredNumberIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
  );
  push(
    issues,
    percentCapIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
  );
  return issues;
}

export function validateOperatorOfficer(input: {
  personKind?: unknown;
  name?: unknown;
  identityNumber?: unknown;
  dateOfBirth?: unknown;
  nationality?: unknown;
  address?: unknown;
  designation?: unknown;
  designationOther?: unknown;
  appointmentDate?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(
    issues,
    requiredEnumIssue(input.personKind, SC_PERSON_KINDS, "personKind", "Board of Director/Management Team")
  );
  push(issues, requiredTextIssue(input.name, "name", "Name"));
  const identityKind: "NRIC" | "PASSPORT" =
    trimToNull(input.nationality)?.toUpperCase() === "MALAYSIA" || !trimToNull(input.nationality)
      ? "NRIC"
      : "PASSPORT";
  push(
    issues,
    identityFormatIssue(
      input.identityNumber,
      identityKind,
      "identityNumber",
      "Identity Number (NRIC/ Passport No.)"
    )
  );
  push(issues, requiredDateIssue(input.dateOfBirth, "dateOfBirth", "Date of Birth (dd/mm/yyyy)"));
  push(issues, requiredTextIssue(input.nationality, "nationality", "Nationality"));
  push(issues, requiredTextIssue(input.address, "address", "Address"));
  push(issues, requiredEnumIssue(input.designation, SC_DESIGNATIONS, "designation", "Designation"));
  if (input.designation === "OTHERS") {
    push(
      issues,
      requiredTextIssue(input.designationOther, "designationOther", "Designation - Others (Please specify)")
    );
  }
  push(issues, requiredDateIssue(input.appointmentDate, "appointmentDate", "Appointment Date (dd/mm/yyyy)"));
  return issues;
}

export function validateOperatorAdvisor(input: {
  advisorType?: unknown;
  name?: unknown;
  registrationNumber?: unknown;
  country?: unknown;
  address?: unknown;
  appointmentDate?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredEnumIssue(input.advisorType, OPERATOR_ADVISOR_TYPES, "advisorType", "Type of Advisor"));
  push(issues, requiredTextIssue(input.name, "name", "Name"));
  push(
    issues,
    identityFormatIssue(input.registrationNumber, "ROC", "registrationNumber", "Company Registration No.")
  );
  push(issues, requiredTextIssue(input.country, "country", "Country"));
  push(issues, requiredTextIssue(input.address, "address", "Address"));
  push(issues, requiredDateIssue(input.appointmentDate, "appointmentDate", "Appointment Date (dd/mm/yyyy)"));
  return issues;
}

export function validateOperatorInterest(input: {
  name?: unknown;
  registrationNumber?: unknown;
  country?: unknown;
  address?: unknown;
  acquisitionDate?: unknown;
  shareType?: unknown;
  shareTypeOther?: unknown;
  shareholdingUnits?: unknown;
  shareholdingPercentage?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredTextIssue(input.name, "name", "Name"));
  push(issues, identityFormatIssue(input.registrationNumber, "ROC", "registrationNumber", "ROC"));
  push(issues, requiredTextIssue(input.country, "country", "Country"));
  push(issues, requiredTextIssue(input.address, "address", "Address"));
  push(issues, requiredDateIssue(input.acquisitionDate, "acquisitionDate", "Acquisition Date (dd/mm/yyyy)"));
  push(issues, requiredEnumIssue(input.shareType, SC_SHARE_TYPES, "shareType", "Type of Shares"));
  if (input.shareType === "OTHERS") {
    push(
      issues,
      requiredTextIssue(input.shareTypeOther, "shareTypeOther", "Type of Shares - Others (please specify)")
    );
  }
  push(issues, requiredNumberIssue(input.shareholdingUnits, "shareholdingUnits", "Shareholding Units (unit)"));
  push(
    issues,
    requiredNumberIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
  );
  push(
    issues,
    percentCapIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
  );
  return issues;
}

export const OPERATOR_FINANCIAL_REQUIRED_FIELDS = [
  ["consolidatedAccounts", "Consolidated Accounts"],
  ["auditorName", "Auditor's Name"],
  ["financialYearEnd", "Financial Year End (dd/mm/yyyy)"],
  ["unmodifiedReports", "UnModified Reports"],
  ["dateTabledToBoard", "Date of Tabling to Board (dd/mm/yyyy)"],
  ["currency", "Currency"],
  ["numberOfShares", "Number of Shares"],
  ["totalAssets", "Total Assets"],
  ["nonCurrentAssets", "Non-Current Assets"],
  ["currentAssets", "Current Assets"],
  ["totalEquity", "Total Equity"],
  ["paidUpCapital", "Paid-up Capital"],
  ["shareApplicationAccount", "Share Application Account"],
  ["sharePremiumAndReserves", "Share Premium & Other Reserves"],
  ["accumulatedProfitCarriedForward", "Accumulated Profit Carried Forward"],
  ["equityMinorityInterest", "Minority Interest"],
  ["totalLiabilities", "Total Liabilities"],
  ["nonCurrentLiabilities", "Non-Current Liabilities"],
  ["currentLiabilities", "Current Liabilities"],
  ["totalRevenue", "Total Revenue"],
  ["revenueDonation", "Donation Based"],
  ["revenueReward", "Reward Based"],
  ["revenueLending", "Lending Based"],
  ["revenueEquity", "Equity Based"],
  ["revenueFees", "Fees charges"],
  ["revenueOther", "Other - Revenue"],
  ["incomeDepositInterest", "Interest from deposit placement"],
  ["incomeOther", "Other - Income"],
  ["totalCost", "Total Cost"],
  ["costStaff", "Staff Cost"],
  ["costSystem", "System Cost"],
  ["costPromotion", "Promotion Activities"],
  ["costOther", "Other - Cost"],
  ["profitBeforeTax", "Profit/(Loss) Before Tax"],
  ["taxation", "Taxation"],
  ["profitAfterTax", "Profit/(Loss) After Tax"],
  ["pnlMinorityInterest", "Minority Interest"],
  ["netDividend", "Net Dividend"],
] as const;

export function validateOperatorFinancialStatement(input: Record<string, unknown>): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  const yesNo = ["consolidatedAccounts", "unmodifiedReports"];
  const dates = ["financialYearEnd", "dateTabledToBoard"];
  const texts = ["auditorName", "currency"];
  for (const [field, label] of OPERATOR_FINANCIAL_REQUIRED_FIELDS) {
    if (yesNo.includes(field)) {
      if (input[field] !== true && input[field] !== false) {
        issues.push({ field, label, message: `${label} is required.` });
      }
      continue;
    }
    if (dates.includes(field)) {
      push(issues, requiredDateIssue(input[field], field, label));
      continue;
    }
    if (texts.includes(field)) {
      push(issues, requiredTextIssue(input[field], field, label));
      continue;
    }
    push(issues, requiredNumberIssue(input[field], field, label));
  }
  return issues;
}

export function validateIssuerPersonForm(input: {
  entityType?: unknown;
  name?: unknown;
  identityPrefix?: unknown;
  identityNumber?: unknown;
  email?: unknown;
  dateOfBirth?: unknown;
  dateOfIncorporation?: unknown;
  gender?: unknown;
  nationality?: unknown;
  countryOfIncorporation?: unknown;
  line1?: unknown;
  state?: unknown;
  postalCode?: unknown;
  isShareholder?: boolean;
  isOfficer?: boolean;
  shareType?: unknown;
  shareTypeOther?: unknown;
  shareholdingUnits?: unknown;
  shareholdingAmount?: unknown;
  shareholdingPercentage?: unknown;
  designation?: unknown;
  designationOther?: unknown;
  appointmentDate?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  const corporate = input.entityType === "CORPORATE";
  const shareholder = Boolean(input.isShareholder) || corporate;
  const officer = Boolean(input.isOfficer) && !corporate;
  const nameLabel = shareholder ? "Shareholder Name" : "Name";
  const identityLabel = shareholder
    ? "Shareholder Identity (NRIC/Passport/Company Registration No.)"
    : "Identity Number (NRIC/Passport No.)";
  const dobLabel = corporate
    ? "Date of Incorporation (dd/mm/yyyy)"
    : "Date of Birth (dd/mm/yyyy)";
  const nationalityLabel = shareholder ? "Nationality/Country" : "Nationality";
  const addressLabel = shareholder ? "Business/Residential Address" : "Residential Address";
  const stateLabel = shareholder
    ? "Business/Residential Address - State"
    : "Residential Address - State";
  const postcodeLabel = shareholder
    ? "Business/Residential Address - Postcode"
    : "Residential Address - Postcode";

  push(issues, requiredTextIssue(input.name, "name", nameLabel));
  if (!corporate) {
    push(
      issues,
      requiredEnumIssue(input.identityPrefix, ["NRIC", "PASSPORT"], "identityPrefix", "Identity Prefix")
    );
  }
  const identityKind: "NRIC" | "ROC" | "PASSPORT" = corporate
    ? "ROC"
    : trimToNull(input.identityPrefix) === "PASSPORT"
      ? "PASSPORT"
      : "NRIC";
  push(issues, identityFormatIssue(input.identityNumber, identityKind, "identityNumber", identityLabel));
  if (!corporate) {
    push(issues, optionalEmailIssue(input.email, "email", "Email"));
  }
  if (corporate) {
    push(issues, requiredDateIssue(input.dateOfIncorporation, "dateOfIncorporation", dobLabel));
    push(issues, requiredTextIssue(input.countryOfIncorporation, "countryOfIncorporation", nationalityLabel));
  } else {
    push(issues, requiredDateIssue(input.dateOfBirth, "dateOfBirth", dobLabel));
    push(issues, requiredEnumIssue(input.gender, ["MALE", "FEMALE"], "gender", "Gender"));
    push(issues, requiredTextIssue(input.nationality, "nationality", nationalityLabel));
  }
  push(issues, requiredTextIssue(input.line1, "address.line1", addressLabel));
  push(issues, requiredTextIssue(input.state, "address.state", stateLabel));
  push(issues, requiredPostcodeIssue(input.postalCode, input.state, "address.postalCode", postcodeLabel));
  if (shareholder) {
    push(issues, requiredEnumIssue(input.shareType, SC_SHARE_TYPES, "shareType", "Type of Shares"));
    if (input.shareType === "OTHERS") {
      push(
        issues,
        requiredTextIssue(input.shareTypeOther, "shareTypeOther", "Type of Shares - Others (please specify)")
      );
    }
    push(issues, requiredNumberIssue(input.shareholdingUnits, "shareholdingUnits", "Shareholding Units (unit)"));
    push(issues, requiredNumberIssue(input.shareholdingAmount, "shareholdingAmount", "Shareholding Amount (RM)"));
    push(
      issues,
      requiredNumberIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
    );
    push(
      issues,
      percentCapIssue(input.shareholdingPercentage, "shareholdingPercentage", "Shareholding Percentage (%)")
    );
  }
  if (officer) {
    push(issues, requiredEnumIssue(input.designation, SC_DESIGNATIONS, "designation", "Designation"));
    if (input.designation === "OTHERS") {
      push(
        issues,
        requiredTextIssue(input.designationOther, "designationOther", "Designation - Others (please specify)")
      );
    }
    push(issues, requiredDateIssue(input.appointmentDate, "appointmentDate", "Appointment Date (dd/mm/yyyy)"));
  }
  return issues;
}

export function validatePartyPatch(patch: Record<string, unknown>): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, rejectClearedRequiredText(patch, "name", "Name"));
  push(issues, rejectClearedRequiredText(patch, "identityNumber", "Identity Number"));
  push(issues, rejectClearedRequiredEnum(patch, "identityPrefix", SC_IDENTITY_PREFIXES, "Identity Prefix"));
  push(issues, rejectClearedRequiredDate(patch, "dateOfBirth", "Date of Birth (dd/mm/yyyy)"));
  push(issues, rejectClearedRequiredDate(patch, "dateOfIncorporation", "Date of Birth (dd/mm/yyyy)"));
  push(issues, rejectClearedRequiredText(patch, "nationality", "Nationality"));
  push(issues, rejectClearedRequiredText(patch, "countryOfIncorporation", "Nationality/Country"));
  push(issues, rejectClearedRequiredEnum(patch, "shareType", SC_SHARE_TYPES, "Type of Shares"));
  push(issues, rejectClearedRequiredNumber(patch, "shareholdingUnits", "Shareholding Units (unit)"));
  push(issues, rejectClearedRequiredNumber(patch, "shareholdingAmount", "Shareholding Amount (RM)"));
  push(issues, rejectClearedRequiredNumber(patch, "shareholdingPercentage", "Shareholding Percentage (%)"));
  push(issues, rejectClearedRequiredEnum(patch, "designation", SC_DESIGNATIONS, "Designation"));
  push(issues, rejectClearedRequiredDate(patch, "appointmentDate", "Appointment Date (dd/mm/yyyy)"));
  if (present(patch, "gender")) {
    const gender = trimToNull(patch.gender);
    if (!gender) issues.push({ field: "gender", label: "Gender", message: "Gender is required." });
  }
  if (present(patch, "address") && patch.address && typeof patch.address === "object") {
    const address = patch.address as Record<string, unknown>;
    if (present(address, "line1")) {
      push(issues, requiredTextIssue(address.line1, "address.line1", "Address"));
    }
    if (present(address, "state")) {
      push(issues, requiredTextIssue(address.state, "address.state", "State"));
    }
    if (present(address, "postalCode") || present(address, "state")) {
      push(
        issues,
        requiredPostcodeIssue(address.postalCode, address.state, "address.postalCode", "Postcode")
      );
    }
  }
  return issues;
}
