/**
 * Split facility origination from invoice drawdowns.
 *
 * Newly created applications stamp `split_origination: true` on `financing_type`.
 * Apps without that marker keep the historical combined new_contract + invoice layout.
 */

export const FINANCING_STRUCTURE_TYPES = [
  "new_contract",
  "existing_contract",
  "invoice_only",
] as const;

export type FinancingStructureType = (typeof FINANCING_STRUCTURE_TYPES)[number];

/** Set on `financing_type` at application create. Absence means a grandfathered record. */
export const SPLIT_ORIGINATION_MARKER = "split_origination" as const;

export type FinancingGoalId = FinancingStructureType;

export type FinancingGoalChoice = {
  id: FinancingGoalId;
  title: string;
  description: string;
  disabled: boolean;
  disabledReason: string | null;
};

export type FinancingJourneySummary = {
  title: string;
  now: string;
  after: string;
};

export function isFinancingStructureType(value: unknown): value is FinancingStructureType {
  return (
    value === "new_contract" || value === "existing_contract" || value === "invoice_only"
  );
}

export function readFinancingStructureType(value: unknown): FinancingStructureType | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { structure_type?: unknown }).structure_type;
  return isFinancingStructureType(type) ? type : null;
}

export function isSplitOriginationApplication(financingType: unknown): boolean {
  if (!financingType || typeof financingType !== "object" || Array.isArray(financingType)) {
    return false;
  }
  return (financingType as Record<string, unknown>)[SPLIT_ORIGINATION_MARKER] === true;
}

export function withSplitOriginationMarker(
  financingType: Record<string, unknown>
): Record<string, unknown> {
  return { ...financingType, [SPLIT_ORIGINATION_MARKER]: true };
}

export function preserveSplitOriginationMarker(
  nextFinancingType: Record<string, unknown>,
  previousFinancingType: unknown
): Record<string, unknown> {
  if (!isSplitOriginationApplication(previousFinancingType)) return nextFinancingType;
  return withSplitOriginationMarker(nextFinancingType);
}

export function isFacilityOnlyNewContract(input: {
  structureType?: string | null;
  financingType?: unknown;
}): boolean {
  return input.structureType === "new_contract" && isSplitOriginationApplication(input.financingType);
}

export function shouldOmitInvoiceDetails(input: {
  structureType?: string | null;
  financingType?: unknown;
}): boolean {
  return isFacilityOnlyNewContract(input);
}

export function isLegacyCombinedNewContract(input: {
  structureType?: string | null;
  financingType?: unknown;
}): boolean {
  return input.structureType === "new_contract" && !isSplitOriginationApplication(input.financingType);
}

export const ADMIN_CONTRACT_APPLICATION_KINDS = ["facility", "invoice"] as const;
export type AdminContractApplicationKind = (typeof ADMIN_CONTRACT_APPLICATION_KINDS)[number];

/** Facility origination vs invoice draw on a linked contract. */
export function resolveAdminContractApplicationKind(input: {
  applicationId: string;
  originatingApplicationId?: string | null;
  structureType?: string | null;
  financingType?: unknown;
  invoiceCount?: number;
}): AdminContractApplicationKind {
  if (
    input.originatingApplicationId &&
    input.applicationId === input.originatingApplicationId
  ) {
    return "facility";
  }
  if (input.structureType === "existing_contract" || input.structureType === "invoice_only") {
    return "invoice";
  }
  if (input.structureType === "new_contract") {
    return "facility";
  }
  return (input.invoiceCount ?? 0) > 0 ? "invoice" : "facility";
}

export function filterWorkflowStepsForOrigination<T extends { id?: string }>(
  workflow: T[],
  input: {
    structureType?: string | null;
    financingType?: unknown;
    getStepKey: (stepId: string) => string | null;
    finalize: (steps: T[]) => T[];
  }
): T[] {
  let base = workflow;
  if (input.structureType === "existing_contract") {
    base = base.filter((step) => input.getStepKey(String(step.id ?? "")) !== "contract_details");
  }
  if (shouldOmitInvoiceDetails(input)) {
    base = base.filter((step) => input.getStepKey(String(step.id ?? "")) !== "invoice_details");
  }
  return input.finalize(base);
}

export function listFinancingGoalChoices(input: {
  hasApprovedFacilities: boolean;
}): FinancingGoalChoice[] {
  return [
    {
      id: "new_contract",
      title: "Set up a new facility",
      description:
        "Apply for a reusable financing limit against a customer contract. You will finance invoices after CashSouk approves the facility.",
      disabled: false,
      disabledReason: null,
    },
    {
      id: "existing_contract",
      title: "Finance an invoice from an approved facility",
      description: "Use available credit from a facility you already have.",
      disabled: !input.hasApprovedFacilities,
      disabledReason: input.hasApprovedFacilities
        ? null
        : "You do not have an approved facility yet",
    },
    {
      id: "invoice_only",
      title: "Finance one invoice without a facility",
      description: "Apply to finance a single invoice without setting up a reusable facility.",
      disabled: false,
      disabledReason: null,
    },
  ];
}

export function resolveInitialFinancingGoal(input: {
  savedStructureType?: FinancingStructureType | null;
  savedFacilityId?: string | null;
  prefillFacilityId?: string | null;
}): { structureType: FinancingStructureType; facilityId: string; fromPrefill: boolean } {
  if (input.savedStructureType) {
    return {
      structureType: input.savedStructureType,
      facilityId:
        input.savedStructureType === "existing_contract" ? (input.savedFacilityId ?? "") : "",
      fromPrefill: false,
    };
  }
  const prefill = input.prefillFacilityId?.trim() ?? "";
  if (prefill) {
    return { structureType: "existing_contract", facilityId: prefill, fromPrefill: true };
  }
  return { structureType: "new_contract", facilityId: "", fromPrefill: false };
}

export function buildFinancingJourneySummary(
  structureType: FinancingStructureType | null
): FinancingJourneySummary | null {
  if (structureType === "new_contract") {
    return {
      title: "Your journey",
      now: "You will complete facility and customer details, then the rest of this application. Invoice details are not part of this step.",
      after:
        "After CashSouk approves the facility, Finance an invoice will appear on that facility so you can request financing for one invoice.",
    };
  }
  if (structureType === "existing_contract") {
    return {
      title: "Your journey",
      now: "You will attach one invoice to the approved facility you selected, then complete the rest of this application.",
      after: "CashSouk will review this invoice against the available credit on that facility.",
    };
  }
  if (structureType === "invoice_only") {
    return {
      title: "Your journey",
      now: "You will provide customer and invoice details, then complete the rest of this application. You are not setting up a reusable facility.",
      after: "CashSouk will review this single invoice on its own.",
    };
  }
  return null;
}

export function buildBranchResetDescription(input: {
  fromType?: FinancingStructureType | null;
  hasInvoices: boolean;
  hasDraftFacility: boolean;
}): string {
  const removed: string[] = [];
  if (input.fromType === "new_contract" || input.hasDraftFacility) {
    removed.push("draft facility details and uploaded contract files");
  }
  if (input.fromType === "existing_contract") {
    removed.push("the selected approved facility for this application");
  }
  if (input.fromType === "invoice_only") {
    removed.push("customer details entered for standalone invoice financing");
  }
  if (input.hasInvoices) {
    removed.push("draft invoices and their uploaded files");
  }
  if (removed.length === 0) {
    return "This will clear financing details entered for the current choice. Other application steps are kept. This cannot be undone.";
  }
  return `This will remove ${joinWithAnd(removed)}. Other application steps are kept. This cannot be undone.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Requested (or approved) facility is invalid when it is greater than or equal to contract face. */
export function isRequestedFacilityAtOrAboveContractValue(
  requestedFacility: number,
  contractValue: number
): boolean {
  return requestedFacility >= contractValue;
}

export const REQUESTED_FACILITY_BELOW_CONTRACT_COPY =
  "Requested financing must be less than the contract value.";

export function facilityChooserRemaining(input: {
  availableFacility?: number | null;
  lifetimeRemaining?: number | null;
}): { leftToDraw: number | null; leftOnContract: number | null } {
  const leftToDraw =
    typeof input.availableFacility === "number" && Number.isFinite(input.availableFacility)
      ? input.availableFacility
      : null;
  const leftOnContract =
    typeof input.lifetimeRemaining === "number" && Number.isFinite(input.lifetimeRemaining)
      ? input.lifetimeRemaining
      : null;
  return { leftToDraw, leftOnContract };
}

export const FACILITY_CAPACITY_EXCEEDED = "FACILITY_CAPACITY_EXCEEDED";
export const CONTRACT_LIFETIME_EXCEEDED = "CONTRACT_LIFETIME_EXCEEDED";
export const FACILITY_MUST_BE_BELOW_CONTRACT_VALUE = "FACILITY_MUST_BE_BELOW_CONTRACT_VALUE";

export const CAPACITY_ERROR_CODES = [
  FACILITY_CAPACITY_EXCEEDED,
  CONTRACT_LIFETIME_EXCEEDED,
  FACILITY_MUST_BE_BELOW_CONTRACT_VALUE,
] as const;

export type CapacityErrorCode = (typeof CAPACITY_ERROR_CODES)[number];

export const LEFT_TO_DRAW_LABEL = "Left to draw";
export const LEFT_ON_CONTRACT_LABEL = "Left on contract";
export const CREDIT_FACILITY_LABEL = "Credit facility";
export const CONTRACT_ALLOCATION_LABEL = "Contract allocation";

export const LEFT_TO_DRAW_HELPER =
  "Credit facility remaining: approved facility minus reserved and live financing. Repayment frees this credit.";
export const LEFT_ON_CONTRACT_HELPER =
  "Contract allocation remaining: contract value minus counted invoice face values. Settlement does not free this allocation.";

export const DRAFT_OVERAGE_CAN_SAVE_COPY =
  "You can save this draft, but it cannot be submitted until the amounts fit.";
export const RESERVED_AMENDMENT_OVERAGE_COPY =
  "Reserved amendments cannot be saved above the remaining limits.";

export const CAPACITY_ERROR_COPY = {
  FACILITY_CAPACITY_EXCEEDED:
    "This request exceeds remaining facility credit (left to draw). Reduce the financing amount, or wait for reserved or live financing to be released.",
  CONTRACT_LIFETIME_EXCEEDED:
    "This invoice exceeds remaining contract allocation (left on contract). Reduce the invoice value. Settlement does not free this allocation.",
  FACILITY_MUST_BE_BELOW_CONTRACT_VALUE: REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
} as const;

export function isCapacityErrorCode(value: unknown): value is CapacityErrorCode {
  return (
    value === FACILITY_CAPACITY_EXCEEDED ||
    value === CONTRACT_LIFETIME_EXCEEDED ||
    value === FACILITY_MUST_BE_BELOW_CONTRACT_VALUE
  );
}

export function readCapacityErrorCode(error: unknown): CapacityErrorCode | null {
  if (typeof error === "string") return isCapacityErrorCode(error) ? error : null;
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: unknown; error?: { code?: unknown } };
  if (isCapacityErrorCode(record.code)) return record.code;
  if (isCapacityErrorCode(record.error?.code)) return record.error.code;
  return null;
}

export function mapCapacityApiError(error: unknown): string | null {
  const code = readCapacityErrorCode(error);
  return code ? CAPACITY_ERROR_COPY[code] : null;
}

export type DualLimitPreview = {
  leftToDraw: number | null;
  leftOnContract: number | null;
  financingAmount: number;
  invoiceFace: number;
  financingOverage: number;
  faceOverage: number;
  exceedsFacility: boolean;
  exceedsLifetime: boolean;
  exceedsAny: boolean;
};

function finiteAmount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function previewDualLimits(input: {
  availableFacility?: number | null;
  lifetimeRemaining?: number | null;
  financingAmount: number;
  invoiceFace: number;
  addBackFinancing?: number | null;
  addBackFace?: number | null;
}): DualLimitPreview {
  const addBackFinancing = Math.max(0, finiteAmount(input.addBackFinancing) ?? 0);
  const addBackFace = Math.max(0, finiteAmount(input.addBackFace) ?? 0);
  const available = finiteAmount(input.availableFacility);
  const remaining = finiteAmount(input.lifetimeRemaining);
  const leftToDraw = available == null ? null : available + addBackFinancing;
  const leftOnContract = remaining == null ? null : remaining + addBackFace;
  const financingAmount = Number.isFinite(input.financingAmount) ? input.financingAmount : 0;
  const invoiceFace = Number.isFinite(input.invoiceFace) ? input.invoiceFace : 0;
  const financingOverage =
    leftToDraw != null && financingAmount > leftToDraw ? financingAmount - leftToDraw : 0;
  const faceOverage =
    leftOnContract != null && invoiceFace > leftOnContract ? invoiceFace - leftOnContract : 0;
  return {
    leftToDraw,
    leftOnContract,
    financingAmount,
    invoiceFace,
    financingOverage,
    faceOverage,
    exceedsFacility: financingOverage > 0,
    exceedsLifetime: faceOverage > 0,
    exceedsAny: financingOverage > 0 || faceOverage > 0,
  };
}

export function dualLimitOverageCopy(
  preview: DualLimitPreview,
  mode: "draft" | "reserved"
): string | null {
  if (!preview.exceedsAny) return null;
  const parts: string[] = [];
  if (preview.exceedsFacility) {
    parts.push("Requested financing exceeds left to draw.");
  }
  if (preview.exceedsLifetime) {
    parts.push("Invoice value exceeds left on contract.");
  }
  const suffix =
    mode === "draft" ? DRAFT_OVERAGE_CAN_SAVE_COPY : RESERVED_AMENDMENT_OVERAGE_COPY;
  return `${parts.join(" ")} ${suffix}`;
}

export function isReservedCapacityInvoiceStatus(status: string | null | undefined): boolean {
  const value = String(status ?? "").toUpperCase();
  return value === "SUBMITTED" || value === "AMENDMENT_REQUESTED" || value === "OFFER_SENT";
}

export function isEditableReservedInvoiceStatus(status: string | null | undefined): boolean {
  const value = String(status ?? "").toUpperCase();
  return value === "AMENDMENT_REQUESTED" || value === "SUBMITTED";
}

export type FacilityImpactCopy = {
  statusWording: string;
  settledLifetimeRetained: boolean;
  released: boolean;
};

export function facilityImpactCopy(input: {
  invoiceStatus?: string | null;
  noteStatus?: string | null;
  servicingStatus?: string | null;
}): FacilityImpactCopy {
  const invoiceStatus = String(input.invoiceStatus ?? "").toUpperCase();
  const noteStatus = String(input.noteStatus ?? "").toUpperCase();
  const servicingStatus = String(input.servicingStatus ?? "").toUpperCase();
  if (invoiceStatus === "DRAFT") {
    return {
      statusWording: "This draft does not reserve credit or contract allocation until you submit.",
      settledLifetimeRetained: false,
      released: false,
    };
  }
  if (
    invoiceStatus === "REJECTED" ||
    invoiceStatus === "WITHDRAWN" ||
    invoiceStatus === "OFFER_EXPIRED" ||
    noteStatus === "FAILED_FUNDING" ||
    noteStatus === "CANCELLED"
  ) {
    return {
      statusWording: "This financing no longer occupies the facility or contract allocation.",
      settledLifetimeRetained: false,
      released: true,
    };
  }
  if (noteStatus === "REPAID" || servicingStatus === "SETTLED") {
    return {
      statusWording: "Repayment freed credit. Settled invoices still use contract allocation.",
      settledLifetimeRetained: true,
      released: false,
    };
  }
  if (invoiceStatus === "SUBMITTED" || invoiceStatus === "AMENDMENT_REQUESTED") {
    return {
      statusWording: "This request reserves credit and uses contract allocation.",
      settledLifetimeRetained: false,
      released: false,
    };
  }
  if (invoiceStatus === "OFFER_SENT") {
    return {
      statusWording:
        "Offered financing is reserved against the facility. Invoice face uses contract allocation.",
      settledLifetimeRetained: false,
      released: false,
    };
  }
  return {
    statusWording: "Live financing occupies the credit facility. Invoice face uses contract allocation.",
    settledLifetimeRetained: false,
    released: false,
  };
}

export const OPENING_APPLICATION_COPY = {
  title: "What would you like to do?",
  description:
    "Start by choosing a financing product. Next you will pick whether to set up a new facility, finance an invoice from an approved facility, or finance one invoice without a facility.",
  prefilledFacilityDescription:
    "You started from an approved facility. After you choose a product, we will take you straight to financing an invoice from that facility.",
  productListHeading: "Choose a financing product",
  productListDescription:
    "This is the product your application will use. You will choose your financing goal on the next screen.",
} as const;

export const FACILITY_ONLY_SUBMIT_COPY =
  "This application is for a facility only. After CashSouk approves it, Finance an invoice will appear on the facility so you can request financing for an invoice.";

export const NO_APPROVED_FACILITY_COPY = "You do not have an approved facility yet";
export const SET_UP_FACILITY_INSTEAD_COPY = "Set up a new facility instead";
