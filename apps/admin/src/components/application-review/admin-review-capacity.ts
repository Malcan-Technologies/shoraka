/**
 * Canonical admin review capacity for contract, invoice, and acceptance tabs.
 * Occupancy and lifetime go through one resolver so unmarked pre-backfill rows
 * do not show different remaining/reserved/allocation figures per tab.
 */

import { resolveApprovedFacility } from "@cashsouk/config";
import {
  conservativeMigrationWindowLifetimeRemaining,
  conservativeMigrationWindowLifetimeUsed,
  hasCompletedCapacitySnapshot,
  isInvoiceOnlyFinancingStructure,
} from "@cashsouk/types";
import {
  parseFacilityAmount,
  resolveAdminReviewFacilityOccupancy,
} from "@/contracts/utils/contract-facility-metrics";

export type AdminReviewCapacityInvoice = {
  status?: string;
  details?: unknown;
  offer_details?: unknown;
};

export type AdminReviewCapacitySource = {
  id?: string;
  invoices?: AdminReviewCapacityInvoice[];
  financing_structure?: unknown;
  contract?: {
    status?: string;
    contract_details?: unknown;
    invoices?: AdminReviewCapacityInvoice[];
  } | null;
};

export type AdminReviewCapacity = {
  approvedFacility: number;
  utilizedFacility: number;
  pendingFacility: number;
  availableFacility: number;
  lifetimeCap: number;
  lifetimeUsed: number;
  lifetimeRemaining: number;
  isOverLimit: boolean;
};

export type AdminReviewTabCapacityProps = {
  contract: {
    remainingCredit: number;
    remainingAllocation: number;
    reservedFacility: number;
  };
  invoice: {
    contractFacility: number;
    availableFacility: number;
    utilizedFacility: number;
    pendingFacility: number;
    lifetimeCap: number;
    lifetimeUsed: number;
    lifetimeRemaining: number;
    isOverLimit: boolean;
  };
  acceptance: {
    remainingCredit: number;
    remainingAllocation: number;
  };
};

function contractDetailsRecord(details: unknown): Record<string, unknown> | null {
  return details && typeof details === "object" ? (details as Record<string, unknown>) : null;
}

/** Same invoice set the invoice tab already used for occupancy. */
function reviewOccupancyInvoices(
  app: AdminReviewCapacitySource
): AdminReviewCapacityInvoice[] {
  const appInvoices = app.invoices ?? [];
  const contractInvoices = app.contract?.invoices ?? [];
  return contractInvoices.length > 0 ? contractInvoices : appInvoices;
}

function reviewInvoiceFaceValue(details: unknown): number {
  const record = contractDetailsRecord(details);
  if (!record) return 0;
  return parseFacilityAmount(record.value) ?? parseFacilityAmount(record.invoice_value) ?? 0;
}

function contractFaceValue(contractDetails: Record<string, unknown> | null | undefined): number {
  if (!contractDetails) return 0;
  return parseFacilityAmount(contractDetails.value) ?? parseFacilityAmount(contractDetails.contract_value) ?? 0;
}

function resolveAdminReviewLifetimeAllocation(input: {
  contractDetails: Record<string, unknown> | null | undefined;
  invoices: AdminReviewCapacityInvoice[];
}): { lifetimeCap: number; lifetimeUsed: number; lifetimeRemaining: number } {
  const contractFace = contractFaceValue(input.contractDetails);
  if (hasCompletedCapacitySnapshot(input.contractDetails)) {
    const lifetimeCap = parseFacilityAmount(input.contractDetails?.lifetime_cap) ?? contractFace;
    const lifetimeUsed = parseFacilityAmount(input.contractDetails?.lifetime_used) ?? 0;
    const storedLifetimeRemaining = parseFacilityAmount(input.contractDetails?.lifetime_remaining);
    return {
      lifetimeCap,
      lifetimeUsed,
      lifetimeRemaining:
        storedLifetimeRemaining != null
          ? storedLifetimeRemaining
          : conservativeMigrationWindowLifetimeRemaining(lifetimeCap, lifetimeUsed),
    };
  }

  const lifetimeUsed = conservativeMigrationWindowLifetimeUsed(
    input.invoices.map((invoice) => ({
      status: invoice.status,
      faceValue: reviewInvoiceFaceValue(invoice.details),
    }))
  );
  return {
    lifetimeCap: contractFace,
    lifetimeUsed,
    lifetimeRemaining: conservativeMigrationWindowLifetimeRemaining(contractFace, lifetimeUsed),
  };
}

function resolveAdminReviewApprovedCeiling(input: {
  contractDetails: Record<string, unknown> | null | undefined;
  contractStatus?: string;
  contractSectionStatus?: string;
}): number {
  const cd = input.contractDetails;
  const linkedApproved = resolveApprovedFacility(input.contractStatus ?? "", cd);
  if (linkedApproved > 0) return linkedApproved;
  return resolveApprovedFacility(input.contractSectionStatus ?? "", cd);
}

export function resolveAdminReviewCapacity(input: {
  contractDetails: Record<string, unknown> | null | undefined;
  invoices: AdminReviewCapacityInvoice[];
  /** Linked contract row status — source of truth for an existing approved line. */
  contractStatus?: string;
  /** New-contract review-section status only; never used as a requested-facility fallback. */
  contractSectionStatus?: string;
}): AdminReviewCapacity | null {
  const cd = input.contractDetails;
  const approvedFacility = resolveAdminReviewApprovedCeiling({
    contractDetails: cd,
    contractStatus: input.contractStatus,
    contractSectionStatus: input.contractSectionStatus,
  });
  if (!(approvedFacility > 0)) return null;

  const utilizedFacility = parseFacilityAmount(cd?.utilized_facility) ?? 0;
  const occupancy = resolveAdminReviewFacilityOccupancy({
    contractDetails: cd,
    invoices: input.invoices,
    approvedFacility,
    utilizedFacility,
  });
  const pendingFacility = occupancy.pendingFacility;
  const availableFacility = hasCompletedCapacitySnapshot(cd)
    ? occupancy.availableFacility
    : approvedFacility - utilizedFacility - pendingFacility;
  const { lifetimeCap, lifetimeUsed, lifetimeRemaining } = resolveAdminReviewLifetimeAllocation({
    contractDetails: cd,
    invoices: input.invoices,
  });

  return {
    approvedFacility,
    utilizedFacility,
    pendingFacility,
    availableFacility,
    lifetimeCap,
    lifetimeUsed,
    lifetimeRemaining,
    isOverLimit: availableFacility < 0 || (lifetimeCap > 0 && lifetimeRemaining < 0),
  };
}

export function toAdminReviewTabCapacityProps(
  capacity: AdminReviewCapacity
): AdminReviewTabCapacityProps {
  return {
    contract: {
      remainingCredit: capacity.availableFacility,
      remainingAllocation: capacity.lifetimeRemaining,
      reservedFacility: capacity.pendingFacility,
    },
    invoice: {
      contractFacility: capacity.approvedFacility,
      availableFacility: capacity.availableFacility,
      utilizedFacility: capacity.utilizedFacility,
      pendingFacility: capacity.pendingFacility,
      lifetimeCap: capacity.lifetimeCap,
      lifetimeUsed: capacity.lifetimeUsed,
      lifetimeRemaining: capacity.lifetimeRemaining,
      isOverLimit: capacity.isOverLimit,
    },
    acceptance: {
      remainingCredit: capacity.availableFacility,
      remainingAllocation: capacity.lifetimeRemaining,
    },
  };
}

export function resolveAdminReviewTabCapacity(input: {
  app: AdminReviewCapacitySource;
  contractSectionStatus?: string;
}): AdminReviewTabCapacityProps | null {
  if (!input.app.contract) return null;
  if (isInvoiceOnlyFinancingStructure(input.app.financing_structure)) return null;
  const capacity = resolveAdminReviewCapacity({
    contractDetails: contractDetailsRecord(input.app.contract.contract_details),
    invoices: reviewOccupancyInvoices(input.app),
    contractStatus: input.app.contract.status,
    contractSectionStatus: input.contractSectionStatus,
  });
  return capacity ? toAdminReviewTabCapacityProps(capacity) : null;
}
