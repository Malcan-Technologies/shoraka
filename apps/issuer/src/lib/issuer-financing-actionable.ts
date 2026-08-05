import type { NoteListItem } from "@cashsouk/types";
import { isNoteFullySettled } from "@cashsouk/ui";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";
import {
  asContractForModal,
  asInvoiceForModal,
  type IssuerDashboardContract,
  type IssuerDashboardInvoice,
} from "@/types/issuer-dashboard";
import { financingOfferHref } from "@/lib/financing-offer-href";
import { actionsRequiredLabel } from "@/lib/issuer-pending-actions";

export function isIssuerContractActionable(contract: IssuerDashboardContract): boolean {
  if ((contract.actionRequiredApplicationIds ?? []).length > 0) return true;
  return shouldShowIssuerReviewOfferCta(asContractForModal(contract.contractForModal));
}

export function isIssuerInvoiceActionable(invoice: IssuerDashboardInvoice): boolean {
  if ((invoice.actionRequiredApplicationIds ?? []).length > 0) return true;
  return shouldShowIssuerReviewOfferCta(asInvoiceForModal(invoice.invoiceForModal));
}

/** Formal arrears status (stronger than late / past-due attention). */
export function isIssuerNoteInArrears(note: NoteListItem): boolean {
  if (isNoteFullySettled(note)) return false;
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  return status === "ARREARS" || servicing === "ARREARS";
}

/** Notes where the issuer should act (late / arrears / past due repayment). */
export function isIssuerNoteActionable(note: NoteListItem): boolean {
  if (isNoteFullySettled(note)) return false;
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  if (isIssuerNoteInArrears(note) || servicing === "LATE") {
    return true;
  }
  if (!note.maturityDate) return false;
  const maturity = new Date(note.maturityDate);
  if (Number.isNaN(maturity.getTime()) || maturity.getTime() >= Date.now()) return false;
  return (
    status === "ACTIVE" ||
    servicing === "ACTIVE" ||
    servicing === "PARTIAL" ||
    servicing === "IN_SERVICING"
  );
}

export function partitionByActionable<T>(
  items: readonly T[],
  isActionable: (item: T) => boolean
): { attention: T[]; rest: T[] } {
  const attention: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (isActionable(item)) attention.push(item);
    else rest.push(item);
  }
  return { attention, rest };
}

export function countIssuerFinancingActionable(input: {
  contracts: readonly IssuerDashboardContract[];
  invoices: readonly IssuerDashboardInvoice[];
  notes: readonly NoteListItem[];
}): { contracts: number; invoices: number; notes: number; total: number } {
  const contracts = input.contracts.filter(isIssuerContractActionable).length;
  const invoices = input.invoices.filter(isIssuerInvoiceActionable).length;
  const notes = input.notes.filter(isIssuerNoteActionable).length;
  return { contracts, invoices, notes, total: contracts + invoices + notes };
}

export type IssuerFinancingPendingAction = {
  count: number;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

function contractActionHref(contract: IssuerDashboardContract): string {
  if (shouldShowIssuerReviewOfferCta(asContractForModal(contract.contractForModal))) {
    return financingOfferHref(contract.applicationId);
  }
  const ids = contract.actionRequiredApplicationIds ?? [];
  if (ids.length === 1) return `/applications/${ids[0]}/edit`;
  if (ids.length > 1) {
    return `/applications?applicationIds=${encodeURIComponent(ids.join(","))}`;
  }
  return `/financing/contracts/${contract.id}`;
}

function invoiceActionHref(invoice: IssuerDashboardInvoice): string {
  if (shouldShowIssuerReviewOfferCta(asInvoiceForModal(invoice.invoiceForModal))) {
    return financingOfferHref(invoice.applicationId, invoice.id);
  }
  const ids = invoice.actionRequiredApplicationIds ?? [];
  if (ids.length === 1) return `/applications/${ids[0]}/edit`;
  if (ids.length > 1) {
    return `/applications?applicationIds=${encodeURIComponent(ids.join(","))}`;
  }
  return `/financing/invoices/${invoice.id}`;
}

/**
 * Dashboard next-action payload for financing — same count as Recent financing
 * and the Financing sidebar / tab badges.
 */
export function buildIssuerFinancingPendingAction(input: {
  contracts: readonly IssuerDashboardContract[];
  invoices: readonly IssuerDashboardInvoice[];
  notes: readonly NoteListItem[];
}): IssuerFinancingPendingAction | null {
  const actionableContracts = input.contracts.filter(isIssuerContractActionable);
  const actionableInvoices = input.invoices.filter(isIssuerInvoiceActionable);
  const actionableNotes = input.notes.filter(isIssuerNoteActionable);
  const { total, contracts, invoices, notes } = countIssuerFinancingActionable(input);
  if (total === 0) return null;

  const parts: string[] = [];
  if (contracts > 0) parts.push(`${contracts} contract${contracts === 1 ? "" : "s"}`);
  if (invoices > 0) parts.push(`${invoices} invoice${invoices === 1 ? "" : "s"}`);
  if (notes > 0) parts.push(`${notes} note${notes === 1 ? "" : "s"}`);

  const description =
    parts.length > 0
      ? `Needs attention: ${parts.join(", ")}.`
      : "Open Financing to clear items that need your response.";

  const singles = [
    ...actionableContracts.map((c) => {
      const modal = asContractForModal(c.contractForModal);
      const reviewVisible = shouldShowIssuerReviewOfferCta(modal);
      return {
        href: contractActionHref(c),
        ctaLabel: reviewVisible
          ? getIssuerOfferActionCtaFromOfferDetails(modal.offer_details, { scope: "contract" }).label
          : "Make changes",
      };
    }),
    ...actionableInvoices.map((i) => {
      const modal = asInvoiceForModal(i.invoiceForModal);
      const reviewVisible = shouldShowIssuerReviewOfferCta(modal);
      return {
        href: invoiceActionHref(i),
        ctaLabel: reviewVisible
          ? getIssuerOfferActionCtaFromOfferDetails(modal.offer_details, { scope: "invoice" }).label
          : "Make changes",
      };
    }),
    ...actionableNotes.map((n) => ({
      href: `/financing/notes/${n.id}`,
      ctaLabel: "View note",
    })),
  ];

  if (singles.length === 1) {
    return {
      count: total,
      title: actionsRequiredLabel(total),
      description,
      href: singles[0].href,
      ctaLabel: singles[0].ctaLabel,
    };
  }

  const tab =
    actionableContracts.length > 0
      ? "contracts"
      : actionableInvoices.length > 0
        ? "invoices"
        : "notes";

  return {
    count: total,
    title: actionsRequiredLabel(total),
    description,
    href: `/financing?tab=${tab}`,
    ctaLabel: "View financing",
  };
}
