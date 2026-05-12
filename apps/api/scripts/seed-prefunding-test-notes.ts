#!/usr/bin/env tsx
/**
 * Creates additional notes in DRAFT / prefunding shape (no listing, NOT_OPEN funding, 0 funded),
 * using the same snapshots and payment schedule pattern as NoteService.createFromInvoiceSource.
 *
 * Preferentially consumes approved invoices that do not already have a note. If fewer than the
 * requested count are available, clones the most recently updated note for the remainder (same
 * snapshots and amounts; source_invoice_id cleared so it does not collide with the unique invoice key).
 *
 * Usage (from repo root): pnpm --filter @cashsouk/api seed-prefunding-test-notes
 * Optional: SEED_PREFUNDING_NOTE_COUNT=5 (default 5, max 20)
 */
import { randomBytes } from "node:crypto";
import {
  InvoiceStatus,
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { resolveApprovedFacilityForRefresh } from "../src/lib/contract-facility";
import {
  resolveOfferedAmount,
  resolveOfferedProfitRate,
  resolveRequestedInvoiceAmount,
} from "../src/lib/invoice-offer";
import { resolveProductNameFromWorkflow } from "../src/modules/notes/mapper";

const prisma = new PrismaClient();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function firstSchedulePayload(note: {
  id: string;
  target_amount: Prisma.Decimal;
  profit_rate_percent: Prisma.Decimal | null;
  maturity_date: Date | null;
}) {
  const profit =
    note.profit_rate_percent != null
      ? note.target_amount.toNumber() * (note.profit_rate_percent.toNumber() / 100)
      : 0;
  return {
    note_id: note.id,
    sequence: 1,
    due_date: note.maturity_date ?? new Date(),
    expected_principal: note.target_amount,
    expected_profit: money(profit),
    expected_total: money(note.target_amount.toNumber() + profit),
  };
}

async function main() {
  const limitRaw = process.env.SEED_PREFUNDING_NOTE_COUNT;
  const limit = Math.min(20, Math.max(1, limitRaw ? Number(limitRaw) || 5 : 5));

  const adminUser = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  if (!adminUser) {
    throw new Error("No user with ADMIN role found; create an admin first (e.g. pnpm --filter @cashsouk/api create-admin).");
  }
  const actorUserId = adminUser.user_id;

  const attached = await prisma.note.findMany({
    where: { source_invoice_id: { not: null } },
    select: { source_invoice_id: true },
  });
  const usedInvoiceIds = attached.map((row) => row.source_invoice_id).filter((id): id is string => Boolean(id));

  const invoiceCandidateLimit = Math.min(200, Math.max(limit * 25, limit));
  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.APPROVED,
      ...(usedInvoiceIds.length > 0 ? { id: { notIn: usedInvoiceIds } } : {}),
    },
    take: invoiceCandidateLimit,
    orderBy: { created_at: "desc" },
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

  const dateCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let createdCount = 0;

  for (const invoice of invoices) {
    if (createdCount >= limit) break;

    const application = invoice.application;
    const sourceContract = invoice.contract ?? application.contract;

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
    const issuerIndustry = resolveIssuerIndustryFromCorporateData(
      application.issuer_organization.corporate_onboarding_data
    );
    const invoiceFaceValue = resolveRequestedInvoiceAmount(invoiceDetails);
    const targetAmount =
      resolveOfferedAmount(invoiceOffer) ||
      invoiceFaceValue ||
      resolveApprovedFacilityForRefresh(sourceContract?.status ?? "", contractDetails) ||
      toNumber(contractDetails.financing) ||
      toNumber(contractDetails.value);

    if (targetAmount <= 0) {
      console.warn(`Skip invoice ${invoice.id}: unresolved target amount`);
      continue;
    }

    const invoiceNumber = typeof invoiceDetails.number === "string" ? invoiceDetails.number : invoice.id.slice(-8);
    const reference = `NOTE-${dateCompact}-${invoice.id.slice(-8).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          source_application_id: application.id,
          source_contract_id: invoice.contract_id ?? application.contract_id,
          source_invoice_id: invoice.id,
          issuer_organization_id: application.issuer_organization_id,
          status: NoteStatus.DRAFT,
          listing_status: NoteListingStatus.NOT_LISTED,
          funding_status: NoteFundingStatus.NOT_OPEN,
          servicing_status: NoteServicingStatus.NOT_STARTED,
          funded_amount: money(0),
          published_at: null,
          title: `Note for invoice ${invoiceNumber} - ${application.issuer_organization.name ?? application.issuer_organization.id}`,
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
              actor_user_id: actorUserId,
              actor_role: UserRole.ADMIN,
              portal: "ADMIN",
              metadata: { applicationId: application.id, invoiceId: invoice.id },
            },
          },
          admin_actions: {
            create: {
              action_type: "CREATE_FROM_INVOICE",
              actor_user_id: actorUserId,
              after_state: { status: NoteStatus.DRAFT, invoiceId: invoice.id },
            },
          },
        },
      });

      await tx.notePaymentSchedule.create({
        data: firstSchedulePayload(created),
      });
    });

    console.log(`Created prefunding test note ${reference} for invoice ${invoice.id}`);
    createdCount += 1;
  }

  const remaining = limit - createdCount;
  if (remaining <= 0) return;

  const template = await prisma.note.findFirst({
    orderBy: { updated_at: "desc" },
  });

  if (!template) {
    console.log(
      `Created ${createdCount} note(s) from invoices; no existing note in DB to clone for ${remaining} more.`
    );
    return;
  }

  for (let i = 0; i < remaining; i += 1) {
    const reference = `NOTE-${dateCompact}-C${randomBytes(3).toString("hex").toUpperCase()}`;
    await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          source_application_id: template.source_application_id,
          source_contract_id: template.source_contract_id,
          source_invoice_id: null,
          issuer_organization_id: template.issuer_organization_id,
          status: NoteStatus.DRAFT,
          listing_status: NoteListingStatus.NOT_LISTED,
          funding_status: NoteFundingStatus.NOT_OPEN,
          servicing_status: NoteServicingStatus.NOT_STARTED,
          title: `${template.title} (test copy ${i + 1})`,
          note_reference: reference,
          product_snapshot: template.product_snapshot ?? undefined,
          requested_amount: template.requested_amount,
          target_amount: template.target_amount,
          funded_amount: money(0),
          minimum_funding_percent: template.minimum_funding_percent,
          profit_rate_percent: template.profit_rate_percent ?? undefined,
          platform_fee_rate_percent: template.platform_fee_rate_percent,
          service_fee_rate_percent: template.service_fee_rate_percent,
          service_fee_customer_scope: template.service_fee_customer_scope,
          issuer_snapshot: template.issuer_snapshot,
          paymaster_snapshot: template.paymaster_snapshot ?? undefined,
          contract_snapshot: template.contract_snapshot ?? undefined,
          invoice_snapshot: template.invoice_snapshot ?? undefined,
          is_featured: false,
          featured_rank: null,
          featured_from: null,
          featured_until: null,
          maturity_date: template.maturity_date,
          grace_period_days: template.grace_period_days,
          arrears_threshold_days: template.arrears_threshold_days,
          tawidh_rate_cap_percent: template.tawidh_rate_cap_percent,
          gharamah_rate_cap_percent: template.gharamah_rate_cap_percent,
          published_at: null,
          funding_closed_at: null,
          activated_at: null,
          repaid_at: null,
          arrears_started_at: null,
          default_marked_at: null,
          default_marked_by_admin_user_id: null,
          default_reason: null,
          metadata: template.metadata ?? undefined,
        },
      });

      await tx.notePaymentSchedule.create({
        data: firstSchedulePayload(created),
      });
    });

    console.log(`Created prefunding test note ${reference} (cloned from ${template.note_reference})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
