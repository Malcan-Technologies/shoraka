import {
  isFacilityEnabled,
  isFacilityOnlyNewContract,
  isLegacyCombinedNewContract,
  readFinancingStructureType,
} from "@cashsouk/types";
import { assertFacilityFeeUpfrontSettled } from "../../lib/facility-fee-upfront-guard";
import { AppError } from "../../lib/http/error-handler";

export type OriginationGuardApplication = {
  financing_type?: unknown;
  financing_structure?: unknown;
  issuer_organization_id?: string | null;
  contract_id?: string | null;
};

export type OriginationGuardContract = {
  id: string;
  status?: string | null;
  issuer_organization_id?: string | null;
  contract_details?: unknown;
} | null;

export function assertFacilityIsEnabled(contract: OriginationGuardContract): void {
  if (!contract) return;
  if (isFacilityEnabled(contract.contract_details)) return;
  throw new AppError(
    400,
    "FACILITY_DISABLED",
    "This facility is disabled and cannot be used for new invoice financing."
  );
}

export function assertMayAttachInvoiceToApplication(
  application: OriginationGuardApplication
): void {
  const structureType = readFinancingStructureType(application.financing_structure);
  if (
    isFacilityOnlyNewContract({
      structureType,
      financingType: application.financing_type,
    })
  ) {
    throw new AppError(
      400,
      "FACILITY_ONLY_NO_INVOICE",
      "This application is for a new facility only. After the facility is approved, start a separate application to finance an invoice."
    );
  }
}

export function assertExistingFacilityDrawdown(
  application: OriginationGuardApplication,
  contract: OriginationGuardContract
): void {
  const structureType = readFinancingStructureType(application.financing_structure);
  if (structureType !== "existing_contract") return;

  if (!contract) {
    throw new AppError(
      400,
      "FACILITY_DRAWDOWN_REQUIRES_APPROVED_FACILITY",
      "Select an approved facility you own before financing an invoice from it."
    );
  }
  if (contract.issuer_organization_id !== application.issuer_organization_id) {
    throw new AppError(403, "FORBIDDEN", "Cannot link a facility from a different organization.");
  }
  if (contract.status !== "APPROVED") {
    throw new AppError(
      400,
      "INVALID_CONTRACT_STATUS",
      "Only approved facilities can be used to finance an invoice."
    );
  }
  assertFacilityIsEnabled(contract);
  assertFacilityFeeUpfrontSettled(contract.contract_details);
}

export function assertApplicationSubmitOrigination(input: {
  application: OriginationGuardApplication;
  invoices: unknown[];
  contract: OriginationGuardContract;
}): void {
  const structureType = readFinancingStructureType(input.application.financing_structure);
  if (
    isFacilityOnlyNewContract({
      structureType,
      financingType: input.application.financing_type,
    }) &&
    input.invoices.length > 0
  ) {
    throw new AppError(
      400,
      "FACILITY_ONLY_NO_INVOICE",
      "This application is for a new facility only and cannot include invoices."
    );
  }
  assertExistingFacilityDrawdown(input.application, input.contract);
}

export function allowsLegacyCombinedInvoices(application: OriginationGuardApplication): boolean {
  return isLegacyCombinedNewContract({
    structureType: readFinancingStructureType(application.financing_structure),
    financingType: application.financing_type,
  });
}
