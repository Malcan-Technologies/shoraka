import {
  Prisma,
  NoteFundingStatus,
  NoteStatus,
  ContractStatus,
  InvoiceStatus,
  NotePaymentStatus,
  ApplicationStatus,
  WithdrawalType,
} from "@prisma/client";
import { countNoteInvestors, resolveFacilityFeeBalance } from "@cashsouk/types";
import { facilityFeeUpfrontDto } from "../../lib/facility-fee-upfront-guard";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationRepository } from "../organization/repository";
import {
  mapIssuerDisbursementBreakdown,
  type IssuerDashboardDisbursementBreakdown,
} from "./disbursement-breakdown";
import {
  computeOnTimePaymentRate,
  decimalToNumber,
  sixMonthsAgoFrom,
} from "./track-record-aggregates";
import {
  computeContractFacilitySnapshot,
  facilitySnapshotToDetailsPatch,
  toFacilityNoteOccupancy,
} from "../../lib/contract-facility";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function productNameFromFinancingType(financing: Record<string, unknown> | null): string | null {
  const candidates = [financing?.product_name, financing?.name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
  tenureDays?: number | null;
  marketplaceStatusLabel: string | null;
  investorCount: number;
  disbursementBreakdown: IssuerDashboardDisbursementBreakdown | null;
};

export type IssuerDashboardInvoiceDto = {
  id: string;
  displayReference: string | null;
  applicationId: string;
  productId: string;
  productName: string | null;
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
  /** Application IDs that require action (AMENDMENT_REQUESTED). Usually 0 or 1. */
  actionRequiredApplicationIds: string[];
};

export type IssuerDashboardContractDto = {
  id: string;
  displayReference: string | null;
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
  pendingFacilityAmount: string | null;
  repaidFacilityAmount: string | null;
  lifetimeCapAmount: string | null;
  lifetimeUsedAmount: string | null;
  lifetimeRemainingAmount: string | null;
  contractValueAmount: string | null;
  facilityFeeCapAmount: string | null;
  facilityFeePaidAmount: string | null;
  facilityFeeRemainingAmount: string | null;
  facilityFeeUpfrontAmount: number | null;
  facilityFeeUpfrontOutstanding: number | null;
  facilityFeeWaived?: boolean;
  facilityEnabled?: boolean;
  facilityDisabledReason?: string | null;
  activeNotesCount: number;
  contractStatus: ContractStatus;
  /** Application IDs that require action (AMENDMENT_REQUESTED) across all applications sharing this contract. */
  actionRequiredApplicationIds: string[];
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
    pastFinancingAmount: string | null;
    activeNotesCount: number;
    completedNotesCount: number;
  };
  repaymentPerformance: {
    onTimePercent: number | null;
    pastDueCount: number | null;
    lateRepaymentsLastSixMonthsCount: number | null;
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
    tenure_days?: number | null;
    listing: { status: string; closes_at: Date | null } | null;
  },
  disbursementBreakdown?: IssuerDashboardNoteDto["disbursementBreakdown"],
  investorCount = 0
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
    tenureDays: note.tenure_days ?? null,
    marketplaceStatusLabel,
    investorCount,
    disbursementBreakdown: disbursementBreakdown ?? null,
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

export class IssuerDashboardService {
  async getDashboard(
    organizationId: string,
    userId: string,
    opts?: { includeContractLinkedInvoices?: boolean }
  ): Promise<IssuerDashboardPayload> {
    await assertIssuerOrganizationAccess(organizationId, userId);

    const includeContractLinkedInvoices = opts?.includeContractLinkedInvoices ?? false;

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

    const noteInvestments =
      notes.length === 0
        ? []
        : await prisma.noteInvestment.findMany({
            where: { note_id: { in: notes.map((note) => note.id) } },
            select: {
              note_id: true,
              investor_organization_id: true,
              status: true,
            },
          });
    const investmentsByNoteId = new Map<
      string,
      Array<{ investorOrganizationId: string; status: string }>
    >();
    for (const investment of noteInvestments) {
      const list = investmentsByNoteId.get(investment.note_id) ?? [];
      list.push({
        investorOrganizationId: investment.investor_organization_id,
        status: investment.status,
      });
      investmentsByNoteId.set(investment.note_id, list);
    }
    const investorCountByNoteId = new Map<string, number>();
    for (const note of notes) {
      investorCountByNoteId.set(
        note.id,
        countNoteInvestors(investmentsByNoteId.get(note.id) ?? [])
      );
    }

    const disbursementWithdrawals = await prisma.withdrawalInstruction.findMany({
      where: {
        issuer_organization_id: organizationId,
        withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
        note_id: { not: null },
      },
      orderBy: { created_at: "desc" },
      select: { note_id: true, metadata: true },
    });

    type NoteWithListing = (typeof notes)[number];

    const notesByInvoiceId = new Map<string, NoteWithListing>();
    const notesByContractId = new Map<string, NoteWithListing[]>();
    const disbursementByNoteId = new Map<string, IssuerDashboardNoteDto["disbursementBreakdown"]>();
    for (const withdrawal of disbursementWithdrawals) {
      if (!withdrawal.note_id || disbursementByNoteId.has(withdrawal.note_id)) continue;
      const metadata = asRecord(withdrawal.metadata);
      disbursementByNoteId.set(withdrawal.note_id, mapIssuerDisbursementBreakdown(metadata));
    }
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

    // Success rate is based on funding outcome rows only (funding_status), and uses activated_at
    // as the success indicator (whether the note was actually activated/disbursed).
    const successfulDisbursedNotesCount = notes.filter((n) => n.activated_at !== null).length;
    const fundingOutcomeNotesCount = notes.filter(
      (n) => n.funding_status === NoteFundingStatus.FUNDED || n.funding_status === NoteFundingStatus.FAILED
    ).length;
    const successRatePercent =
      fundingOutcomeNotesCount > 0
        ? Math.round((successfulDisbursedNotesCount / fundingOutcomeNotesCount) * 100)
        : null;

    const activeFinancingNotes = notes.filter((n) => n.status === NoteStatus.ACTIVE);
    const activeFinancingAmount =
      activeFinancingNotes.length > 0
        ? activeFinancingNotes.reduce((sum, n) => sum + decimalToNumber(n.funded_amount), 0).toFixed(2)
        : null;

    const pastFinancingNotes = notes.filter((n) => n.status === NoteStatus.REPAID);
    const pastFinancingAmount =
      pastFinancingNotes.length > 0
        ? pastFinancingNotes.reduce((sum, n) => sum + decimalToNumber(n.funded_amount), 0).toFixed(2)
        : null;

    const contractsOut: IssuerDashboardContractDto[] = [];
    const invoicesOut: IssuerDashboardInvoiceDto[] = [];

    /**
     * Multiple applications may reference the same Contract.id (existing contract flow).
     * We emit one issuer dashboard contract row per Contract.id. applicationId and productId
     * come from the most recently created application among those sharing the contract (stable
     * tie-break: sort by created_at desc, take first). Invoice stats aggregate every invoice under
     * that contract across all those applications. Note-based metrics still use Note.source_contract_id.
     */
    type ApplicationWithRelations = (typeof applications)[number];
    const applicationsByContractId = new Map<string, ApplicationWithRelations[]>();
    for (const app of applications) {
      if (!app.contract) continue;
      const cid = app.contract.id;
      const bucket = applicationsByContractId.get(cid) ?? [];
      bucket.push(app);
      applicationsByContractId.set(cid, bucket);
    }

    for (const [, appsForContract] of applicationsByContractId) {
      appsForContract.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const primaryApp = appsForContract[0];
      const c = primaryApp.contract!;

      const financing = asRecord(primaryApp.financing_type);
      const productId = (financing?.product_id as string | undefined) ?? "";

      const details = asRecord(c.contract_details);
      const customer = asRecord(c.customer_details);
      const contractNotes = notesByContractId.get(c.id) ?? [];

      const mergedInvoicesById = new Map<string, ApplicationWithRelations["invoices"][number]>();
      for (const app of appsForContract) {
        for (const inv of app.invoices) {
          if (inv.contract_id === c.id) mergedInvoicesById.set(inv.id, inv);
        }
      }
      const contractInvoices = Array.from(mergedInvoicesById.values());

      const occupancy = computeContractFacilitySnapshot(
        c.status,
        details,
        contractInvoices.map((inv) => ({
          status: inv.status,
          details: asRecord(inv.details),
          offer_details: asRecord(inv.offer_details),
          note: toFacilityNoteOccupancy(notesByInvoiceId.get(inv.id) ?? null),
        }))
      );

      const approvedNum = occupancy.approvedFacility > 0 ? occupancy.approvedFacility : null;
      const utilizedFacilityAmount = occupancy.approvedFacility > 0 ? occupancy.utilizedFacility : null;
      const availableFacilityAmount =
        occupancy.approvedFacility > 0 ? occupancy.availableFacility.toFixed(2) : null;
      const pendingFacilityAmount =
        occupancy.pendingFacility > 0 ? occupancy.pendingFacility.toFixed(2) : null;
      const repaidFacilityAmount =
        occupancy.repaidFacility > 0 ? occupancy.repaidFacility.toFixed(2) : null;

      const actionRequiredApplicationIds = [
        ...new Set(
          appsForContract
            .filter((a) => a.status === ApplicationStatus.AMENDMENT_REQUESTED)
            .map((a) => a.id)
        ),
      ];

      // Funding in progress counts notes strictly open for investor funding.
      const fundingInProgress = contractNotes.filter(
        (n) => n.status === NoteStatus.PUBLISHED && n.funding_status === NoteFundingStatus.OPEN
      ).length;
      let activeNotesInv = 0;
      let completedNotesInv = 0;
      let unsuccessfulRaise = 0;
      for (const inv of contractInvoices) {
        const linked = notesByInvoiceId.get(inv.id);
        if (!linked) continue;
        if (isActiveNote(linked)) activeNotesInv += 1;
        if (isCompletedNote(linked)) completedNotesInv += 1;
        if (isUnsuccessfulNote(linked)) unsuccessfulRaise += 1;
      }

      const approvedCount = contractInvoices.filter((i) => i.status === InvoiceStatus.APPROVED).length;
      const rejectedCount = contractInvoices.filter((i) => i.status === InvoiceStatus.REJECTED).length;
      const unfinancedCount = contractInvoices.filter((i) => {
        if (i.status !== InvoiceStatus.APPROVED) return false;
        // "Unfinanced" means the approved invoice has no linked Note yet.
        return !notesByInvoiceId.has(i.id);
      }).length;

      const feeBalance = resolveFacilityFeeBalance({
        ...(details ?? {}),
        approved_facility: approvedNum,
      });
      const hasFeeState =
        details != null &&
        ("facility_fee_total_amount" in details ||
          "facility_fee_rate_percent" in details ||
          "facility_fee_paid_amount" in details ||
          "facility_fee_waived" in details);
      const facilityFeeApplies = approvedNum !== null && hasFeeState;
      const facilityFeeCapNum = feeBalance.totalOwed;
      const facilityFeePaidNum = feeBalance.paid;
      const facilityFeeRemainingNum = feeBalance.remaining;
      const upfrontDto = facilityFeeUpfrontDto({
        ...(details ?? {}),
        approved_facility: approvedNum,
      });

      const activeNotesOnContract = contractNotes.filter((n) => n.status === NoteStatus.ACTIVE).length;

      const titleRaw = details?.title;
      const contractTitle =
        typeof titleRaw === "string" && titleRaw.trim().length > 0 ? titleRaw.trim() : null;
      const lifetimeCapAmount = occupancy.lifetimeCap > 0 ? occupancy.lifetimeCap.toFixed(2) : null;
      const contractForModal = jsonForModal({
        ...c,
        contract_details: {
          ...(details ?? {}),
          ...facilitySnapshotToDetailsPatch(occupancy),
        },
      });

      contractsOut.push({
        id: c.id,
        displayReference: c.display_reference ?? null,
        applicationId: primaryApp.id,
        productId,
        contractForModal,
        title: contractTitle,
        productName: productNameFromFinancingType(financing),
        customerName: (customer?.name as string | undefined) ?? null,
        contractStartDate: (details?.start_date as string | undefined) ?? null,
        contractEndDate: (details?.end_date as string | undefined) ?? null,
        approvedFacilityAmount: approvedNum !== null ? approvedNum.toFixed(2) : null,
        utilizedFacilityAmount:
          utilizedFacilityAmount !== null ? utilizedFacilityAmount.toFixed(2) : null,
        availableFacilityAmount,
        pendingFacilityAmount,
        repaidFacilityAmount,
        lifetimeCapAmount,
        lifetimeUsedAmount: lifetimeCapAmount != null ? occupancy.lifetimeUsed.toFixed(2) : null,
        lifetimeRemainingAmount:
          lifetimeCapAmount != null ? occupancy.lifetimeRemaining.toFixed(2) : null,
        contractValueAmount:
          occupancy.contractValue > 0 ? occupancy.contractValue.toFixed(2) : null,
        facilityFeeCapAmount: facilityFeeApplies ? facilityFeeCapNum.toFixed(2) : null,
        facilityFeePaidAmount: facilityFeeApplies ? facilityFeePaidNum.toFixed(2) : null,
        facilityFeeRemainingAmount: facilityFeeApplies ? facilityFeeRemainingNum.toFixed(2) : null,
        facilityFeeUpfrontAmount: facilityFeeApplies ? upfrontDto.facilityFeeUpfrontAmount : null,
        facilityFeeUpfrontOutstanding: facilityFeeApplies
          ? upfrontDto.facilityFeeUpfrontOutstanding
          : null,
        facilityFeeWaived: feeBalance.waived,
        facilityEnabled: feeBalance.enabled,
        facilityDisabledReason: feeBalance.disabledReason,
        activeNotesCount: activeNotesOnContract,
        contractStatus: c.status,
        actionRequiredApplicationIds,
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
        // Main issuer dashboard should show only standalone invoice financing:
        // - exclude invoices linked to a Contract (invoice.contract_id != null)
        // Contract detail keeps its old behavior via an internal option.
        if (!includeContractLinkedInvoices && inv.contract_id) continue;

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
          displayReference: inv.display_reference ?? null,
          applicationId: app.id,
          productId,
          productName: productNameFromFinancingType(financing),
          contractId: inv.contract_id,
          invoiceForModal: jsonForModal(inv),
          invoiceStatus: inv.status,
          invoiceNumber:
            typeof details?.number === "string" && details.number.trim()
              ? details.number.trim()
              : "",
          customerName: invoiceCustomerName,
          invoiceValue: invVal !== null ? invVal.toFixed(2) : null,
          financingAmount,
          submissionDate: inv.created_at.toISOString(),
          note: invNote
            ? mapNoteToDto(
                invNote,
                disbursementByNoteId.get(invNote.id),
                investorCountByNoteId.get(invNote.id) ?? 0
              )
            : null,
          actionRequiredApplicationIds:
            app.status === ApplicationStatus.AMENDMENT_REQUESTED ? [app.id] : [],
        });
      }
    }

    // Repayment Performance: shared schedule-level on-time helper (also used by prospectus Stage 7).
    const now = new Date();
    const sixMonthsAgo = sixMonthsAgoFrom(now);

    const schedulesInWindow = await prisma.notePaymentSchedule.findMany({
      where: {
        due_date: {
          gte: sixMonthsAgo,
          lte: now,
        },
        note: { issuer_organization_id: organizationId },
      },
      select: { id: true, note_id: true, due_date: true, expected_total: true },
    });

    const scheduleIds = schedulesInWindow.map((s) => s.id);

    const paymentsForWindow = scheduleIds.length
      ? await prisma.notePayment.findMany({
          where: {
            schedule_id: { in: scheduleIds },
            status: NotePaymentStatus.RECEIVED,
          },
          select: { schedule_id: true, receipt_date: true, receipt_amount: true },
        })
      : [];

    const onTimeResult = computeOnTimePaymentRate({
      schedules: schedulesInWindow,
      payments: paymentsForWindow,
      now,
      windowStart: sixMonthsAgo,
    });
    const onTimePercent = onTimeResult.onTimePercent;
    const pastDueCount = onTimeResult.pastDueCount;
    const lateRepaymentsLastSixMonthsCount = onTimeResult.lateRepaymentsCount;

    return {
      user: { displayName },
      overview: {
        successRatePercent,
        activeFinancingAmount,
        pastFinancingAmount,
        activeNotesCount,
        completedNotesCount,
      },
      repaymentPerformance: {
        onTimePercent,
        pastDueCount,
        lateRepaymentsLastSixMonthsCount,
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
      throw new AppError(404, "CONTRACT_NOT_FOUND", "Facility not found");
    }
    // Include contract-linked invoices so contract detail can still show the full invoice list.
    const full = await this.getDashboard(organizationId, userId, { includeContractLinkedInvoices: true });
    const row = full.contracts.find((c) => c.id === contractId) ?? null;
    const invoices = full.invoices.filter((i) => i.contractId === contractId);
    return { contract: row, invoices };
  }
}

export const issuerDashboardService = new IssuerDashboardService();
