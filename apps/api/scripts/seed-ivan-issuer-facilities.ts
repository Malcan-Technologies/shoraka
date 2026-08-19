#!/usr/bin/env tsx
/**
 * Local seed: one APPROVED facility with invoices, plus facilities at
 * each approval stage, for Ivan Issuers Sdn Bhd.
 *
 * Structurally correct (unlike the invoice_only + dummy-contract fixtures):
 * - new_contract apps own the facility and link invoices.contract_id
 * - follow-on invoices use existing_contract against the APPROVED facility
 * - APPROVED facility has accepted offer terms + a COMPLETED signing envelope
 *
 * Usage:
 *   pnpm -C apps/api tsx scripts/seed-ivan-issuer-facilities.ts
 */

import { createHash } from "node:crypto";
import {
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
  PrismaClient,
  type ApplicationStatus,
  type ContractStatus,
} from "@prisma/client";
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
} from "./seed-application-helpers";

const prisma = new PrismaClient();

const ISSUER_EMAIL = "ivan.chew@malcan.io";
const ISSUER_ORG_NAME = "Ivan Issuers Sdn Bhd";
const PRODUCT_ID = "cmojlzg0g0001h6rsp3mlcyba";
const ADMIN_USER_ID = "AAAAA";
const ACTIVE_NOTE_REF = "NOTE-FAC-PETRONAS-001";

function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(6));
}

function seedCuid(kind: string, key: string, index = 0): string {
  const digest = createHash("sha256")
    .update(`ivan-fac|${kind}|${key}|${index}`)
    .digest("hex");
  return `c${digest.slice(0, 24)}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function customerDetails(name: string): Prisma.InputJsonValue {
  return {
    ...buildCustomerDetails(),
    name,
    is_large_private_company: false,
  } as Prisma.InputJsonValue;
}

function contractOfferDetails(input: {
  requested: number;
  offered: number;
  sentAt: string;
  respondedAt?: string | null;
  acceptanceStatus: "PENDING_ISSUER" | "COMPLETED" | "DECLINED";
  acceptanceExpiresAt: string;
}): Prisma.InputJsonValue {
  return {
    requested_facility: input.requested,
    offered_facility: input.offered,
    facility_fee_rate_percent: 1,
    sent_at: input.sentAt,
    responded_at: input.respondedAt ?? null,
    sent_by_user_id: ADMIN_USER_ID,
    responded_by_user_id: input.respondedAt ? ADMIN_USER_ID : null,
    version: 1,
    offer_acceptance: {
      status: input.acceptanceStatus,
      acceptance_expires_at: input.acceptanceExpiresAt,
      ...(input.acceptanceStatus === "COMPLETED"
        ? { submitted_at: input.respondedAt, reviewed_at: input.respondedAt }
        : {}),
    },
  };
}

function invoiceOfferDetails(input: {
  requestedAmount: number;
  offeredAmount: number;
  requestedRatio: number;
  offeredRatio: number;
  sentAt: string;
  respondedAt?: string | null;
  acceptanceStatus: "PENDING_ISSUER" | "COMPLETED";
}): Prisma.InputJsonValue {
  return {
    sent_at: input.sentAt,
    version: 1,
    risk_rating: "B",
    responded_at: input.respondedAt ?? null,
    offered_amount: input.offeredAmount,
    sent_by_user_id: ADMIN_USER_ID,
    requested_amount: input.requestedAmount,
    responded_by_user_id: input.respondedAt ? ADMIN_USER_ID : null,
    offered_ratio_percent: input.offeredRatio,
    requested_ratio_percent: input.requestedRatio,
    platform_fee_rate_percent: 1,
    offered_profit_rate_percent: 12,
    offer_acceptance: {
      status: input.acceptanceStatus,
      acceptance_expires_at: daysFromNow(14),
      ...(input.acceptanceStatus === "COMPLETED"
        ? { submitted_at: input.respondedAt, reviewed_at: input.respondedAt }
        : {}),
    },
  };
}

type FacilityStage = {
  key: string;
  title: string;
  customer: string;
  appStatus: ApplicationStatus;
  contractStatus: ContractStatus;
  daysAgo: number;
  requested: number;
  offered?: number;
  withOffer?: "pending" | "accepted" | "declined" | "expired";
};

const FACILITY_STAGES: FacilityStage[] = [
  {
    key: "approved",
    title: "Petronas Maintenance Facility",
    customer: "Petronas Chemicals Bhd",
    appStatus: "COMPLETED",
    contractStatus: "APPROVED",
    daysAgo: 21,
    requested: 500_000,
    offered: 400_000,
    withOffer: "accepted",
  },
  {
    key: "submitted",
    title: "TNB Supply Agreement",
    customer: "Tenaga Nasional Bhd",
    appStatus: "UNDER_REVIEW",
    contractStatus: "SUBMITTED",
    daysAgo: 4,
    requested: 320_000,
  },
  {
    key: "offer_sent",
    title: "Shell Logistics Facility",
    customer: "Shell Malaysia Trading Sdn Bhd",
    appStatus: "CONTRACT_SENT",
    contractStatus: "OFFER_SENT",
    daysAgo: 6,
    requested: 280_000,
    offered: 240_000,
    withOffer: "pending",
  },
  {
    key: "amendment",
    title: "Gamuda Civil Works",
    customer: "Gamuda Bhd",
    appStatus: "AMENDMENT_REQUESTED",
    contractStatus: "AMENDMENT_REQUESTED",
    daysAgo: 8,
    requested: 180_000,
  },
  {
    key: "offer_expired",
    title: "MMC Port Services",
    customer: "MMC Port Holdings Sdn Bhd",
    appStatus: "OFFER_EXPIRED",
    contractStatus: "OFFER_EXPIRED",
    daysAgo: 20,
    requested: 210_000,
    offered: 180_000,
    withOffer: "expired",
  },
  {
    key: "rejected",
    title: "IWK Water Treatment",
    customer: "Indah Water Konsortium Sdn Bhd",
    appStatus: "REJECTED",
    contractStatus: "REJECTED",
    daysAgo: 16,
    requested: 150_000,
    offered: 120_000,
    withOffer: "declined",
  },
  {
    key: "withdrawn",
    title: "PLUS Highway Works",
    customer: "PLUS Malaysia Bhd",
    appStatus: "WITHDRAWN",
    contractStatus: "WITHDRAWN",
    daysAgo: 12,
    requested: 200_000,
  },
];

const APPROVED_INVOICES = [
  { key: "approved", index: 1, number: "FAC-APPR-001", value: 100_000, ratio: 80, offered: 80_000, status: "APPROVED" as const },
  { key: "approved", index: 2, number: "FAC-APPR-002", value: 75_000, ratio: 80, offered: 60_000, status: "APPROVED" as const },
] as const;

const DRAWDOWN_INVOICES = [
  { key: "approved_drawdown", index: 1, number: "FAC-APPR-003", value: 50_000, ratio: 70, status: "SUBMITTED" as const },
  { key: "approved_drawdown", index: 2, number: "FAC-APPR-004", value: 35_000, ratio: 75, status: "SUBMITTED" as const },
  { key: "approved_drawdown", index: 3, number: "FAC-APPR-005", value: 40_000, ratio: 80, offered: 30_000, status: "OFFER_SENT" as const },
] as const;

const ALL_APP_KEYS = [...FACILITY_STAGES.map((s) => s.key), "approved_drawdown"];

async function deletePrevious(orgId: string) {
  const appIds = ALL_APP_KEYS.map((key) => seedCuid("app", key));
  const contractIds = FACILITY_STAGES.map((s) => seedCuid("con", s.key));

  const notes = await prisma.note.findMany({
    where: {
      OR: [
        { source_application_id: { in: appIds } },
        { source_contract_id: { in: contractIds } },
        { note_reference: ACTIVE_NOTE_REF },
      ],
    },
    select: { id: true },
  });
  const noteIds = notes.map((n) => n.id);
  if (noteIds.length > 0) {
    await prisma.noteInvestment.deleteMany({ where: { note_id: { in: noteIds } } });
    await prisma.notePaymentSchedule.deleteMany({ where: { note_id: { in: noteIds } } });
    await prisma.noteListing.deleteMany({ where: { note_id: { in: noteIds } } });
    await prisma.note.deleteMany({ where: { id: { in: noteIds } } });
  }

  await prisma.invoice.deleteMany({ where: { application_id: { in: appIds } } });
  await prisma.application.deleteMany({
    where: { id: { in: appIds }, issuer_organization_id: orgId },
  });
  await prisma.contract.deleteMany({
    where: { id: { in: contractIds }, issuer_organization_id: orgId },
  });
}

async function createApplicationShell(input: {
  appId: string;
  orgId: string;
  productVersion: number;
  status: ApplicationStatus;
  createdAt: Date;
  submitted: boolean;
  structureType: "new_contract" | "existing_contract";
  contractId: string;
}) {
  await prisma.application.create({
    data: {
      id: input.appId,
      issuer_organization_id: input.orgId,
      product_version: input.productVersion,
      status: input.status,
      submitted_at: input.submitted ? input.createdAt : null,
      created_at: input.createdAt,
      last_completed_step: 9,
      financing_type: { product_id: PRODUCT_ID } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: input.structureType,
        existing_contract_id: input.structureType === "existing_contract" ? input.contractId : null,
      } as Prisma.InputJsonValue,
      contract_id: input.contractId,
      company_details: buildCompanyDetails(input.orgId) as Prisma.InputJsonValue,
      business_details: buildBusinessDetails() as Prisma.InputJsonValue,
      financial_statements: buildFinancialStatements() as Prisma.InputJsonValue,
      supporting_documents: buildSupportingDocuments() as Prisma.InputJsonValue,
      declarations: buildDeclarations() as Prisma.InputJsonValue,
      review_and_submit: buildReviewAndSubmit() as Prisma.InputJsonValue,
    },
  });
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: ISSUER_EMAIL, mode: "insensitive" } },
    select: { user_id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${ISSUER_EMAIL}`);

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

  console.log(`Seeding facilities for ${user.email} / ${org.name}`);
  await deletePrevious(org.id);

  const approvedContractId = seedCuid("con", "approved");
  const approvedAppId = seedCuid("app", "approved");

  for (const stage of FACILITY_STAGES) {
    const appId = seedCuid("app", stage.key);
    const contractId = seedCuid("con", stage.key);
    const createdAt = daysAgo(stage.daysAgo);
    const sentAt = daysAgo(Math.max(1, stage.daysAgo - 2)).toISOString();
    const respondedAt = daysAgo(Math.max(1, stage.daysAgo - 4)).toISOString();
    const details = {
      ...buildContractDetails(),
      title: stage.title,
      value: stage.requested,
      financing: stage.requested,
      number: `CON-${stage.key.toUpperCase()}`,
    } as Record<string, unknown>;

    let offer: Prisma.InputJsonValue = Prisma.JsonNull;
    if (stage.withOffer && stage.offered != null) {
      const expired = stage.withOffer === "expired";
      offer = contractOfferDetails({
        requested: stage.requested,
        offered: stage.offered,
        sentAt,
        respondedAt:
          stage.withOffer === "accepted" || stage.withOffer === "declined" ? respondedAt : null,
        acceptanceStatus:
          stage.withOffer === "accepted"
            ? "COMPLETED"
            : stage.withOffer === "declined"
              ? "DECLINED"
              : "PENDING_ISSUER",
        acceptanceExpiresAt: expired ? daysAgo(2).toISOString() : daysFromNow(14),
      });
      if (stage.contractStatus === "APPROVED") {
        details.approved_facility = stage.offered;
        details.facility_fee_rate_percent = 1;
        details.facility_fee_paid_amount = 0;
      }
    }

    await prisma.contract.create({
      data: {
        id: contractId,
        issuer_organization_id: org.id,
        originating_application_id: null,
        status: stage.contractStatus,
        contract_details: details as Prisma.InputJsonValue,
        customer_details: customerDetails(stage.customer),
        offer_details: offer,
        created_at: createdAt,
      },
    });

    await createApplicationShell({
      appId,
      orgId: org.id,
      productVersion: product.version,
      status: stage.appStatus,
      createdAt,
      submitted: stage.appStatus !== "DRAFT",
      structureType: "new_contract",
      contractId,
    });

    await prisma.contract.update({
      where: { id: contractId },
      data: { originating_application_id: appId },
    });
  }

  const approvedSentAt = daysAgo(18).toISOString();
  const approvedRespondedAt = daysAgo(16).toISOString();

  for (const inv of APPROVED_INVOICES) {
    const details = buildInvoiceDetails({
      number: inv.number,
      value: inv.value,
      financing_ratio_percent: inv.ratio,
      maturity_date: daysFromNow(90).slice(0, 10),
    });
    await prisma.invoice.create({
      data: {
        id: seedCuid("inv", inv.key, inv.index),
        application_id: approvedAppId,
        contract_id: approvedContractId,
        details: details as Prisma.InputJsonValue,
        offer_details: invoiceOfferDetails({
          requestedAmount: Math.round((inv.value * inv.ratio) / 100),
          offeredAmount: inv.offered,
          requestedRatio: inv.ratio,
          offeredRatio: Math.round((inv.offered / inv.value) * 100),
          sentAt: approvedSentAt,
          respondedAt: approvedRespondedAt,
          acceptanceStatus: "COMPLETED",
        }),
        status: inv.status,
        created_at: daysAgo(18),
      },
    });
  }

  const drawdownAppId = seedCuid("app", "approved_drawdown");
  await createApplicationShell({
    appId: drawdownAppId,
    orgId: org.id,
    productVersion: product.version,
    status: "INVOICE_PENDING",
    createdAt: daysAgo(3),
    submitted: true,
    structureType: "existing_contract",
    contractId: approvedContractId,
  });

  for (const inv of DRAWDOWN_INVOICES) {
    const details = buildInvoiceDetails({
      number: inv.number,
      value: inv.value,
      financing_ratio_percent: inv.ratio,
      maturity_date: daysFromNow(120).slice(0, 10),
    });
    const requestedAmount = Math.round((inv.value * inv.ratio) / 100);
    const offer =
      inv.status === "OFFER_SENT" && "offered" in inv
        ? invoiceOfferDetails({
            requestedAmount,
            offeredAmount: inv.offered,
            requestedRatio: inv.ratio,
            offeredRatio: Math.round((inv.offered / inv.value) * 100),
            sentAt: daysAgo(1).toISOString(),
            acceptanceStatus: "PENDING_ISSUER",
          })
        : Prisma.JsonNull;
    await prisma.invoice.create({
      data: {
        id: seedCuid("inv", inv.key, inv.index),
        application_id: drawdownAppId,
        contract_id: approvedContractId,
        details: details as Prisma.InputJsonValue,
        offer_details: offer,
        status: inv.status,
        created_at: daysAgo(3),
      },
    });
  }

  const approvedInvoices = await prisma.invoice.findMany({
    where: { contract_id: approvedContractId },
    select: { status: true, details: true, offer_details: true },
  });
  const utilized = approvedInvoices
    .filter((row) => row.status === "APPROVED")
    .reduce((sum, row) => {
      const offered = (row.offer_details as { offered_amount?: number } | null)?.offered_amount;
      return sum + (typeof offered === "number" ? offered : 0);
    }, 0);
  const approvedFacility = 400_000;
  await prisma.contract.update({
    where: { id: approvedContractId },
    data: {
      contract_details: {
        ...((await prisma.contract.findUnique({
          where: { id: approvedContractId },
          select: { contract_details: true },
        }))?.contract_details as Record<string, unknown>),
        approved_facility: approvedFacility,
        utilized_facility: utilized,
        available_facility: approvedFacility - utilized,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.signingEnvelope.create({
    data: {
      id: seedCuid("env", "approved"),
      application_id: approvedAppId,
      contract_id: approvedContractId,
      product_version: product.version,
      title: "Petronas Maintenance Facility — signed package",
      status: "COMPLETED",
      created_by_user_id: ADMIN_USER_ID,
      sent_at: daysAgo(17),
      completed_at: daysAgo(16),
    },
  });

  const activeInvoiceId = seedCuid("inv", "approved", 1);
  const activeInvoice = await prisma.invoice.findUnique({
    where: { id: activeInvoiceId },
    select: { id: true, details: true, offer_details: true, status: true },
  });
  const contract = await prisma.contract.findUnique({
    where: { id: approvedContractId },
    select: { id: true, status: true, contract_details: true, customer_details: true },
  });
  if (!activeInvoice || !contract) {
    throw new Error("Approved facility invoice/contract missing after seed");
  }

  const investorOrg = await prisma.investorOrganization.findFirst({
    where: { owner_user_id: user.user_id },
    orderBy: { created_at: "asc" },
  });
  if (!investorOrg) {
    throw new Error(`Investor org not found for ${user.email}`);
  }

  const fundedAmount = 80_000;
  const profitRate = 12;
  const noteId = seedCuid("note", "approved_active");
  const activatedAt = daysAgo(5);
  const maturity = new Date(`${daysFromNow(90).slice(0, 10)}T00:00:00.000Z`);
  const paymaster = (contract.customer_details as { name?: string } | null) ?? {};

  await prisma.note.create({
    data: {
      id: noteId,
      source_application_id: approvedAppId,
      source_contract_id: approvedContractId,
      source_invoice_id: activeInvoice.id,
      issuer_organization_id: org.id,
      status: NoteStatus.ACTIVE,
      listing_status: NoteListingStatus.CLOSED,
      funding_status: NoteFundingStatus.FUNDED,
      servicing_status: NoteServicingStatus.CURRENT,
      title: "Petronas Maintenance — FAC-APPR-001",
      note_reference: ACTIVE_NOTE_REF,
      product_snapshot: {
        product_id: product.id,
        name: "Invoice Financing",
        category: "Invoice Financing",
      },
      issuer_snapshot: { id: org.id, name: org.name, type: org.type },
      paymaster_snapshot: {
        name: paymaster.name ?? "Petronas Chemicals Bhd",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
      contract_snapshot: {
        id: contract.id,
        status: contract.status,
        contract_details: contract.contract_details,
      },
      invoice_snapshot: {
        id: activeInvoice.id,
        status: activeInvoice.status,
        details: activeInvoice.details,
        offer_details: activeInvoice.offer_details,
      },
      requested_amount: money(fundedAmount),
      target_amount: money(fundedAmount),
      funded_amount: money(fundedAmount),
      minimum_funding_percent: money(80),
      profit_rate_percent: money(profitRate),
      platform_fee_rate_percent: money(1),
      service_fee_rate_percent: money(15),
      maturity_date: maturity,
      published_at: daysAgo(20),
      funding_closed_at: activatedAt,
      activated_at: activatedAt,
    },
  });

  await prisma.noteListing.create({
    data: {
      note_id: noteId,
      status: NoteListingStatus.CLOSED,
      opens_at: daysAgo(25),
      closes_at: activatedAt,
      published_at: daysAgo(25),
      visibility: "INVESTOR_MARKETPLACE",
      summary: "FAC-APPR-001 — fully funded and active",
    },
  });

  await prisma.noteInvestment.create({
    data: {
      id: seedCuid("noteinvst", "approved_active"),
      note_id: noteId,
      investor_organization_id: investorOrg.id,
      investor_user_id: user.user_id,
      status: NoteInvestmentStatus.CONFIRMED,
      amount: money(fundedAmount),
      allocation_percent: money(100),
      committed_at: activatedAt,
      confirmed_at: activatedAt,
    },
  });

  await prisma.notePaymentSchedule.create({
    data: {
      id: seedCuid("notesched", "approved_active"),
      note_id: noteId,
      status: "PENDING",
      sequence: 1,
      due_date: maturity,
      expected_principal: money(fundedAmount),
      expected_profit: money(fundedAmount * (profitRate / 100)),
      expected_total: money(fundedAmount * (1 + profitRate / 100)),
    },
  });

  console.log("\nSeeded facilities:");
  for (const stage of FACILITY_STAGES) {
    const extra =
      stage.key === "approved"
        ? `  invoices: 2 approved (FAC-APPR-001 is ACTIVE/FUNDED note ${ACTIVE_NOTE_REF}) + 2 submitted + 1 offer-sent`
        : "";
    console.log(
      `  ${stage.contractStatus.padEnd(22)} ${seedCuid("con", stage.key)}  ${stage.title}${extra}`
    );
  }
  console.log(`\nApproved facility: ${approvedContractId}`);
  console.log(`  utilized ${utilized} / approved ${approvedFacility} (available ${approvedFacility - utilized})`);
  console.log(`  active note: ${ACTIVE_NOTE_REF}  ${noteId}  invoice ${activeInvoiceId}  RM ${fundedAmount}`);
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
