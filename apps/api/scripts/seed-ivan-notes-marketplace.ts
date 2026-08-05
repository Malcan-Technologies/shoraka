#!/usr/bin/env tsx
/**
 * Local seed: marketplace-open + funded notes for Ivan Issuers / Ivan investor.
 *
 * - Marketplace notes: status PUBLISHED, listing PUBLISHED, funding OPEN
 * - Funded notes: status ACTIVE, listing CLOSED, funding FUNDED + CONFIRMED investment
 *   on Ivan's investor organization (also visible in investor portfolio)
 *
 * Usage:
 *   pnpm -C apps/api tsx scripts/seed-ivan-notes-marketplace.ts
 */

import {
  InvoiceStatus,
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  buildInvoiceDetails,
  generateInvoiceDetailsList,
} from "./seed-application-helpers";
import { IVAN_COMPLETED_APP_ID, seedCuid } from "./seed-ivan-issuer-varied-statuses";

const prisma = new PrismaClient();

const ISSUER_EMAIL = "ivan.chew@malcan.io";
const ISSUER_ORG_NAME = "Ivan Issuers Sdn Bhd";
const PRODUCT_ID = "cmojlzg0g0001h6rsp3mlcyba";
const SOURCE_APP_ID = IVAN_COMPLETED_APP_ID;

const PAYMASTER = {
  name: "Petronas Chemical Bhd",
  country: "MY",
  entity_type: "Private Limited Company (Sdn Bhd)",
  ssm_number: "201901234567",
  is_related_party: "no",
};

type MarketSpec = {
  key: string;
  reference: string;
  title: string;
  target: number;
  funded: number;
  profitRate: number;
  featured?: boolean;
  /** Also create a CONFIRMED investment from Ivan investor org (still marketplace-open). */
  investAmount?: number;
};

type FundedSpec = {
  key: string;
  reference: string;
  title: string;
  target: number;
  profitRate: number;
  investAmount: number;
  maturityDaysFromNow: number;
};

const MARKETPLACE_SPECS: MarketSpec[] = [
  {
    key: "mkt_open_a",
    reference: "NOTE-IVAN-MKT-A",
    title: "Ivan Issuers — Marketplace Note A (open)",
    target: 50_000,
    funded: 12_500,
    profitRate: 10,
    featured: true,
    investAmount: 5_000,
  },
  {
    key: "mkt_open_b",
    reference: "NOTE-IVAN-MKT-B",
    title: "Ivan Issuers — Marketplace Note B (open)",
    target: 75_000,
    funded: 0,
    profitRate: 11.5,
  },
  {
    key: "mkt_open_c",
    reference: "NOTE-IVAN-MKT-C",
    title: "Ivan Issuers — Marketplace Note C (partially funded)",
    target: 100_000,
    funded: 40_000,
    profitRate: 12,
    investAmount: 10_000,
  },
];

const FUNDED_SPECS: FundedSpec[] = [
  {
    key: "funded_a",
    reference: "NOTE-IVAN-FUNDED-A",
    title: "Ivan Issuers — Funded Note A (active)",
    target: 25_000,
    profitRate: 10,
    investAmount: 25_000,
    maturityDaysFromNow: 90,
  },
  {
    key: "funded_b",
    reference: "NOTE-IVAN-FUNDED-B",
    title: "Ivan Issuers — Funded Note B (active)",
    target: 40_000,
    profitRate: 11,
    investAmount: 40_000,
    maturityDaysFromNow: 120,
  },
  {
    key: "funded_c",
    reference: "NOTE-IVAN-FUNDED-C",
    title: "Ivan Issuers — Funded Note C (active)",
    target: 60_000,
    profitRate: 12.5,
    investAmount: 30_000,
    maturityDaysFromNow: 150,
  },
];

function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(6));
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function ensureInvoice(args: {
  invoiceId: string;
  applicationId: string;
  contractId: string | null;
  amount: number;
  maturity: Date;
}) {
  const [input] = generateInvoiceDetailsList(1);
  const details = buildInvoiceDetails({
    ...input,
    value: Math.round(args.amount * 1.25),
    financing_ratio_percent: 80,
    maturity_date: args.maturity.toISOString().slice(0, 10),
  });
  const offerDetails = {
    offered_amount: args.amount,
    offered_profit_rate_percent: 10,
    platform_fee_rate_percent: 0,
  };

  await prisma.invoice.upsert({
    where: { id: args.invoiceId },
    create: {
      id: args.invoiceId,
      application_id: args.applicationId,
      contract_id: args.contractId,
      details: details as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
      status: InvoiceStatus.APPROVED,
    },
    update: {
      application_id: args.applicationId,
      contract_id: args.contractId,
      details: details as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
      status: InvoiceStatus.APPROVED,
    },
  });

  return { details, offerDetails };
}

async function upsertInvestment(args: {
  investmentId: string;
  noteId: string;
  investorOrgId: string;
  investorUserId: string;
  amount: number;
  target: number;
  confirmed: boolean;
  committedAt: Date;
}) {
  const allocation = (args.amount / args.target) * 100;
  await prisma.noteInvestment.upsert({
    where: { id: args.investmentId },
    create: {
      id: args.investmentId,
      note_id: args.noteId,
      investor_organization_id: args.investorOrgId,
      investor_user_id: args.investorUserId,
      status: args.confirmed ? NoteInvestmentStatus.CONFIRMED : NoteInvestmentStatus.COMMITTED,
      amount: money(args.amount),
      allocation_percent: money(allocation),
      committed_at: args.committedAt,
      confirmed_at: args.confirmed ? args.committedAt : null,
    },
    update: {
      note_id: args.noteId,
      investor_organization_id: args.investorOrgId,
      investor_user_id: args.investorUserId,
      status: args.confirmed ? NoteInvestmentStatus.CONFIRMED : NoteInvestmentStatus.COMMITTED,
      amount: money(args.amount),
      allocation_percent: money(allocation),
      committed_at: args.committedAt,
      confirmed_at: args.confirmed ? args.committedAt : null,
    },
  });
}

async function upsertSchedule(args: {
  scheduleId: string;
  noteId: string;
  principal: number;
  profitRate: number;
  dueDate: Date;
}) {
  const profit = args.principal * (args.profitRate / 100);
  await prisma.notePaymentSchedule.upsert({
    where: { id: args.scheduleId },
    create: {
      id: args.scheduleId,
      note_id: args.noteId,
      status: "PENDING",
      sequence: 1,
      due_date: args.dueDate,
      expected_principal: money(args.principal),
      expected_profit: money(profit),
      expected_total: money(args.principal + profit),
    },
    update: {
      note_id: args.noteId,
      status: "PENDING",
      sequence: 1,
      due_date: args.dueDate,
      expected_principal: money(args.principal),
      expected_profit: money(profit),
      expected_total: money(args.principal + profit),
    },
  });
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: ISSUER_EMAIL, mode: "insensitive" } },
    select: { user_id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${ISSUER_EMAIL}`);

  const issuerOrg = await prisma.issuerOrganization.findFirst({
    where: {
      owner_user_id: user.user_id,
      name: { equals: ISSUER_ORG_NAME, mode: "insensitive" },
    },
  });
  if (!issuerOrg) throw new Error(`Issuer org not found: ${ISSUER_ORG_NAME}`);

  const investorOrg = await prisma.investorOrganization.findFirst({
    where: { owner_user_id: user.user_id },
    orderBy: { created_at: "asc" },
  });
  if (!investorOrg) throw new Error(`Investor org not found for ${user.email}`);

  const product = await prisma.product.findUnique({ where: { id: PRODUCT_ID } });
  if (!product || product.status !== "ACTIVE") {
    throw new Error(`Active product not found: ${PRODUCT_ID}`);
  }

  const sourceApp = await prisma.application.findUnique({
    where: { id: SOURCE_APP_ID },
    include: { contract: true },
  });
  if (!sourceApp) {
    throw new Error(
      `Source application ${SOURCE_APP_ID} missing. Run seed-ivan-issuer-varied-statuses.ts first.`
    );
  }

  // Ensure source app is COMPLETED so note lineage looks production-like.
  if (sourceApp.status !== "COMPLETED") {
    await prisma.application.update({
      where: { id: sourceApp.id },
      data: { status: "COMPLETED" },
    });
  }

  const issuerSnapshot = {
    id: issuerOrg.id,
    name: issuerOrg.name,
    type: issuerOrg.type,
  };
  const productSnapshot = {
    product_id: product.id,
    name: "Invoice Financing Test",
    category: "Invoice Financing",
  };

  const opensAt = daysAgo(2);
  const closesAt = daysFromNow(45);
  const publishedAt = opensAt;

  // Remove prior Ivan note seeds (legacy string IDs + current cuid IDs).
  const priorNoteRefs = [...MARKETPLACE_SPECS, ...FUNDED_SPECS].map((s) => s.reference);
  const priorNotes = await prisma.note.findMany({
    where: {
      OR: [
        { note_reference: { in: priorNoteRefs } },
        { id: { startsWith: "seed_ivan_note_" } },
      ],
    },
    select: { id: true },
  });
  const priorNoteIds = priorNotes.map((n) => n.id);
  if (priorNoteIds.length > 0) {
    await prisma.noteInvestment.deleteMany({ where: { note_id: { in: priorNoteIds } } });
    await prisma.notePaymentSchedule.deleteMany({ where: { note_id: { in: priorNoteIds } } });
    await prisma.noteListing.deleteMany({ where: { note_id: { in: priorNoteIds } } });
    await prisma.note.deleteMany({ where: { id: { in: priorNoteIds } } });
  }
  await prisma.invoice.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "seed_ivan_note_inv_" } },
        {
          id: {
            in: [...MARKETPLACE_SPECS, ...FUNDED_SPECS].map((s) => seedCuid("noteinv", s.key)),
          },
        },
      ],
    },
  });

  console.log(`Issuer:  ${issuerOrg.name} (${issuerOrg.id})`);
  console.log(`Investor: ${investorOrg.name} (${investorOrg.id})`);
  console.log(`User: ${user.email}`);

  const results: Array<{ kind: string; reference: string; noteId: string }> = [];

  for (const spec of MARKETPLACE_SPECS) {
    const noteId = seedCuid("note", spec.key);
    const invoiceId = seedCuid("noteinv", spec.key);
    const investmentId = seedCuid("noteinvst", spec.key);
    const maturity = daysFromNow(100);

    const { details, offerDetails } = await ensureInvoice({
      invoiceId,
      applicationId: sourceApp.id,
      contractId: sourceApp.contract_id,
      amount: spec.target,
      maturity,
    });

    await prisma.note.upsert({
      where: { note_reference: spec.reference },
      create: {
        id: noteId,
        source_application_id: sourceApp.id,
        source_contract_id: sourceApp.contract_id,
        source_invoice_id: invoiceId,
        issuer_organization_id: issuerOrg.id,
        status: NoteStatus.PUBLISHED,
        listing_status: NoteListingStatus.PUBLISHED,
        funding_status: NoteFundingStatus.OPEN,
        servicing_status: NoteServicingStatus.NOT_STARTED,
        title: spec.title,
        note_reference: spec.reference,
        product_snapshot: productSnapshot,
        issuer_snapshot: issuerSnapshot,
        paymaster_snapshot: PAYMASTER,
        contract_snapshot: sourceApp.contract
          ? {
              id: sourceApp.contract.id,
              status: sourceApp.contract.status,
              contract_details: sourceApp.contract.contract_details,
            }
          : Prisma.JsonNull,
        invoice_snapshot: {
          id: invoiceId,
          status: InvoiceStatus.APPROVED,
          details,
          offer_details: offerDetails,
        },
        requested_amount: money(spec.target),
        target_amount: money(spec.target),
        funded_amount: money(spec.funded),
        minimum_funding_percent: money(80),
        profit_rate_percent: money(spec.profitRate),
        platform_fee_rate_percent: money(0),
        service_fee_rate_percent: money(15),
        maturity_date: maturity,
        published_at: publishedAt,
        is_featured: Boolean(spec.featured),
        featured_rank: spec.featured ? 1 : null,
        featured_from: spec.featured ? opensAt : null,
        featured_until: spec.featured ? closesAt : null,
      },
      update: {
        source_application_id: sourceApp.id,
        source_contract_id: sourceApp.contract_id,
        source_invoice_id: invoiceId,
        issuer_organization_id: issuerOrg.id,
        status: NoteStatus.PUBLISHED,
        listing_status: NoteListingStatus.PUBLISHED,
        funding_status: NoteFundingStatus.OPEN,
        servicing_status: NoteServicingStatus.NOT_STARTED,
        title: spec.title,
        product_snapshot: productSnapshot,
        issuer_snapshot: issuerSnapshot,
        paymaster_snapshot: PAYMASTER,
        requested_amount: money(spec.target),
        target_amount: money(spec.target),
        funded_amount: money(spec.funded),
        profit_rate_percent: money(spec.profitRate),
        maturity_date: maturity,
        published_at: publishedAt,
        is_featured: Boolean(spec.featured),
        featured_rank: spec.featured ? 1 : null,
        featured_from: spec.featured ? opensAt : null,
        featured_until: spec.featured ? closesAt : null,
      },
    });

    await prisma.noteListing.upsert({
      where: { note_id: noteId },
      create: {
        note_id: noteId,
        status: NoteListingStatus.PUBLISHED,
        opens_at: opensAt,
        closes_at: closesAt,
        published_at: publishedAt,
        visibility: "INVESTOR_MARKETPLACE",
        summary: `${spec.title} — open for investment`,
      },
      update: {
        status: NoteListingStatus.PUBLISHED,
        opens_at: opensAt,
        closes_at: closesAt,
        published_at: publishedAt,
        visibility: "INVESTOR_MARKETPLACE",
        summary: `${spec.title} — open for investment`,
        unpublished_at: null,
      },
    });

    if (spec.investAmount && spec.investAmount > 0) {
      await upsertInvestment({
        investmentId,
        noteId,
        investorOrgId: investorOrg.id,
        investorUserId: user.user_id,
        amount: spec.investAmount,
        target: spec.target,
        confirmed: false,
        committedAt: daysAgo(1),
      });
    }

    results.push({ kind: "marketplace", reference: spec.reference, noteId });
  }

  for (const spec of FUNDED_SPECS) {
    const noteId = seedCuid("note", spec.key);
    const invoiceId = seedCuid("noteinv", spec.key);
    const investmentId = seedCuid("noteinvst", spec.key);
    const scheduleId = seedCuid("notesched", spec.key);
    const maturity = daysFromNow(spec.maturityDaysFromNow);
    const activatedAt = daysAgo(5);

    const { details, offerDetails } = await ensureInvoice({
      invoiceId,
      applicationId: sourceApp.id,
      contractId: sourceApp.contract_id,
      amount: spec.target,
      maturity,
    });

    await prisma.note.upsert({
      where: { note_reference: spec.reference },
      create: {
        id: noteId,
        source_application_id: sourceApp.id,
        source_contract_id: sourceApp.contract_id,
        source_invoice_id: invoiceId,
        issuer_organization_id: issuerOrg.id,
        status: NoteStatus.ACTIVE,
        listing_status: NoteListingStatus.CLOSED,
        funding_status: NoteFundingStatus.FUNDED,
        servicing_status: NoteServicingStatus.CURRENT,
        title: spec.title,
        note_reference: spec.reference,
        product_snapshot: productSnapshot,
        issuer_snapshot: issuerSnapshot,
        paymaster_snapshot: PAYMASTER,
        contract_snapshot: sourceApp.contract
          ? {
              id: sourceApp.contract.id,
              status: sourceApp.contract.status,
              contract_details: sourceApp.contract.contract_details,
            }
          : Prisma.JsonNull,
        invoice_snapshot: {
          id: invoiceId,
          status: InvoiceStatus.APPROVED,
          details,
          offer_details: offerDetails,
        },
        requested_amount: money(spec.target),
        target_amount: money(spec.target),
        funded_amount: money(spec.target),
        minimum_funding_percent: money(80),
        profit_rate_percent: money(spec.profitRate),
        platform_fee_rate_percent: money(0),
        service_fee_rate_percent: money(15),
        maturity_date: maturity,
        published_at: daysAgo(20),
        funding_closed_at: activatedAt,
        activated_at: activatedAt,
      },
      update: {
        source_application_id: sourceApp.id,
        source_contract_id: sourceApp.contract_id,
        source_invoice_id: invoiceId,
        issuer_organization_id: issuerOrg.id,
        status: NoteStatus.ACTIVE,
        listing_status: NoteListingStatus.CLOSED,
        funding_status: NoteFundingStatus.FUNDED,
        servicing_status: NoteServicingStatus.CURRENT,
        title: spec.title,
        product_snapshot: productSnapshot,
        issuer_snapshot: issuerSnapshot,
        paymaster_snapshot: PAYMASTER,
        requested_amount: money(spec.target),
        target_amount: money(spec.target),
        funded_amount: money(spec.target),
        profit_rate_percent: money(spec.profitRate),
        maturity_date: maturity,
        funding_closed_at: activatedAt,
        activated_at: activatedAt,
      },
    });

    await prisma.noteListing.upsert({
      where: { note_id: noteId },
      create: {
        note_id: noteId,
        status: NoteListingStatus.CLOSED,
        opens_at: daysAgo(25),
        closes_at: activatedAt,
        published_at: daysAgo(25),
        visibility: "INVESTOR_MARKETPLACE",
        summary: `${spec.title} — funding closed`,
      },
      update: {
        status: NoteListingStatus.CLOSED,
        opens_at: daysAgo(25),
        closes_at: activatedAt,
        published_at: daysAgo(25),
        visibility: "INVESTOR_MARKETPLACE",
      },
    });

    await upsertInvestment({
      investmentId,
      noteId,
      investorOrgId: investorOrg.id,
      investorUserId: user.user_id,
      amount: spec.investAmount,
      target: spec.target,
      confirmed: true,
      committedAt: activatedAt,
    });

    await upsertSchedule({
      scheduleId,
      noteId,
      principal: spec.target,
      profitRate: spec.profitRate,
      dueDate: maturity,
    });

    results.push({ kind: "funded", reference: spec.reference, noteId });
  }

  // Keep investor balance healthy for further marketplace commits.
  await prisma.investorBalance.upsert({
    where: { investor_organization_id: investorOrg.id },
    create: {
      investor_organization_id: investorOrg.id,
      available_amount: money(250_000),
    },
    update: {
      available_amount: money(250_000),
    },
  });

  console.log("\nSeeded notes:");
  for (const row of results) {
    console.log(`  [${row.kind.padEnd(11)}] ${row.reference}  ${row.noteId}`);
  }
  console.log(`\nInvestor org "${investorOrg.name}" balance set to RM 250,000`);
  console.log("Marketplace filter: PUBLISHED + listing PUBLISHED + funding OPEN");
  console.log("Portfolio: CONFIRMED/COMMITTED investments on investor org");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
