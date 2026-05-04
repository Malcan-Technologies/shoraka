import PDFDocument from "pdfkit";
import {
  ApplicationStatus,
  InvoiceStatus,
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteLedgerAccountType,
  NoteLedgerDirection,
  NoteListingStatus,
  NotePaymentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteSettlementType,
  NoteStatus,
  InvestorBalanceTransactionSource,
  Prisma,
  UserRole,
  WithdrawalStatus,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { putS3ObjectBuffer } from "../../lib/s3/client";
import { resolveApprovedFacilityForRefresh } from "../../lib/contract-facility";
import {
  resolveOfferedAmount,
  resolveOfferedProfitRate,
  resolveRequestedInvoiceAmount,
} from "../../lib/invoice-offer";
import { isSoukscoreRiskRating } from "@cashsouk/types";
import { creditInvestorBalance, debitInvestorBalanceForCommit } from "./investor-balance";
import { mapLedgerEntry, mapMarketplaceNoteDetail, mapNoteDetail, mapNoteListItem, resolveProductNameFromWorkflow } from "./mapper";
import { noteInclude, noteRepository } from "./repository";
import { calculateLateCharge as calculateLateChargeValues, calculateSettlementWaterfall } from "./calculators";
import type {
  createInvestmentSchema,
  createNoteFromApplicationSchema,
  bucketActivityQuerySchema,
  createWithdrawalSchema,
  getNotesQuerySchema,
  lateChargeSchema,
  overdueLateChargeSchema,
  paymentReviewSchema,
  recordPaymentSchema,
  settlementPreviewSchema,
  updateNoteDraftSchema,
  updatePlatformFinanceSettingsSchema,
} from "./schemas";
import type { z } from "zod";

type ActorContext = {
  userId: string;
  role?: UserRole | string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveProductCategoryFromWorkflow(workflow: Prisma.JsonValue | null | undefined): string | null {
  if (!Array.isArray(workflow)) return null;
  const financingTypeStep = workflow.find((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return false;
    const stepRecord = step as Record<string, unknown>;
    const id = typeof stepRecord.id === "string" ? stepRecord.id : "";
    return id.startsWith("financing_type");
  });
  if (!financingTypeStep || typeof financingTypeStep !== "object" || Array.isArray(financingTypeStep)) {
    return null;
  }
  const financingConfig = asRecord((financingTypeStep as Record<string, unknown>).config);
  const category = financingConfig?.category;
  if (typeof category === "string" && category.trim().length > 0) return category.trim();
  return null;
}

function resolveIssuerIndustryFromCorporateData(data: Prisma.JsonValue | null | undefined): string | null {
  const corporateData = asRecord(data);
  const basicInfo = asRecord(corporateData?.basicInfo);
  const industry = basicInfo?.industry;
  if (typeof industry === "string" && industry.trim().length > 0) return industry.trim();
  return null;
}

function toNumber(value: unknown): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Standard marketplace ticket floor (MYR). When remaining capacity is smaller, min commit equals remainder. */
const MARKETPLACE_MIN_COMMIT_MYR = 100;

function resolveNoteSettlementAmount(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
}) {
  const invoiceSnapshot = asRecord(note.invoice_snapshot);
  const details = asRecord(invoiceSnapshot?.details);
  const offerDetails = asRecord(invoiceSnapshot?.offer_details);
  return (
    toNumber(details?.value) ||
    toNumber(details?.invoice_value) ||
    toNumber(details?.invoiceAmount) ||
    toNumber(offerDetails?.invoice_value) ||
    toNumber(note.requested_amount)
  );
}

function resolveIssuerPaymentPurpose(input: { metadata?: Record<string, unknown> | null }) {
  const metadata = asRecord(input.metadata);
  return metadata?.paymentPurpose === "LATE_FEES" ? "LATE_FEES" : "SETTLEMENT";
}

function resolveRiskRating(value: unknown) {
  return isSoukscoreRiskRating(value) ? value : null;
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
  const constraint = meta && "target" in meta ? meta.target : null;
  return Array.isArray(constraint) ? constraint.includes(target) : constraint === target;
}

function assertSettlementAmountComplete(
  settlement: {
    gross_receipt_amount: Prisma.Decimal | number | string;
    note: {
      invoice_snapshot?: Prisma.JsonValue | null;
      requested_amount?: Prisma.Decimal | number | string | null;
    };
  }
) {
  const settlementAmount = resolveNoteSettlementAmount(settlement.note);
  const grossReceiptAmount = toNumber(settlement.gross_receipt_amount);
  if (settlementAmount > 0 && grossReceiptAmount + 0.005 < settlementAmount) {
    throw new AppError(
      422,
      "INCOMPLETE_SETTLEMENT_AMOUNT",
      "Settlement cannot be approved or posted until the full invoice settlement amount has been received"
    );
  }
}

async function assertRepaymentReceiptLedgerComplete(noteId: string, requiredAmount: number) {
  const receiptEntries = await prisma.noteLedgerEntry.findMany({
    where: {
      note_id: noteId,
      direction: NoteLedgerDirection.CREDIT,
      account: { code: "REPAYMENT_POOL" },
    },
    select: { amount: true },
  });
  const receivedAmount = receiptEntries.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  if (requiredAmount > 0 && receivedAmount + 0.005 < requiredAmount) {
    throw new AppError(
      422,
      "INCOMPLETE_REPAYMENT_RECEIPT",
      "Settlement cannot be approved or posted until the full settlement amount has been received into the Repayment Pool"
    );
  }
}

function assertNoteReadyForServicing(note: {
  funding_status: NoteFundingStatus;
  servicing_status: NoteServicingStatus;
}) {
  if (note.funding_status !== NoteFundingStatus.FUNDED || note.servicing_status === NoteServicingStatus.NOT_STARTED) {
    throw new AppError(
      409,
      "NOTE_SERVICING_NOT_OPEN",
      "Payment and settlement are available only after the note is funded and activated"
    );
  }
  if (note.servicing_status === NoteServicingStatus.SETTLED) {
    throw new AppError(409, "NOTE_ALREADY_SETTLED", "Payment and settlement are closed after settlement is posted");
  }
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return value as Prisma.InputJsonValue;
}

function dateFrom(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenCalendarDates(from: Date, to: Date) {
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toStart = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toStart.getTime() - fromStart.getTime()) / 86_400_000);
}

async function renderPdfBuffer(title: string, rows: Array<[string, string]>): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();
  for (const [label, value] of rows) {
    doc.fontSize(10).fillColor("#666").text(label);
    doc.fontSize(12).fillColor("#111").text(value || "-");
    doc.moveDown(0.5);
  }
  doc.end();
  return done;
}

export class NoteService {
  async listAdminNotes(params: z.infer<typeof getNotesQuerySchema>) {
    const { notes, totalCount } = await noteRepository.list(params);
    const productIds = notes
      .map((note) => {
        const productSnapshot = asRecord(note.product_snapshot);
        const productId = productSnapshot?.product_id;
        return typeof productId === "string" && productId.trim().length > 0 ? productId : null;
      })
      .filter((value): value is string => Boolean(value));
    const uniqueProductIds = [...new Set(productIds)];
    const products = uniqueProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: uniqueProductIds } },
          select: { id: true, workflow: true },
        })
      : [];
    const productCategoryById = new Map(
      products.map((product) => [product.id, resolveProductCategoryFromWorkflow(product.workflow)])
    );
    const productNameById = new Map(
      products.map((product) => [product.id, resolveProductNameFromWorkflow(product.workflow)])
    );
    const issuerOrgIds = [...new Set(notes.map((note) => note.issuer_organization_id))];
    const issuerOrgs = issuerOrgIds.length
      ? await prisma.issuerOrganization.findMany({
          where: { id: { in: issuerOrgIds } },
          select: { id: true, corporate_onboarding_data: true },
        })
      : [];
    const issuerIndustryByOrgId = new Map(
      issuerOrgs.map((org) => [org.id, resolveIssuerIndustryFromCorporateData(org.corporate_onboarding_data)])
    );
    const mappedNotes = notes.map((note) => {
      const mapped = mapNoteListItem(note);
      const productSnapshot = asRecord(note.product_snapshot);
      const productId =
        typeof productSnapshot?.product_id === "string" && productSnapshot.product_id.trim().length > 0
          ? productSnapshot.product_id
          : null;
      return {
        ...mapped,
        productCategory:
          mapped.productCategory ??
          (productId ? productCategoryById.get(productId) ?? null : null),
        productName: mapped.productName ?? (productId ? productNameById.get(productId) ?? null : null),
        issuerIndustry: mapped.issuerIndustry ?? issuerIndustryByOrgId.get(note.issuer_organization_id) ?? null,
      };
    });
    return {
      notes: mappedNotes,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / params.pageSize),
      },
    };
  }

  async getAdminNoteDetail(id: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    return mapNoteDetail(note);
  }

  async listSourceInvoicesForNotes() {
    const invoices = await prisma.invoice.findMany({
      where: { status: InvoiceStatus.APPROVED },
      include: {
        application: {
          include: {
            issuer_organization: true,
            contract: true,
          },
        },
        contract: true,
      },
      orderBy: { updated_at: "desc" },
    });
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const notes = await prisma.note.findMany({
      where: { source_invoice_id: { in: invoiceIds } },
      select: {
        id: true,
        source_invoice_id: true,
        note_reference: true,
        status: true,
      },
    });
    const notesByInvoiceId = new Map(notes.map((note) => [note.source_invoice_id, note]));

    return {
      invoices: invoices.map((invoice) => {
        const details = asRecord(invoice.details) ?? {};
        const offer = asRecord(invoice.offer_details) ?? {};
        const sourceContract = invoice.contract ?? invoice.application.contract;
        const paymaster = asRecord(sourceContract?.customer_details);
        const note = notesByInvoiceId.get(invoice.id) ?? null;
        return {
          invoiceId: invoice.id,
          applicationId: invoice.application_id,
          contractId: invoice.contract_id ?? invoice.application.contract_id,
          issuerOrganizationId: invoice.application.issuer_organization_id,
          issuerName: invoice.application.issuer_organization.name,
          paymasterName: this.resolvePaymasterName(paymaster),
          invoiceNumber: typeof details.number === "string" ? details.number : null,
          invoiceAmount: resolveRequestedInvoiceAmount(details),
          offeredAmount: resolveOfferedAmount(offer) || null,
          profitRatePercent: resolveOfferedProfitRate(offer),
          riskRating: resolveRiskRating(offer.risk_rating),
          maturityDate:
            typeof details.maturity_date === "string"
              ? dateFrom(details.maturity_date)?.toISOString() ?? null
              : null,
          invoiceStatus: invoice.status,
          applicationStatus: invoice.application.status,
          noteId: note?.id ?? null,
          noteReference: note?.note_reference ?? null,
          noteStatus: note?.status ?? null,
        };
      }),
    };
  }

  async getActionRequiredCount() {
    const approvedInvoices = await prisma.invoice.findMany({
      where: { status: InvoiceStatus.APPROVED },
      select: { id: true },
    });
    const approvedInvoiceIds = approvedInvoices.map((invoice) => invoice.id);
    const notesForApprovedInvoices = approvedInvoiceIds.length
      ? await prisma.note.findMany({
          where: { source_invoice_id: { in: approvedInvoiceIds } },
          select: { source_invoice_id: true },
        })
      : [];
    const notedInvoiceIds = new Set(notesForApprovedInvoices.map((note) => note.source_invoice_id).filter(Boolean));
    const readyInvoices = approvedInvoiceIds.filter((invoiceId) => !notedInvoiceIds.has(invoiceId)).length;

    const [draftNotes, fundingCandidates, activationReady, pendingIssuerPayments] = await Promise.all([
      prisma.note.count({
        where: {
          status: NoteStatus.DRAFT,
        },
      }),
      prisma.note.findMany({
        where: {
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
        },
        select: {
          funded_amount: true,
          target_amount: true,
          minimum_funding_percent: true,
        },
      }),
      prisma.note.count({
        where: {
          funding_status: NoteFundingStatus.FUNDED,
          servicing_status: NoteServicingStatus.NOT_STARTED,
        },
      }),
      prisma.notePayment.count({
        where: {
          source: "ISSUER_ON_BEHALF",
          status: NotePaymentStatus.PENDING,
        },
      }),
    ]);

    const fundingReady = fundingCandidates.filter((note) => {
      const targetAmount = toNumber(note.target_amount);
      if (targetAmount <= 0) return false;
      const fundingPercent = (toNumber(note.funded_amount) / targetAmount) * 100;
      return fundingPercent + 0.005 >= toNumber(note.minimum_funding_percent);
    }).length;

    const breakdown = {
      readyInvoices,
      draftNotes,
      fundingReady,
      activationReady,
      pendingIssuerPayments,
    };

    return {
      count: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
      breakdown,
    };
  }

  async createFromInvoice(
    invoiceId: string,
    input: z.infer<typeof createNoteFromApplicationSchema>,
    actor: ActorContext
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        application: {
          include: {
            issuer_organization: true,
            contract: true,
          },
        },
        contract: true,
      },
    });
    if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    return this.createFromInvoiceSource({
      application: invoice.application,
      invoice,
      sourceContract: invoice.contract ?? invoice.application.contract,
      title: input.title,
      actor,
    });
  }

  async createFromApplication(
    applicationId: string,
    input: z.infer<typeof createNoteFromApplicationSchema>,
    actor: ActorContext
  ) {
    const source = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        issuer_organization: true,
        contract: true,
        invoices: { orderBy: { created_at: "asc" } },
      },
    });

    if (!source) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    if (source.status !== ApplicationStatus.COMPLETED) {
      throw new AppError(409, "APPLICATION_NOT_COMPLETED", "Only completed applications can become notes");
    }

    let selectedInvoice = input.sourceInvoiceId
      ? source.invoices.find((invoice) => invoice.id === input.sourceInvoiceId)
      : null;

    if (!input.sourceInvoiceId) {
      const approvedInvoices = source.invoices.filter((invoice) => invoice.status === InvoiceStatus.APPROVED);
      const existingNotes = approvedInvoices.length
        ? await prisma.note.findMany({
            where: { source_invoice_id: { in: approvedInvoices.map((invoice) => invoice.id) } },
            select: { source_invoice_id: true },
          })
        : [];
      const notedInvoiceIds = new Set(existingNotes.map((note) => note.source_invoice_id).filter(Boolean));
      selectedInvoice =
        approvedInvoices.find((invoice) => !notedInvoiceIds.has(invoice.id)) ?? approvedInvoices[0] ?? null;
    }

    if (input.sourceInvoiceId && !selectedInvoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Source invoice not found for application");
    }

    if (!selectedInvoice) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    return this.createFromInvoiceSource({
      application: source,
      invoice: selectedInvoice,
      sourceContract: source.contract,
      title: input.title,
      actor,
    });
  }

  private async createFromInvoiceSource(params: {
    application: {
      id: string;
      issuer_organization_id: string;
      contract_id: string | null;
      financing_type: Prisma.JsonValue | null;
      issuer_organization: {
        id: string;
        name: string | null;
        type: string;
        corporate_onboarding_data: Prisma.JsonValue | null;
      };
    };
    invoice: {
      id: string;
      application_id: string;
      contract_id: string | null;
      details: Prisma.JsonValue;
      offer_details: Prisma.JsonValue | null;
      status: InvoiceStatus;
    };
    sourceContract: {
      id: string;
      status: string;
      contract_details: Prisma.JsonValue | null;
      offer_details: Prisma.JsonValue | null;
      customer_details: Prisma.JsonValue | null;
    } | null;
    title?: string;
    actor: ActorContext;
  }) {
    const { application, invoice, sourceContract, actor } = params;
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new AppError(409, "INVOICE_NOT_APPROVED", "Only approved invoices can become notes");
    }

    const existing = await noteRepository.findBySource(application.id, invoice.id);
    if (existing) return mapNoteDetail(existing);

    const invoiceDetails = asRecord(invoice.details) ?? {};
    const invoiceOffer = asRecord(invoice.offer_details) ?? {};
    const contractDetails = asRecord(sourceContract?.contract_details) ?? {};
    const financingType = asRecord(application.financing_type);
    const productId = typeof financingType?.product_id === "string" ? financingType.product_id : null;
    const product = productId
      ? await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, workflow: true },
        })
      : null;
    const productCategory = resolveProductCategoryFromWorkflow(product?.workflow);
    const productDisplayName =
      resolveProductNameFromWorkflow(product?.workflow) ??
      (typeof financingType?.product_name === "string" && financingType.product_name.trim().length > 0
        ? financingType.product_name.trim()
        : null);
    const issuerIndustry = resolveIssuerIndustryFromCorporateData(application.issuer_organization.corporate_onboarding_data);
    const invoiceFaceValue = resolveRequestedInvoiceAmount(invoiceDetails);
    const targetAmount =
      resolveOfferedAmount(invoiceOffer) ||
      invoiceFaceValue ||
      resolveApprovedFacilityForRefresh(sourceContract?.status ?? "", contractDetails) ||
      toNumber(contractDetails.financing) ||
      toNumber(contractDetails.value);

    if (targetAmount <= 0) {
      throw new AppError(422, "NOTE_AMOUNT_UNRESOLVED", "Unable to resolve note target amount");
    }

    const invoiceNumber = typeof invoiceDetails.number === "string" ? invoiceDetails.number : invoice.id.slice(-8);
    const reference = `NOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${invoice.id
      .slice(-8)
      .toUpperCase()}`;

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          source_application_id: application.id,
          source_contract_id: invoice.contract_id ?? application.contract_id,
          source_invoice_id: invoice.id,
          issuer_organization_id: application.issuer_organization_id,
          title:
            params.title ??
            `Note for invoice ${invoiceNumber} - ${application.issuer_organization.name ?? application.issuer_organization.id}`,
          note_reference: reference,
          issuer_snapshot: {
            id: application.issuer_organization.id,
            name: application.issuer_organization.name,
            type: application.issuer_organization.type,
            industry: issuerIndustry,
          },
          paymaster_snapshot: json(sourceContract?.customer_details),
          product_snapshot: json({
            ...(financingType ?? {}),
            product_id: productId,
            category: productCategory,
            ...(productDisplayName ? { product_name: productDisplayName } : {}),
          }),
          contract_snapshot: json(
            sourceContract
              ? {
                  id: sourceContract.id,
                  status: sourceContract.status,
                  contract_details: sourceContract.contract_details,
                  offer_details: sourceContract.offer_details,
                }
              : null
          ),
          invoice_snapshot: {
            id: invoice.id,
            status: invoice.status,
            details: invoice.details,
            offer_details: invoice.offer_details,
          },
          requested_amount: money(invoiceFaceValue || targetAmount),
          target_amount: money(targetAmount),
          profit_rate_percent:
            resolveOfferedProfitRate(invoiceOffer) != null
              ? money(resolveOfferedProfitRate(invoiceOffer) ?? 0)
              : undefined,
          service_fee_rate_percent: money(15),
          maturity_date:
            typeof invoiceDetails.maturity_date === "string"
              ? dateFrom(invoiceDetails.maturity_date)
              : null,
          events: {
            create: {
              event_type: "NOTE_CREATED_FROM_INVOICE",
              actor_user_id: actor.userId,
              actor_role: actor.role,
              portal: actor.portal ?? "ADMIN",
              ip_address: actor.ipAddress,
              user_agent: actor.userAgent,
              correlation_id: actor.correlationId,
              metadata: { applicationId: application.id, invoiceId: invoice.id },
            },
          },
          admin_actions: {
            create: {
              action_type: "CREATE_FROM_INVOICE",
              actor_user_id: actor.userId,
              after_state: { status: NoteStatus.DRAFT, invoiceId: invoice.id },
              ip_address: actor.ipAddress,
              user_agent: actor.userAgent,
              correlation_id: actor.correlationId,
            },
          },
        },
        include: noteInclude,
      });

      await tx.notePaymentSchedule.create({
        data: {
          note_id: created.id,
          sequence: 1,
          due_date: created.maturity_date ?? new Date(),
          expected_principal: created.target_amount,
          expected_profit: money(
            created.profit_rate_percent
              ? created.target_amount.toNumber() * (created.profit_rate_percent.toNumber() / 100)
              : 0
          ),
          expected_total: money(
            created.target_amount.toNumber() +
              (created.profit_rate_percent
                ? created.target_amount.toNumber() * (created.profit_rate_percent.toNumber() / 100)
                : 0)
          ),
        },
      });

      return tx.note.findUniqueOrThrow({ where: { id: created.id }, include: noteInclude });
    }).catch(async (error: unknown) => {
      if (isUniqueConstraintError(error, "source_invoice_id")) {
        const existingAfterRace = await noteRepository.findBySource(application.id, invoice.id);
        if (existingAfterRace) return existingAfterRace;
      }
      throw error;
    });

    return mapNoteDetail(note);
  }

  async updateDraft(id: string, input: z.infer<typeof updateNoteDraftSchema>, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.DRAFT || note.funding_status !== NoteFundingStatus.NOT_OPEN) {
      throw new AppError(409, "NOTE_NOT_EDITABLE", "Only pre-funding draft notes can be edited");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.note.update({
        where: { id },
        data: {
          title: input.title,
          target_amount: input.targetAmount != null ? money(input.targetAmount) : undefined,
          maturity_date: input.maturityDate !== undefined ? dateFrom(input.maturityDate) : undefined,
          platform_fee_rate_percent:
            input.platformFeeRatePercent != null ? money(input.platformFeeRatePercent) : undefined,
          service_fee_rate_percent:
            input.serviceFeeRatePercent != null ? money(input.serviceFeeRatePercent) : undefined,
          service_fee_customer_scope: input.serviceFeeCustomerScope,
          profit_rate_percent:
            input.profitRatePercent !== undefined && input.profitRatePercent !== null
              ? money(input.profitRatePercent)
              : input.profitRatePercent === null
                ? null
                : undefined,
          listing: input.summary !== undefined
            ? {
                upsert: {
                  create: { summary: input.summary },
                  update: { summary: input.summary },
                },
              }
            : undefined,
        },
        include: noteInclude,
      });
      await this.logAdminAction(tx, id, "UPDATE_DRAFT", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });

    return mapNoteDetail(updated);
  }

  async publish(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (
      note.status !== NoteStatus.DRAFT ||
      note.funding_status !== NoteFundingStatus.NOT_OPEN ||
      !(new Set<NoteListingStatus>([
        NoteListingStatus.NOT_LISTED,
        NoteListingStatus.DRAFT,
        NoteListingStatus.UNPUBLISHED,
      ])).has(note.listing_status)
    ) {
      throw new AppError(409, "NOTE_NOT_PUBLISHABLE", "Only draft or unpublished notes can be published");
    }
    if (toNumber(note.platform_fee_rate_percent) > 3 || toNumber(note.service_fee_rate_percent) > 15) {
      throw new AppError(422, "NOTE_FEE_CAP_EXCEEDED", "Configured fees exceed allowed caps");
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: {
          id,
          status: NoteStatus.DRAFT,
          funding_status: NoteFundingStatus.NOT_OPEN,
          listing_status: { in: [NoteListingStatus.NOT_LISTED, NoteListingStatus.DRAFT, NoteListingStatus.UNPUBLISHED] },
        },
        data: {
          status: NoteStatus.PUBLISHED,
          listing_status: NoteListingStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          published_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(409, "NOTE_NOT_PUBLISHABLE", "Only draft or unpublished notes can be published");
      }
      const result = await tx.note.update({
        where: { id },
        data: {
          listing: {
            upsert: {
              create: { status: NoteListingStatus.PUBLISHED, published_at: now },
              update: { status: NoteListingStatus.PUBLISHED, published_at: now, unpublished_at: null },
            },
          },
        },
        include: noteInclude,
      });
      await this.logAdminAction(tx, id, "PUBLISH", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });
    return mapNoteDetail(updated);
  }

  async unpublish(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.investments.length > 0) {
      throw new AppError(409, "NOTE_HAS_COMMITMENTS", "Cannot unpublish notes with investor commitments");
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.note.update({
        where: { id },
        data: {
          status: NoteStatus.DRAFT,
          listing_status: NoteListingStatus.UNPUBLISHED,
          funding_status: NoteFundingStatus.NOT_OPEN,
          listing: {
            upsert: {
              create: { status: NoteListingStatus.UNPUBLISHED, unpublished_at: now },
              update: { status: NoteListingStatus.UNPUBLISHED, unpublished_at: now },
            },
          },
        },
        include: noteInclude,
      });
      await this.logAdminAction(tx, id, "UNPUBLISH", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });
    return mapNoteDetail(updated);
  }

  async createInvestment(noteId: string, input: z.infer<typeof createInvestmentSchema>, actor: ActorContext) {
    const investorOrg = await prisma.investorOrganization.findFirst({
      where: {
        id: input.investorOrganizationId,
        OR: [
          { owner_user_id: actor.userId },
          { members: { some: { user_id: actor.userId } } },
        ],
      },
    });
    if (!investorOrg) throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");
    if (!investorOrg.deposit_received) {
      throw new AppError(403, "INVESTOR_DEPOSIT_REQUIRED", "Minimum investor deposit is required before investing");
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        status: true,
        funding_status: true,
        target_amount: true,
        funded_amount: true,
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(409, "NOTE_NOT_OPEN", "Note is not open for investment");
    }

    const target = toNumber(note.target_amount);
    const funded = toNumber(note.funded_amount);
    const remainingCapacity = Math.max(target - funded, 0);
    if (remainingCapacity <= 0) {
      throw new AppError(409, "NOTE_FULLY_ALLOCATED", "This note has no remaining funding capacity");
    }
    if (input.amount > remainingCapacity) {
      throw new AppError(
        422,
        "NOTE_OVERSUBSCRIBED",
        `Investment exceeds remaining note capacity of ${remainingCapacity.toFixed(2)}`
      );
    }
    const minCommit = Math.min(MARKETPLACE_MIN_COMMIT_MYR, remainingCapacity);
    if (input.amount + 1e-9 < minCommit) {
      throw new AppError(
        422,
        "INVESTMENT_BELOW_MINIMUM",
        `Minimum commitment for this note is ${minCommit.toFixed(2)}`
      );
    }

    const investmentAmount = money(input.amount);
    const remainingCapacityFloor = money(target - input.amount);

    const updated = await prisma.$transaction(async (tx) => {
      const capacityUpdate = await tx.note.updateMany({
        where: {
          id: noteId,
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          funded_amount: { lte: remainingCapacityFloor },
        },
        data: { funded_amount: { increment: investmentAmount } },
      });

      if (capacityUpdate.count !== 1) {
        const current = await tx.note.findUnique({
          where: { id: noteId },
          select: {
            status: true,
            funding_status: true,
            funded_amount: true,
            target_amount: true,
          },
        });
        if (!current) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
        if (current.status !== NoteStatus.PUBLISHED || current.funding_status !== NoteFundingStatus.OPEN) {
          throw new AppError(409, "NOTE_NOT_OPEN", "Note is not open for investment");
        }
        const remainingCapacity = Math.max(toNumber(current.target_amount) - toNumber(current.funded_amount), 0);
        throw new AppError(
          422,
          "NOTE_OVERSUBSCRIBED",
          `Investment exceeds remaining note capacity of ${remainingCapacity.toFixed(2)}`
        );
      }

      const investment = await tx.noteInvestment.create({
        data: {
          note_id: noteId,
          investor_organization_id: input.investorOrganizationId,
          investor_user_id: actor.userId,
          amount: investmentAmount,
          allocation_percent: money(target > 0 ? (input.amount / target) * 100 : 0),
        },
      });
      await debitInvestorBalanceForCommit(tx, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
        noteId,
        noteInvestmentId: investment.id,
      });
      await this.logEvent(tx, noteId, "INVESTMENT_COMMITTED", actor, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
      });
      return tx.note.findUniqueOrThrow({ where: { id: noteId }, include: noteInclude });
    });

    return mapMarketplaceNoteDetail(updated);
  }

  async closeFunding(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(409, "NOTE_FUNDING_NOT_OPEN", "Only notes with open funding can be closed");
    }
    const fundingPercent = toNumber(note.target_amount) > 0
      ? (toNumber(note.funded_amount) / toNumber(note.target_amount)) * 100
      : 0;
    if (fundingPercent < toNumber(note.minimum_funding_percent)) {
      throw new AppError(409, "NOTE_MINIMUM_FUNDING_NOT_MET", "Minimum funding threshold has not been met");
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: { id, status: NoteStatus.PUBLISHED, funding_status: NoteFundingStatus.OPEN },
        data: {
          status: NoteStatus.FUNDING,
          funding_status: NoteFundingStatus.FUNDED,
          listing_status: NoteListingStatus.CLOSED,
          funding_closed_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(409, "NOTE_FUNDING_NOT_OPEN", "Only notes with open funding can be closed");
      }
      await tx.noteInvestment.updateMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        data: { status: NoteInvestmentStatus.CONFIRMED, confirmed_at: now },
      });
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      await this.logAdminAction(tx, id, "CLOSE_FUNDING", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });
    return mapNoteDetail(updated);
  }

  async failFunding(id: string, actor: ActorContext) {
    const now = new Date();
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.status !== NoteStatus.PUBLISHED || note.funding_status !== NoteFundingStatus.OPEN) {
      throw new AppError(409, "NOTE_FUNDING_NOT_OPEN", "Only notes with open funding can be failed");
    }
    const targetAmount = toNumber(note.target_amount);
    const minimumFundingAmount = targetAmount * (toNumber(note.minimum_funding_percent) / 100);
    const fundingPercent = targetAmount > 0
      ? (toNumber(note.funded_amount) / targetAmount) * 100
      : 0;
    if (fundingPercent + 0.005 >= toNumber(note.minimum_funding_percent)) {
      throw new AppError(409, "NOTE_MINIMUM_FUNDING_MET", "Notes that meet the minimum funding threshold should be closed, not failed");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const releasedCommitments = await tx.noteInvestment.findMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        select: { id: true, investor_organization_id: true, amount: true },
      });
      const stateUpdate = await tx.note.updateMany({
        where: {
          id,
          status: NoteStatus.PUBLISHED,
          funding_status: NoteFundingStatus.OPEN,
          funded_amount: { lt: money(minimumFundingAmount) },
        },
        data: {
          status: NoteStatus.FAILED_FUNDING,
          funding_status: NoteFundingStatus.FAILED,
          listing_status: NoteListingStatus.CLOSED,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(409, "NOTE_FUNDING_NOT_OPEN", "Only notes with open funding can be failed");
      }
      await tx.noteInvestment.updateMany({
        where: { note_id: id, status: NoteInvestmentStatus.COMMITTED },
        data: { status: NoteInvestmentStatus.RELEASED, released_at: now },
      });
      for (const inv of releasedCommitments) {
        await creditInvestorBalance(tx, {
          investorOrganizationId: inv.investor_organization_id,
          amount: toNumber(inv.amount),
          source: InvestorBalanceTransactionSource.NOTE_INVESTMENT_RELEASE,
          noteId: id,
          noteInvestmentId: inv.id,
        });
      }
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      await this.logAdminAction(tx, id, "FAIL_FUNDING", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });
    return mapNoteDetail(updated);
  }

  async activate(id: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.funding_status !== NoteFundingStatus.FUNDED) {
      throw new AppError(409, "NOTE_NOT_FUNDED", "Only funded notes can be activated");
    }
    if (note.status === NoteStatus.ACTIVE || note.servicing_status !== NoteServicingStatus.NOT_STARTED) {
      throw new AppError(409, "NOTE_ALREADY_ACTIVATED", "Note has already been activated");
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.note.updateMany({
        where: { id, funding_status: NoteFundingStatus.FUNDED, servicing_status: NoteServicingStatus.NOT_STARTED },
        data: {
          status: NoteStatus.ACTIVE,
          servicing_status: NoteServicingStatus.CURRENT,
          activated_at: now,
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(409, "NOTE_ALREADY_ACTIVATED", "Note has already been activated");
      }
      const result = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      await this.postDisbursementLedger(tx, result, actor);
      await this.logAdminAction(tx, id, "ACTIVATE", actor, mapNoteListItem(note), mapNoteListItem(result));
      return result;
    });
    return mapNoteDetail(updated);
  }

  async listMarketplace(params: z.infer<typeof getNotesQuerySchema>) {
    return this.listAdminNotes({
      ...params,
      status: NoteStatus.PUBLISHED,
      listingStatus: NoteListingStatus.PUBLISHED,
      fundingStatus: NoteFundingStatus.OPEN,
    });
  }

  async getMarketplaceNoteDetail(id: string) {
    const note = await noteRepository.findById(id);
    if (
      !note ||
      note.status !== NoteStatus.PUBLISHED ||
      note.listing_status !== NoteListingStatus.PUBLISHED ||
      note.funding_status !== NoteFundingStatus.OPEN
    ) {
      throw new AppError(404, "NOTE_NOT_FOUND", "Published marketplace note not found");
    }
    return mapMarketplaceNoteDetail(note);
  }

  async listInvestorInvestments(userId: string) {
    const orgs = await prisma.investorOrganization.findMany({
      where: { OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }] },
      select: { id: true },
    });
    const orgIds = orgs.map((org) => org.id);
    const notes = await prisma.note.findMany({
      where: { investments: { some: { investor_organization_id: { in: orgIds } } } },
      include: noteInclude,
      orderBy: { updated_at: "desc" },
    });
    return {
      notes: notes.map(mapNoteListItem),
      pagination: { page: 1, pageSize: notes.length || 1, totalCount: notes.length, totalPages: 1 },
    };
  }

  async getInvestorPortfolio(userId: string) {
    const orgs = await prisma.investorOrganization.findMany({
      where: { OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }] },
      select: { id: true },
    });
    const orgIds = orgs.map((org) => org.id);
    const investments = await prisma.noteInvestment.findMany({
      where: {
        investor_organization_id: { in: orgIds },
        status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
      },
    });
    const committed = investments.reduce((sum, investment) => sum + toNumber(investment.amount), 0);
    const balanceRows = await prisma.investorBalance.findMany({
      where: { investor_organization_id: { in: orgIds } },
      select: { available_amount: true },
    });
    const availableBalance = balanceRows.reduce((sum, row) => sum + toNumber(row.available_amount), 0);
    const portfolioTotal = availableBalance + committed;
    return {
      totalInvestment: committed,
      portfolioTotal,
      availableBalance,
      investmentCount: investments.length,
    };
  }

  async testTopUpInvestorBalance(
    actor: ActorContext,
    input: { investorOrganizationId: string; amount: number }
  ) {
    const investorOrg = await prisma.investorOrganization.findFirst({
      where: {
        id: input.investorOrganizationId,
        OR: [
          { owner_user_id: actor.userId },
          { members: { some: { user_id: actor.userId } } },
        ],
      },
    });
    if (!investorOrg) throw new AppError(403, "INVESTOR_ORG_FORBIDDEN", "Investor organization not accessible");

    await prisma.$transaction(async (tx) => {
      const balanceTransaction = await creditInvestorBalance(tx, {
        investorOrganizationId: input.investorOrganizationId,
        amount: input.amount,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        metadata: { reason: "test_topup" },
      });
      const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
      await tx.noteLedgerEntry.create({
        data: {
          account_id: investorPoolId,
          direction: NoteLedgerDirection.CREDIT,
          amount: money(input.amount),
          description: "Investor test top-up received into investor pool",
          idempotency_key: `investor-balance-topup:${balanceTransaction.id}`,
          metadata: {
            actorUserId: actor.userId,
            actorPortal: actor.portal ?? "INVESTOR",
            investorOrganizationId: input.investorOrganizationId,
            investorBalanceTransactionId: balanceTransaction.id,
            source: "MANUAL_TOPUP",
          },
        },
      });
    });
    return this.getInvestorPortfolio(actor.userId);
  }

  async listIssuerNotes(userId: string) {
    const orgs = await prisma.issuerOrganization.findMany({
      where: { OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }] },
      select: { id: true },
    });
    const orgIds = orgs.map((org) => org.id);
    const notes = await prisma.note.findMany({
      where: { issuer_organization_id: { in: orgIds } },
      include: noteInclude,
      orderBy: { updated_at: "desc" },
    });
    return {
      notes: notes.map(mapNoteListItem),
      pagination: { page: 1, pageSize: notes.length || 1, totalCount: notes.length, totalPages: 1 },
    };
  }

  async getIssuerNote(id: string, userId: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const allowed = await prisma.issuerOrganization.findFirst({
      where: {
        id: note.issuer_organization_id,
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
      },
    });
    if (!allowed) throw new AppError(403, "ISSUER_NOTE_FORBIDDEN", "Issuer note is not accessible");
    return mapNoteDetail(note);
  }

  getPaymentInstructions(id: string) {
    return {
      noteId: id,
      bankName: process.env.REPAYMENT_BANK_NAME ?? "Trustee Bank",
      accountName: process.env.REPAYMENT_ACCOUNT_NAME ?? "CashSouk Repayment Pool",
      accountNumber: process.env.REPAYMENT_ACCOUNT_NUMBER ?? "Pending configuration",
      referenceFormat: `NOTE-${id.slice(-8).toUpperCase()}`,
    };
  }

  async recordPayment(id: string, input: z.infer<typeof recordPaymentSchema>, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    const requiresAdminReview = input.source === "ISSUER_ON_BEHALF" && actor.portal === "ISSUER";
    const paymentPurpose = resolveIssuerPaymentPurpose(input);
    if (requiresAdminReview) {
      if (paymentPurpose === "LATE_FEES") {
        throw new AppError(
          422,
          "ISSUER_LATE_FEE_PAYMENT_NOT_ALLOWED",
          "Late fees are deducted from repayment proceeds and cannot be paid separately by the issuer"
        );
      } else {
        const settlementAmount = resolveNoteSettlementAmount(note);
        if (settlementAmount <= 0) {
          throw new AppError(409, "NOTE_AMOUNT_UNRESOLVED", "Payment cannot be submitted before the invoice amount is resolved");
        }
        if (Math.abs(input.receiptAmount - settlementAmount) > 0.005) {
          throw new AppError(
            422,
            "INVALID_SETTLEMENT_AMOUNT",
            "Issuer payment must match the invoice settlement amount"
          );
        }
      }
    }
    const status = requiresAdminReview ? NotePaymentStatus.PENDING : NotePaymentStatus.RECEIVED;
    const eventType = requiresAdminReview ? "ISSUER_PAYMENT_SUBMITTED" : "PAYMENT_RECEIVED";
    const paymentMetadata = input.metadata ?? (requiresAdminReview ? { paymentPurpose } : undefined);
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.notePayment.create({
        data: {
          note_id: id,
          schedule_id: input.scheduleId ?? null,
          source: input.source,
          status,
          receipt_amount: money(input.receiptAmount),
          receipt_date: new Date(input.receiptDate),
          evidence_s3_key: input.evidenceS3Key ?? null,
          reference: input.reference ?? null,
          recorded_by_user_id: actor.userId,
          metadata: json(paymentMetadata),
        },
      });
      if (status === NotePaymentStatus.RECEIVED) {
        await this.postPaymentReceiptLedger(tx, payment, actor);
      }
      await this.logEvent(tx, id, eventType, actor, json({ ...input, metadata: paymentMetadata }));
      return tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
    });
    return mapNoteDetail(updated);
  }

  async approvePayment(id: string, paymentId: string, actor: ActorContext) {
    const payment = await prisma.notePayment.findUnique({ where: { id: paymentId }, include: { note: true } });
    if (!payment || payment.note_id !== id) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    assertNoteReadyForServicing(payment.note);
    if (payment.status !== NotePaymentStatus.PENDING) {
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Only pending payments can be approved");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.notePayment.update({
        where: { id: paymentId },
        data: {
          status: NotePaymentStatus.RECEIVED,
          reconciled_by_user_id: actor.userId,
          reconciled_at: new Date(),
        },
      });
      await this.postPaymentReceiptLedger(tx, updatedPayment, actor);
      await this.logEvent(tx, id, "PAYMENT_APPROVED", actor, { paymentId });
      return tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
    });
    return mapNoteDetail(updated);
  }

  async rejectPayment(id: string, paymentId: string, input: z.infer<typeof paymentReviewSchema>, actor: ActorContext) {
    const payment = await prisma.notePayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.note_id !== id) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    if (payment.status !== NotePaymentStatus.PENDING) {
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Only pending payments can be rejected");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.notePayment.update({
        where: { id: paymentId },
        data: {
          status: NotePaymentStatus.VOID,
          reconciled_by_user_id: actor.userId,
          reconciled_at: new Date(),
          metadata: {
            ...(asRecord(payment.metadata) ?? {}),
            rejectionReason: input.reason ?? null,
          },
        },
      });
      await this.logEvent(tx, id, "PAYMENT_REJECTED", actor, { paymentId, reason: input.reason ?? null });
      return tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
    });
    return mapNoteDetail(updated);
  }

  async previewSettlement(id: string, input: z.infer<typeof settlementPreviewSchema>, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);
    const lockedSettlement = note.settlements.find(
      (settlement) =>
        settlement.status === NoteSettlementStatus.APPROVED ||
        settlement.status === NoteSettlementStatus.POSTED
    );
    if (lockedSettlement) {
      throw new AppError(
        409,
        "SETTLEMENT_LOCKED",
        "Settlement has already been approved or posted and cannot be previewed again"
      );
    }
    const payment = input.paymentId
      ? note.payments.find((candidate) => candidate.id === input.paymentId)
      : note.payments.find(
          (candidate) =>
            candidate.status === NotePaymentStatus.RECEIVED ||
            candidate.status === NotePaymentStatus.RECONCILED ||
            candidate.status === NotePaymentStatus.PARTIAL
        ) ?? null;
    const grossReceipt = input.receiptAmount ?? (payment ? toNumber(payment.receipt_amount) : 0);
    if (grossReceipt <= 0) throw new AppError(422, "SETTLEMENT_RECEIPT_REQUIRED", "Receipt amount is required");

    const waterfall = calculateSettlementWaterfall({
      grossReceiptAmount: grossReceipt,
      fundedPrincipal: toNumber(note.funded_amount),
      profitRatePercent: toNumber(note.profit_rate_percent),
      serviceFeeRatePercent: toNumber(note.service_fee_rate_percent),
      tawidhAmount: input.tawidhAmount ?? 0,
      gharamahAmount: input.gharamahAmount ?? 0,
    });

    const snapshot = {
      ...waterfall,
      allocations: note.investments.map((investment) => {
        const ratio = waterfall.investorPrincipal > 0 ? toNumber(investment.amount) / waterfall.investorPrincipal : 0;
        return {
          investmentId: investment.id,
          investorOrganizationId: investment.investor_organization_id,
          principal: toNumber(investment.amount),
          profitNet: waterfall.investorProfitNet * ratio,
        };
      }),
    };

    const settlement = await prisma.noteSettlement.create({
      data: {
        note_id: id,
        payment_id: payment?.id ?? null,
        gross_receipt_amount: money(grossReceipt),
        investor_principal: money(waterfall.investorPrincipal),
        investor_profit_gross: money(waterfall.investorProfitGross),
        service_fee_amount: money(waterfall.serviceFeeAmount),
        investor_profit_net: money(waterfall.investorProfitNet),
        tawidh_amount: money(waterfall.tawidhAmount),
        gharamah_amount: money(waterfall.gharamahAmount),
        issuer_residual_amount: money(waterfall.issuerResidualAmount),
        unapplied_amount: money(waterfall.unappliedAmount),
        settlement_type:
          waterfall.tawidhAmount > 0 || waterfall.gharamahAmount > 0 ? NoteSettlementType.LATE : NoteSettlementType.STANDARD,
        preview_snapshot: snapshot,
      },
    });
    await prisma.noteEvent.create({
      data: {
        note_id: id,
        event_type: "SETTLEMENT_PREVIEWED",
        actor_user_id: actor.userId,
        actor_role: actor.role,
        portal: actor.portal,
        correlation_id: actor.correlationId,
        metadata: { settlementId: settlement.id, ...snapshot },
      },
    });
    return { settlementId: settlement.id, ...snapshot };
  }

  async approveSettlement(id: string, settlementId: string, actor: ActorContext) {
    const settlement = await prisma.noteSettlement.findUnique({
      where: { id: settlementId },
      include: { note: true },
    });
    if (!settlement || settlement.note_id !== id) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    assertNoteReadyForServicing(settlement.note);
    if (settlement.status !== NoteSettlementStatus.PREVIEW) {
      throw new AppError(409, "SETTLEMENT_NOT_PREVIEW", "Only preview settlements can be approved");
    }
    assertSettlementAmountComplete(settlement);
    await assertRepaymentReceiptLedgerComplete(settlement.note_id, resolveNoteSettlementAmount(settlement.note));

    await prisma.noteSettlement.update({
      where: { id: settlementId },
      data: {
        status: NoteSettlementStatus.APPROVED,
        approved_by_user_id: actor.userId,
        approved_at: new Date(),
      },
    });
    await this.logEvent(prisma, id, "SETTLEMENT_APPROVED", actor, { settlementId });
    return this.getAdminNoteDetail(id);
  }

  async postSettlement(id: string, settlementId: string, actor: ActorContext) {
    const settlement = await prisma.noteSettlement.findUnique({
      where: { id: settlementId },
      include: { note: true },
    });
    if (!settlement || settlement.note_id !== id) {
      throw new AppError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found");
    }
    assertNoteReadyForServicing(settlement.note);
    if (settlement.status !== NoteSettlementStatus.APPROVED) {
      throw new AppError(409, "SETTLEMENT_NOT_APPROVED", "Settlement must be approved before posting");
    }
    assertSettlementAmountComplete(settlement);
    await assertRepaymentReceiptLedgerComplete(settlement.note_id, resolveNoteSettlementAmount(settlement.note));

    await prisma.$transaction(async (tx) => {
      await this.postSettlementLedger(tx, settlement, actor);
      await tx.noteSettlement.update({
        where: { id: settlementId },
        data: {
          status: NoteSettlementStatus.POSTED,
          posted_at: new Date(),
          idempotency_key: `settlement:${settlementId}`,
        },
      });
      await tx.note.update({
        where: { id },
        data: {
          status: NoteStatus.REPAID,
          servicing_status: NoteServicingStatus.SETTLED,
          repaid_at: new Date(),
        },
      });
      await tx.noteInvestment.updateMany({
        where: {
          note_id: id,
          status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
        },
        data: { status: NoteInvestmentStatus.SETTLED },
      });
      await this.logEvent(tx, id, "SETTLEMENT_POSTED", actor, { settlementId });
    });
    return this.getAdminNoteDetail(id);
  }

  async calculateLateCharge(input: z.infer<typeof lateChargeSchema>) {
    const settings = await this.getPlatformFinanceSettings();
    return calculateLateChargeValues({
      receiptAmount: input.receiptAmount,
      dueDate: new Date(input.dueDate),
      receiptDate: new Date(input.receiptDate),
      gracePeriodDays: settings.gracePeriodDays,
      tawidhRateCapPercent: settings.tawidhRateCapPercent,
      gharamahRateCapPercent: settings.gharamahRateCapPercent,
      tawidhAmount: input.tawidhAmount,
      gharamahAmount: input.gharamahAmount,
    });
  }

  async checkOverdueLateCharge(id: string, input: z.infer<typeof overdueLateChargeSchema>) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    assertNoteReadyForServicing(note);

    const schedule = note.payment_schedules[0] ?? null;
    const dueDate = schedule?.due_date ?? note.maturity_date;
    const checkDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
    const receiptAmount = input.receiptAmount ?? resolveNoteSettlementAmount(note);

    if (!dueDate) {
      return {
        overdue: false,
        dueDate: null,
        checkDate: checkDate.toISOString(),
        gracePeriodDays: note.grace_period_days,
        daysLate: 0,
        receiptAmount,
        totalTawidhCap: 0,
        totalGharamahCap: 0,
        appliedTawidhAmount: 0,
        appliedGharamahAmount: 0,
        remainingTawidhAmount: 0,
        remainingGharamahAmount: 0,
        suggestedTawidhAmount: 0,
        suggestedGharamahAmount: 0,
        message: "No due date is available for this note.",
      };
    }

    const total = calculateLateChargeValues({
      receiptAmount,
      dueDate,
      receiptDate: checkDate,
      gracePeriodDays: note.grace_period_days,
      tawidhRateCapPercent: toNumber(note.tawidh_rate_cap_percent),
      gharamahRateCapPercent: toNumber(note.gharamah_rate_cap_percent),
    });

    const appliedSettlements = note.settlements.filter(
      (settlement) =>
        settlement.status === NoteSettlementStatus.APPROVED ||
        settlement.status === NoteSettlementStatus.POSTED
    );
    const appliedTawidhAmount = appliedSettlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.tawidh_amount),
      0
    );
    const appliedGharamahAmount = appliedSettlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.gharamah_amount),
      0
    );
    const remainingTawidhAmount = Math.max(0, total.tawidhCap - appliedTawidhAmount);
    const remainingGharamahAmount = Math.max(0, total.gharamahCap - appliedGharamahAmount);
    const overdue = total.daysLate > 0;

    return {
      overdue,
      dueDate: dueDate.toISOString(),
      checkDate: checkDate.toISOString(),
      gracePeriodDays: note.grace_period_days,
      daysLate: total.daysLate,
      receiptAmount,
      totalTawidhCap: total.tawidhCap,
      totalGharamahCap: total.gharamahCap,
      appliedTawidhAmount,
      appliedGharamahAmount,
      remainingTawidhAmount,
      remainingGharamahAmount,
      suggestedTawidhAmount: overdue ? remainingTawidhAmount : 0,
      suggestedGharamahAmount: overdue ? remainingGharamahAmount : 0,
      message: !overdue
        ? "Payment is not overdue after the grace period."
        : remainingTawidhAmount <= 0 && remainingGharamahAmount <= 0
          ? "This payment is overdue, but all allowable late fees have already been applied."
          : "Payment is overdue. Suggested late fees exclude previously approved or posted late fees.",
    };
  }

  async applyOverdueLateCharge(
    id: string,
    input: z.infer<typeof overdueLateChargeSchema>,
    actor: ActorContext
  ) {
    const result = await this.checkOverdueLateCharge(id, input);
    if (result.overdue && result.dueDate) {
      const note = await noteRepository.findById(id);
      if (note) {
        const dueDate = new Date(result.dueDate);
        const checkDate = new Date(result.checkDate);
        const daysPastDue = Math.max(0, daysBetweenCalendarDates(dueDate, checkDate));
        const daysAfterGrace = Math.max(0, daysPastDue - note.grace_period_days);
        const isArrears = daysAfterGrace >= note.arrears_threshold_days;
        const nextServicingStatus = isArrears ? NoteServicingStatus.ARREARS : NoteServicingStatus.LATE;
        if (note.servicing_status !== nextServicingStatus) {
          await noteRepository.updateState(id, {
            status: isArrears ? NoteStatus.ARREARS : note.status,
            servicing_status: nextServicingStatus,
            arrears_started_at: isArrears && !note.arrears_started_at ? new Date() : undefined,
          });
        }
      }
    }
    await this.logEvent(prisma, id, "OVERDUE_LATE_CHARGE_CHECKED", actor, result);
    return result;
  }

  async approveLateCharge(id: string, input: z.infer<typeof lateChargeSchema>, actor: ActorContext) {
    const result = await this.calculateLateCharge(input);
    await this.logEvent(prisma, id, "LATE_CHARGE_APPROVED", actor, result);
    return result;
  }

  async generateNoteLetter(id: string, type: "arrears" | "default", actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    const title = type === "arrears" ? "Arrears Warning Letter" : "Default Notice Letter";
    const buffer = await renderPdfBuffer(title, [
      ["Note reference", note.note_reference],
      ["Issuer", mapNoteListItem(note).issuerName ?? "-"],
      ["Paymaster", mapNoteListItem(note).paymasterName ?? "-"],
      ["Outstanding funded amount", toNumber(note.funded_amount).toFixed(2)],
      ["Generated at", new Date().toISOString()],
    ]);
    const key = `note-letters/${id}/${type}-${Date.now()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    await this.logEvent(prisma, id, `${type.toUpperCase()}_LETTER_GENERATED`, actor, { s3Key: key });
    return { s3Key: key };
  }

  async markDefault(id: string, reason: string, actor: ActorContext) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    if (note.servicing_status !== NoteServicingStatus.ARREARS) {
      throw new AppError(409, "NOTE_NOT_IN_ARREARS", "Default can only be marked while note is in arrears");
    }
    const updated = await noteRepository.updateState(id, {
      status: NoteStatus.DEFAULTED,
      servicing_status: NoteServicingStatus.DEFAULTED,
      default_marked_at: new Date(),
      default_marked_by_admin_user_id: actor.userId,
      default_reason: reason,
    });
    await this.logEvent(prisma, id, "NOTE_DEFAULT_MARKED", actor, { reason });
    return mapNoteDetail(updated);
  }

  async getPlatformFinanceSettings() {
    const settings = await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {},
      create: { key: "DEFAULT" },
    });
    return {
      id: settings.id,
      key: settings.key,
      gracePeriodDays: settings.grace_period_days,
      arrearsThresholdDays: settings.arrears_threshold_days,
      tawidhRateCapPercent: toNumber(settings.tawidh_rate_cap_percent),
      gharamahRateCapPercent: toNumber(settings.gharamah_rate_cap_percent),
      defaultTawidhRatePercent: toNumber(settings.default_tawidh_rate_percent),
      defaultGharamahRatePercent: toNumber(settings.default_gharamah_rate_percent),
      withdrawalLetterTemplate: settings.withdrawal_letter_template,
      arrearsLetterTemplate: settings.arrears_letter_template,
      defaultLetterTemplate: settings.default_letter_template,
      updatedByUserId: settings.updated_by_user_id,
      updatedAt: settings.updated_at.toISOString(),
    };
  }

  async updatePlatformFinanceSettings(
    input: z.infer<typeof updatePlatformFinanceSettingsSchema>,
    actor: ActorContext
  ) {
    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      create: {
        key: "DEFAULT",
        grace_period_days: input.gracePeriodDays,
        arrears_threshold_days: input.arrearsThresholdDays,
        tawidh_rate_cap_percent: input.tawidhRateCapPercent != null ? money(input.tawidhRateCapPercent) : undefined,
        gharamah_rate_cap_percent: input.gharamahRateCapPercent != null ? money(input.gharamahRateCapPercent) : undefined,
        default_tawidh_rate_percent: input.defaultTawidhRatePercent != null ? money(input.defaultTawidhRatePercent) : undefined,
        default_gharamah_rate_percent: input.defaultGharamahRatePercent != null ? money(input.defaultGharamahRatePercent) : undefined,
        withdrawal_letter_template: input.withdrawalLetterTemplate,
        arrears_letter_template: input.arrearsLetterTemplate,
        default_letter_template: input.defaultLetterTemplate,
        updated_by_user_id: actor.userId,
      },
      update: {
        grace_period_days: input.gracePeriodDays,
        arrears_threshold_days: input.arrearsThresholdDays,
        tawidh_rate_cap_percent: input.tawidhRateCapPercent != null ? money(input.tawidhRateCapPercent) : undefined,
        gharamah_rate_cap_percent: input.gharamahRateCapPercent != null ? money(input.gharamahRateCapPercent) : undefined,
        default_tawidh_rate_percent: input.defaultTawidhRatePercent != null ? money(input.defaultTawidhRatePercent) : undefined,
        default_gharamah_rate_percent: input.defaultGharamahRatePercent != null ? money(input.defaultGharamahRatePercent) : undefined,
        withdrawal_letter_template: input.withdrawalLetterTemplate,
        arrears_letter_template: input.arrearsLetterTemplate,
        default_letter_template: input.defaultLetterTemplate,
        updated_by_user_id: actor.userId,
      },
    });
    return this.getPlatformFinanceSettings();
  }

  async createWithdrawal(input: z.infer<typeof createWithdrawalSchema>, actor: ActorContext) {
    const withdrawal = await prisma.withdrawalInstruction.create({
      data: {
        note_id: input.noteId ?? null,
        investor_organization_id: input.investorOrganizationId ?? null,
        issuer_organization_id: input.issuerOrganizationId ?? null,
        requested_by_user_id: actor.userId,
        withdrawal_type: input.withdrawalType,
        amount: money(input.amount),
        beneficiary_snapshot: input.beneficiarySnapshot as Prisma.InputJsonValue,
      },
    });
    return this.mapWithdrawal(withdrawal);
  }

  async generateWithdrawalLetter(id: string, actor: ActorContext) {
    const withdrawal = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!withdrawal) throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal instruction not found");
    const buffer = await renderPdfBuffer("Trustee Withdrawal Instruction", [
      ["Withdrawal ID", withdrawal.id],
      ["Type", withdrawal.withdrawal_type],
      ["Amount", `${withdrawal.currency} ${toNumber(withdrawal.amount).toFixed(2)}`],
      ["Requested by", withdrawal.requested_by_user_id],
      ["Generated at", new Date().toISOString()],
    ]);
    const key = `withdrawal-letters/${id}/${Date.now()}.pdf`;
    await putS3ObjectBuffer({ key, body: buffer, contentType: "application/pdf" });
    const updated = await prisma.withdrawalInstruction.update({
      where: { id },
      data: {
        status: WithdrawalStatus.LETTER_GENERATED,
        letter_s3_key: key,
        generated_at: new Date(),
      },
    });
    if (withdrawal.note_id) {
      await this.logEvent(prisma, withdrawal.note_id, "WITHDRAWAL_LETTER_GENERATED", actor, { withdrawalId: id, s3Key: key });
    }
    return this.mapWithdrawal(updated);
  }

  async markWithdrawalSubmitted(id: string, actor: ActorContext) {
    const existing = await prisma.withdrawalInstruction.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    if (existing.status !== WithdrawalStatus.LETTER_GENERATED) {
      throw new AppError(
        409,
        "WITHDRAWAL_LETTER_REQUIRED",
        "Withdrawal can be submitted to trustee only after its instruction letter is generated"
      );
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.withdrawalInstruction.updateMany({
        where: { id, status: WithdrawalStatus.LETTER_GENERATED },
        data: {
          status: WithdrawalStatus.SUBMITTED_TO_TRUSTEE,
          submitted_by_user_id: actor.userId,
          submitted_to_trustee_at: new Date(),
        },
      });
      if (stateUpdate.count !== 1) {
        throw new AppError(
          409,
          "WITHDRAWAL_LETTER_REQUIRED",
          "Withdrawal can be submitted to trustee only after its instruction letter is generated"
        );
      }
      return tx.withdrawalInstruction.findUniqueOrThrow({ where: { id } });
    });
    if (withdrawal.note_id) {
      await this.logEvent(prisma, withdrawal.note_id, "WITHDRAWAL_SUBMITTED_TO_TRUSTEE", actor, { withdrawalId: id });
    }
    return this.mapWithdrawal(withdrawal);
  }

  async listLedger(id: string) {
    const entries = await prisma.noteLedgerEntry.findMany({
      where: { note_id: id },
      include: { account: true },
      orderBy: { posted_at: "desc" },
    });
    return entries.map(mapLedgerEntry);
  }

  async listLedgerBucketBalances() {
    const accounts = await prisma.noteLedgerAccount.findMany({
      include: { ledger_entries: true },
      orderBy: { name: "asc" },
    });
    const bucketOrder = ["INVESTOR_POOL", "REPAYMENT_POOL", "OPERATING_ACCOUNT", "TAWIDH_ACCOUNT", "GHARAMAH_ACCOUNT"];
    const buckets = accounts
      .filter((account) => bucketOrder.includes(account.code))
      .sort((a, b) => bucketOrder.indexOf(a.code) - bucketOrder.indexOf(b.code))
      .map((account) => {
        const debitTotal = account.ledger_entries
          .filter((entry) => entry.direction === NoteLedgerDirection.DEBIT)
          .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
        const creditTotal = account.ledger_entries
          .filter((entry) => entry.direction === NoteLedgerDirection.CREDIT)
          .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
        const lastPostedAt = account.ledger_entries.reduce<Date | null>((latest, entry) => {
          if (!latest || entry.posted_at > latest) return entry.posted_at;
          return latest;
        }, null);

        return {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          currency: account.currency,
          debitTotal,
          creditTotal,
          balance: creditTotal - debitTotal,
          entryCount: account.ledger_entries.length,
          lastPostedAt: lastPostedAt?.toISOString() ?? null,
        };
      });

    return {
      buckets,
      totals: {
        debitTotal: buckets.reduce((sum, bucket) => sum + bucket.debitTotal, 0),
        creditTotal: buckets.reduce((sum, bucket) => sum + bucket.creditTotal, 0),
        balance: buckets.reduce((sum, bucket) => sum + bucket.balance, 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listLedgerBucketActivity(accountCode: NoteLedgerAccountType, query: z.infer<typeof bucketActivityQuerySchema>) {
    const account = await prisma.noteLedgerAccount.findUnique({
      where: { code: accountCode },
      include: { ledger_entries: true },
    });
    if (!account) throw new AppError(404, "LEDGER_ACCOUNT_NOT_FOUND", "Ledger bucket not found");

    const debitTotal = account.ledger_entries
      .filter((entry) => entry.direction === NoteLedgerDirection.DEBIT)
      .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const creditTotal = account.ledger_entries
      .filter((entry) => entry.direction === NoteLedgerDirection.CREDIT)
      .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const lastPostedAt = account.ledger_entries.reduce<Date | null>((latest, entry) => {
      if (!latest || entry.posted_at > latest) return entry.posted_at;
      return latest;
    }, null);
    const where = { account: { code: accountCode } };
    const [entries, totalCount] = await Promise.all([
      prisma.noteLedgerEntry.findMany({
        where,
        include: {
          account: true,
          note: { select: { note_reference: true, title: true } },
        },
        orderBy: { posted_at: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.noteLedgerEntry.count({ where }),
    ]);

    return {
      bucket: {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        currency: account.currency,
        debitTotal,
        creditTotal,
        balance: creditTotal - debitTotal,
        entryCount: account.ledger_entries.length,
        lastPostedAt: lastPostedAt?.toISOString() ?? null,
      },
      entries: entries.map((entry) => ({
        ...mapLedgerEntry(entry),
        noteReference: entry.note?.note_reference ?? null,
        noteTitle: entry.note?.title ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listEvents(id: string) {
    const note = await noteRepository.findById(id);
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    return mapNoteDetail(note).events;
  }

  private mapWithdrawal(withdrawal: {
    id: string;
    note_id: string | null;
    investor_organization_id: string | null;
    issuer_organization_id: string | null;
    requested_by_user_id: string;
    submitted_by_user_id: string | null;
    status: WithdrawalStatus;
    withdrawal_type: string;
    amount: Prisma.Decimal;
    currency: string;
    beneficiary_snapshot: Prisma.JsonValue;
    letter_s3_key: string | null;
    generated_at: Date | null;
    submitted_to_trustee_at: Date | null;
    created_at: Date;
  }) {
    return {
      id: withdrawal.id,
      noteId: withdrawal.note_id,
      investorOrganizationId: withdrawal.investor_organization_id,
      issuerOrganizationId: withdrawal.issuer_organization_id,
      requestedByUserId: withdrawal.requested_by_user_id,
      submittedByUserId: withdrawal.submitted_by_user_id,
      status: withdrawal.status,
      withdrawalType: withdrawal.withdrawal_type,
      amount: toNumber(withdrawal.amount),
      currency: withdrawal.currency,
      beneficiarySnapshot: asRecord(withdrawal.beneficiary_snapshot) ?? {},
      letterS3Key: withdrawal.letter_s3_key,
      generatedAt: withdrawal.generated_at?.toISOString() ?? null,
      submittedToTrusteeAt: withdrawal.submitted_to_trustee_at?.toISOString() ?? null,
      createdAt: withdrawal.created_at.toISOString(),
    };
  }

  private resolvePaymasterName(paymaster: Record<string, unknown> | null): string | null {
    const name = paymaster?.name ?? paymaster?.company_name ?? paymaster?.business_name;
    return typeof name === "string" ? name : null;
  }

  private async logEvent(
    tx: Prisma.TransactionClient | typeof prisma,
    noteId: string,
    eventType: string,
    actor: ActorContext,
    metadata?: Prisma.InputJsonValue
  ) {
    await tx.noteEvent.create({
      data: {
        note_id: noteId,
        event_type: eventType,
        actor_user_id: actor.userId,
        actor_role: actor.role,
        portal: actor.portal,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
        correlation_id: actor.correlationId,
        metadata,
      },
    });
  }

  private async logAdminAction(
    tx: Prisma.TransactionClient,
    noteId: string,
    actionType: string,
    actor: ActorContext,
    beforeState?: Prisma.InputJsonValue,
    afterState?: Prisma.InputJsonValue
  ) {
    await tx.noteAdminAction.create({
      data: {
        note_id: noteId,
        action_type: actionType,
        actor_user_id: actor.userId,
        before_state: beforeState,
        after_state: afterState,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
        correlation_id: actor.correlationId,
      },
    });
    await this.logEvent(tx, noteId, actionType, actor, { beforeState, afterState });
  }

  private async getLedgerAccountId(tx: Prisma.TransactionClient, code: string) {
    const account = await tx.noteLedgerAccount.findUnique({ where: { code } });
    if (!account) throw new AppError(500, "LEDGER_ACCOUNT_MISSING", `Missing ledger account ${code}`);
    return account.id;
  }

  private async postDisbursementLedger(
    tx: Prisma.TransactionClient,
    note: Awaited<ReturnType<typeof prisma.note.findUniqueOrThrow>>,
    actor: ActorContext
  ) {
    const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
    const operatingId = await this.getLedgerAccountId(tx, "OPERATING_ACCOUNT");
    const fundedAmount = toNumber(note.funded_amount);
    const platformFee = fundedAmount * (toNumber(note.platform_fee_rate_percent) / 100);
    const entries = [
      {
        account_id: investorPoolId,
        direction: NoteLedgerDirection.DEBIT,
        amount: money(fundedAmount),
        description: "Funded note disbursement from investor pool",
      },
      {
        account_id: operatingId,
        direction: NoteLedgerDirection.CREDIT,
        amount: money(platformFee),
        description: "Platform fee deducted at disbursement",
      },
    ].filter((entry) => toNumber(entry.amount) > 0);

    for (const [index, entry] of entries.entries()) {
      await tx.noteLedgerEntry.create({
        data: {
          note_id: note.id,
          ...entry,
          idempotency_key: `note:${note.id}:activate:${index}`,
          metadata: { actorUserId: actor.userId },
        },
      });
    }
  }

  private async postPaymentReceiptLedger(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      note_id: string;
      receipt_amount: unknown;
      source: string;
      reference: string | null;
    },
    actor: ActorContext
  ) {
    const repaymentPoolId = await this.getLedgerAccountId(tx, "REPAYMENT_POOL");
    const amount = toNumber(payment.receipt_amount);
    if (amount <= 0) return;

    await tx.noteLedgerEntry.upsert({
      where: { idempotency_key: `payment:${payment.id}:receipt` },
      update: {},
      create: {
        note_id: payment.note_id,
        account_id: repaymentPoolId,
        payment_id: payment.id,
        direction: NoteLedgerDirection.CREDIT,
        amount: money(amount),
        description: "Repayment receipt recorded",
        idempotency_key: `payment:${payment.id}:receipt`,
        metadata: {
          actorUserId: actor.userId,
          source: payment.source,
          reference: payment.reference,
        },
      },
    });
  }

  private async postSettlementLedger(
    tx: Prisma.TransactionClient,
    settlement: Awaited<ReturnType<typeof prisma.noteSettlement.findUnique>>,
    actor: ActorContext
  ) {
    if (!settlement) return;
    const investorPoolId = await this.getLedgerAccountId(tx, "INVESTOR_POOL");
    const repaymentPoolId = await this.getLedgerAccountId(tx, "REPAYMENT_POOL");
    const operatingId = await this.getLedgerAccountId(tx, "OPERATING_ACCOUNT");
    const tawidhId = await this.getLedgerAccountId(tx, "TAWIDH_ACCOUNT");
    const gharamahId = await this.getLedgerAccountId(tx, "GHARAMAH_ACCOUNT");
    const receiptAlreadyPosted = settlement.payment_id
      ? await tx.noteLedgerEntry.findUnique({
          where: { idempotency_key: `payment:${settlement.payment_id}:receipt` },
        })
      : null;
    const entries: Array<[string, string, NoteLedgerDirection, Prisma.Decimal | number | string, string]> = [];
    if (!receiptAlreadyPosted) {
      entries.push([
        "repayment-receipt",
        repaymentPoolId,
        NoteLedgerDirection.CREDIT,
        settlement.gross_receipt_amount,
        "Repayment receipt",
      ]);
    }
    entries.push(
      ["repayment-to-investor-principal", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.investor_principal, "Investor principal paid from repayment pool"],
      ["repayment-to-investor-profit", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.investor_profit_net, "Investor net profit paid from repayment pool"],
      ["repayment-to-service-fee", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.service_fee_amount, "Service fee paid from repayment pool"],
      ["repayment-to-tawidh", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.tawidh_amount, "Ta'widh paid from repayment pool"],
      ["repayment-to-gharamah", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.gharamah_amount, "Gharamah paid from repayment pool"],
      ["repayment-to-issuer-residual", repaymentPoolId, NoteLedgerDirection.DEBIT, settlement.issuer_residual_amount, "Issuer residual paid from repayment pool"],
      ["investor-principal", investorPoolId, NoteLedgerDirection.CREDIT, settlement.investor_principal, "Investor principal returned"],
      ["investor-profit", investorPoolId, NoteLedgerDirection.CREDIT, settlement.investor_profit_net, "Investor net profit returned"],
      ["service-fee", operatingId, NoteLedgerDirection.CREDIT, settlement.service_fee_amount, "Service fee from investor profit"],
      ["tawidh", tawidhId, NoteLedgerDirection.CREDIT, settlement.tawidh_amount, "Ta'widh late charge"],
      ["gharamah", gharamahId, NoteLedgerDirection.CREDIT, settlement.gharamah_amount, "Gharamah late charge"]
    );

    for (const [key, accountId, direction, amount, description] of entries) {
      if (toNumber(amount) <= 0) continue;
      await tx.noteLedgerEntry.create({
        data: {
          note_id: settlement.note_id,
          account_id: accountId,
          settlement_id: settlement.id,
          payment_id: settlement.payment_id,
          direction,
          amount,
          description,
          idempotency_key: `settlement:${settlement.id}:${key}`,
          metadata: { actorUserId: actor.userId },
        },
      });
    }
  }
}

export const noteService = new NoteService();
