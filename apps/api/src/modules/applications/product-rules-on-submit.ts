import {
  ContractStatus,
  InvoiceStatus,
  readFinancingStructureType,
} from "@cashsouk/types";
import {
  assertContractMeetsProductRules,
  assertInvoiceMeetsProductRules,
} from "../../lib/product-rule-guard";
import { assertMaturityForApplication } from "../products/validate-financial-config";

const LOCKED_INVOICE_STATUSES = new Set<string>([
  InvoiceStatus.SUBMITTED,
  InvoiceStatus.APPROVED,
  InvoiceStatus.OFFER_SENT,
  InvoiceStatus.REJECTED,
  InvoiceStatus.WITHDRAWN,
]);

export type SubmitProductRuleInvoice = {
  status?: string | null;
  details?: unknown;
  contract_id?: string | null;
};

export type SubmitProductRuleContract = {
  status?: string | null;
  contract_details?: unknown;
};

function asDetails(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invoiceIsOpenForProductRules(status: string | null | undefined): boolean {
  if (status == null || status === "") return true;
  return !LOCKED_INVOICE_STATUSES.has(status);
}

export function assertProductRulesForSubmit(
  workflow: unknown,
  input: {
    invoices?: SubmitProductRuleInvoice[] | null;
    contract?: SubmitProductRuleContract | null;
    applicationContractId?: string | null;
    structureType?: string | null;
    /**
     * Whether the facility dates are open for re-validation. Initial submit always
     * checks; amendment resubmit passes false when contract_details was not amended so
     * elapsed calendar time cannot fail an already-accepted end date.
     */
    checkContract?: boolean;
  }
): void {
  const structureType = input.structureType ?? readFinancingStructureType(undefined);
  // Mirrors InvoiceService: an invoice sits on a facility when the application is not
  // standalone and either the invoice row or the application is linked to a contract.
  const facilityEligible = structureType !== "invoice_only";
  for (const invoice of input.invoices ?? []) {
    if (!invoiceIsOpenForProductRules(invoice.status)) continue;
    const details = asDetails(invoice.details) ?? {};
    assertMaturityForApplication(workflow, details);
    assertInvoiceMeetsProductRules(workflow, details, {
      mode: "issuer_request",
      hasFacility:
        facilityEligible && Boolean(invoice.contract_id ?? input.applicationContractId),
    });
  }
  if (structureType !== "new_contract") return;
  if (input.checkContract === false) return;
  if (input.contract?.status === ContractStatus.APPROVED) return;
  assertContractMeetsProductRules(workflow, asDetails(input.contract?.contract_details), {
    referenceDate: new Date(),
  });
}
