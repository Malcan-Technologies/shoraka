/**
 * SECTION: Database-backed Prospectus Review test support (local DB only)
 * WHY: Each test gets its own Note graph (unique ids per call) so Jest workers and the shared
 * demo seed (`seed_prospectus_demo_note_001`) never race; cleanup removes exactly that graph.
 *
 * API:
 *   seedIsolatedProspectusNote({ label, financialStatements, ctosFinancials }) → graph
 *   getProspectusTestActor() → admin ActorContext for service calls
 *   makeProspectusDraftApprovable(graph, actor) → lazy-creates the review and saves a complete draft
 *   approveProspectus(graph, actor) → prospectusReviewService.approve
 *   readProspectusReviewRow(graph) → note_prospectus_reviews row as stored
 *   countProspectusAuditEntries(graph, actionType) → admin-action + note-event counts
 *   writeProspectusNoteFinancialSnapshot(graph) → makes the Note snapshot-backed (no live read)
 *   cleanupIsolatedProspectusNote(graph) → deletes every row the graph created
 */

import { randomBytes } from "node:crypto";
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  NoteListingStatus,
  NoteStatus,
  OrganizationType,
  Prisma,
  ProductStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  NOTE_FINANCIAL_SNAPSHOT_VERSION,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  PROSPECTUS_REVIEW_REQUIRED_FROM,
  prospectusReviewService,
} from "./prospectus-review.service";

export type ProspectusTestActor = {
  userId: string;
  role: "ADMIN";
  portal: "ADMIN";
  ipAddress: string;
  userAgent: string;
  correlationId: string;
};

export type IsolatedProspectusNoteGraph = {
  runId: string;
  noteId: string;
  noteReference: string;
  organizationId: string;
  applicationId: string;
  contractId: string;
  invoiceId: string;
  ctosReportId: string;
  productId: string;
};

const FINANCING_AMOUNT = 850_000;
const PROFIT_RATE = 9.5;
const PAYMASTER = {
  name: "Demo Paymaster Trading Sdn Bhd",
  country: "MY",
  entity_type: "Private Limited Company (Sdn Bhd)",
};

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function graphIds(label: string): IsolatedProspectusNoteGraph {
  const runId = `${label}_${randomBytes(6).toString("hex")}`;
  const prefix = `dbtest_prospectus_${runId}`;
  return {
    runId,
    noteId: `${prefix}_note`,
    noteReference: `DBTEST-PROSPECTUS-${runId}`.toUpperCase(),
    organizationId: `${prefix}_org`,
    applicationId: `${prefix}_app`,
    contractId: `${prefix}_contract`,
    invoiceId: `${prefix}_invoice`,
    ctosReportId: `${prefix}_ctos`,
    productId: `${prefix}_product`,
  };
}

/** First local ADMIN user; the DB must be seeded (`prisma:seed`). Read-only. */
export async function getProspectusTestActor(): Promise<ProspectusTestActor> {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  if (!admin) {
    throw new Error("No ADMIN user found. Run `pnpm --filter @cashsouk/api prisma:seed` first.");
  }
  return {
    userId: admin.user_id,
    role: "ADMIN",
    portal: "ADMIN",
    ipAddress: "127.0.0.1",
    userAgent: "prospectus-review-db-test",
    correlationId: `prospectus-db-test-${Date.now()}`,
  };
}

/**
 * Create a DRAFT Note graph with its own issuer org, MARC assessment, application, CTOS report
 * and listing.
 * Financial inputs are passed in so callers choose the fixture (e.g. the demo seed builders).
 * The org owner is the local admin user (no user rows are written).
 */
export async function seedIsolatedProspectusNote(input: {
  label: string;
  financialStatements: Record<string, unknown>;
  ctosFinancials: unknown[];
}): Promise<IsolatedProspectusNoteGraph> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Prospectus DB test support is blocked in production");
  }
  const graph = graphIds(input.label);
  try {
    await insertIsolatedGraphRows(graph, input);
  } catch (error) {
    // A half-created graph must not leak rows into the shared local DB.
    await cleanupIsolatedProspectusNote(graph);
    throw error;
  }
  return graph;
}

async function insertIsolatedGraphRows(
  graph: IsolatedProspectusNoteGraph,
  input: { financialStatements: Record<string, unknown>; ctosFinancials: unknown[] }
): Promise<void> {
  const actor = await getProspectusTestActor();
  const now = new Date();
  const createdAt =
    now.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime()
      ? now
      : new Date(PROSPECTUS_REVIEW_REQUIRED_FROM.getTime() + 60_000);
  const maturityDate = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
  const maturityIso = maturityDate.toISOString().slice(0, 10);
  const productSnapshot = {
    product_id: graph.productId,
    product_name: "Account Receivable Financing",
    category: "invoice_financing",
    name: "Account Receivable Financing",
  };
  const contractDetails = {
    approved_facility: 2_000_000,
    financing: FINANCING_AMOUNT,
    value: FINANCING_AMOUNT,
    description: "civil engineering and infrastructure works",
  };
  const invoiceDetails = {
    number: `INV-${graph.noteReference}`,
    applied_financing: FINANCING_AMOUNT,
    maturity_date: maturityIso,
    due_date: maturityIso,
    value: FINANCING_AMOUNT,
    financing_ratio_percent: 80,
    invoice_value: FINANCING_AMOUNT,
  };
  const offerDetails = {
    offered_amount: FINANCING_AMOUNT,
    offered_profit_rate_percent: PROFIT_RATE,
    platform_fee_rate_percent: 1.5,
    risk_rating: "C",
  };
  const stub = {} as Prisma.InputJsonValue;

  await prisma.product.create({
    data: {
      id: graph.productId,
      status: ProductStatus.ACTIVE,
      version: 1,
      service_fee_rate_percent: money(15),
      marketplace_listing_duration_days: 14,
      workflow: [{ id: "financing_type_1", name: "Financing Type", config: productSnapshot }],
    },
  });
  await prisma.issuerOrganization.create({
    data: {
      id: graph.organizationId,
      owner_user_id: actor.userId,
      type: OrganizationType.COMPANY,
      name: "DB Test Prospectus Trading Sdn Bhd",
      registration_number: "202699990099",
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: now,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: { basicInfo: { industry: "Industrial Manufacturing" } },
    },
  });
  // Approval requires a complete org MARC assessment.
  await prisma.issuerOrganizationMarcAssessment.create({
    data: {
      issuer_organization_id: graph.organizationId,
      credit_grade: "SME-3",
      credit_score: new Prisma.Decimal("72.50"),
      probability_of_default: new Prisma.Decimal("1.1300"),
      report_file_name: "dbtest-marc-report.pdf",
      report_date: now,
      created_by_user_id: actor.userId,
    },
  });
  await prisma.contract.create({
    data: {
      id: graph.contractId,
      issuer_organization_id: graph.organizationId,
      status: ContractStatus.APPROVED,
      contract_details: contractDetails,
      customer_details: PAYMASTER,
    },
  });
  // Application-owned CTOS must be fetched no later than application submit.
  await prisma.ctosReport.create({
    data: {
      id: graph.ctosReportId,
      issuer_organization_id: graph.organizationId,
      subject_ref: null,
      fetched_at: new Date(now.getTime() - 1_000),
      financials_json: input.ctosFinancials as Prisma.InputJsonValue,
      summary_json: stub,
      legal_json: stub,
      ccris_json: stub,
      company_json: stub,
      raw_xml: "<dbtest/>",
    },
  });
  await prisma.application.create({
    data: {
      id: graph.applicationId,
      issuer_organization_id: graph.organizationId,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: now,
      financing_type: productSnapshot,
      contract_id: graph.contractId,
      financial_statements: input.financialStatements as Prisma.InputJsonValue,
    },
  });
  await prisma.invoice.create({
    data: {
      id: graph.invoiceId,
      application_id: graph.applicationId,
      contract_id: graph.contractId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails,
      offer_details: offerDetails,
    },
  });
  await prisma.note.create({
    data: {
      id: graph.noteId,
      source_application_id: graph.applicationId,
      source_contract_id: graph.contractId,
      source_invoice_id: graph.invoiceId,
      issuer_organization_id: graph.organizationId,
      status: NoteStatus.DRAFT,
      listing_status: NoteListingStatus.DRAFT,
      title: `Prospectus DB Test — ${graph.noteReference}`,
      note_reference: graph.noteReference,
      issuer_snapshot: { name: "DB Test Prospectus Trading Sdn Bhd", entity_type: PAYMASTER.entity_type },
      paymaster_snapshot: PAYMASTER,
      product_snapshot: productSnapshot,
      purpose_snapshot: { financing_for: contractDetails.description },
      contract_snapshot: {
        id: graph.contractId,
        status: ContractStatus.APPROVED,
        contract_details: contractDetails,
        customer_details: PAYMASTER,
      },
      invoice_snapshot: {
        id: graph.invoiceId,
        status: InvoiceStatus.APPROVED,
        details: invoiceDetails,
        offer_details: offerDetails,
      },
      requested_amount: money(FINANCING_AMOUNT),
      target_amount: money(FINANCING_AMOUNT),
      profit_rate_percent: money(PROFIT_RATE),
      platform_fee_rate_percent: money(1.5),
      service_fee_rate_percent: money(15),
      maturity_date: maturityDate,
      created_at: createdAt,
      listing: {
        create: {
          status: NoteListingStatus.DRAFT,
          opens_at: now,
          closes_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          visibility: "INVESTOR_MARKETPLACE",
        },
      },
      payment_schedules: {
        create: {
          sequence: 1,
          due_date: maturityDate,
          expected_principal: money(FINANCING_AMOUNT),
          expected_profit: money(FINANCING_AMOUNT * (PROFIT_RATE / 100)),
          expected_total: money(FINANCING_AMOUNT * (1 + PROFIT_RATE / 100)),
        },
      },
    },
  });
}

/** Lazy-create the review (GET path) and save the complete demo draft through the service. */
export async function makeProspectusDraftApprovable(
  graph: IsolatedProspectusNoteGraph,
  actor: ProspectusTestActor
): Promise<void> {
  const initial = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
  await prospectusReviewService.saveDraft(
    graph.noteId,
    { draftContent: buildCompleteProspectusReviewDraft(), expectedUpdatedAt: initial.review.updatedAt },
    actor
  );
}

export async function approveProspectus(
  graph: IsolatedProspectusNoteGraph,
  actor: ProspectusTestActor
) {
  return prospectusReviewService.approve(graph.noteId, actor);
}

export async function readProspectusReviewRow(graph: IsolatedProspectusNoteGraph) {
  return prisma.noteProspectusReview.findUniqueOrThrow({ where: { note_id: graph.noteId } });
}

/** Audit rows written by logProspectusAction (note_admin_actions + note_events) for one action. */
export async function countProspectusAuditEntries(
  graph: IsolatedProspectusNoteGraph,
  actionType: string
): Promise<{ adminActions: number; events: number }> {
  const [adminActions, events] = await Promise.all([
    prisma.noteAdminAction.count({ where: { note_id: graph.noteId, action_type: actionType } }),
    prisma.noteEvent.count({ where: { note_id: graph.noteId, event_type: actionType } }),
  ]);
  return { adminActions, events };
}

/**
 * Copy the graph's application financials and owned CTOS into notes.financial_snapshot, so the
 * Prospectus reads the Note snapshot and never the live application / CTOS rows.
 */
export async function writeProspectusNoteFinancialSnapshot(
  graph: IsolatedProspectusNoteGraph
): Promise<NoteFinancialSnapshot> {
  const [application, ctos] = await Promise.all([
    prisma.application.findUniqueOrThrow({
      where: { id: graph.applicationId },
      select: { financial_statements: true, submitted_at: true },
    }),
    prisma.ctosReport.findUniqueOrThrow({
      where: { id: graph.ctosReportId },
      select: { fetched_at: true, financials_json: true },
    }),
  ]);
  const submittedAt = (application.submitted_at ?? new Date()).toISOString();
  const snapshot: NoteFinancialSnapshot = {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    reference_date: submittedAt,
    financial_statements: application.financial_statements,
    ctos: {
      report_id: graph.ctosReportId,
      fetched_at: ctos.fetched_at.toISOString(),
      financials: ctos.financials_json,
    },
    source: {
      application_id: graph.applicationId,
      review_cycle: 1,
      application_submitted_at: submittedAt,
      financial_review: { status: "APPROVED", reviewed_at: submittedAt, reviewer_user_id: null },
    },
  };
  await prisma.note.update({
    where: { id: graph.noteId },
    data: { financial_snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });
  return snapshot;
}

/** Delete the graph; Note children (review, publications, audit, listing, schedule) cascade. */
export async function cleanupIsolatedProspectusNote(
  graph: IsolatedProspectusNoteGraph
): Promise<void> {
  await prisma.note.deleteMany({ where: { id: graph.noteId } });
  await prisma.ctosReport.deleteMany({ where: { id: graph.ctosReportId } });
  await prisma.issuerOrganizationFinancialStatement.deleteMany({
    where: { issuer_organization_id: graph.organizationId },
  });
  await prisma.invoice.deleteMany({ where: { id: graph.invoiceId } });
  await prisma.application.deleteMany({ where: { id: graph.applicationId } });
  await prisma.contract.deleteMany({ where: { id: graph.contractId } });
  await prisma.issuerOrganizationMarcAssessment.deleteMany({
    where: { issuer_organization_id: graph.organizationId },
  });
  await prisma.issuerOrganization.deleteMany({ where: { id: graph.organizationId } });
  await prisma.product.deleteMany({ where: { id: graph.productId } });
}
