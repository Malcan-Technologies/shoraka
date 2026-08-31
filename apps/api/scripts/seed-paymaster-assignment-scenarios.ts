#!/usr/bin/env tsx
/**
 * Dev-only idempotent seed for Paymaster master data, MARC, 5-page / legacy 3-page
 * Prospectus publications, and Notice of Assignment disbursement scenarios.
 *
 * Usage (repo root):
 *   pnpm --filter @cashsouk/api seed:paymaster-assignment
 *
 * Does not call CTOS, RegTank, SigningCloud, MARC APIs, email, payments, or S3 uploads.
 * Prospectus PDF status stays PENDING (frozen HTML only — no fake S3 PDF keys).
 * Notice / acknowledgement binaries are omitted so Download buttons stay hidden.
 *
 * Never run against production.
 */
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  OrganizationMemberRole,
  OrganizationType,
  Prisma,
  PrismaClient,
  ProductStatus,
  ProspectusReviewStatus,
  UserRole,
  WithdrawalStatus,
  WithdrawalType,
} from "@prisma/client";
import { AdminRole } from "@cashsouk/types";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { ensureAdminRoleCatalog } from "../src/lib/auth/rbac";
import { buildNoteIssuerSnapshot } from "../src/modules/notes/note-issuer-snapshot";
import { expectedProspectusPageCount } from "../src/modules/notes/prospectus/prospectus-pdf";
import { buildProspectusPageOneHtml } from "../src/modules/notes/prospectus/prospectus-page-one.html";
import {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
} from "../src/modules/notes/prospectus/prospectus-page-one-mapper";
import { loadProspectusPageOneNote } from "../src/modules/notes/prospectus/prospectus-page-one-prisma";
import { buildProspectusPageTwoHtml } from "../src/modules/notes/prospectus/prospectus-page-two.html";
import {
  buildProspectusPageTwo,
  mapProspectusPageTwoDataToInput,
} from "../src/modules/notes/prospectus/prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "../src/modules/notes/prospectus/prospectus-page-two-prisma";
import { buildProspectusPageThreeHtml } from "../src/modules/notes/prospectus/prospectus-page-three.html";
import {
  buildProspectusPageFourHtml,
  buildProspectusPageFiveHtml,
} from "../src/modules/notes/prospectus/prospectus-marc-appendix.html";
import {
  buildProspectusPageThree,
  mapProspectusPageThreeDataToInput,
} from "../src/modules/notes/prospectus/prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "../src/modules/notes/prospectus/prospectus-page-three-prisma";
import {
  buildCompleteApprovedProspectusSnapshot,
  withApprovedSnapshotHtml,
} from "../src/modules/notes/prospectus-review/prospectus-approved-snapshot";
import {
  catalogueVersion,
  toProspectusPublicationContent,
  type ProspectusReviewStoredContent,
} from "../src/modules/notes/prospectus-review/prospectus-review-content";
import { buildCompleteProspectusReviewDraft } from "../src/modules/notes/prospectus-review/prospectus-review.demo-fixtures";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "../src/modules/notes/prospectus-review/prospectus-review.service";
import { buildPaymasterSnapshot } from "../src/modules/paymaster/snapshot";
import { listIssuerPaymasters } from "../src/modules/paymaster/service";
import {
  buildProspectusDemoBusinessDetails,
  buildProspectusDemoFinancialStatements,
  upsertProspectusDemoCtosReport,
} from "./seed-prospectus-review-note";

const prisma = new PrismaClient();

export const PMAS_PRODUCT_ID = "seed_pmas_product";
export const PMAS_ADMIN_EMAIL = "paymaster.scenarios.admin@cashsouk.local";
export const PMAS_INVESTOR_EMAIL = "paymaster.scenarios.investor@cashsouk.local";
export const PMAS_ISSUER_A_EMAIL = "paymaster.issuer.a@cashsouk.local";
export const PMAS_ISSUER_B_EMAIL = "paymaster.issuer.b@cashsouk.local";
export const PMAS_ISSUER_C_EMAIL = "paymaster.issuer.c@cashsouk.local";

export const PMAS_ORG_A_ID = "seed_pmas_issuer_a";
export const PMAS_ORG_B_ID = "seed_pmas_issuer_b";
export const PMAS_ORG_C_ID = "seed_pmas_issuer_c";
export const PMAS_INVESTOR_ORG_ID = "seed_pmas_investor_org";

export const PMAS_PAYMASTER_1_ID = "seed_pmas_paymaster_harbour";
export const PMAS_PAYMASTER_2_ID = "seed_pmas_paymaster_pacific";
export const PMAS_PAYMASTER_3_ID = "seed_pmas_paymaster_delta";

/** 12-digit SSM identities — unique legal rows, never merged by name. */
export const PMAS_PAYMASTER_1_SSM = "201801234567";
export const PMAS_PAYMASTER_2_SSM = "201905678901";
export const PMAS_PAYMASTER_3_SSM = "202012345678";

export const PMAS_PAYMASTER_1_NAME = "Harbour Goods Paymaster Sdn Bhd";
export const PMAS_PAYMASTER_2_NAME = "Pacific Trade Obligor Sdn Bhd";
export const PMAS_PAYMASTER_3_NAME = "Delta Supply Paymaster Sdn Bhd";

export const ENTITY_SDN_BHD = "Private Limited Company (Sdn Bhd)";
export const ENTITY_BHD = "Public Limited Company (Bhd)";

export const NOTE_A_REF = "NOTE-PMAS-ACK-001";
export const NOTE_B_REF = "NOTE-PMAS-SENT-001";
export const NOTE_C_REF = "NOTE-PMAS-UPLD-001";
export const NOTE_D_REF = "NOTE-PMAS-LEGACY-001";
export const NOTE_L_REF = "NOTE-PMAS-LISTED-001";
export const NOTE_G_REF = "NOTE-PMAS-GEN-001";

export const NOTE_A_ID = "seed_pmas_note_ack";
export const NOTE_B_ID = "seed_pmas_note_sent";
export const NOTE_C_ID = "seed_pmas_note_upld";
export const NOTE_D_ID = "seed_pmas_note_legacy";
export const NOTE_L_ID = "seed_pmas_note_listed";
export const NOTE_G_ID = "seed_pmas_note_generated";

const FINANCING_AMOUNT = 425_000;
const PROFIT_RATE = 10;
const PLATFORM_FEE = 1.5;
const SERVICE_FEE = 15;
const RISK_RATING = "B";
const PURPOSE = "Working capital against approved trade receivables";
const CONTRACT_WORK = "supply of industrial components and scheduled maintenance";

const TRACK_RECORD = {
  totalInvoicesPaid: 18,
  totalAmountPaid: "4250000",
  successfulRepaymentPercent: 94,
  onTimePaymentPercent: 89,
  averagePaymentPeriodDays: 43,
} as const;

const SEED_NOTE_IDS = [NOTE_A_ID, NOTE_B_ID, NOTE_C_ID, NOTE_D_ID, NOTE_L_ID, NOTE_G_ID] as const;

type NoticeStatus = "GENERATED" | "SENT" | "ACKNOWLEDGEMENT_UPLOADED" | "ACKNOWLEDGED";

type FinancingSpec = {
  key: string;
  noteId: string;
  noteReference: string;
  appId: string;
  contractId: string;
  invoiceId: string;
  envelopeId: string;
  reviewId: string;
  publicationId: string;
  noticeId: string;
  withdrawalId: string;
  shorakaId: string;
  ctosReportId: string;
  issuerOrgId: string;
  issuerName: string;
  paymasterId: string;
  paymasterName: string;
  paymasterSsm: string;
  relatedParty: boolean;
  invoiceNumber: string;
  noticeStatus: NoticeStatus | null;
  prospectusPages: 3 | 5;
  listedOpen: boolean;
  disbursementReadyGraph: boolean;
  title: string;
};

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function customerDetails(input: {
  paymasterId: string;
  name: string;
  ssm: string;
  entityType: string;
  country: string;
  relatedParty: boolean;
}): Prisma.InputJsonValue {
  return buildPaymasterSnapshot({
    paymaster: {
      id: input.paymasterId,
      legal_name: input.name,
      registration_number: input.ssm,
      registration_country: input.country,
      entity_type: input.entityType,
    },
    isRelatedParty: input.relatedParty,
  }) as Prisma.InputJsonValue;
}

export function buildPmasOfficerReviewDraft(): ProspectusReviewStoredContent {
  const draft = buildCompleteProspectusReviewDraft();
  draft.page2.paymasterTrackRecord = { ...TRACK_RECORD };
  return draft;
}

async function ensureUser(input: {
  email: string;
  cognitoSub: string;
  roles: UserRole[];
  firstName: string;
  lastName: string;
  investorOrgIds?: string[];
  issuerOrgIds?: string[];
}): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { user_id: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { user_id: existing.user_id },
      data: {
        roles: { set: input.roles },
        first_name: input.firstName,
        last_name: input.lastName,
        investor_account: { set: input.investorOrgIds ?? [] },
        issuer_account: { set: input.issuerOrgIds ?? [] },
      },
    });
    return existing.user_id;
  }
  const userId = await generateUniqueUserId();
  await prisma.user.create({
    data: {
      user_id: userId,
      email: input.email,
      cognito_sub: input.cognitoSub,
      cognito_username: input.email,
      roles: input.roles,
      first_name: input.firstName,
      last_name: input.lastName,
      investor_account: input.investorOrgIds ?? [],
      issuer_account: input.issuerOrgIds ?? [],
    },
  });
  return userId;
}

async function ensureAdmin(userId: string) {
  await ensureAdminRoleCatalog(prisma);
  const role = await prisma.adminRoleConfig.findUnique({
    where: { key: AdminRole.SUPER_ADMIN },
  });
  if (!role) {
    throw new Error("SUPER_ADMIN role catalog missing after ensureAdminRoleCatalog");
  }
  await prisma.admin.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      role_id: role.id,
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
    update: {
      role_id: role.id,
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
  });
}

async function upsertPaymaster(input: {
  preferredId: string;
  legalName: string;
  registrationNumber: string;
  entityType: string;
  mismatchPending: boolean;
  verificationStatus: "UNVERIFIED" | "VERIFIED";
  verifiedByUserId?: string;
}): Promise<{ id: string; created: boolean }> {
  const verificationData =
    input.verificationStatus === "VERIFIED"
      ? {
          verification_status: "VERIFIED" as const,
          verified_at: new Date("2026-06-01T00:00:00.000Z"),
          verified_by_user_id: input.verifiedByUserId ?? null,
        }
      : {
          verification_status: "UNVERIFIED" as const,
          verified_at: null,
          verified_by_user_id: null,
        };
  const bySsm = await prisma.paymaster.findUnique({
    where: { registration_number: input.registrationNumber },
  });
  if (bySsm) {
    const updated = await prisma.paymaster.update({
      where: { id: bySsm.id },
      data: {
        legal_name: input.legalName,
        registration_country: "MY",
        entity_type: input.entityType,
        mismatch_pending: input.mismatchPending,
        source: "ISSUER_APPLICATION",
        ...verificationData,
      },
    });
    return { id: updated.id, created: false };
  }
  const created = await prisma.paymaster.create({
    data: {
      id: input.preferredId,
      legal_name: input.legalName,
      registration_number: input.registrationNumber,
      registration_country: "MY",
      entity_type: input.entityType,
      mismatch_pending: input.mismatchPending,
      source: "ISSUER_APPLICATION",
      ...verificationData,
    },
  });
  return { id: created.id, created: true };
}

async function upsertIssuerOrg(input: {
  id: string;
  ownerUserId: string;
  name: string;
  registrationNumber: string;
  displayReference: string;
  industry: string;
}) {
  await prisma.issuerOrganization.upsert({
    where: { id: input.id },
    update: {
      owner_user_id: input.ownerUserId,
      name: input.name,
      type: OrganizationType.COMPANY,
      registration_number: input.registrationNumber,
      display_reference: input.displayReference,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: { basicInfo: { industry: input.industry } },
    },
    create: {
      id: input.id,
      owner_user_id: input.ownerUserId,
      type: OrganizationType.COMPANY,
      name: input.name,
      registration_number: input.registrationNumber,
      display_reference: input.displayReference,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: { basicInfo: { industry: input.industry } },
    },
  });
  await prisma.organizationMember.upsert({
    where: {
      user_id_issuer_organization_id: {
        user_id: input.ownerUserId,
        issuer_organization_id: input.id,
      },
    },
    create: {
      user_id: input.ownerUserId,
      issuer_organization_id: input.id,
      role: OrganizationMemberRole.OWNER,
    },
    update: { role: OrganizationMemberRole.OWNER },
  });
}

async function upsertMarc(input: {
  id: string;
  issuerOrganizationId: string;
  actorUserId: string;
  creditGrade: string;
  creditScore: number;
  probabilityOfDefault: number;
  reportFileName: string;
  reportDate: Date;
}) {
  await prisma.issuerOrganizationMarcAssessment.upsert({
    where: { id: input.id },
    update: {
      issuer_organization_id: input.issuerOrganizationId,
      credit_grade: input.creditGrade,
      credit_score: input.creditScore,
      probability_of_default: input.probabilityOfDefault,
      report_file_name: input.reportFileName,
      report_s3_key: null,
      report_date: input.reportDate,
      created_by_user_id: input.actorUserId,
    },
    create: {
      id: input.id,
      issuer_organization_id: input.issuerOrganizationId,
      credit_grade: input.creditGrade,
      credit_score: input.creditScore,
      probability_of_default: input.probabilityOfDefault,
      report_file_name: input.reportFileName,
      report_s3_key: null,
      report_date: input.reportDate,
      created_by_user_id: input.actorUserId,
    },
  });
}

async function resetSeedGraph() {
  const noteIds = [...SEED_NOTE_IDS];
  const investments = await prisma.noteInvestment.findMany({
    where: { note_id: { in: noteIds } },
    select: { id: true },
  });
  if (investments.length > 0) {
    await prisma.noteInvestment.deleteMany({ where: { note_id: { in: noteIds } } });
  }
  await prisma.shorakaTradeOrder.deleteMany({
    where: { note_id: { in: noteIds } },
  });
  await prisma.withdrawalInstruction.deleteMany({
    where: { note_id: { in: noteIds } },
  });
  await prisma.paymasterAssignmentNotice.deleteMany({
    where: { note_id: { in: noteIds } },
  });
  await prisma.noteProspectusPublication.deleteMany({
    where: { note_id: { in: noteIds } },
  });
  await prisma.noteProspectusReview.deleteMany({
    where: { note_id: { in: noteIds } },
  });
  await prisma.notePaymentSchedule.deleteMany({ where: { note_id: { in: noteIds } } });
  await prisma.noteEvent.deleteMany({ where: { note_id: { in: noteIds } } });
  await prisma.noteListing.deleteMany({ where: { note_id: { in: noteIds } } });
  await prisma.note.deleteMany({ where: { id: { in: noteIds } } });

  const appIds = [
    "seed_pmas_app_a1",
    "seed_pmas_app_a2",
    "seed_pmas_app_a3",
    "seed_pmas_app_b1",
    "seed_pmas_app_c1",
    "seed_pmas_app_listed",
    "seed_pmas_app_mismatch",
  ];
  await prisma.signingEnvelope.deleteMany({ where: { application_id: { in: appIds } } });
  await prisma.invoice.deleteMany({ where: { application_id: { in: appIds } } });
  await prisma.application.deleteMany({ where: { id: { in: appIds } } });
  await prisma.paymasterMismatch.deleteMany({
    where: { id: "seed_pmas_mismatch_delta" },
  });
  await prisma.contract.deleteMany({
    where: {
      id: {
        in: [
          "seed_pmas_contract_a1",
          "seed_pmas_contract_a2",
          "seed_pmas_contract_a3",
          "seed_pmas_contract_b1",
          "seed_pmas_contract_c1",
          "seed_pmas_contract_listed",
          "seed_pmas_contract_mismatch",
        ],
      },
    },
  });
}

async function freezeProspectus(input: {
  noteId: string;
  reviewId: string;
  publicationId: string;
  adminUserId: string;
  draft: ProspectusReviewStoredContent;
  includeAppendix: boolean;
  publishedAt: Date | null;
}) {
  const publication = toProspectusPublicationContent(input.draft);
  const page3Data = await loadProspectusPageThreeData(prisma, input.noteId);
  const page3Input = mapProspectusPageThreeDataToInput(page3Data);
  page3Input.publicationContent = publication;
  const page3 = buildProspectusPageThree(page3Input);

  let approvedSnapshot = await buildCompleteApprovedProspectusSnapshot({
    noteId: input.noteId,
    publicationId: input.publicationId,
    contentVersion: 1,
    approvedContent: input.draft,
    approvedAt: new Date(),
    approvedByUserId: input.adminUserId,
    optionCatalogueVersion: catalogueVersion(),
  });

  const page1Note = await loadProspectusPageOneNote(prisma, input.noteId);
  const page1Input = await mapProspectusPageOneDataToInput(page1Note);
  page1Input.publicationContent = publication;
  page1Input.trackRecordMode = "frozen_publication_snapshot";
  page1Input.page1TrackRecordSnapshot =
    approvedSnapshot.page_1 as typeof page1Input.page1TrackRecordSnapshot;
  const page1 = buildProspectusPageOne(page1Input);
  const page2Data = await loadProspectusPageTwoData(prisma, input.noteId);
  const page2Input = mapProspectusPageTwoDataToInput(page2Data);
  page2Input.publicationContent = publication;
  const page2 = buildProspectusPageTwo(page2Input);

  const html = {
    page1: buildProspectusPageOneHtml(page1),
    page2: buildProspectusPageTwoHtml(page2),
    page3: buildProspectusPageThreeHtml(page3),
    ...(input.includeAppendix
      ? {
          page4: buildProspectusPageFourHtml(),
          page5: buildProspectusPageFiveHtml(),
        }
      : {}),
  };
  approvedSnapshot = withApprovedSnapshotHtml(approvedSnapshot, html);
  const pageCount = expectedProspectusPageCount(html);

  await prisma.noteProspectusPublication.create({
    data: {
      id: input.publicationId,
      note_id: input.noteId,
      prospectus_review_id: input.reviewId,
      content_version: 1,
      snapshot: approvedSnapshot as unknown as Prisma.InputJsonValue,
      render_fingerprint: approvedSnapshot.render_fingerprint,
      approved_by_user_id: input.adminUserId,
      approved_at: new Date(),
      published_at: input.publishedAt,
      pdf_generation_status: "PENDING",
      pdf_page_count: pageCount,
      pdf_storage_key: null,
      pdf_storage_bucket: null,
    },
  });

  await prisma.noteProspectusReview.update({
    where: { id: input.reviewId },
    data: {
      status: ProspectusReviewStatus.PUBLISHED,
      draft_content: input.draft as unknown as Prisma.InputJsonValue,
      approved_content: input.draft as unknown as Prisma.InputJsonValue,
      approved_snapshot: approvedSnapshot as unknown as Prisma.InputJsonValue,
      approved_publication_id: input.publicationId,
      render_fingerprint: approvedSnapshot.render_fingerprint,
      approved_by_user_id: input.adminUserId,
      approved_at: new Date(),
      updated_by_user_id: input.adminUserId,
      content_version: 1,
      option_catalogue_version: catalogueVersion(),
    },
  });

  return { pageCount, html };
}

async function upsertFinancing(
  spec: FinancingSpec,
  input: {
    adminUserId: string;
    investorUserId: string;
    now: Date;
    paymasterByPreferredId: Record<string, string>;
  }
) {
  const paymasterId = input.paymasterByPreferredId[spec.paymasterId] ?? spec.paymasterId;
  const listingOpens = addDays(input.now, spec.listedOpen ? -2 : -21);
  const listingCloses = spec.listedOpen ? addDays(input.now, 12) : addDays(input.now, -7);
  const maturity = addDays(input.now, 90);
  const invoiceDue = isoDate(addDays(input.now, 75));
  const financialStatements = buildProspectusDemoFinancialStatements(input.now);
  const businessDetails = buildProspectusDemoBusinessDetails();
  const detailsJson = customerDetails({
    paymasterId,
    name: spec.paymasterName,
    ssm: spec.paymasterSsm,
    entityType: ENTITY_SDN_BHD,
    country: "MY",
    relatedParty: spec.relatedParty,
  });

  await upsertProspectusDemoCtosReport({
    prisma,
    reportId: spec.ctosReportId,
    issuerOrganizationId: spec.issuerOrgId,
    ref: input.now,
  });

  await prisma.contract.upsert({
    where: { id: spec.contractId },
    update: {
      issuer_organization_id: spec.issuerOrgId,
      paymaster_id: paymasterId,
      status: ContractStatus.APPROVED,
      display_reference: `CTR-PMAS-${spec.key.toUpperCase()}`,
      approved_facility: money(2_000_000),
      customer_details: detailsJson,
      contract_details: {
        approved_facility: 2_000_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
        financing: FINANCING_AMOUNT,
        value: FINANCING_AMOUNT,
        description: CONTRACT_WORK,
      } as Prisma.InputJsonValue,
    },
    create: {
      id: spec.contractId,
      issuer_organization_id: spec.issuerOrgId,
      paymaster_id: paymasterId,
      status: ContractStatus.APPROVED,
      display_reference: `CTR-PMAS-${spec.key.toUpperCase()}`,
      approved_facility: money(2_000_000),
      customer_details: detailsJson,
      contract_details: {
        approved_facility: 2_000_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
        financing: FINANCING_AMOUNT,
        value: FINANCING_AMOUNT,
        description: CONTRACT_WORK,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.application.upsert({
    where: { id: spec.appId },
    update: {
      issuer_organization_id: spec.issuerOrgId,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: addDays(input.now, -20),
      display_reference: `APP-PMAS-${spec.key.toUpperCase()}`,
      contract_id: spec.contractId,
      financing_type: {
        product_id: PMAS_PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: spec.contractId,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
    },
    create: {
      id: spec.appId,
      issuer_organization_id: spec.issuerOrgId,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: addDays(input.now, -20),
      display_reference: `APP-PMAS-${spec.key.toUpperCase()}`,
      contract_id: spec.contractId,
      financing_type: {
        product_id: PMAS_PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: spec.contractId,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
    },
  });

  const invoiceDetails = {
    number: spec.invoiceNumber,
    value: FINANCING_AMOUNT,
    financing_ratio_percent: 80,
    maturity_date: invoiceDue,
    due_date: invoiceDue,
    issued_date: isoDate(addDays(input.now, -30)),
    description: CONTRACT_WORK,
  };
  const offerDetails = {
    offered_amount: FINANCING_AMOUNT,
    offered_ratio_percent: 80,
    offered_profit_rate_percent: PROFIT_RATE,
    platform_fee_rate_percent: PLATFORM_FEE,
    risk_rating: RISK_RATING,
  };

  await prisma.invoice.upsert({
    where: { id: spec.invoiceId },
    update: {
      application_id: spec.appId,
      contract_id: spec.contractId,
      status: InvoiceStatus.APPROVED,
      display_reference: `INV-PMAS-${spec.key.toUpperCase()}`,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
    create: {
      id: spec.invoiceId,
      application_id: spec.appId,
      contract_id: spec.contractId,
      status: InvoiceStatus.APPROVED,
      display_reference: `INV-PMAS-${spec.key.toUpperCase()}`,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
  });

  await prisma.signingEnvelope.upsert({
    where: { id: spec.envelopeId },
    update: {
      application_id: spec.appId,
      contract_id: spec.contractId,
      invoice_id: spec.invoiceId,
      title: `${spec.title} — signed package`,
      status: "COMPLETED",
      created_by_user_id: input.adminUserId,
      sent_at: addDays(input.now, -16),
      completed_at: addDays(input.now, -15),
      metadata: { seed: "seed-paymaster-assignment-scenarios" },
    },
    create: {
      id: spec.envelopeId,
      application_id: spec.appId,
      contract_id: spec.contractId,
      invoice_id: spec.invoiceId,
      title: `${spec.title} — signed package`,
      status: "COMPLETED",
      created_by_user_id: input.adminUserId,
      sent_at: addDays(input.now, -16),
      completed_at: addDays(input.now, -15),
      metadata: { seed: "seed-paymaster-assignment-scenarios" },
    },
  });

  const org = await prisma.issuerOrganization.findUniqueOrThrow({
    where: { id: spec.issuerOrgId },
  });
  const issuerSnapshot = buildNoteIssuerSnapshot({
    organization: org,
    businessDetails,
  });

  const funded = spec.disbursementReadyGraph;
  const publishedAt = addDays(input.now, -14);
  const fundingClosedAt = funded ? addDays(input.now, -3) : null;

  await prisma.note.create({
    data: {
      id: spec.noteId,
      source_application_id: spec.appId,
      source_contract_id: spec.contractId,
      source_invoice_id: spec.invoiceId,
      issuer_organization_id: spec.issuerOrgId,
      status: NoteStatus.PUBLISHED,
      listing_status: spec.listedOpen ? NoteListingStatus.PUBLISHED : NoteListingStatus.CLOSED,
      funding_status: funded ? NoteFundingStatus.CLOSED : NoteFundingStatus.OPEN,
      servicing_status: NoteServicingStatus.NOT_STARTED,
      title: spec.title,
      note_reference: spec.noteReference,
      paymaster_id: paymasterId,
      issuer_snapshot: issuerSnapshot as Prisma.InputJsonValue,
      paymaster_snapshot: detailsJson,
      product_snapshot: {
        product_id: PMAS_PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
        name: "Account Receivable Financing",
      } as Prisma.InputJsonValue,
      purpose_snapshot: { financing_for: PURPOSE } as Prisma.InputJsonValue,
      contract_snapshot: {
        id: spec.contractId,
        status: ContractStatus.APPROVED,
        contract_details: {
          approved_facility: 2_000_000,
          financing: FINANCING_AMOUNT,
          value: FINANCING_AMOUNT,
          description: CONTRACT_WORK,
        },
        customer_details: detailsJson,
      } as Prisma.InputJsonValue,
      invoice_snapshot: {
        id: spec.invoiceId,
        status: InvoiceStatus.APPROVED,
        details: invoiceDetails,
        offer_details: offerDetails,
      } as Prisma.InputJsonValue,
      requested_amount: money(FINANCING_AMOUNT),
      target_amount: money(FINANCING_AMOUNT),
      funded_amount: money(funded ? FINANCING_AMOUNT : 0),
      profit_rate_percent: money(PROFIT_RATE),
      platform_fee_rate_percent: money(PLATFORM_FEE),
      service_fee_rate_percent: money(SERVICE_FEE),
      tenure_days: 90,
      maturity_date: maturity,
      published_at: publishedAt,
      funding_closed_at: fundingClosedAt,
      created_at: input.now,
    },
  });

  await prisma.noteListing.create({
    data: {
      note_id: spec.noteId,
      status: spec.listedOpen ? NoteListingStatus.PUBLISHED : NoteListingStatus.CLOSED,
      opens_at: listingOpens,
      closes_at: listingCloses,
      published_at: publishedAt,
      visibility: "INVESTOR_MARKETPLACE",
      summary: spec.title,
    },
  });

  const profit = FINANCING_AMOUNT * (PROFIT_RATE / 100);
  await prisma.notePaymentSchedule.create({
    data: {
      note_id: spec.noteId,
      sequence: 1,
      due_date: maturity,
      expected_principal: money(FINANCING_AMOUNT),
      expected_profit: money(profit),
      expected_total: money(FINANCING_AMOUNT + profit),
    },
  });

  await prisma.noteProspectusReview.create({
    data: {
      id: spec.reviewId,
      note_id: spec.noteId,
      status: ProspectusReviewStatus.DRAFT,
      content_version: 1,
      option_catalogue_version: catalogueVersion(),
      draft_content: buildPmasOfficerReviewDraft() as unknown as Prisma.InputJsonValue,
      created_by_user_id: input.adminUserId,
      updated_by_user_id: input.adminUserId,
    },
  });

  const freeze = await freezeProspectus({
    noteId: spec.noteId,
    reviewId: spec.reviewId,
    publicationId: spec.publicationId,
    adminUserId: input.adminUserId,
    draft: buildPmasOfficerReviewDraft(),
    includeAppendix: spec.prospectusPages === 5,
    publishedAt: publishedAt,
  });

  if (funded) {
    await prisma.noteInvestment.create({
      data: {
        id: `seed_pmas_inv_${spec.key}`,
        note_id: spec.noteId,
        investor_organization_id: PMAS_INVESTOR_ORG_ID,
        investor_user_id: input.investorUserId,
        status: NoteInvestmentStatus.CONFIRMED,
        amount: money(FINANCING_AMOUNT),
        allocation_percent: money(100),
        committed_at: addDays(input.now, -10),
        confirmed_at: addDays(input.now, -9),
        prospectus_publication_id: spec.publicationId,
        prospectus_content_version: 1,
        prospectus_acknowledged_at: addDays(input.now, -10),
      },
    });

    await prisma.withdrawalInstruction.create({
      data: {
        id: spec.withdrawalId,
        note_id: spec.noteId,
        issuer_organization_id: spec.issuerOrgId,
        requested_by_user_id: input.adminUserId,
        status: WithdrawalStatus.DRAFT,
        withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
        amount: money(FINANCING_AMOUNT),
        display_reference: `WDL-PMAS-${spec.key.toUpperCase()}`,
        beneficiary_snapshot: {
          bank_name: "Maybank Islamic Berhad",
          account_number: "564012345678",
          account_holder: spec.issuerName,
        } as Prisma.InputJsonValue,
        metadata: { seed: "seed-paymaster-assignment-scenarios" },
      },
    });

    await prisma.shorakaTradeOrder.create({
      data: {
        id: spec.shorakaId,
        withdrawal_instruction_id: spec.withdrawalId,
        note_id: spec.noteId,
        status: "COMPLETED",
        idempotency_key: `seed-pmas-shoraka-${spec.key}`,
        certificate_s3_key: `seed/paymaster-assignment/${spec.key}/tawarruq-certificate-local-placeholder.pdf`,
        certificate_file_sha256: "seed-placeholder-not-uploaded",
        certificate_uploaded_at: addDays(input.now, -2),
        submitted_at: addDays(input.now, -2),
      },
    });
  }

  if (spec.noticeStatus) {
    const generatedAt = addDays(input.now, -2);
    const sentAt =
      spec.noticeStatus === "GENERATED" ? null : addDays(input.now, -1);
    const uploadedAt =
      spec.noticeStatus === "ACKNOWLEDGEMENT_UPLOADED" || spec.noticeStatus === "ACKNOWLEDGED"
        ? addDays(input.now, -1)
        : null;
    const acknowledgedAt = spec.noticeStatus === "ACKNOWLEDGED" ? input.now : null;
    await prisma.paymasterAssignmentNotice.create({
      data: {
        id: spec.noticeId,
        paymaster_id: paymasterId,
        issuer_organization_id: spec.issuerOrgId,
        contract_id: spec.contractId,
        invoice_id: spec.invoiceId,
        note_id: spec.noteId,
        status: spec.noticeStatus,
        version: 1,
        notice_s3_key: null,
        notice_file_name: null,
        generated_at: generatedAt,
        generated_by_user_id: input.adminUserId,
        sent_at: sentAt,
        sent_by_user_id: sentAt ? input.adminUserId : null,
        acknowledgement_s3_key: null,
        acknowledgement_file_name: uploadedAt ? "paymaster-acknowledgement-local.pdf" : null,
        acknowledgement_uploaded_at: uploadedAt,
        acknowledgement_uploaded_by_user_id: uploadedAt ? input.adminUserId : null,
        acknowledged_at: acknowledgedAt,
        acknowledged_by_user_id: acknowledgedAt ? input.adminUserId : null,
        template_pending: true,
        metadata: {
          seed: "seed-paymaster-assignment-scenarios",
          documentConvention: "status-only-no-s3",
        },
      },
    });
  }

  await prisma.issuerPaymasterLink.upsert({
    where: {
      issuer_organization_id_paymaster_id: {
        issuer_organization_id: spec.issuerOrgId,
        paymaster_id: paymasterId,
      },
    },
    create: {
      issuer_organization_id: spec.issuerOrgId,
      paymaster_id: paymasterId,
      is_related_party: spec.relatedParty,
      last_used_at: input.now,
    },
    update: {
      is_related_party: spec.relatedParty,
      last_used_at: input.now,
    },
  });

  return freeze;
}

export async function seedPaymasterAssignmentScenarios() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:paymaster-assignment is blocked in production");
  }

  const now = new Date();
  const draft = buildPmasOfficerReviewDraft();
  if (!draft.page2.paymasterTrackRecord) {
    throw new Error("Officer Paymaster Track Record missing from draft fixture");
  }

  const adminUserId = await ensureUser({
    email: PMAS_ADMIN_EMAIL,
    cognitoSub: "seed_pmas_admin_sub",
    roles: [UserRole.ADMIN],
    firstName: "Paymaster",
    lastName: "Admin",
  });
  await ensureAdmin(adminUserId);

  const investorUserId = await ensureUser({
    email: PMAS_INVESTOR_EMAIL,
    cognitoSub: "seed_pmas_investor_sub",
    roles: [UserRole.INVESTOR],
    firstName: "Paymaster",
    lastName: "Investor",
    investorOrgIds: [PMAS_INVESTOR_ORG_ID],
  });
  const issuerAUserId = await ensureUser({
    email: PMAS_ISSUER_A_EMAIL,
    cognitoSub: "seed_pmas_issuer_a_sub",
    roles: [UserRole.ISSUER],
    firstName: "Aisha",
    lastName: "Rahman",
    issuerOrgIds: [PMAS_ORG_A_ID],
  });
  const issuerBUserId = await ensureUser({
    email: PMAS_ISSUER_B_EMAIL,
    cognitoSub: "seed_pmas_issuer_b_sub",
    roles: [UserRole.ISSUER],
    firstName: "Ben",
    lastName: "Tan",
    issuerOrgIds: [PMAS_ORG_B_ID],
  });
  const issuerCUserId = await ensureUser({
    email: PMAS_ISSUER_C_EMAIL,
    cognitoSub: "seed_pmas_issuer_c_sub",
    roles: [UserRole.ISSUER],
    firstName: "Chloe",
    lastName: "Lim",
    issuerOrgIds: [PMAS_ORG_C_ID],
  });

  await prisma.product.upsert({
    where: { id: PMAS_PRODUCT_ID },
    update: {
      status: ProductStatus.ACTIVE,
      service_fee_rate_percent: money(SERVICE_FEE),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
            product_name: "Account Receivable Financing",
          },
        },
      ],
    },
    create: {
      id: PMAS_PRODUCT_ID,
      status: ProductStatus.ACTIVE,
      version: 1,
      service_fee_rate_percent: money(SERVICE_FEE),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
            product_name: "Account Receivable Financing",
          },
        },
      ],
    },
  });

  await prisma.investorOrganization.upsert({
    where: { id: PMAS_INVESTOR_ORG_ID },
    update: {
      owner_user_id: investorUserId,
      type: OrganizationType.PERSONAL,
      name: "Paymaster Scenario Investor",
      first_name: "Paymaster",
      last_name: "Investor",
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: true,
      country: "Malaysia",
    },
    create: {
      id: PMAS_INVESTOR_ORG_ID,
      owner_user_id: investorUserId,
      type: OrganizationType.PERSONAL,
      name: "Paymaster Scenario Investor",
      first_name: "Paymaster",
      last_name: "Investor",
      onboarding_status: "COMPLETED",
      onboarded_at: now,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: true,
      country: "Malaysia",
    },
  });
  await prisma.investorBalance.upsert({
    where: { investor_organization_id: PMAS_INVESTOR_ORG_ID },
    update: { available_amount: money(500_000) },
    create: {
      investor_organization_id: PMAS_INVESTOR_ORG_ID,
      available_amount: money(500_000),
    },
  });

  await upsertIssuerOrg({
    id: PMAS_ORG_A_ID,
    ownerUserId: issuerAUserId,
    name: "North Harbour Manufacturing Sdn Bhd",
    registrationNumber: "201701112233",
    displayReference: "ISS-PMAS-A",
    industry: "Industrial Manufacturing",
  });
  await upsertIssuerOrg({
    id: PMAS_ORG_B_ID,
    ownerUserId: issuerBUserId,
    name: "South Ridge Logistics Sdn Bhd",
    registrationNumber: "201802223344",
    displayReference: "ISS-PMAS-B",
    industry: "Logistics",
  });
  await upsertIssuerOrg({
    id: PMAS_ORG_C_ID,
    ownerUserId: issuerCUserId,
    name: "Eastwind Components Sdn Bhd",
    registrationNumber: "201903334455",
    displayReference: "ISS-PMAS-C",
    industry: "Trading",
  });

  await resetSeedGraph();

  const pm1 = await upsertPaymaster({
    preferredId: PMAS_PAYMASTER_1_ID,
    legalName: PMAS_PAYMASTER_1_NAME,
    registrationNumber: PMAS_PAYMASTER_1_SSM,
    entityType: ENTITY_SDN_BHD,
    mismatchPending: false,
    verificationStatus: "VERIFIED",
    verifiedByUserId: adminUserId,
  });
  const pm2 = await upsertPaymaster({
    preferredId: PMAS_PAYMASTER_2_ID,
    legalName: PMAS_PAYMASTER_2_NAME,
    registrationNumber: PMAS_PAYMASTER_2_SSM,
    entityType: ENTITY_SDN_BHD,
    mismatchPending: false,
    verificationStatus: "VERIFIED",
    verifiedByUserId: adminUserId,
  });
  const pm3 = await upsertPaymaster({
    preferredId: PMAS_PAYMASTER_3_ID,
    legalName: PMAS_PAYMASTER_3_NAME,
    registrationNumber: PMAS_PAYMASTER_3_SSM,
    entityType: ENTITY_SDN_BHD,
    mismatchPending: true,
    verificationStatus: "UNVERIFIED",
  });
  const paymasterByPreferredId = {
    [PMAS_PAYMASTER_1_ID]: pm1.id,
    [PMAS_PAYMASTER_2_ID]: pm2.id,
    [PMAS_PAYMASTER_3_ID]: pm3.id,
  };

  const marcDate = new Date("2026-06-15T00:00:00.000Z");
  await upsertMarc({
    id: "seed_pmas_marc_a",
    issuerOrganizationId: PMAS_ORG_A_ID,
    actorUserId: adminUserId,
    creditGrade: "SME-3",
    creditScore: 74,
    probabilityOfDefault: 1.13,
    reportFileName: "North-Harbour-MARC-Strato-2026-06.pdf",
    reportDate: marcDate,
  });
  await upsertMarc({
    id: "seed_pmas_marc_b",
    issuerOrganizationId: PMAS_ORG_B_ID,
    actorUserId: adminUserId,
    creditGrade: "SME-6",
    creditScore: 45,
    probabilityOfDefault: 20.02,
    reportFileName: "South-Ridge-MARC-Strato-2026-06.pdf",
    reportDate: marcDate,
  });
  await upsertMarc({
    id: "seed_pmas_marc_c",
    issuerOrganizationId: PMAS_ORG_C_ID,
    actorUserId: adminUserId,
    creditGrade: "SME-4",
    creditScore: 62,
    probabilityOfDefault: 7.43,
    reportFileName: "Eastwind-MARC-Strato-2026-06.pdf",
    reportDate: marcDate,
  });

  const specs: FinancingSpec[] = [
    {
      key: "a1",
      noteId: NOTE_A_ID,
      noteReference: NOTE_A_REF,
      appId: "seed_pmas_app_a1",
      contractId: "seed_pmas_contract_a1",
      invoiceId: "seed_pmas_invoice_a1",
      envelopeId: "seed_pmas_env_a1",
      reviewId: "seed_pmas_review_a1",
      publicationId: "seed_pmas_pub_a1",
      noticeId: "seed_pmas_notice_a1",
      withdrawalId: "seed_pmas_wdl_a1",
      shorakaId: "seed_pmas_shoraka_a1",
      ctosReportId: "seed_pmas_ctos_a",
      issuerOrgId: PMAS_ORG_A_ID,
      issuerName: "North Harbour Manufacturing Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_1_ID,
      paymasterName: PMAS_PAYMASTER_1_NAME,
      paymasterSsm: PMAS_PAYMASTER_1_SSM,
      relatedParty: false,
      invoiceNumber: "INV-HARBOUR-2401",
      noticeStatus: "ACKNOWLEDGED",
      prospectusPages: 5,
      listedOpen: false,
      disbursementReadyGraph: true,
      title: "Harbour receivables — acknowledged / disbursement ready",
    },
    {
      key: "a2",
      noteId: NOTE_C_ID,
      noteReference: NOTE_C_REF,
      appId: "seed_pmas_app_a2",
      contractId: "seed_pmas_contract_a2",
      invoiceId: "seed_pmas_invoice_a2",
      envelopeId: "seed_pmas_env_a2",
      reviewId: "seed_pmas_review_a2",
      publicationId: "seed_pmas_pub_a2",
      noticeId: "seed_pmas_notice_a2",
      withdrawalId: "seed_pmas_wdl_a2",
      shorakaId: "seed_pmas_shoraka_a2",
      ctosReportId: "seed_pmas_ctos_a",
      issuerOrgId: PMAS_ORG_A_ID,
      issuerName: "North Harbour Manufacturing Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_1_ID,
      paymasterName: PMAS_PAYMASTER_1_NAME,
      paymasterSsm: PMAS_PAYMASTER_1_SSM,
      relatedParty: false,
      invoiceNumber: "INV-HARBOUR-2402",
      noticeStatus: "ACKNOWLEDGEMENT_UPLOADED",
      prospectusPages: 5,
      listedOpen: false,
      disbursementReadyGraph: true,
      title: "Harbour receivables — acknowledgement uploaded, admin confirm pending",
    },
    {
      key: "a3",
      noteId: NOTE_G_ID,
      noteReference: NOTE_G_REF,
      appId: "seed_pmas_app_a3",
      contractId: "seed_pmas_contract_a3",
      invoiceId: "seed_pmas_invoice_a3",
      envelopeId: "seed_pmas_env_a3",
      reviewId: "seed_pmas_review_a3",
      publicationId: "seed_pmas_pub_a3",
      noticeId: "seed_pmas_notice_a3",
      withdrawalId: "seed_pmas_wdl_a3",
      shorakaId: "seed_pmas_shoraka_a3",
      ctosReportId: "seed_pmas_ctos_a",
      issuerOrgId: PMAS_ORG_A_ID,
      issuerName: "North Harbour Manufacturing Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_1_ID,
      paymasterName: PMAS_PAYMASTER_1_NAME,
      paymasterSsm: PMAS_PAYMASTER_1_SSM,
      relatedParty: false,
      invoiceNumber: "INV-HARBOUR-2403",
      noticeStatus: "GENERATED",
      prospectusPages: 5,
      listedOpen: false,
      disbursementReadyGraph: true,
      title: "Harbour receivables — notice generated, mark sent pending",
    },
    {
      key: "b1",
      noteId: NOTE_B_ID,
      noteReference: NOTE_B_REF,
      appId: "seed_pmas_app_b1",
      contractId: "seed_pmas_contract_b1",
      invoiceId: "seed_pmas_invoice_b1",
      envelopeId: "seed_pmas_env_b1",
      reviewId: "seed_pmas_review_b1",
      publicationId: "seed_pmas_pub_b1",
      noticeId: "seed_pmas_notice_b1",
      withdrawalId: "seed_pmas_wdl_b1",
      shorakaId: "seed_pmas_shoraka_b1",
      ctosReportId: "seed_pmas_ctos_b",
      issuerOrgId: PMAS_ORG_B_ID,
      issuerName: "South Ridge Logistics Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_1_ID,
      paymasterName: PMAS_PAYMASTER_1_NAME,
      paymasterSsm: PMAS_PAYMASTER_1_SSM,
      relatedParty: true,
      invoiceNumber: "INV-HARBOUR-SR-1108",
      noticeStatus: "SENT",
      prospectusPages: 5,
      listedOpen: false,
      disbursementReadyGraph: true,
      title: "Harbour receivables — sent, waiting Paymaster acknowledgement",
    },
    {
      key: "c1",
      noteId: NOTE_D_ID,
      noteReference: NOTE_D_REF,
      appId: "seed_pmas_app_c1",
      contractId: "seed_pmas_contract_c1",
      invoiceId: "seed_pmas_invoice_c1",
      envelopeId: "seed_pmas_env_c1",
      reviewId: "seed_pmas_review_c1",
      publicationId: "seed_pmas_pub_c1",
      noticeId: "seed_pmas_notice_c1",
      withdrawalId: "seed_pmas_wdl_c1",
      shorakaId: "seed_pmas_shoraka_c1",
      ctosReportId: "seed_pmas_ctos_c",
      issuerOrgId: PMAS_ORG_C_ID,
      issuerName: "Eastwind Components Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_2_ID,
      paymasterName: PMAS_PAYMASTER_2_NAME,
      paymasterSsm: PMAS_PAYMASTER_2_SSM,
      relatedParty: false,
      invoiceNumber: "INV-PACIFIC-5510",
      noticeStatus: null,
      prospectusPages: 3,
      listedOpen: true,
      disbursementReadyGraph: false,
      title: "Pacific trade note — legacy 3-page Prospectus",
    },
    {
      key: "l1",
      noteId: NOTE_L_ID,
      noteReference: NOTE_L_REF,
      appId: "seed_pmas_app_listed",
      contractId: "seed_pmas_contract_listed",
      invoiceId: "seed_pmas_invoice_listed",
      envelopeId: "seed_pmas_env_listed",
      reviewId: "seed_pmas_review_listed",
      publicationId: "seed_pmas_pub_listed",
      noticeId: "seed_pmas_notice_listed",
      withdrawalId: "seed_pmas_wdl_listed",
      shorakaId: "seed_pmas_shoraka_listed",
      ctosReportId: "seed_pmas_ctos_a",
      issuerOrgId: PMAS_ORG_A_ID,
      issuerName: "North Harbour Manufacturing Sdn Bhd",
      paymasterId: PMAS_PAYMASTER_1_ID,
      paymasterName: PMAS_PAYMASTER_1_NAME,
      paymasterSsm: PMAS_PAYMASTER_1_SSM,
      relatedParty: false,
      invoiceNumber: "INV-HARBOUR-2410",
      noticeStatus: null,
      prospectusPages: 5,
      listedOpen: true,
      disbursementReadyGraph: false,
      title: "Harbour marketplace note — current 5-page Prospectus",
    },
  ];

  const pageCounts: Record<string, number> = {};
  for (const spec of specs) {
    const freeze = await upsertFinancing(spec, {
      adminUserId,
      investorUserId,
      now,
      paymasterByPreferredId,
    });
    pageCounts[spec.noteReference] = freeze.pageCount;
  }

  const mismatchCustomer = customerDetails({
    paymasterId: pm3.id,
    name: PMAS_PAYMASTER_3_NAME,
    ssm: PMAS_PAYMASTER_3_SSM,
    entityType: ENTITY_BHD,
    country: "SG",
    relatedParty: false,
  });
  await prisma.contract.upsert({
    where: { id: "seed_pmas_contract_mismatch" },
    update: {
      issuer_organization_id: PMAS_ORG_A_ID,
      paymaster_id: pm3.id,
      status: ContractStatus.APPROVED,
      display_reference: "CTR-PMAS-MISMATCH",
      customer_details: mismatchCustomer,
      contract_details: {
        approved_facility: 800_000,
        financing: 180_000,
        value: 180_000,
        description: CONTRACT_WORK,
      } as Prisma.InputJsonValue,
    },
    create: {
      id: "seed_pmas_contract_mismatch",
      issuer_organization_id: PMAS_ORG_A_ID,
      paymaster_id: pm3.id,
      status: ContractStatus.APPROVED,
      display_reference: "CTR-PMAS-MISMATCH",
      customer_details: mismatchCustomer,
      contract_details: {
        approved_facility: 800_000,
        financing: 180_000,
        value: 180_000,
        description: CONTRACT_WORK,
      } as Prisma.InputJsonValue,
    },
  });
  await prisma.application.upsert({
    where: { id: "seed_pmas_app_mismatch" },
    update: {
      issuer_organization_id: PMAS_ORG_A_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: now,
      display_reference: "APP-PMAS-MISMATCH",
      contract_id: "seed_pmas_contract_mismatch",
      financing_type: {
        product_id: PMAS_PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: "seed_pmas_contract_mismatch",
      } as Prisma.InputJsonValue,
    },
    create: {
      id: "seed_pmas_app_mismatch",
      issuer_organization_id: PMAS_ORG_A_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: now,
      display_reference: "APP-PMAS-MISMATCH",
      contract_id: "seed_pmas_contract_mismatch",
      financing_type: {
        product_id: PMAS_PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: "seed_pmas_contract_mismatch",
      } as Prisma.InputJsonValue,
    },
  });
  await prisma.paymasterMismatch.create({
    data: {
      id: "seed_pmas_mismatch_delta",
      paymaster_id: pm3.id,
      application_id: "seed_pmas_app_mismatch",
      contract_id: "seed_pmas_contract_mismatch",
      submitted_legal_name: PMAS_PAYMASTER_3_NAME,
      submitted_entity_type: ENTITY_BHD,
      submitted_country: "SG",
      existing_legal_name: PMAS_PAYMASTER_3_NAME,
      existing_entity_type: ENTITY_SDN_BHD,
      existing_country: "MY",
      status: "PENDING",
    },
  });
  await prisma.issuerPaymasterLink.upsert({
    where: {
      issuer_organization_id_paymaster_id: {
        issuer_organization_id: PMAS_ORG_A_ID,
        paymaster_id: pm3.id,
      },
    },
    create: {
      issuer_organization_id: PMAS_ORG_A_ID,
      paymaster_id: pm3.id,
      is_related_party: false,
      last_used_at: now,
    },
    update: {
      is_related_party: false,
      last_used_at: now,
    },
  });

  const ivan = await prisma.user.findFirst({
    where: { email: { equals: "ivan.chew@malcan.io", mode: "insensitive" } },
    select: { user_id: true },
  });
  let ivanIssuerOrgId: string | null = null;
  if (ivan) {
    const ivanOrg = await prisma.issuerOrganization.findFirst({
      where: { owner_user_id: ivan.user_id },
      select: { id: true },
    });
    if (ivanOrg) {
      ivanIssuerOrgId = ivanOrg.id;
      await prisma.issuerPaymasterLink.upsert({
        where: {
          issuer_organization_id_paymaster_id: {
            issuer_organization_id: ivanOrg.id,
            paymaster_id: pm1.id,
          },
        },
        create: {
          issuer_organization_id: ivanOrg.id,
          paymaster_id: pm1.id,
          is_related_party: false,
          last_used_at: now,
        },
        update: { last_used_at: now },
      });
    }
  }

  const [issuerAOptions, issuerBOptions, issuerCOptions] = await Promise.all([
    listIssuerPaymasters(PMAS_ORG_A_ID),
    listIssuerPaymasters(PMAS_ORG_B_ID),
    listIssuerPaymasters(PMAS_ORG_C_ID),
  ]);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: "max.chng@truestack.my" },
    select: { email: true },
  });

  return {
    adminEmail: PMAS_ADMIN_EMAIL,
    existingPrismaSeedAdminEmail: existingAdmin?.email ?? null,
    investorEmail: PMAS_INVESTOR_EMAIL,
    issuerAEmail: PMAS_ISSUER_A_EMAIL,
    issuerBEmail: PMAS_ISSUER_B_EMAIL,
    issuerCEmail: PMAS_ISSUER_C_EMAIL,
    ivanIssuerEmail: ivanIssuerOrgId ? "ivan.chew@malcan.io" : null,
    passwords:
      "Not created by this seed (Cognito-managed). Use an existing Cognito user, create-admin, or DISABLE_AUTH=true for local API bypass.",
    paymaster1Id: pm1.id,
    paymaster2Id: pm2.id,
    paymaster3Id: pm3.id,
    paymaster1Ssm: PMAS_PAYMASTER_1_SSM,
    paymaster2Ssm: PMAS_PAYMASTER_2_SSM,
    paymaster3Ssm: PMAS_PAYMASTER_3_SSM,
    notes: {
      acknowledgedReady: { id: NOTE_A_ID, reference: NOTE_A_REF, pages: pageCounts[NOTE_A_REF] },
      sentWaitingPaymaster: { id: NOTE_B_ID, reference: NOTE_B_REF, pages: pageCounts[NOTE_B_REF] },
      uploadedWaitingAdmin: { id: NOTE_C_ID, reference: NOTE_C_REF, pages: pageCounts[NOTE_C_REF] },
      generatedWaitingAdmin: { id: NOTE_G_ID, reference: NOTE_G_REF, pages: pageCounts[NOTE_G_REF] },
      legacyThreePage: { id: NOTE_D_ID, reference: NOTE_D_REF, pages: pageCounts[NOTE_D_REF] },
      listedFivePage: { id: NOTE_L_ID, reference: NOTE_L_REF, pages: pageCounts[NOTE_L_REF] },
    },
    issuerAPaymasterIds: issuerAOptions.map((row) => row.id),
    issuerBPaymasterIds: issuerBOptions.map((row) => row.id),
    issuerCPaymasterIds: issuerCOptions.map((row) => row.id),
    createdAfterProspectusGate:
      now.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime(),
    command: "pnpm --filter @cashsouk/api seed:paymaster-assignment",
  };
}

async function main() {
  const result = await seedPaymasterAssignmentScenarios();
  console.log("\n=== Paymaster / Notice / Prospectus scenario seed (local only) ===\n");
  console.log(JSON.stringify(result, null, 2));
}

const isDirectRun =
  process.argv[1]?.includes("seed-paymaster-assignment-scenarios") ||
  process.argv[1]?.includes("seed:paymaster-assignment");

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
