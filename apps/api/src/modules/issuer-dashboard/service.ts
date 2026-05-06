import { Prisma, NoteFundingStatus, NoteStatus, ContractStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationRepository } from "../organization/repository";

function decimalToNumber(value: unknown): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jsonForModal(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function fundingProgressPercent(funded: unknown, target: unknown): number | null {
  const t = decimalToNumber(target);
  if (t <= 0) return null;
  const f = decimalToNumber(funded);
  const pct = (f / t) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}

export type IssuerDashboardNoteDto = {
  id: string;
  noteReference: string;
  noteStatus: NoteStatus;
  listingStatus: string | null;
  noteListingStatus: string | null;
  fundingStatus: NoteFundingStatus;
  servicingStatus: string;
  targetAmount: string;
  fundedAmount: string;
  fundingProgressPercent: number | null;
  minimumFundingPercent: string;
  fundingDeadline: string | null;
  maturityDate: string | null;
  marketplaceStatusLabel: string | null;
};

export type IssuerDashboardInvoiceDto = {
  id: string;
  applicationId: string;
  productId: string;
  contractId: string | null;
  /** JSON-serialized invoice row for issuer offer modal. */
  invoiceForModal: unknown;
  invoiceStatus: InvoiceStatus;
  invoiceNumber: string;
  customerName: string | null;
  invoiceValue: string | null;
  financingAmount: string | null;
  submissionDate: string | null;
  note: IssuerDashboardNoteDto | null;
};

export type IssuerDashboardContractDto = {
  id: string;
  applicationId: string;
  productId: string;
  /** JSON-serialized contract row for issuer offer modal (dates as ISO strings). */
  contractForModal: unknown;
  /** From `contract_details.title` only; null when missing. */
  title: string | null;
  productName: string | null;
  customerName: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  approvedFacilityAmount: string | null;
  utilizedFacilityAmount: string | null;
  availableFacilityAmount: string | null;
  activeNotesCount: number;
  contractStatus: ContractStatus;
  invoiceStats: {
    total: number;
    approved: number;
    rejected: number;
    unfinanced: number;
    fundingInProgress: number;
    activeNotes: number;
    completedNotes: number;
    unsuccessfulRaise: number;
    disputedNotes: number | null;
  };
};

export type IssuerDashboardPayload = {
  user: { displayName: string | null };
  overview: {
    successRatePercent: number | null;
    activeFinancingAmount: string | null;
    activeNotesCount: number;
    completedNotesCount: number;
  };
  repaymentPerformance: {
    onTimePercent: number | null;
    pastDueDays: number | null;
    averageLateDays: number | null;
  };
  contracts: IssuerDashboardContractDto[];
  /** All invoices for the org (with or without contract_id), for dashboard financing lists. */
  invoices: IssuerDashboardInvoiceDto[];
};

const organizationRepository = new OrganizationRepository();

async function assertIssuerOrganizationAccess(organizationId: string, userId: string): Promise<void> {
  const organization = await prisma.issuerOrganization.findUnique({
    where: { id: organizationId },
    select: { id: true, owner_user_id: true },
  });
  if (!organization) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  }
  if (organization.owner_user_id === userId) {
    return;
  }
  const member = await organizationRepository.getOrganizationMember(organizationId, userId, "issuer");
  if (!member) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
  }
}

function mapNoteToDto(
  note: {
    id: string;
    note_reference: string;
    status: NoteStatus;
    listing_status: string;
    funding_status: NoteFundingStatus;
    servicing_status: string;
    target_amount: Prisma.Decimal;
    funded_amount: Prisma.Decimal;
    minimum_funding_percent: Prisma.Decimal;
    maturity_date: Date | null;
    listing: { status: string; closes_at: Date | null } | null;
  }
): IssuerDashboardNoteDto {
  const progress = fundingProgressPercent(note.funded_amount, note.target_amount);
  const listingCloses = note.listing?.closes_at ?? null;
  const fundingDeadline = listingCloses ? listingCloses.toISOString() : null;
  const maturityDate = note.maturity_date ? note.maturity_date.toISOString() : null;

  let marketplaceStatusLabel: string | null = null;
  if (note.listing) {
    if (note.listing.status === "PUBLISHED") marketplaceStatusLabel = "Listed";
    else if (note.listing.status === "DRAFT") marketplaceStatusLabel = "Listing draft";
    else if (note.listing.status === "CLOSED") marketplaceStatusLabel = "Listing closed";
    else if (note.listing.status === "UNPUBLISHED") marketplaceStatusLabel = "Unpublished";
    else marketplaceStatusLabel = note.listing.status;
  } else if (note.listing_status && note.listing_status !== "NOT_LISTED") {
    marketplaceStatusLabel = note.listing_status;
  }

  return {
    id: note.id,
    noteReference: note.note_reference,
    noteStatus: note.status,
    listingStatus: note.listing_status,
    noteListingStatus: note.listing?.status ?? null,
    fundingStatus: note.funding_status,
    servicingStatus: note.servicing_status,
    targetAmount: note.target_amount.toString(),
    fundedAmount: note.funded_amount.toString(),
    fundingProgressPercent: progress,
    minimumFundingPercent: note.minimum_funding_percent.toString(),
    fundingDeadline,
    maturityDate,
    marketplaceStatusLabel,
  };
}

function isUnsuccessfulNote(note: { status: NoteStatus; funding_status: NoteFundingStatus }): boolean {
  return note.status === NoteStatus.FAILED_FUNDING || note.funding_status === NoteFundingStatus.FAILED;
}

function isCompletedNote(note: { status: NoteStatus }): boolean {
  return note.status === NoteStatus.REPAID;
}

function isActiveNote(note: { status: NoteStatus }): boolean {
  return note.status === NoteStatus.ACTIVE;
}

function isFundingNote(note: { status: NoteStatus; funding_status: NoteFundingStatus }): boolean {
  return (
    note.status === NoteStatus.FUNDING ||
    note.status === NoteStatus.PUBLISHED ||
    note.funding_status === NoteFundingStatus.OPEN
  );
}

export class IssuerDashboardService {
  async getDashboard(organizationId: string, userId: string): Promise<IssuerDashboardPayload> {
    await assertIssuerOrganizationAccess(organizationId, userId);

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { first_name: true, last_name: true },
    });
    const displayName =
      user?.first_name || user?.last_name
        ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
        : null;

    const applications = await prisma.application.findMany({
      where: { issuer_organization_id: organizationId },
      orderBy: { created_at: "desc" },
      include: {
        contract: true,
        invoices: { orderBy: { created_at: "asc" } },
      },
    });

    const notes = await prisma.note.findMany({
      where: { issuer_organization_id: organizationId },
      include: { listing: true },
    });

    type NoteWithListing = (typeof notes)[number];

    const notesByInvoiceId = new Map<string, NoteWithListing>();
    const notesByContractId = new Map<string, NoteWithListing[]>();
    for (const n of notes) {
      if (n.source_invoice_id) {
        notesByInvoiceId.set(n.source_invoice_id, n);
      }
      if (n.source_contract_id) {
        const prev: NoteWithListing[] = notesByContractId.get(n.source_contract_id) ?? [];
        prev.push(n);
        notesByContractId.set(n.source_contract_id, prev);
      }
    }

    const activeNotesCount = notes.filter((n) => n.status === NoteStatus.ACTIVE).length;
    const completedNotesCount = notes.filter((n) => n.status === NoteStatus.REPAID).length;

    const contractsOut: IssuerDashboardContractDto[] = [];
    const invoicesOut: IssuerDashboardInvoiceDto[] = [];

    for (const app of applications) {
      const financing = asRecord(app.financing_type);
      const productId = (financing?.product_id as string | undefined) ?? "";
      if (!app.contract) continue;

      const c = app.contract;
      const details = asRecord(c.contract_details);
      const customer = asRecord(c.customer_details);
      const approved = details?.approved_facility ?? details?.approved_facility_amount;
      const approvedNum = approved !== undefined && approved !== null ? decimalToNumber(approved) : null;

      const contractNotes = notesByContractId.get(c.id) ?? [];
      let utilizedFromNotes = 0;
      for (const cn of contractNotes) {
        if (cn.status === NoteStatus.CANCELLED || cn.status === NoteStatus.DRAFT) continue;
        utilizedFromNotes += decimalToNumber(cn.funded_amount);
      }

      const contractInvoices = app.invoices.filter((inv) => inv.contract_id === c.id);
      let fundingInProgress = 0;
      let activeNotesInv = 0;
      let completedNotesInv = 0;
      let unsuccessfulRaise = 0;
      for (const inv of contractInvoices) {
        const linked = notesByInvoiceId.get(inv.id);
        if (!linked) continue;
        if (isFundingNote(linked)) fundingInProgress += 1;
        if (isActiveNote(linked)) activeNotesInv += 1;
        if (isCompletedNote(linked)) completedNotesInv += 1;
        if (isUnsuccessfulNote(linked)) unsuccessfulRaise += 1;
      }

      const approvedCount = contractInvoices.filter((i) => i.status === InvoiceStatus.APPROVED).length;
      const rejectedCount = contractInvoices.filter((i) => i.status === InvoiceStatus.REJECTED).length;
      const unfinancedCount = contractInvoices.filter(
        (i) => i.status !== InvoiceStatus.APPROVED && i.status !== InvoiceStatus.REJECTED
      ).length;

      const utilizedFacilityAmount =
        contractNotes.length > 0 ? utilizedFromNotes : details?.utilized_facility != null
          ? decimalToNumber(details.utilized_facility)
          : null;

      let availableFacilityAmount: string | null = null;
      if (approvedNum !== null && utilizedFacilityAmount !== null) {
        availableFacilityAmount = Math.max(0, approvedNum - utilizedFacilityAmount).toFixed(2);
      } else if (details?.available_facility != null) {
        availableFacilityAmount = String(details.available_facility);
      }

      const activeNotesOnContract = contractNotes.filter((n) => n.status === NoteStatus.ACTIVE).length;

      const titleRaw = details?.title;
      const contractTitle =
        typeof titleRaw === "string" && titleRaw.trim().length > 0 ? titleRaw.trim() : null;

      contractsOut.push({
        id: c.id,
        applicationId: app.id,
        productId,
        contractForModal: jsonForModal(c),
        title: contractTitle,
        productName: null,
        customerName: (customer?.name as string | undefined) ?? null,
        contractStartDate: (details?.start_date as string | undefined) ?? null,
        contractEndDate: (details?.end_date as string | undefined) ?? null,
        approvedFacilityAmount: approvedNum !== null ? approvedNum.toFixed(2) : null,
        utilizedFacilityAmount:
          utilizedFacilityAmount !== null ? utilizedFacilityAmount.toFixed(2) : null,
        availableFacilityAmount,
        activeNotesCount: activeNotesOnContract,
        contractStatus: c.status,
        invoiceStats: {
          total: contractInvoices.length,
          approved: approvedCount,
          rejected: rejectedCount,
          unfinanced: unfinancedCount,
          fundingInProgress,
          activeNotes: activeNotesInv,
          completedNotes: completedNotesInv,
          unsuccessfulRaise,
          disputedNotes: null,
        },
      });
    }

    for (const app of applications) {
      const financing = asRecord(app.financing_type);
      const productId = (financing?.product_id as string | undefined) ?? "";
      const invoiceCustomerName = app.contract
        ? ((asRecord(app.contract.customer_details)?.name as string | undefined) ?? null)
        : null;

      for (const inv of app.invoices) {
        const details = asRecord(inv.details);
        const invNote = notesByInvoiceId.get(inv.id) ?? null;
        const ratioRaw = details?.financing_ratio_percent;
        let ratio = NaN;
        if (typeof ratioRaw === "number") ratio = ratioRaw;
        else if (typeof ratioRaw === "string") {
          const n = Number(String(ratioRaw).replace(/,/g, ""));
          ratio = Number.isFinite(n) ? n : NaN;
        }
        const invVal = details?.value != null ? decimalToNumber(details.value) : null;
        let financingAmount: string | null = null;
        if (details?.financing_amount != null) {
          financingAmount = String(details.financing_amount);
        } else if (invVal !== null && Number.isFinite(ratio)) {
          financingAmount = ((invVal * ratio) / 100).toFixed(2);
        }

        invoicesOut.push({
          id: inv.id,
          applicationId: app.id,
          productId,
          contractId: inv.contract_id,
          invoiceForModal: jsonForModal(inv),
          invoiceStatus: inv.status,
          invoiceNumber: (details?.number as string | undefined) ?? inv.id,
          customerName: invoiceCustomerName,
          invoiceValue: invVal !== null ? invVal.toFixed(2) : null,
          financingAmount,
          submissionDate: inv.created_at.toISOString(),
          note: invNote ? mapNoteToDto(invNote) : null,
        });
      }
    }

    return {
      user: { displayName },
      overview: {
        successRatePercent: null,
        activeFinancingAmount: null,
        activeNotesCount,
        completedNotesCount,
      },
      repaymentPerformance: {
        onTimePercent: null,
        pastDueDays: null,
        averageLateDays: null,
      },
      contracts: contractsOut,
      invoices: invoicesOut,
    };
  }

  async getContractDetail(organizationId: string, userId: string, contractId: string) {
    await assertIssuerOrganizationAccess(organizationId, userId);
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, issuer_organization_id: organizationId },
    });
    if (!contract) {
      throw new AppError(404, "CONTRACT_NOT_FOUND", "Contract not found");
    }
    const full = await this.getDashboard(organizationId, userId);
    const row = full.contracts.find((c) => c.id === contractId) ?? null;
    const invoices = full.invoices.filter((i) => i.contractId === contractId);
    return { contract: row, invoices };
  }
}

export const issuerDashboardService = new IssuerDashboardService();
