import {
  getIssuerAuthorizedParty,
  type AuthorizedPartiesSnapshot,
} from "./authorized-parties";
import { FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY } from "./generated-documents";
import {
  DEED_OF_ASSIGNMENT_TEMPLATE_KEY,
  GUARANTOR_AGREEMENT_TEMPLATE_KEY,
  normalizeSigningEmail,
} from "./signing-envelopes";
export const OPERATOR_DOCUMENT_KINDS = ["FA", "JSG", "DOA"] as const;
export type OperatorDocumentKind = (typeof OPERATOR_DOCUMENT_KINDS)[number];

export const OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT = 2;
export const OPERATOR_DOCUMENT_WITNESS_COUNT = 1;
/** @deprecated Use OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT. */
export const OPERATOR_DOCUMENT_SIGNER_COUNT = OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT;

export const OPERATOR_DOCUMENT_KIND_LABELS: Record<OperatorDocumentKind, string> = {
  FA: "Facility Agreement",
  JSG: "Joint and Several Guarantee",
  DOA: "Deed of Assignment",
};

export const OPERATOR_DOCUMENT_REPRESENTATIVE_ROLES = [
  "FA_INVESTOR",
  "FA_AGENT",
  "JSG_OPERATOR",
  "DOA_SSP",
] as const;
export type OperatorDocumentRepresentativeRole =
  (typeof OPERATOR_DOCUMENT_REPRESENTATIVE_ROLES)[number];

export const OPERATOR_DOCUMENT_WITNESS_ROLES = [
  "FA_ISSUER_WITNESS",
  "JSG_GUARANTOR_WITNESS",
  "JSG_OPERATOR_WITNESS",
  "DOA_ASSIGNOR_WITNESS",
] as const;
export type OperatorDocumentWitnessRole = (typeof OPERATOR_DOCUMENT_WITNESS_ROLES)[number];

export const OPERATOR_DOCUMENT_EXECUTION_ROLES = [
  ...OPERATOR_DOCUMENT_REPRESENTATIVE_ROLES,
  ...OPERATOR_DOCUMENT_WITNESS_ROLES,
] as const;
export type OperatorDocumentExecutionRole = (typeof OPERATOR_DOCUMENT_EXECUTION_ROLES)[number];

export const OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS: Record<OperatorDocumentExecutionRole, string> =
  {
    FA_INVESTOR: "Facility Agreement — Investor",
    FA_AGENT: "Facility Agreement — Agent",
    JSG_OPERATOR: "Joint and Several Guarantee — Operator",
    DOA_SSP: "Deed of Assignment — SSP",
    FA_ISSUER_WITNESS: "Facility Agreement — issuer witness",
    JSG_GUARANTOR_WITNESS: "Joint and Several Guarantee — guarantor witness",
    JSG_OPERATOR_WITNESS: "Joint and Several Guarantee — operator witness",
    DOA_ASSIGNOR_WITNESS: "Deed of Assignment — assignor witness",
  };

export const OPERATOR_DOCUMENT_KIND_BY_PACKAGE_KEY: Record<string, OperatorDocumentKind> = {
  [FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY]: "FA",
  [GUARANTOR_AGREEMENT_TEMPLATE_KEY]: "JSG",
  [DEED_OF_ASSIGNMENT_TEMPLATE_KEY]: "DOA",
};

export const SIGNING_PACKAGE_DOCUMENT_EXECUTION_ROLES: Record<string, OperatorDocumentExecutionRole[]> =
  {
    [FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY]: [
      "FA_INVESTOR",
      "FA_AGENT",
      "FA_ISSUER_WITNESS",
    ],
    [GUARANTOR_AGREEMENT_TEMPLATE_KEY]: [
      "JSG_OPERATOR",
      "JSG_GUARANTOR_WITNESS",
      "JSG_OPERATOR_WITNESS",
    ],
    [DEED_OF_ASSIGNMENT_TEMPLATE_KEY]: ["DOA_SSP", "DOA_ASSIGNOR_WITNESS"],
  };

const ROLES_REQUIRING_ISSUER_SEAL: ReadonlySet<string> = new Set([
  FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY,
  DEED_OF_ASSIGNMENT_TEMPLATE_KEY,
]);

export const OPERATOR_DOCUMENT_KIND_PLACEMENTS: Record<
  OperatorDocumentKind,
  OperatorDocumentExecutionRole[]
> = {
  FA: ["FA_INVESTOR", "FA_AGENT", "FA_ISSUER_WITNESS"],
  JSG: ["JSG_OPERATOR", "JSG_GUARANTOR_WITNESS", "JSG_OPERATOR_WITNESS"],
  DOA: ["DOA_SSP", "DOA_ASSIGNOR_WITNESS"],
};

export const OPERATOR_DOCUMENT_EXECUTION_KEYWORDS: Record<OperatorDocumentExecutionRole, string> = {
  FA_INVESTOR: "CASHSOUK_FA_INVESTOR",
  FA_AGENT: "CASHSOUK_FA_AGENT",
  JSG_OPERATOR: "CASHSOUK_JSG_OPERATOR",
  DOA_SSP: "CASHSOUK_DOA_SSP",
  FA_ISSUER_WITNESS: "CASHSOUK_FA_ISSUER_WITNESS",
  JSG_GUARANTOR_WITNESS: "CASHSOUK_JSG_GUARANTOR_WITNESS",
  JSG_OPERATOR_WITNESS: "CASHSOUK_JSG_OPERATOR_WITNESS",
  DOA_ASSIGNOR_WITNESS: "CASHSOUK_DOA_ASSIGNOR_WITNESS",
};

export const SHORAKA_SIGNING_ASSIGNMENTS_HREF = "/shoraka/profile?tab=signing";

export type OperatorDocumentExecutionDisplayedField = "name" | "designation" | "identityNumber";

export const OPERATOR_DOCUMENT_EXECUTION_DISPLAYED_FIELDS: Record<
  OperatorDocumentExecutionRole,
  readonly OperatorDocumentExecutionDisplayedField[]
> = {
  FA_INVESTOR: ["name", "designation"],
  FA_AGENT: ["name", "designation"],
  JSG_OPERATOR: ["name", "identityNumber", "designation"],
  DOA_SSP: ["name", "designation"],
  FA_ISSUER_WITNESS: ["name", "identityNumber"],
  JSG_GUARANTOR_WITNESS: ["name", "identityNumber"],
  JSG_OPERATOR_WITNESS: [],
  DOA_ASSIGNOR_WITNESS: ["name", "designation"],
};

export type DocumentExecutionRepeatCounts = {
  issuerSignatoryCount: number;
  jsgGuarantorSignatureCount: number;
  assignorSignatoryCount: number;
};

export type OperatorDocumentExecutionSlotRef = {
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
};

export type OperatorDocumentPlacementRef = OperatorDocumentExecutionSlotRef & {
  documentKind: OperatorDocumentKind;
  keyword: string;
};

export function isOperatorDocumentKind(value: unknown): value is OperatorDocumentKind {
  return typeof value === "string" && (OPERATOR_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isOperatorDocumentExecutionRole(
  value: unknown
): value is OperatorDocumentExecutionRole {
  return (
    typeof value === "string" &&
    (OPERATOR_DOCUMENT_EXECUTION_ROLES as readonly string[]).includes(value)
  );
}

export function isOperatorDocumentRepresentativeRole(
  value: unknown
): value is OperatorDocumentRepresentativeRole {
  return (
    typeof value === "string" &&
    (OPERATOR_DOCUMENT_REPRESENTATIVE_ROLES as readonly string[]).includes(value)
  );
}

export function isOperatorDocumentWitnessRole(value: unknown): value is OperatorDocumentWitnessRole {
  return (
    typeof value === "string" &&
    (OPERATOR_DOCUMENT_WITNESS_ROLES as readonly string[]).includes(value)
  );
}

export function documentExecutionSlotCount(roleKey: OperatorDocumentExecutionRole): number {
  return isOperatorDocumentWitnessRole(roleKey)
    ? OPERATOR_DOCUMENT_WITNESS_COUNT
    : OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT;
}

export function isValidExecutionSlotIndex(
  roleKey: OperatorDocumentExecutionRole,
  value: unknown
): value is number {
  const max = documentExecutionSlotCount(roleKey);
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

export function executionRoleSigningRole(
  roleKey: OperatorDocumentExecutionRole
): "AUTHORISED_SIGNATORY" | "WITNESS" {
  return isOperatorDocumentWitnessRole(roleKey) ? "WITNESS" : "AUTHORISED_SIGNATORY";
}

export function executionRoleHasSignDate(roleKey: OperatorDocumentExecutionRole): boolean {
  return (
    roleKey === "FA_INVESTOR" ||
    roleKey === "FA_AGENT" ||
    roleKey === "FA_ISSUER_WITNESS" ||
    roleKey === "JSG_GUARANTOR_WITNESS"
  );
}

/** SigningCloud file2 / `/signature/auto` accept at most ten unique keywords per contract. */
export const SIGNINGCLOUD_MAX_CONTRACT_KEYWORDS = 10;
/** Numeric date stamp written by `/signature/auto` `datekeyword`. */
export const SIGNINGCLOUD_AUTO_DATE_FORMAT = "dd/MM/yyyy";

export type AutomaticSignerKeywordOwner = {
  signKeyword: string;
  dateKeyword?: string | null;
  placements: readonly { roleKey: OperatorDocumentExecutionRole; slotIndex: number }[];
};

export function compactAutomaticKeywordToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function automaticSignerKeywordStem(
  documentKind: OperatorDocumentKind,
  signingPersonId: string
): string {
  const compact = compactAutomaticKeywordToken(signingPersonId) || "SIGNER";
  return `CASHSOUK_${documentKind}_${compact}`;
}

export function automaticSignerSignKeyword(
  documentKind: OperatorDocumentKind,
  signingPersonId: string
): string {
  return `${automaticSignerKeywordStem(documentKind, signingPersonId)}_SIGN`;
}

export function automaticSignerDateKeyword(
  documentKind: OperatorDocumentKind,
  signingPersonId: string
): string {
  return `${automaticSignerKeywordStem(documentKind, signingPersonId)}_DATE`;
}

/** Sibling `_DATE` marker; keep `${signKeyword}_DATE` only for snapshots frozen before `_SIGN`. */
export function automaticDateKeywordForSignKeyword(signKeyword: string): string {
  const value = signKeyword.trim();
  return value.endsWith("_SIGN") ? `${value.slice(0, -5)}_DATE` : `${value}_DATE`;
}

export function automaticSignerKeywordPair(
  documentKind: OperatorDocumentKind,
  signingPersonId: string,
  placements: readonly { roleKey: OperatorDocumentExecutionRole }[]
): { signKeyword: string; dateKeyword?: string } {
  const signKeyword = automaticSignerSignKeyword(documentKind, signingPersonId);
  if (!placements.some((placement) => executionRoleHasSignDate(placement.roleKey))) {
    return { signKeyword };
  }
  return { signKeyword, dateKeyword: automaticSignerDateKeyword(documentKind, signingPersonId) };
}

export function automaticContractKeywords(
  owners: readonly AutomaticSignerKeywordOwner[]
): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const owner of owners) {
    for (const keyword of [owner.signKeyword, owner.dateKeyword]) {
      const value = keyword?.trim() ?? "";
      if (!value || seen.has(value)) continue;
      seen.add(value);
      keywords.push(value);
    }
  }
  return keywords;
}

export function automaticContractKeywordLimitIssue(
  owners: readonly AutomaticSignerKeywordOwner[]
): string | null {
  const count = automaticContractKeywords(owners).length;
  if (count <= SIGNINGCLOUD_MAX_CONTRACT_KEYWORDS) return null;
  return `SigningCloud allows at most ${SIGNINGCLOUD_MAX_CONTRACT_KEYWORDS} keywords on a contract (${count} required).`;
}

export function automaticSigningKeywordsOverlap(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  if (!a || !b || a === b) return a.length > 0 && a === b;
  return a.includes(b) || b.includes(a);
}

export function automaticSignerKeywordCollisionIssue(
  owners: readonly AutomaticSignerKeywordOwner[]
): string | null {
  const ownerByKeyword = new Map<string, number>();
  for (const [index, owner] of owners.entries()) {
    for (const keyword of [owner.signKeyword, owner.dateKeyword]) {
      const value = keyword?.trim() ?? "";
      if (!value) continue;
      const previous = ownerByKeyword.get(value);
      if (previous != null && previous !== index) {
        return `Duplicate automatic-signing keyword ${value}.`;
      }
      ownerByKeyword.set(value, index);
    }
    const sign = owner.signKeyword?.trim() ?? "";
    const date = owner.dateKeyword?.trim() ?? "";
    if (sign && date && automaticSigningKeywordsOverlap(sign, date)) {
      return `Automatic-signing keywords ${sign} and ${date} overlap.`;
    }
  }
  const unique = [...ownerByKeyword.keys()];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const left = unique[i]!;
      const right = unique[j]!;
      if (automaticSigningKeywordsOverlap(left, right)) {
        return `Automatic-signing keywords ${left} and ${right} overlap.`;
      }
    }
  }
  return null;
}

export function defaultAutomaticKeywordOwners(
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null
): AutomaticSignerKeywordOwner[] {
  const documentKind = documentKindForPackageKey(documentKey);
  if (!documentKind) return [];
  const groups = new Map<string, OperatorDocumentExecutionSlotRef[]>();
  for (const slot of documentExecutionSlotsForPackageKey(documentKey, repeats)) {
    const personId = isOperatorDocumentWitnessRole(slot.roleKey)
      ? `W${slot.roleKey}`
      : `P${slot.roleKey}${slot.slotIndex}`;
    const placements = groups.get(personId) ?? [];
    placements.push(slot);
    groups.set(personId, placements);
  }
  return [...groups.entries()].map(([personId, placements]) => {
    const pair = automaticSignerKeywordPair(documentKind, personId, placements);
    return { ...pair, placements };
  });
}

export function documentKindForPackageKey(documentKey: string): OperatorDocumentKind | null {
  return OPERATOR_DOCUMENT_KIND_BY_PACKAGE_KEY[documentKey] ?? null;
}

export function repeatCountsFromFrozenPeople(
  people: readonly FrozenAutomaticSignerSnapshot[]
): DocumentExecutionRepeatCounts {
  const countFor = (roleKey: OperatorDocumentExecutionRole): number =>
    people.reduce(
      (sum, person) =>
        sum + person.placements.filter((placement) => placement.roleKey === roleKey).length,
      0
    );
  return {
    issuerSignatoryCount: Math.max(1, countFor("FA_ISSUER_WITNESS")),
    jsgGuarantorSignatureCount: Math.max(1, countFor("JSG_GUARANTOR_WITNESS")),
    assignorSignatoryCount: Math.max(1, countFor("DOA_ASSIGNOR_WITNESS")),
  };
}

export function executionRepeatCountsFromAuthorizedParties(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): DocumentExecutionRepeatCounts {
  const issuerCount = Math.max(1, getIssuerAuthorizedParty(snapshot)?.representatives.length ?? 1);
  let guarantorSignatures = 0;
  for (const party of snapshot?.parties ?? []) {
    if (party.entity_kind === "INDIVIDUAL_GUARANTOR") {
      guarantorSignatures += 1;
    } else if (party.entity_kind === "CORPORATE_GUARANTOR") {
      guarantorSignatures += party.representatives.length;
    }
  }
  return {
    issuerSignatoryCount: issuerCount,
    jsgGuarantorSignatureCount: Math.max(1, guarantorSignatures),
    assignorSignatoryCount: issuerCount,
  };
}

export function documentKindForExecutionRole(
  roleKey: OperatorDocumentExecutionRole
): OperatorDocumentKind {
  if (roleKey === "FA_INVESTOR" || roleKey === "FA_AGENT" || roleKey === "FA_ISSUER_WITNESS") {
    return "FA";
  }
  if (
    roleKey === "JSG_OPERATOR" ||
    roleKey === "JSG_GUARANTOR_WITNESS" ||
    roleKey === "JSG_OPERATOR_WITNESS"
  ) {
    return "JSG";
  }
  return "DOA";
}

export function documentExecutionRolesForPackageKey(
  documentKey: string
): OperatorDocumentExecutionRole[] {
  return SIGNING_PACKAGE_DOCUMENT_EXECUTION_ROLES[documentKey] ?? [];
}

export function documentExecutionSlotLabel(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): string {
  const count = documentExecutionSlotCount(roleKey);
  if (count === 1) return OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey];
  return `${OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey]} (${slotIndex} of ${count})`;
}

export function automaticSigningKeywordForSlot(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): string {
  return `${OPERATOR_DOCUMENT_EXECUTION_KEYWORDS[roleKey]}_${slotIndex}`;
}

export function automaticSlotKey(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): string {
  return `${roleKey}:${slotIndex}`;
}

export function bindingSlotKey(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): string {
  return automaticSlotKey(roleKey, slotIndex);
}

export function allDocumentExecutionSlots(): OperatorDocumentExecutionSlotRef[] {
  return OPERATOR_DOCUMENT_EXECUTION_ROLES.flatMap((roleKey) =>
    Array.from({ length: documentExecutionSlotCount(roleKey) }, (_, index) => ({
      roleKey,
      slotIndex: index + 1,
    }))
  );
}

export function automaticSignerRef(
  documentKind: OperatorDocumentKind,
  signingPersonId: string
): string {
  return `auto:${documentKind}:${signingPersonId}`;
}

export function frozenAutomaticSignerLabel(snapshot: FrozenAutomaticSignerSnapshot): string {
  const name = snapshot.officerName.trim();
  return name || "CashSouk signatory";
}

export function placementsForConfiguredSlot(
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): OperatorDocumentPlacementRef[] {
  return [
    {
      documentKind: documentKindForExecutionRole(roleKey),
      roleKey,
      slotIndex,
      keyword: automaticSigningKeywordForSlot(roleKey, slotIndex),
    },
  ];
}

export function witnessRepeatCount(
  roleKey: OperatorDocumentExecutionRole,
  repeats?: DocumentExecutionRepeatCounts | null
): number {
  if (roleKey === "FA_ISSUER_WITNESS") {
    return Math.max(1, repeats?.issuerSignatoryCount ?? 1);
  }
  if (roleKey === "JSG_GUARANTOR_WITNESS") {
    return Math.max(1, repeats?.jsgGuarantorSignatureCount ?? 1);
  }
  if (roleKey === "JSG_OPERATOR_WITNESS") return 1;
  if (roleKey === "DOA_ASSIGNOR_WITNESS") {
    return Math.max(1, repeats?.assignorSignatoryCount ?? 1);
  }
  return documentExecutionSlotCount(roleKey);
}

export function expandedPlacementsForRole(
  roleKey: OperatorDocumentExecutionRole,
  repeats?: DocumentExecutionRepeatCounts | null
): OperatorDocumentPlacementRef[] {
  if (isOperatorDocumentWitnessRole(roleKey)) {
    const count = witnessRepeatCount(roleKey, repeats);
    return Array.from({ length: count }, (_, index) => ({
      documentKind: documentKindForExecutionRole(roleKey),
      roleKey,
      slotIndex: index + 1,
      keyword: automaticSigningKeywordForSlot(roleKey, index + 1),
    }));
  }
  return Array.from({ length: documentExecutionSlotCount(roleKey) }, (_, index) => ({
    documentKind: documentKindForExecutionRole(roleKey),
    roleKey,
    slotIndex: index + 1,
    keyword: automaticSigningKeywordForSlot(roleKey, index + 1),
  }));
}

export function documentExecutionSlotsForPackageKey(
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null
): OperatorDocumentExecutionSlotRef[] {
  return documentExecutionRolesForPackageKey(documentKey).flatMap((roleKey) => {
    if (isOperatorDocumentWitnessRole(roleKey)) {
      return expandedPlacementsForRole(roleKey, repeats).map((placement) => ({
        roleKey: placement.roleKey,
        slotIndex: placement.slotIndex,
      }));
    }
    return Array.from({ length: documentExecutionSlotCount(roleKey) }, (_, index) => ({
      roleKey,
      slotIndex: index + 1,
    }));
  });
}

export function configuredSlotsForPackageKey(documentKey: string): OperatorDocumentExecutionSlotRef[] {
  return documentExecutionRolesForPackageKey(documentKey).flatMap((roleKey) =>
    Array.from({ length: documentExecutionSlotCount(roleKey) }, (_, index) => ({
      roleKey,
      slotIndex: index + 1,
    }))
  );
}

export function configuredSlotsForDocumentKeys(
  documentKeys: readonly string[]
): OperatorDocumentExecutionSlotRef[] {
  const seen = new Set<string>();
  const slots: OperatorDocumentExecutionSlotRef[] = [];
  for (const documentKey of documentKeys) {
    for (const slot of configuredSlotsForPackageKey(documentKey)) {
      const key = automaticSlotKey(slot.roleKey, slot.slotIndex);
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push(slot);
    }
  }
  return slots;
}

export function documentExecutionSlotsForDocumentKeys(
  documentKeys: readonly string[],
  repeats?: DocumentExecutionRepeatCounts | null
): OperatorDocumentExecutionSlotRef[] {
  const seen = new Set<string>();
  const slots: OperatorDocumentExecutionSlotRef[] = [];
  for (const documentKey of documentKeys) {
    for (const slot of documentExecutionSlotsForPackageKey(documentKey, repeats)) {
      const key = automaticSlotKey(slot.roleKey, slot.slotIndex);
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push(slot);
    }
  }
  return slots;
}

export function placementsForPackageKey(
  documentKey: string,
  repeats?: DocumentExecutionRepeatCounts | null
): OperatorDocumentPlacementRef[] {
  return documentExecutionRolesForPackageKey(documentKey).flatMap((roleKey) =>
    expandedPlacementsForRole(roleKey, repeats)
  );
}

export function signingPackageRequiresIssuerSeal(documentKeys: readonly string[]): boolean {
  return documentKeys.some((key) => ROLES_REQUIRING_ISSUER_SEAL.has(key));
}

export function signingPackageRequiresDoaStamp(documentKeys: readonly string[]): boolean {
  return documentKeys.includes(DEED_OF_ASSIGNMENT_TEMPLATE_KEY);
}

export type OperatorDocumentExecutionSlotDto = {
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
  label: string;
  signingPersonId: string | null;
};

export type OperatorDocumentExecutionBindingInput = {
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
  signingPersonId: string | null;
};

/** @deprecated Prefer OperatorDocumentExecutionSlotDto. */
export type OperatorDocumentSignerDto = OperatorDocumentExecutionSlotDto & {
  documentKind: OperatorDocumentKind;
  signerIndex: number;
};

export type FrozenAutomaticPlacement = {
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
  keyword: string;
  status: "PENDING" | "SIGNED";
};

export type FrozenAutomaticCompanyStamp = {
  s3Key: string;
  sha256: string;
  contentType: string;
  fileName: string | null;
  widthPx: number;
  heightPx: number;
  byteSize: number;
};

export type FrozenAutomaticSignerSnapshot = {
  documentKind: OperatorDocumentKind;
  signingPersonId: string;
  officerName: string;
  designation: string | null;
  identityNumber: string | null;
  signingEmail: string;
  signatureS3Key: string;
  signatureSha256: string;
  signatureWidthPx: number;
  signatureHeightPx: number;
  signatureByteSize: number;
  /** One hidden signature keyword reused on every owned signature line. */
  signKeyword: string;
  /** One hidden date keyword reused on every owned Date line. Omitted when no dates. */
  dateKeyword?: string | null;
  placements: FrozenAutomaticPlacement[];
  companyStamp?: FrozenAutomaticCompanyStamp | null;
  /** Legacy pair index. Present on envelopes frozen before role-level bindings. */
  signerIndex?: number;
};

export type FrozenDocumentExecutionContext = {
  people: FrozenAutomaticSignerSnapshot[];
  companyStamp: FrozenAutomaticCompanyStamp | null;
};

export type SigningPackageReadinessIssue = {
  code: string;
  message: string;
  href?: string;
};

export type SigningPackageReadinessDto = {
  ready: boolean;
  issues: SigningPackageReadinessIssue[];
};

export type DocumentExecutionBindingIssue = {
  code:
    | "SIGNING_AUTOMATIC_ROLE_UNBOUND"
    | "SIGNING_AUTOMATIC_SIGNER_NOT_READY"
    | "SIGNING_AUTOMATIC_IDENTITY_MISSING"
    | "SIGNING_AUTOMATIC_STAMP_MISSING"
    | "DOCUMENT_EXECUTION_DUPLICATE_SIGNER"
    | "DOCUMENT_EXECUTION_EMAIL_COLLISION";
  message: string;
  roleKey: OperatorDocumentExecutionRole;
  slotIndex: number;
  documentKind: OperatorDocumentKind;
};

export function emptyDocumentExecutionSlots(): OperatorDocumentExecutionSlotDto[] {
  return allDocumentExecutionSlots().map((slot) => ({
    roleKey: slot.roleKey,
    slotIndex: slot.slotIndex,
    label: documentExecutionSlotLabel(slot.roleKey, slot.slotIndex),
    signingPersonId: null,
  }));
}

/** @deprecated Prefer emptyDocumentExecutionSlots. */
export function emptyDocumentSigners(): OperatorDocumentSignerDto[] {
  return emptyDocumentExecutionSlots().map((slot) => ({
    ...slot,
    documentKind: documentKindForExecutionRole(slot.roleKey),
    signerIndex: slot.slotIndex,
  }));
}

export function isAutomaticSignerProviderReady(input: {
  active: boolean;
  roles: readonly string[];
  signingEmail: string | null | undefined;
  signatureS3Key: string | null | undefined;
  signatureSha256: string | null | undefined;
  signatureConfirmedAt: string | null | undefined;
  requiredRole?: "AUTHORISED_SIGNATORY" | "WITNESS";
}): boolean {
  const requiredRole = input.requiredRole ?? "AUTHORISED_SIGNATORY";
  return (
    input.active &&
    input.roles.includes(requiredRole) &&
    Boolean(normalizeSigningEmail(input.signingEmail ?? "")) &&
    Boolean(input.signatureS3Key?.trim()) &&
    Boolean(input.signatureSha256?.trim()) &&
    Boolean(input.signatureConfirmedAt?.trim())
  );
}

export function displayedExecutionIdentityIssues(input: {
  roleKey: OperatorDocumentExecutionRole;
  officerName: string | null | undefined;
  designation: string | null | undefined;
  identityNumber: string | null | undefined;
}): string[] {
  const missing: string[] = [];
  const required = OPERATOR_DOCUMENT_EXECUTION_DISPLAYED_FIELDS[input.roleKey];
  if (required.includes("name") && !input.officerName?.trim()) missing.push("name");
  if (required.includes("designation") && !input.designation?.trim()) missing.push("designation");
  if (required.includes("identityNumber") && !input.identityNumber?.trim()) {
    missing.push("IC/passport number");
  }
  return missing;
}

export function documentExecutionBindingIssues(input: {
  requiredSlots: readonly OperatorDocumentExecutionSlotRef[];
  bindings: Array<{
    roleKey: OperatorDocumentExecutionRole;
    slotIndex: number;
    signingPersonId: string | null;
    signingEmail: string | null;
    officerName?: string | null;
    designation?: string | null;
    identityNumber?: string | null;
    providerReady: boolean;
  }>;
  companyStampReady?: boolean;
}): DocumentExecutionBindingIssue[] {
  const issues: DocumentExecutionBindingIssue[] = [];
  const byKey = new Map(
    input.bindings.map((row) => [automaticSlotKey(row.roleKey, row.slotIndex), row] as const)
  );
  const requiredDocuments = new Set(
    input.requiredSlots.map((slot) => documentKindForExecutionRole(slot.roleKey))
  );

  for (const slot of input.requiredSlots) {
    const row = byKey.get(automaticSlotKey(slot.roleKey, slot.slotIndex));
    const label = documentExecutionSlotLabel(slot.roleKey, slot.slotIndex);
    const documentKind = documentKindForExecutionRole(slot.roleKey);
    if (!row?.signingPersonId) {
      issues.push({
        code: "SIGNING_AUTOMATIC_ROLE_UNBOUND",
        message: `CashSouk has not assigned ${label}.`,
        roleKey: slot.roleKey,
        slotIndex: slot.slotIndex,
        documentKind,
      });
      continue;
    }
    if (!row.providerReady) {
      issues.push({
        code: "SIGNING_AUTOMATIC_SIGNER_NOT_READY",
        message: `The CashSouk ${
          isOperatorDocumentWitnessRole(slot.roleKey) ? "witness" : "signatory"
        } for ${label} is not ready for automatic signing.`,
        roleKey: slot.roleKey,
        slotIndex: slot.slotIndex,
        documentKind,
      });
    }
    const identityMissing = displayedExecutionIdentityIssues({
      roleKey: slot.roleKey,
      officerName: row.officerName,
      designation: row.designation,
      identityNumber: row.identityNumber,
    });
    if (identityMissing.length > 0) {
      issues.push({
        code: "SIGNING_AUTOMATIC_IDENTITY_MISSING",
        message: `${label} needs a ${identityMissing.join(" and ")} on the Shoraka person record.`,
        roleKey: slot.roleKey,
        slotIndex: slot.slotIndex,
        documentKind,
      });
    }
  }

  if (requiredDocuments.has("DOA") && input.companyStampReady === false) {
    issues.push({
      code: "SIGNING_AUTOMATIC_STAMP_MISSING",
      message: "Upload a CashSouk company stamp before sending a Deed of Assignment.",
      roleKey: "DOA_SSP",
      slotIndex: 1,
      documentKind: "DOA",
    });
  }

  const byRolePerson = new Map<OperatorDocumentExecutionRole, Map<string, number[]>>();
  const byRoleEmail = new Map<OperatorDocumentExecutionRole, Map<string, number[]>>();
  for (const slot of input.requiredSlots) {
    if (!isOperatorDocumentRepresentativeRole(slot.roleKey)) continue;
    const row = byKey.get(automaticSlotKey(slot.roleKey, slot.slotIndex));
    const personId = row?.signingPersonId?.trim() ?? "";
    if (personId) {
      const byPerson = byRolePerson.get(slot.roleKey) ?? new Map<string, number[]>();
      const indexes = byPerson.get(personId) ?? [];
      indexes.push(slot.slotIndex);
      byPerson.set(personId, indexes);
      byRolePerson.set(slot.roleKey, byPerson);
    }
    const email = normalizeSigningEmail(row?.signingEmail ?? "");
    if (email) {
      const byEmail = byRoleEmail.get(slot.roleKey) ?? new Map<string, number[]>();
      const indexes = byEmail.get(email) ?? [];
      indexes.push(slot.slotIndex);
      byEmail.set(email, indexes);
      byRoleEmail.set(slot.roleKey, byEmail);
    }
  }

  for (const [roleKey, byPerson] of byRolePerson) {
    for (const indexes of byPerson.values()) {
      if (indexes.length < 2) continue;
      issues.push({
        code: "DOCUMENT_EXECUTION_DUPLICATE_SIGNER",
        message: `${OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey]} representatives must be two different people.`,
        roleKey,
        slotIndex: indexes[1] ?? 2,
        documentKind: documentKindForExecutionRole(roleKey),
      });
    }
  }

  for (const [roleKey, byEmail] of byRoleEmail) {
    for (const indexes of byEmail.values()) {
      if (indexes.length < 2) continue;
      issues.push({
        code: "DOCUMENT_EXECUTION_EMAIL_COLLISION",
        message: `${OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey]} representatives cannot use the same signing email.`,
        roleKey,
        slotIndex: indexes[1] ?? 2,
        documentKind: documentKindForExecutionRole(roleKey),
      });
    }
  }

  return issues;
}

export function signingPackageReadinessFromBindingIssues(
  issues: readonly DocumentExecutionBindingIssue[]
): SigningPackageReadinessDto {
  return {
    ready: issues.length === 0,
    issues: issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      href: SHORAKA_SIGNING_ASSIGNMENTS_HREF,
    })),
  };
}

export function frozenPersonForRole(
  people: readonly FrozenAutomaticSignerSnapshot[],
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): FrozenAutomaticSignerSnapshot | null {
  return (
    people.find((person) =>
      person.placements.some(
        (placement) => placement.roleKey === roleKey && placement.slotIndex === slotIndex
      )
    ) ?? null
  );
}

export function frozenExecutionMergePerson(
  people: readonly FrozenAutomaticSignerSnapshot[],
  roleKey: OperatorDocumentExecutionRole,
  slotIndex: number
): { name: string; designation: string; identity_number: string } {
  const person = frozenPersonForRole(people, roleKey, slotIndex);
  return {
    name: person?.officerName.trim() ?? "",
    designation: person?.designation?.trim() ?? "",
    identity_number: person?.identityNumber?.trim() ?? "",
  };
}

export function frozenWitnessPerson(
  people: readonly FrozenAutomaticSignerSnapshot[],
  roleKey: OperatorDocumentWitnessRole
): FrozenAutomaticSignerSnapshot | null {
  return frozenPersonForRole(people, roleKey, 1);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function isAutomaticKeyword(value: string): boolean {
  return /^CASHSOUK_[A-Z0-9_]+$/.test(value);
}

function parsePlacementRow(
  value: unknown,
  sharedSignKeyword: string | null
): FrozenAutomaticPlacement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isOperatorDocumentExecutionRole(row.roleKey)) return null;
  const slotIndex = asPositiveInt(row.slotIndex);
  if (slotIndex == null) return null;
  const keyword = asNonEmptyString(row.keyword);
  if (!keyword || !isAutomaticKeyword(keyword)) return null;
  const slotKeyword = automaticSigningKeywordForSlot(row.roleKey, slotIndex);
  if (sharedSignKeyword) {
    if (keyword !== sharedSignKeyword) return null;
  } else if (keyword !== slotKeyword) {
    return null;
  }
  const status = row.status === "SIGNED" ? "SIGNED" : row.status === "PENDING" ? "PENDING" : null;
  if (!status) return null;
  return {
    roleKey: row.roleKey,
    slotIndex,
    keyword,
    status,
  };
}

function parsePlacements(
  value: unknown,
  sharedSignKeyword: string | null
): FrozenAutomaticPlacement[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed: FrozenAutomaticPlacement[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const placement = parsePlacementRow(item, sharedSignKeyword);
    if (!placement) return null;
    const key = automaticSlotKey(placement.roleKey, placement.slotIndex);
    if (seen.has(key)) return null;
    seen.add(key);
    parsed.push(placement);
  }
  return parsed;
}

function parseCompanyStamp(value: unknown): FrozenAutomaticCompanyStamp | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const s3Key = asNonEmptyString(row.s3Key);
  const sha256 = asNonEmptyString(row.sha256)?.toLowerCase() ?? null;
  const contentType = asNonEmptyString(row.contentType);
  const widthPx = asPositiveInt(row.widthPx);
  const heightPx = asPositiveInt(row.heightPx);
  const byteSize = asPositiveInt(row.byteSize);
  if (!s3Key || !sha256 || !contentType || widthPx == null || heightPx == null || byteSize == null) {
    return null;
  }
  return {
    s3Key,
    sha256,
    contentType,
    fileName: asNonEmptyString(row.fileName),
    widthPx,
    heightPx,
    byteSize,
  };
}

function inferDocumentKindFromPlacements(
  placements: readonly FrozenAutomaticPlacement[]
): OperatorDocumentKind | null {
  const kinds = new Set(placements.map((placement) => documentKindForExecutionRole(placement.roleKey)));
  if (kinds.size !== 1) return null;
  return [...kinds][0] ?? null;
}

function inferDocumentKindFromLegacySnapshot(row: Record<string, unknown>): OperatorDocumentKind | null {
  if (!isOperatorDocumentExecutionRole(row.roleKey)) return null;
  return documentKindForExecutionRole(row.roleKey);
}

function legacyPlacementFromSnapshot(
  row: Record<string, unknown>,
  documentKind: OperatorDocumentKind,
  signerIndex: number
): FrozenAutomaticPlacement[] | null {
  if (!isOperatorDocumentExecutionRole(row.roleKey)) return null;
  const keyword = asNonEmptyString(row.keyword);
  const expected = automaticSigningKeywordForSlot(row.roleKey, signerIndex);
  if (keyword !== expected) return null;
  if (documentKindForExecutionRole(row.roleKey) !== documentKind) return null;
  return [
    {
      roleKey: row.roleKey,
      slotIndex: signerIndex,
      keyword,
      status: "PENDING",
    },
  ];
}

function legacyFaPairPlacements(
  value: unknown,
  documentKind: OperatorDocumentKind,
  signerIndex: number
): FrozenAutomaticPlacement[] | null {
  if (documentKind !== "FA") return null;
  const expected = [
    {
      roleKey: "FA_INVESTOR" as const,
      slotIndex: signerIndex,
      keyword: automaticSigningKeywordForSlot("FA_INVESTOR", signerIndex),
    },
    {
      roleKey: "FA_AGENT" as const,
      slotIndex: signerIndex,
      keyword: automaticSigningKeywordForSlot("FA_AGENT", signerIndex),
    },
  ];
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const parsed: FrozenAutomaticPlacement[] = [];
  for (const expectedPlacement of expected) {
    const row = value.find((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Record<string, unknown>;
      return (
        candidate.roleKey === expectedPlacement.roleKey &&
        candidate.slotIndex === expectedPlacement.slotIndex
      );
    }) as Record<string, unknown> | undefined;
    const keyword = asNonEmptyString(row?.keyword);
    const status = row?.status === "SIGNED" ? "SIGNED" : row?.status === "PENDING" ? "PENDING" : null;
    if (!row || keyword !== expectedPlacement.keyword || !status) return null;
    parsed.push({
      roleKey: expectedPlacement.roleKey,
      slotIndex: expectedPlacement.slotIndex,
      keyword,
      status,
    });
  }
  return parsed;
}

export function parseFrozenAutomaticSignerSnapshot(
  value: unknown
): FrozenAutomaticSignerSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const signerIndex = asPositiveInt(row.signerIndex) ?? asPositiveInt(row.slotIndex);
  const signingPersonId = asNonEmptyString(row.signingPersonId);
  const officerName = asNonEmptyString(row.officerName);
  const signingEmail = normalizeSigningEmail(asNonEmptyString(row.signingEmail) ?? "");
  const signatureS3Key = asNonEmptyString(row.signatureS3Key);
  const signatureSha256 = asNonEmptyString(row.signatureSha256)?.toLowerCase() ?? null;
  const signatureWidthPx = asPositiveInt(row.signatureWidthPx);
  const signatureHeightPx = asPositiveInt(row.signatureHeightPx);
  const signatureByteSize = asPositiveInt(row.signatureByteSize);
  if (
    !signingPersonId ||
    !officerName ||
    !signingEmail ||
    !signatureS3Key ||
    !signatureSha256 ||
    signatureWidthPx == null ||
    signatureHeightPx == null ||
    signatureByteSize == null
  ) {
    return null;
  }

  const explicitSignKeyword = asNonEmptyString(row.signKeyword);
  if (explicitSignKeyword && !isAutomaticKeyword(explicitSignKeyword)) return null;
  const parsedPlacements = parsePlacements(row.placements, explicitSignKeyword);
  const documentKind =
    (isOperatorDocumentKind(row.documentKind) ? row.documentKind : null) ??
    (parsedPlacements ? inferDocumentKindFromPlacements(parsedPlacements) : null) ??
    inferDocumentKindFromLegacySnapshot(row);
  if (!documentKind) return null;

  const placements =
    parsedPlacements ??
    (signerIndex != null
      ? legacyFaPairPlacements(row.placements, documentKind, signerIndex) ??
        legacyPlacementFromSnapshot(row, documentKind, signerIndex)
      : null);
  if (!placements || placements.length === 0) return null;
  if (inferDocumentKindFromPlacements(placements) !== documentKind) return null;

  const uniquePlacementKeywords = [...new Set(placements.map((placement) => placement.keyword))];
  const signKeyword =
    explicitSignKeyword ??
    (uniquePlacementKeywords.length === 1
      ? uniquePlacementKeywords[0]!
      : automaticSignerSignKeyword(documentKind, signingPersonId));
  const needsDate = placements.some((placement) => executionRoleHasSignDate(placement.roleKey));
  const explicitDateKeyword = asNonEmptyString(row.dateKeyword);
  if (explicitDateKeyword && !isAutomaticKeyword(explicitDateKeyword)) return null;
  const dateKeyword = needsDate
    ? explicitDateKeyword ?? automaticDateKeywordForSignKeyword(signKeyword)
    : null;

  const companyStamp = parseCompanyStamp(row.companyStamp);

  return {
    documentKind,
    signingPersonId,
    officerName,
    designation: asNonEmptyString(row.designation),
    identityNumber: asNonEmptyString(row.identityNumber),
    signingEmail,
    signatureS3Key,
    signatureSha256,
    signatureWidthPx,
    signatureHeightPx,
    signatureByteSize,
    signKeyword,
    ...(dateKeyword ? { dateKeyword } : {}),
    placements,
    ...(companyStamp ? { companyStamp } : {}),
    ...(signerIndex != null ? { signerIndex } : {}),
  };
}

export function parseFrozenDocumentExecutionContext(
  value: unknown
): FrozenDocumentExecutionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.people)) return null;
  const people: FrozenAutomaticSignerSnapshot[] = [];
  for (const item of row.people) {
    const parsed = parseFrozenAutomaticSignerSnapshot(item);
    if (!parsed) return null;
    people.push(parsed);
  }
  return {
    people,
    companyStamp: parseCompanyStamp(row.companyStamp),
  };
}

export function frozenAutomaticPlacementsComplete(
  snapshot: FrozenAutomaticSignerSnapshot
): boolean {
  return snapshot.placements.every((placement) => placement.status === "SIGNED");
}

export function pendingAutomaticPlacements(
  snapshot: FrozenAutomaticSignerSnapshot
): FrozenAutomaticPlacement[] {
  return snapshot.placements.filter((placement) => placement.status !== "SIGNED");
}

export function frozenExecutionContextFromSnapshots(
  snapshots: readonly FrozenAutomaticSignerSnapshot[]
): FrozenDocumentExecutionContext {
  return {
    people: [...snapshots],
    companyStamp: snapshots.find((row) => row.companyStamp)?.companyStamp ?? null,
  };
}
