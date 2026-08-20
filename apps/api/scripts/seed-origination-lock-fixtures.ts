#!/usr/bin/env tsx
/**
 * Seed one realistic application per origination-lock manual case (B–E).
 * Re-run replaces the same rows. Happy path A and smoke F are not seeded.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed-origination-lock-fixtures
 *   pnpm --filter @cashsouk/api seed-origination-lock-fixtures [issuerOrgId] [facilityProductId] [invoiceOnlyProductId]
 */

import { createHash } from "node:crypto";
import "dotenv/config";
import {
  Prisma,
  PrismaClient,
  type ApplicationStatus,
  type ContractStatus,
  type InvoiceStatus,
  type ReviewSection,
  type ReviewStepStatus,
  type SigningEnvelopeStatus,
  type WithdrawReason,
} from "@prisma/client";
import {
  collectAcceptanceDocumentReviewKeys,
  computePhaseDeadlineExpiresAt,
  DEFAULT_ACCEPTANCE_DEADLINE,
  DEFAULT_SIGNING_DEADLINE,
  getReviewSectionOrder,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
  workflowHasSigningPackage,
  type OfferAcceptanceDetails,
  type ReviewSection as SharedReviewSection,
} from "@cashsouk/types";
import { allocateDisplayReference } from "../src/lib/display-reference";
import { parseGuarantorsFromBusinessDetails } from "../src/modules/guarantors/utils";
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
const DEFAULT_ISSUER_EMAIL = "khai.kit@truestack.my";
const DEFAULT_ISSUER_ORG_NAME = "Toyota";
const SEED_KIND = "origlock";

function seedCuid(kind: string, key: string, index = 0): string {
  const digest = createHash("sha256")
    .update(`${SEED_KIND}|${kind}|${key}|${index}`)
    .digest("hex");
  return `c${digest.slice(0, 24)}`;
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function productHasFacilityCeremony(workflow: unknown): boolean {
  return workflowHasAcceptanceDocuments(workflow) && workflowHasSigningPackage(workflow);
}

function buildPaymasterDetails(): Record<string, unknown> {
  return {
    ...buildCustomerDetails(),
    is_large_private_company: false,
    is_related_party: "no",
  };
}

function buildFacilityOffer(
  requested: number,
  offered: number,
  acceptance: OfferAcceptanceDetails
): Prisma.InputJsonValue {
  return {
    requested_facility: requested,
    offered_facility: offered,
    facility_fee_rate_percent: 1,
    sent_at: new Date().toISOString(),
    responded_at: null,
    sent_by_user_id: null,
    responded_by_user_id: null,
    version: 1,
    offer_acceptance: acceptance,
  };
}

function buildInvoiceOffer(
  details: Record<string, unknown>,
  acceptance: OfferAcceptanceDetails | null
): Prisma.InputJsonValue {
  const value = Number(details.value ?? 25_000);
  const ratio = Number(details.financing_ratio_percent ?? 80);
  const requested = Math.round((value * ratio) / 100);
  return {
    requested_amount: requested,
    offered_amount: requested,
    requested_ratio_percent: ratio,
    offered_ratio_percent: ratio,
    offered_profit_rate_percent: 10,
    platform_fee_rate_percent: 1,
    risk_rating: "B",
    sent_at: new Date().toISOString(),
    responded_at: null,
    sent_by_user_id: null,
    responded_by_user_id: null,
    version: 1,
    ...(acceptance ? { offer_acceptance: acceptance } : {}),
  };
}

function pendingIssuerAcceptance(): OfferAcceptanceDetails {
  return {
    status: "PENDING_ISSUER",
    acceptance_expires_at: computePhaseDeadlineExpiresAt(
      new Date().toISOString(),
      DEFAULT_ACCEPTANCE_DEADLINE.days
    ),
  };
}

function signingAcceptance(
  status: "APPROVED_FOR_SIGNING" | "SIGNING_IN_PROGRESS"
): OfferAcceptanceDetails {
  const now = new Date().toISOString();
  return {
    status,
    submitted_at: isoDaysFromNow(-2),
    reviewed_at: isoDaysFromNow(-1),
    acceptance_expires_at: computePhaseDeadlineExpiresAt(now, DEFAULT_ACCEPTANCE_DEADLINE.days),
    signing_expires_at: computePhaseDeadlineExpiresAt(now, DEFAULT_SIGNING_DEADLINE.days),
  };
}

function declinedAcceptance(): OfferAcceptanceDetails {
  return {
    status: "REJECTED",
    submitted_at: isoDaysFromNow(-3),
    reviewed_at: isoDaysFromNow(-1),
    acceptance_expires_at: computePhaseDeadlineExpiresAt(
      isoDaysFromNow(-10),
      DEFAULT_ACCEPTANCE_DEADLINE.days
    ),
  };
}

function expiredAcceptance(): OfferAcceptanceDetails {
  return {
    status: "PENDING_ISSUER",
    acceptance_expires_at: "2000-01-01T16:00:00.000Z",
  };
}

function buildAcceptancePayload(workflow: unknown): Record<string, unknown> {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  const documents =
    rows.length > 0
      ? rows.map((row) => ({
          title: row.name || `Acceptance document ${row.index + 1}`,
          workflow_document_index: row.index,
          file: {
            file_name: `${(row.name || "acceptance").replace(/\s+/g, "-").toLowerCase()}.pdf`,
            file_size: 24_000,
            s3_key: `applications/seed/origlock/acceptance-${row.index}.pdf`,
            uploaded_at: new Date().toISOString(),
          },
        }))
      : [
          {
            title: "Board Resolution",
            workflow_document_index: 0,
            file: {
              file_name: "board-resolution.pdf",
              file_size: 24_000,
              s3_key: "applications/seed/origlock/acceptance-0.pdf",
              uploaded_at: new Date().toISOString(),
            },
          },
        ];
  return { documents };
}

type ReviewPreset =
  | "none"
  | "allPending"
  | "financialApproved"
  | "financialRejected"
  | "allApproved"
  | "offerLive"
  | "signingReady"
  | "approvedWithRejectedSection";

function reviewStatuses(
  structure: "new_contract" | "invoice_only",
  preset: ReviewPreset
): Array<{ section: ReviewSection; status: ReviewStepStatus }> {
  if (preset === "none") return [];
  const sections = getReviewSectionOrder(structure) as ReviewSection[];
  return sections.map((section) => {
    if (preset === "allPending") return { section, status: "PENDING" as const };
    if (preset === "allApproved") return { section, status: "APPROVED" as const };
    if (preset === "financialApproved") {
      return { section, status: section === "financial" ? "APPROVED" : "PENDING" };
    }
    if (preset === "financialRejected") {
      return { section, status: section === "financial" ? "REJECTED" : "PENDING" };
    }
    if (preset === "offerLive") {
      if (section === "contract_details" && structure === "new_contract") {
        return { section, status: "OFFER_SENT" as const };
      }
      if (section === "invoice_details" && structure === "invoice_only") {
        return { section, status: "OFFER_SENT" as const };
      }
      if (
        section === "financial" ||
        section === "company_details" ||
        section === "business_details" ||
        section === "supporting_documents" ||
        section === "contract_details"
      ) {
        return { section, status: "APPROVED" as const };
      }
      return { section, status: "PENDING" as const };
    }
    if (preset === "signingReady") {
      if (section === "invoice_details") return { section, status: "PENDING" as const };
      return { section, status: "APPROVED" as const };
    }
    if (preset === "approvedWithRejectedSection") {
      if (section === "financial") return { section, status: "REJECTED" as const };
      return { section, status: "APPROVED" as const };
    }
    return { section, status: "PENDING" as const };
  });
}

type FixtureSpec = {
  key: string;
  cases: string;
  what: string;
  structure: "new_contract" | "invoice_only";
  appStatus: ApplicationStatus;
  contractStatus: ContractStatus;
  invoiceStatuses: InvoiceStatus[];
  invoiceWithdrawReason?: WithdrawReason;
  contractWithdrawReason?: WithdrawReason;
  productVersionOffset?: number;
  lastCompletedStep?: number;
  reviews: ReviewPreset;
  offerOn?: "contract" | "invoices";
  acceptance?: OfferAcceptanceDetails;
  envelope?: SigningEnvelopeStatus;
  withAcceptanceDocs?: boolean;
  sectionRemark?: SharedReviewSection;
};

const FIXTURES: FixtureSpec[] = [
  {
    key: "B1",
    cases: "B1",
    what: "Draft — delete, no Withdraw",
    structure: "new_contract",
    appStatus: "DRAFT",
    contractStatus: "DRAFT",
    invoiceStatuses: [],
    lastCompletedStep: 4,
    reviews: "none",
  },
  {
    key: "B2",
    cases: "B2, E2 (submitted)",
    what: "Submitted, under review unopened",
    structure: "new_contract",
    appStatus: "SUBMITTED",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "allPending",
  },
  {
    key: "B3",
    cases: "B3, C2, D3, E2 (offer sent)",
    what: "Facility offer live, PENDING_ISSUER",
    structure: "new_contract",
    appStatus: "CONTRACT_SENT",
    contractStatus: "OFFER_SENT",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "offerLive",
    offerOn: "contract",
    acceptance: pendingIssuerAcceptance(),
  },
  {
    key: "B4",
    cases: "B4, C5, D4",
    what: "Signing in progress, envelope SENT",
    structure: "new_contract",
    appStatus: "SIGNING_PENDING",
    contractStatus: "OFFER_SENT",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "signingReady",
    offerOn: "contract",
    acceptance: signingAcceptance("SIGNING_IN_PROGRESS"),
    envelope: "SENT",
    withAcceptanceDocs: true,
  },
  {
    key: "B5",
    cases: "B5",
    what: "Facility approved, leftover invoices",
    structure: "new_contract",
    appStatus: "INVOICE_PENDING",
    contractStatus: "APPROVED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "signingReady",
    offerOn: "contract",
    acceptance: { status: "COMPLETED", submitted_at: isoDaysFromNow(-5) },
    envelope: "COMPLETED",
    withAcceptanceDocs: true,
  },
  {
    key: "B6",
    cases: "B6, E3 (completed)",
    what: "Completed with approved invoices",
    structure: "new_contract",
    appStatus: "COMPLETED",
    contractStatus: "APPROVED",
    invoiceStatuses: ["APPROVED", "APPROVED"],
    reviews: "allApproved",
    offerOn: "contract",
    acceptance: { status: "COMPLETED", submitted_at: isoDaysFromNow(-8) },
    envelope: "COMPLETED",
    withAcceptanceDocs: true,
  },
  {
    key: "B7",
    cases: "B7",
    what: "Invoice-only, three live invoices",
    structure: "invoice_only",
    appStatus: "INVOICES_SENT",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["OFFER_SENT", "OFFER_SENT", "SUBMITTED"],
    reviews: "offerLive",
    offerOn: "invoices",
    acceptance: pendingIssuerAcceptance(),
  },
  {
    key: "B8",
    cases: "B8",
    what: "Invoice-only, last withdrawable invoice",
    structure: "invoice_only",
    appStatus: "INVOICE_PENDING",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["WITHDRAWN", "SUBMITTED"],
    invoiceWithdrawReason: "USER_CANCELLED",
    reviews: "allPending",
  },
  {
    key: "C1",
    cases: "C1",
    what: "Underwriting, financial already approved",
    structure: "new_contract",
    appStatus: "UNDER_REVIEW",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "financialApproved",
  },
  {
    key: "C3",
    cases: "C3",
    what: "Declined offer still on an open file",
    structure: "new_contract",
    appStatus: "CONTRACT_SENT",
    contractStatus: "WITHDRAWN",
    contractWithdrawReason: "OFFER_REJECTED",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "offerLive",
    offerOn: "contract",
    acceptance: declinedAcceptance(),
    withAcceptanceDocs: true,
  },
  {
    key: "C4",
    cases: "C4",
    what: "Approved for signing, envelope DRAFT",
    structure: "new_contract",
    appStatus: "SIGNING_PENDING",
    contractStatus: "OFFER_SENT",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "signingReady",
    offerOn: "contract",
    acceptance: signingAcceptance("APPROVED_FOR_SIGNING"),
    envelope: "DRAFT",
    withAcceptanceDocs: true,
  },
  {
    key: "C6",
    cases: "C6",
    what: "Envelope completed / approved, no reject section",
    structure: "new_contract",
    appStatus: "INVOICE_PENDING",
    contractStatus: "APPROVED",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "allApproved",
    offerOn: "contract",
    acceptance: { status: "COMPLETED", submitted_at: isoDaysFromNow(-4) },
    envelope: "COMPLETED",
    withAcceptanceDocs: true,
  },
  {
    key: "D1",
    cases: "D1",
    what: "Financial section rejected, contract still SUBMITTED",
    structure: "new_contract",
    appStatus: "UNDER_REVIEW",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "financialRejected",
    sectionRemark: "financial",
  },
  {
    key: "D2",
    cases: "D2",
    what: "Ready for application Reject (section already rejected)",
    structure: "new_contract",
    appStatus: "UNDER_REVIEW",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "financialRejected",
    sectionRemark: "financial",
  },
  {
    key: "D5",
    cases: "D5",
    what: "Booked + a rejected section (Reject must stay disabled)",
    structure: "new_contract",
    appStatus: "INVOICE_PENDING",
    contractStatus: "APPROVED",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "approvedWithRejectedSection",
    offerOn: "contract",
    acceptance: { status: "COMPLETED", submitted_at: isoDaysFromNow(-3) },
    envelope: "COMPLETED",
    withAcceptanceDocs: true,
    sectionRemark: "financial",
  },
  {
    key: "D6",
    cases: "D6",
    what: "All sections approved, none rejected",
    structure: "new_contract",
    appStatus: "CONTRACT_PENDING",
    contractStatus: "SUBMITTED",
    invoiceStatuses: ["SUBMITTED", "SUBMITTED"],
    reviews: "allApproved",
  },
  {
    key: "E1",
    cases: "E1",
    what: "Draft on a stale product version",
    structure: "new_contract",
    appStatus: "DRAFT",
    contractStatus: "DRAFT",
    invoiceStatuses: ["DRAFT"],
    productVersionOffset: -1,
    lastCompletedStep: 5,
    reviews: "none",
  },
  {
    key: "E3R",
    cases: "E3 (rejected)",
    what: "Already rejected / closed",
    structure: "new_contract",
    appStatus: "REJECTED",
    contractStatus: "REJECTED",
    invoiceStatuses: ["REJECTED"],
    reviews: "financialRejected",
  },
  {
    key: "E4",
    cases: "E4",
    what: "Offer expired, terms still on the file",
    structure: "new_contract",
    appStatus: "OFFER_EXPIRED",
    contractStatus: "OFFER_EXPIRED",
    invoiceStatuses: ["SUBMITTED"],
    reviews: "offerLive",
    offerOn: "contract",
    acceptance: expiredAcceptance(),
  },
  {
    key: "E5",
    cases: "E5",
    what: "Completed, facility approved, no approved invoices",
    structure: "new_contract",
    appStatus: "COMPLETED",
    contractStatus: "APPROVED",
    invoiceStatuses: ["REJECTED", "WITHDRAWN"],
    invoiceWithdrawReason: "USER_CANCELLED",
    reviews: "allApproved",
    offerOn: "contract",
    acceptance: { status: "COMPLETED", submitted_at: isoDaysFromNow(-6) },
    envelope: "COMPLETED",
    withAcceptanceDocs: true,
  },
];

async function resolveContext() {
  const [orgArg, facilityProductArg, invoiceProductArg] = process.argv.slice(2);

  let org =
    orgArg != null
      ? await prisma.issuerOrganization.findUnique({ where: { id: orgArg } })
      : null;
  if (!org) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: DEFAULT_ISSUER_EMAIL, mode: "insensitive" } },
      select: { user_id: true },
    });
    if (user) {
      org = await prisma.issuerOrganization.findFirst({
        where: {
          owner_user_id: user.user_id,
          name: { equals: DEFAULT_ISSUER_ORG_NAME, mode: "insensitive" },
        },
      });
    }
  }
  if (!org) {
    org = await prisma.issuerOrganization.findFirst({
      where: { name: { contains: "Toyota", mode: "insensitive" } },
    });
  }
  if (!org) {
    org = await prisma.issuerOrganization.findFirst({ orderBy: { created_at: "asc" } });
    if (org) {
      console.warn(
        `Toyota issuer org not found; using ${org.name} (${org.id}). Pass issuerOrgId to target a specific org.`
      );
    }
  }
  if (!org) {
    throw new Error("No issuer organization found. Pass issuerOrgId as the first argument.");
  }

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", deleted_at: null },
    orderBy: { updated_at: "desc" },
  });
  if (products.length === 0) {
    throw new Error("No ACTIVE products found.");
  }

  const scored = [...products].sort((a, b) => {
    const score = (p: (typeof products)[number]) =>
      (productHasFacilityCeremony(p.workflow) ? 4 : 0) + (p.product_code ? 1 : 0);
    return score(b) - score(a);
  });

  const facilityProduct = facilityProductArg
    ? products.find((p) => p.id === facilityProductArg)
    : scored[0];
  const invoiceProduct = invoiceProductArg
    ? products.find((p) => p.id === invoiceProductArg)
    : facilityProduct;

  if (!facilityProduct) throw new Error(`Facility product not found: ${facilityProductArg}`);
  if (!invoiceProduct) throw new Error(`Invoice-only product not found: ${invoiceProductArg}`);

  const reviewer =
    (await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" } },
      select: { user_id: true },
    })) ?? (await prisma.user.findUnique({ where: { user_id: org.owner_user_id }, select: { user_id: true } }));

  return { org, facilityProduct, invoiceProduct, reviewerUserId: reviewer?.user_id ?? org.owner_user_id };
}

async function deletePrevious() {
  const appIds = FIXTURES.map((spec) => seedCuid("app", spec.key));
  const contractIds = FIXTURES.map((spec) => seedCuid("con", spec.key));
  const invoiceIds = FIXTURES.flatMap((spec) =>
    spec.invoiceStatuses.map((_, index) => seedCuid("inv", spec.key, index + 1))
  );

  const noteWhere = {
    OR: [{ source_application_id: { in: appIds } }, { source_contract_id: { in: contractIds } }],
  };
  await prisma.noteInvestment.deleteMany({ where: { note: noteWhere } });
  await prisma.notePaymentSchedule.deleteMany({ where: { note: noteWhere } });
  await prisma.noteListing.deleteMany({ where: { note: noteWhere } });
  await prisma.note.deleteMany({ where: noteWhere });
  await prisma.application.deleteMany({ where: { id: { in: appIds } } });
  await prisma.application.updateMany({
    where: { contract_id: { in: contractIds } },
    data: { contract_id: null },
  });
  await prisma.invoice.updateMany({
    where: { contract_id: { in: contractIds } },
    data: { contract_id: null },
  });
  await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  await prisma.displayReferenceAllocation.deleteMany({
    where: {
      OR: [
        { entity_type: "application", entity_id: { in: appIds } },
        { entity_type: "contract", entity_id: { in: contractIds } },
        { entity_type: "invoice", entity_id: { in: invoiceIds } },
      ],
    },
  });
}

async function maybeAllocate(
  moduleCode: "APP" | "CON" | "INV",
  productCode: string | null,
  entityType: "application" | "contract" | "invoice",
  entityId: string
) {
  if (!productCode) return null;
  try {
    return await allocateDisplayReference(
      {
        moduleCode,
        productCode,
        referenceDate: new Date(),
        entityType,
        entityId,
        prisma,
      },
      async (tx, reference) => {
        if (entityType === "application") {
          await tx.application.update({ where: { id: entityId }, data: { display_reference: reference } });
        } else if (entityType === "contract") {
          await tx.contract.update({ where: { id: entityId }, data: { display_reference: reference } });
        } else {
          await tx.invoice.update({ where: { id: entityId }, data: { display_reference: reference } });
        }
      }
    );
  } catch (error) {
    console.warn(`Display reference skipped for ${entityType} ${entityId}:`, error);
    return null;
  }
}

async function createEnvelope(params: {
  applicationId: string;
  contractId: string;
  status: SigningEnvelopeStatus;
  productVersion: number;
  reviewerUserId: string;
}) {
  const envelopeId = seedCuid("env", params.applicationId);
  const now = new Date();
  const envelope = await prisma.signingEnvelope.create({
    data: {
      id: envelopeId,
      application_id: params.applicationId,
      contract_id: params.contractId,
      product_version: params.productVersion,
      title: "Letter of Offer",
      status: params.status,
      created_by_user_id: params.reviewerUserId,
      provider: "signingcloud",
      sent_at: params.status === "DRAFT" ? null : now,
      completed_at: params.status === "COMPLETED" ? now : null,
    },
  });
  const document = await prisma.signingDocument.create({
    data: {
      envelope_id: envelope.id,
      name: "Letter of Offer",
      source: "GENERATED_OFFER_LETTER",
      order: 0,
      unsigned_s3_key: "applications/seed/origlock/letter-of-offer.pdf",
      status: params.status === "COMPLETED" ? "COMPLETED" : params.status === "DRAFT" ? "DRAFT" : "PENDING",
    },
  });
  const recipient = await prisma.signingRecipient.create({
    data: {
      envelope_id: envelope.id,
      role_key: "issuer_director",
      role_label: "Issuer director",
      name: "Ahmad Hassan",
      email: "ahmad.hassan@example.com",
      ic_number: "850315101234",
      routing_order: 0,
      status: params.status === "COMPLETED" ? "SIGNED" : params.status === "DRAFT" ? "PENDING" : "SENT",
      sent_at: params.status === "DRAFT" ? null : now,
      completed_at: params.status === "COMPLETED" ? now : null,
    },
  });
  await prisma.signingAssignment.create({
    data: {
      envelope_id: envelope.id,
      document_id: document.id,
      recipient_id: recipient.id,
      status: params.status === "COMPLETED" ? "SIGNED" : "PENDING",
      signed_at: params.status === "COMPLETED" ? now : null,
    },
  });
}

type CreatedRow = {
  key: string;
  cases: string;
  what: string;
  applicationId: string;
  displayReference: string | null;
  productId: string;
  invoiceIds: string[];
};

async function createFixture(
  spec: FixtureSpec,
  ctx: Awaited<ReturnType<typeof resolveContext>>
): Promise<CreatedRow> {
  const product = spec.structure === "invoice_only" ? ctx.invoiceProduct : ctx.facilityProduct;
  const workflow = product.workflow;
  const appId = seedCuid("app", spec.key);
  const contractId = seedCuid("con", spec.key);
  const now = new Date();
  const submitted = spec.appStatus !== "DRAFT";
  const productVersion = Math.max(0, product.version + (spec.productVersionOffset ?? 0));
  const productCode =
    typeof product.product_code === "string" && product.product_code.trim()
      ? product.product_code.trim().toUpperCase()
      : null;

  const contractDetailsBase =
    spec.structure === "new_contract"
      ? ({
          ...buildContractDetails(),
          title: `[LOCK ${spec.key}] Supply Agreement`,
        } as Record<string, unknown>)
      : null;
  if (contractDetailsBase && spec.offerOn === "contract") {
    const requested = Number(contractDetailsBase.financing ?? contractDetailsBase.value ?? 50_000);
    contractDetailsBase.approved_facility =
      spec.contractStatus === "APPROVED" ? requested : undefined;
  }

  const acceptanceDocs =
    spec.withAcceptanceDocs || spec.acceptance
      ? (buildAcceptancePayload(workflow) as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  const businessDetails = buildBusinessDetails();
  const offerAcceptance = spec.acceptance ?? null;
  const contractOffer =
    spec.offerOn === "contract" && offerAcceptance && contractDetailsBase
      ? buildFacilityOffer(
          Number(contractDetailsBase.financing ?? contractDetailsBase.value ?? 50_000),
          Number(contractDetailsBase.financing ?? contractDetailsBase.value ?? 50_000),
          offerAcceptance
        )
      : Prisma.JsonNull;

  await prisma.contract.create({
    data: {
      id: contractId,
      issuer_organization_id: ctx.org.id,
      status: spec.contractStatus,
      withdraw_reason: spec.contractWithdrawReason ?? null,
      contract_details: (contractDetailsBase ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      customer_details: buildPaymasterDetails() as Prisma.InputJsonValue,
      offer_details: contractOffer,
    },
  });

  await prisma.application.create({
    data: {
      id: appId,
      issuer_organization_id: ctx.org.id,
      product_version: productVersion,
      status: spec.appStatus,
      submitted_at: submitted ? now : null,
      last_completed_step: spec.lastCompletedStep ?? (submitted ? 9 : 4),
      financing_type: {
        product_id: product.id,
        ...(productCode ? { product_code: productCode } : {}),
        seed: "origination-lock-fixtures",
        fixture: spec.key,
      } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: spec.structure,
        existing_contract_id: null,
      } as Prisma.InputJsonValue,
      contract_id: contractId,
      company_details: buildCompanyDetails(ctx.org.id) as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: buildFinancialStatements() as Prisma.InputJsonValue,
      supporting_documents: buildSupportingDocuments() as Prisma.InputJsonValue,
      declarations: buildDeclarations() as Prisma.InputJsonValue,
      review_and_submit: buildReviewAndSubmit() as Prisma.InputJsonValue,
      acceptance_documents: acceptanceDocs,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { originating_application_id: appId },
  });

  const parsedGuarantors = parseGuarantorsFromBusinessDetails(businessDetails);
  for (const row of parsedGuarantors) {
    await prisma.applicationGuarantor.create({
      data: {
        application_id: appId,
        client_guarantor_id: row.guarantorId,
        guarantor_type: row.guarantorType,
        email: row.email,
        name: row.guarantorType === "individual" ? row.name ?? null : null,
        ic_number: row.guarantorType === "individual" ? row.icNumber ?? null : null,
        business_name: row.guarantorType === "company" ? row.businessName ?? null : null,
        ssm_number: row.guarantorType === "company" ? row.ssmNumber ?? null : null,
        position: row.position,
        source_data: row.sourceData as Prisma.InputJsonValue,
      },
    });
  }

  const invoiceInputs = generateInvoiceDetailsList(spec.invoiceStatuses.length);
  const invoiceIds: string[] = [];
  for (let i = 0; i < spec.invoiceStatuses.length; i++) {
    const invoiceId = seedCuid("inv", spec.key, i + 1);
    invoiceIds.push(invoiceId);
    const details = buildInvoiceDetails(invoiceInputs[i]);
    const status = spec.invoiceStatuses[i];
    const invoiceOffer =
      spec.offerOn === "invoices" && status === "OFFER_SENT"
        ? buildInvoiceOffer(details, i === 0 ? offerAcceptance : pendingIssuerAcceptance())
        : spec.offerOn === "contract" && (status === "OFFER_SENT" || status === "APPROVED")
          ? buildInvoiceOffer(details, null)
          : Prisma.JsonNull;
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        application_id: appId,
        contract_id: spec.structure === "new_contract" ? contractId : null,
        details: details as Prisma.InputJsonValue,
        offer_details: invoiceOffer,
        status,
        withdraw_reason:
          status === "WITHDRAWN" ? spec.invoiceWithdrawReason ?? "USER_CANCELLED" : null,
      },
    });
    await maybeAllocate("INV", productCode, "invoice", invoiceId);
  }

  for (const row of reviewStatuses(spec.structure, spec.reviews)) {
    await prisma.applicationReview.create({
      data: {
        application_id: appId,
        section: row.section,
        status: row.status,
        reviewer_user_id: row.status === "PENDING" ? null : ctx.reviewerUserId,
        reviewed_at: row.status === "PENDING" ? null : now,
      },
    });
  }

  if (spec.sectionRemark) {
    await prisma.applicationReviewRemark.create({
      data: {
        application_id: appId,
        scope: "section",
        scope_key: spec.sectionRemark,
        action_type: "REJECT",
        remark: "Seeded financial reject for origination-lock testing.",
        author_user_id: ctx.reviewerUserId,
      },
    });
  }

  if (spec.withAcceptanceDocs || spec.acceptance) {
    const keys = collectAcceptanceDocumentReviewKeys(workflow, acceptanceDocs);
    const itemIds = keys.length > 0 ? keys : ["acceptance_documents:0:board_resolution"];
    const itemStatus: ReviewStepStatus =
      spec.reviews === "signingReady" ||
      spec.reviews === "allApproved" ||
      spec.reviews === "approvedWithRejectedSection"
        ? "APPROVED"
        : "PENDING";
    for (const itemId of itemIds) {
      await prisma.applicationReviewItem.create({
        data: {
          application_id: appId,
          item_type: "document",
          item_id: itemId,
          status: itemStatus,
          reviewer_user_id: itemStatus === "PENDING" ? null : ctx.reviewerUserId,
          reviewed_at: itemStatus === "PENDING" ? null : now,
        },
      });
    }
  }

  if (spec.envelope) {
    await createEnvelope({
      applicationId: appId,
      contractId,
      status: spec.envelope,
      productVersion: product.version,
      reviewerUserId: ctx.reviewerUserId,
    });
  }

  const appRef = await maybeAllocate("APP", productCode, "application", appId);
  await maybeAllocate("CON", productCode, "contract", contractId);

  return {
    key: spec.key,
    cases: spec.cases,
    what: spec.what,
    applicationId: appId,
    displayReference: appRef,
    productId: product.id,
    invoiceIds,
  };
}

async function main() {
  const ctx = await resolveContext();
  console.log(`Issuer: ${ctx.org.name} (${ctx.org.id})`);
  console.log(`Facility product: ${ctx.facilityProduct.id} v${ctx.facilityProduct.version} ${ctx.facilityProduct.product_code ?? ""}`);
  console.log(`Invoice product:  ${ctx.invoiceProduct.id} v${ctx.invoiceProduct.version} ${ctx.invoiceProduct.product_code ?? ""}`);
  if (!productHasFacilityCeremony(ctx.facilityProduct.workflow)) {
    console.warn("Warning: facility product has no acceptance documents / signing package. C4–C6 UI may look thin.");
  }

  console.log("Replacing previous origination-lock fixtures…");
  await deletePrevious();

  const created: CreatedRow[] = [];
  for (const spec of FIXTURES) {
    created.push(await createFixture(spec, ctx));
  }

  console.log("\nFixtures (issuer /applications/{id}  ·  admin /applications/{productId}/{id})\n");
  console.log(
    "Key".padEnd(5),
    "Cases".padEnd(28),
    "Application".padEnd(28),
    "Ref".padEnd(22),
    "What"
  );
  for (const row of created) {
    console.log(
      row.key.padEnd(5),
      row.cases.padEnd(28),
      row.applicationId.padEnd(28),
      (row.displayReference ?? "—").padEnd(22),
      row.what
    );
    if (row.invoiceIds.length > 0 && (row.key === "B5" || row.key === "B7" || row.key === "B8")) {
      console.log("     invoices:", row.invoiceIds.join(", "));
    }
  }
  console.log(`\nTotal: ${created.length}`);
  console.log("Guide: docs/guides/application/origination-locks-manual-test.md");
  console.log("Re-run this script after destructive cases (withdraw / reject / archive).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
