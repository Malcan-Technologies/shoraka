#!/usr/bin/env tsx
/**
 * Local seed: applications of varied statuses for Ivan Issuers Sdn Bhd.
 *
 * IDs must be valid cuids — issuer GET /v1/applications/:id validates z.string().cuid().
 *
 * Usage:
 *   pnpm -C apps/api tsx scripts/seed-ivan-issuer-varied-statuses.ts
 */

import { createHash } from "node:crypto";
import { Prisma, PrismaClient, type ApplicationStatus, type ContractStatus, type InvoiceStatus } from "@prisma/client";
import {
  buildBusinessDetails,
  buildCompanyDetails,
  buildContractDetails,
  buildCustomerDetails,
  buildDeclarations,
  buildFinancialStatements,
  buildInvoiceDetails,
  buildReviewAndSubmit,
  buildSupportingDocuments,
  generateInvoiceDetailsList,
} from "./seed-application-helpers";

const prisma = new PrismaClient();

const ISSUER_EMAIL = "ivan.chew@malcan.io";
const ISSUER_ORG_NAME = "Ivan Issuers Sdn Bhd";
const PRODUCT_ID = "cmojlzg0g0001h6rsp3mlcyba";

/**
 * Deterministic cuid-shaped IDs (zod cuid + Prisma-compatible).
 * Hash keeps kind/key/index uniqueness after the 25-char cuid truncation.
 */
export function seedCuid(kind: string, key: string, index = 0): string {
  const digest = createHash("sha256")
    .update(`ivan|${kind}|${key}|${index}`)
    .digest("hex");
  return `c${digest.slice(0, 24)}`;
}

export const IVAN_COMPLETED_APP_ID = seedCuid("app", "completed");

type SeedSpec = {
  key: string;
  status: ApplicationStatus;
  structure: "invoice_only" | "new_contract";
  contractStatus?: ContractStatus;
  invoiceStatus?: InvoiceStatus;
  invoiceCount?: number;
  lastCompletedStep?: number;
  submitted?: boolean;
  daysAgo?: number;
  withOfferDetails?: boolean;
};

const SPECS: SeedSpec[] = [
  { key: "draft", status: "DRAFT", structure: "new_contract", contractStatus: "DRAFT", invoiceStatus: "DRAFT", invoiceCount: 1, lastCompletedStep: 3, daysAgo: 1 },
  { key: "submitted", status: "SUBMITTED", structure: "new_contract", contractStatus: "SUBMITTED", invoiceStatus: "SUBMITTED", invoiceCount: 2, submitted: true, daysAgo: 2 },
  { key: "under_review", status: "UNDER_REVIEW", structure: "invoice_only", contractStatus: "SUBMITTED", invoiceStatus: "SUBMITTED", invoiceCount: 2, submitted: true, daysAgo: 3 },
  { key: "amendment", status: "AMENDMENT_REQUESTED", structure: "new_contract", contractStatus: "AMENDMENT_REQUESTED", invoiceStatus: "AMENDMENT_REQUESTED", invoiceCount: 2, submitted: true, daysAgo: 4 },
  { key: "resubmitted", status: "RESUBMITTED", structure: "new_contract", contractStatus: "SUBMITTED", invoiceStatus: "SUBMITTED", invoiceCount: 2, submitted: true, daysAgo: 5 },
  { key: "offer_sent", status: "SUBMITTED", structure: "new_contract", contractStatus: "OFFER_SENT", invoiceStatus: "OFFER_SENT", invoiceCount: 2, submitted: true, daysAgo: 6, withOfferDetails: true },
  { key: "contract_pending", status: "CONTRACT_PENDING", structure: "new_contract", contractStatus: "APPROVED", invoiceStatus: "SUBMITTED", invoiceCount: 1, submitted: true, daysAgo: 7 },
  { key: "invoices_sent", status: "INVOICES_SENT", structure: "invoice_only", contractStatus: "SUBMITTED", invoiceStatus: "OFFER_SENT", invoiceCount: 3, submitted: true, daysAgo: 8, withOfferDetails: true },
  { key: "approved", status: "COMPLETED", structure: "new_contract", contractStatus: "APPROVED", invoiceStatus: "APPROVED", invoiceCount: 2, submitted: true, daysAgo: 10 },
  { key: "completed", status: "COMPLETED", structure: "invoice_only", contractStatus: "APPROVED", invoiceStatus: "APPROVED", invoiceCount: 2, submitted: true, daysAgo: 14 },
  { key: "withdrawn", status: "WITHDRAWN", structure: "new_contract", contractStatus: "WITHDRAWN", invoiceStatus: "WITHDRAWN", invoiceCount: 1, submitted: true, daysAgo: 12 },
  { key: "rejected", status: "REJECTED", structure: "new_contract", contractStatus: "REJECTED", invoiceStatus: "REJECTED", invoiceCount: 1, submitted: true, daysAgo: 15 },
  // ARCHIVED is listed but issuer GET /applications/:id currently blocks ARCHIVED — keep for list coverage only.
  { key: "archived", status: "ARCHIVED", structure: "invoice_only", contractStatus: "APPROVED", invoiceStatus: "APPROVED", invoiceCount: 1, submitted: true, daysAgo: 30 },
];

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildOfferDetails(amount: number): Prisma.InputJsonValue {
  return {
    offered_amount: amount,
    offered_profit_rate_percent: 10,
    platform_fee_rate_percent: 1,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function deleteLegacySeedApps(orgId: string) {
  const legacyApps = await prisma.application.findMany({
    where: {
      issuer_organization_id: orgId,
      OR: [
        { id: { startsWith: "seed_ivan_issuer_app_" } },
        { id: { in: SPECS.map((s) => seedCuid("app", s.key)) } },
      ],
    },
    select: { id: true },
  });
  const appIds = legacyApps.map((a) => a.id);
  if (appIds.length === 0) return;

  await prisma.noteInvestment.deleteMany({
    where: { note: { source_application_id: { in: appIds } } },
  });
  await prisma.notePaymentSchedule.deleteMany({
    where: { note: { source_application_id: { in: appIds } } },
  });
  await prisma.noteListing.deleteMany({
    where: { note: { source_application_id: { in: appIds } } },
  });
  await prisma.note.deleteMany({
    where: { source_application_id: { in: appIds } },
  });
  await prisma.invoice.deleteMany({ where: { application_id: { in: appIds } } });
  await prisma.application.deleteMany({ where: { id: { in: appIds } } });

  const legacyContracts = await prisma.contract.findMany({
    where: {
      issuer_organization_id: orgId,
      OR: [
        { id: { startsWith: "seed_ivan_issuer_contract_" } },
        { id: { in: SPECS.map((s) => seedCuid("con", s.key)) } },
      ],
    },
    select: { id: true },
  });
  const contractIds = legacyContracts.map((c) => c.id);
  if (contractIds.length > 0) {
    await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  }
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: ISSUER_EMAIL, mode: "insensitive" } },
    select: { user_id: true, email: true },
  });
  if (!user) {
    throw new Error(`User not found: ${ISSUER_EMAIL}`);
  }

  const org = await prisma.issuerOrganization.findFirst({
    where: {
      owner_user_id: user.user_id,
      name: { equals: ISSUER_ORG_NAME, mode: "insensitive" },
    },
  });
  if (!org) {
    throw new Error(`Issuer org not found for ${user.email}: ${ISSUER_ORG_NAME}`);
  }

  const product = await prisma.product.findUnique({ where: { id: PRODUCT_ID } });
  if (!product || product.status !== "ACTIVE") {
    throw new Error(`Active product not found: ${PRODUCT_ID}`);
  }

  console.log(`Seeding for ${user.email} / ${org.name} (${org.id})`);
  console.log(`Product: ${product.id} v${product.version}`);
  console.log("Cleaning previous Ivan issuer seed apps…");
  await deleteLegacySeedApps(org.id);

  const created: Array<{ key: string; applicationId: string; status: ApplicationStatus }> = [];

  for (const spec of SPECS) {
    const appId = seedCuid("app", spec.key);
    const contractId = seedCuid("con", spec.key);
    const createdAt = daysAgoDate(spec.daysAgo ?? 1);
    const submittedAt = spec.submitted ? createdAt : null;

    const contractDetailsBase =
      spec.structure === "new_contract" ? (buildContractDetails() as Record<string, unknown>) : null;
    if (contractDetailsBase && spec.withOfferDetails) {
      const financing = Number(contractDetailsBase.financing ?? contractDetailsBase.value ?? 50_000);
      contractDetailsBase.approved_facility = financing;
    }
    const contractDetails = (contractDetailsBase ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    const customerDetails = buildCustomerDetails() as Prisma.InputJsonValue;
    const contractOffer =
      spec.withOfferDetails && contractDetailsBase
        ? buildOfferDetails(Number(contractDetailsBase.financing ?? contractDetailsBase.value ?? 50_000))
        : Prisma.JsonNull;

    await prisma.contract.create({
      data: {
        id: contractId,
        issuer_organization_id: org.id,
        status: spec.contractStatus ?? "SUBMITTED",
        contract_details: contractDetails,
        customer_details: customerDetails,
        offer_details: contractOffer,
        created_at: createdAt,
      },
    });

    await prisma.application.create({
      data: {
        id: appId,
        issuer_organization_id: org.id,
        product_version: product.version,
        status: spec.status,
        submitted_at: submittedAt,
        created_at: createdAt,
        last_completed_step: spec.lastCompletedStep ?? 9,
        financing_type: { product_id: product.id } as Prisma.InputJsonValue,
        financing_structure: {
          structure_type: spec.structure,
          existing_contract_id: null,
        } as Prisma.InputJsonValue,
        contract_id: contractId,
        company_details: buildCompanyDetails(org.id) as Prisma.InputJsonValue,
        business_details: buildBusinessDetails() as Prisma.InputJsonValue,
        financial_statements: buildFinancialStatements() as Prisma.InputJsonValue,
        supporting_documents: buildSupportingDocuments() as Prisma.InputJsonValue,
        declarations: buildDeclarations() as Prisma.InputJsonValue,
        review_and_submit: buildReviewAndSubmit() as Prisma.InputJsonValue,
      },
    });

    const invoiceInputs = generateInvoiceDetailsList(spec.invoiceCount ?? 2);
    for (let i = 0; i < invoiceInputs.length; i++) {
      const invoiceId = seedCuid("inv", spec.key, i + 1);
      const details = buildInvoiceDetails(invoiceInputs[i]);
      const value = Number(details.value ?? 25_000);
      const financing = Math.round(value * (Number(details.financing_ratio_percent ?? 80) / 100));
      await prisma.invoice.create({
        data: {
          id: invoiceId,
          application_id: appId,
          contract_id: spec.structure === "new_contract" ? contractId : null,
          details: details as Prisma.InputJsonValue,
          offer_details: spec.withOfferDetails ? buildOfferDetails(financing) : Prisma.JsonNull,
          status: spec.invoiceStatus ?? "SUBMITTED",
          created_at: createdAt,
        },
      });
    }

    created.push({ key: spec.key, applicationId: appId, status: spec.status });
  }

  console.log("\nSeeded applications (cuid IDs):");
  for (const row of created) {
    console.log(`  ${row.status.padEnd(22)} ${row.applicationId}  (${row.key})`);
  }
  console.log(`\nTotal: ${created.length}`);
  console.log(`Completed app id (for notes seed): ${IVAN_COMPLETED_APP_ID}`);
}

const isDirectRun =
  typeof require !== "undefined" && require.main === module;

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
