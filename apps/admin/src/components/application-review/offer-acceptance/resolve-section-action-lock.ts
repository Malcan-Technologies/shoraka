import type { AdminPermission } from "@cashsouk/types";
import type { ReviewSectionId } from "../review-registry";

export const REVIEW_SECTION_PERMISSION_MAP: Record<string, AdminPermission> = {
  financial: "applications.financial.manage",
  company_details: "applications.company.manage",
  business_details: "applications.business_guarantor.manage",
  supporting_documents: "applications.documents.manage",
  acceptance_documents: "applications.documents.manage",
  contract_details: "applications.contract.manage",
  invoice_details: "applications.invoice.manage",
};

export type SectionActionLock = {
  locked: boolean;
  tooltip: string | undefined;
  canManage: boolean;
};

export type ResolveSectionActionLockInput = {
  section: string;
  applicationWithdrawn: boolean;
  isExistingContract: boolean;
  canManage: boolean;
  tabUnlocked: boolean;
  paymasterSwitchingFrozen: boolean;
  unlockTooltip: string;
};

/**
 * Same lock rules as the live application detail tab map: withdrawn, inherited
 * existing-contract Facility/Acceptance, permission, tab prerequisites, paymaster freeze.
 */
export function resolveSectionActionLock(
  input: ResolveSectionActionLockInput
): SectionActionLock {
  const isContractExistingContract =
    input.section === "contract_details" && input.isExistingContract;
  const isAcceptanceExistingContract =
    input.section === "acceptance_documents" && input.isExistingContract;
  const paymasterAmendmentLocked =
    input.section === "contract_details" && input.paymasterSwitchingFrozen;

  const locked =
    input.applicationWithdrawn ||
    isContractExistingContract ||
    isAcceptanceExistingContract ||
    !input.tabUnlocked ||
    !input.canManage ||
    paymasterAmendmentLocked;

  const tooltip = !locked
    ? undefined
    : !input.canManage
      ? "You do not have permission to perform this action."
      : input.applicationWithdrawn
        ? "Application withdrawn"
        : isContractExistingContract
          ? "Facility was approved in a prior application"
          : isAcceptanceExistingContract
            ? "Acceptance was completed when the linked facility was approved"
            : paymasterAmendmentLocked
              ? "Paymaster cannot be changed after a commercial offer or signed facility"
              : input.unlockTooltip || undefined;

  return { locked, tooltip, canManage: input.canManage };
}

export function canManageReviewSection(
  section: string,
  can: (permission: AdminPermission) => boolean
): boolean {
  const permission = REVIEW_SECTION_PERMISSION_MAP[section];
  return permission ? can(permission) : true;
}

export type SectionActionLockMap = Partial<Record<ReviewSectionId, SectionActionLock>>;
