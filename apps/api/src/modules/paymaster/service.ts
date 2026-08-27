import type { Prisma } from "@prisma/client";
import {
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  MARC_CREDIT_SCORE_RANGE_MESSAGE,
  MARC_REPORT_DATE_REQUIRED_MESSAGE,
  MARC_REPORT_REQUIRED_MESSAGE,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
  isCompleteIssuerMarcAssessment,
  marcSmeGradeFromCreditScore,
  parseMarcCreditScore,
  parseMarcProbabilityOfDefault,
  type IssuerPaymasterOption,
  type MarcAssessmentSnapshot,
  type PaymasterAssignmentNotice as PaymasterAssignmentNoticeDto,
  type PaymasterDetail,
  type PaymasterListItem,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { generatePresignedUploadUrl, validateDocument } from "../../lib/s3/client";
import {
  describePaymasterMismatch,
  parseSubmittedIdentity,
  type PaymasterSubmittedIdentity,
} from "./identity";
import { buildPaymasterSnapshot } from "./snapshot";

export type CustomerDetailsJson = {
  name?: unknown;
  entity_type?: unknown;
  ssm_number?: unknown;
  country?: unknown;
  is_related_party?: unknown;
  is_large_private_company?: unknown;
  document?: unknown;
  paymaster_id?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decimalToNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export async function findPaymasterByRegistration(registrationNumber: string) {
  return prisma.paymaster.findUnique({
    where: { registration_number: registrationNumber },
  });
}

async function createMismatch(params: {
  paymasterId: string;
  existing: { legal_name: string; entity_type: string; registration_country: string };
  submitted: PaymasterSubmittedIdentity;
  applicationId?: string | null;
  contractId?: string | null;
}) {
  await prisma.paymasterMismatch.create({
    data: {
      paymaster_id: params.paymasterId,
      application_id: params.applicationId ?? null,
      contract_id: params.contractId ?? null,
      submitted_legal_name: params.submitted.legalName,
      submitted_entity_type: params.submitted.entityType,
      submitted_country: params.submitted.registrationCountry,
      existing_legal_name: params.existing.legal_name,
      existing_entity_type: params.existing.entity_type,
      existing_country: params.existing.registration_country,
      status: "PENDING",
    },
  });
  await prisma.paymaster.update({
    where: { id: params.paymasterId },
    data: { mismatch_pending: true },
  });
}

async function upsertIssuerLink(params: {
  issuerOrganizationId: string;
  paymasterId: string;
  isRelatedParty: boolean | null;
}) {
  return prisma.issuerPaymasterLink.upsert({
    where: {
      issuer_organization_id_paymaster_id: {
        issuer_organization_id: params.issuerOrganizationId,
        paymaster_id: params.paymasterId,
      },
    },
    create: {
      issuer_organization_id: params.issuerOrganizationId,
      paymaster_id: params.paymasterId,
      is_related_party: params.isRelatedParty,
      last_used_at: new Date(),
    },
    update: {
      is_related_party: params.isRelatedParty,
      last_used_at: new Date(),
    },
  });
}

/**
 * Resolve or create a global Paymaster from issuer Customer Details.
 * Matches by SSM only. Never overwrites legal identity. Flags descriptive mismatches.
 */
export async function resolvePaymasterFromCustomerDetails(params: {
  issuerOrganizationId: string;
  customerDetails: CustomerDetailsJson;
  applicationId?: string | null;
  contractId?: string | null;
  selectedPaymasterId?: string | null;
  /** When true, keep an already-linked facility Paymaster even if SSM in JSON differs. */
  lockExistingPaymasterId?: string | null;
}): Promise<{
  paymasterId: string;
  customerDetails: CustomerDetailsJson;
  mismatchCreated: boolean;
}> {
  const selectedId = params.selectedPaymasterId?.trim() || null;
  const lockId = params.lockExistingPaymasterId?.trim() || null;

  if (lockId) {
    const existing = await prisma.paymaster.findUnique({ where: { id: lockId } });
    if (!existing) {
      throw new AppError(404, "PAYMASTER_NOT_FOUND", "Facility Paymaster was not found.");
    }
    const submitted = parseSubmittedIdentity(params.customerDetails);
    let mismatchCreated = false;
    if (submitted) {
      const mismatch = describePaymasterMismatch(existing, submitted);
      if (mismatch) {
        await createMismatch({
          paymasterId: existing.id,
          existing,
          submitted,
          applicationId: params.applicationId,
          contractId: params.contractId,
        });
        mismatchCreated = true;
        logger.info(
          { paymasterId: existing.id, contractId: params.contractId },
          "Paymaster descriptive mismatch flagged on existing facility"
        );
      }
    }
    const isRelatedParty = Boolean(params.customerDetails.is_related_party);
    await upsertIssuerLink({
      issuerOrganizationId: params.issuerOrganizationId,
      paymasterId: existing.id,
      isRelatedParty,
    });
    const snapshot = buildPaymasterSnapshot({
      paymaster: existing,
      isRelatedParty,
      isLargePrivateCompany:
        typeof params.customerDetails.is_large_private_company === "boolean"
          ? params.customerDetails.is_large_private_company
          : undefined,
      document: params.customerDetails.document,
    });
    return { paymasterId: existing.id, customerDetails: snapshot, mismatchCreated };
  }

  if (selectedId) {
    const selected = await prisma.paymaster.findUnique({ where: { id: selectedId } });
    if (!selected) {
      throw new AppError(404, "PAYMASTER_NOT_FOUND", "Selected customer was not found.");
    }
    const link = await prisma.issuerPaymasterLink.findUnique({
      where: {
        issuer_organization_id_paymaster_id: {
          issuer_organization_id: params.issuerOrganizationId,
          paymaster_id: selected.id,
        },
      },
    });
    if (!link) {
      throw new AppError(
        403,
        "PAYMASTER_NOT_ON_ISSUER",
        "You can only select a customer previously used by this issuer."
      );
    }
    const isRelatedParty = Boolean(params.customerDetails.is_related_party);
    await upsertIssuerLink({
      issuerOrganizationId: params.issuerOrganizationId,
      paymasterId: selected.id,
      isRelatedParty,
    });
    const snapshot = buildPaymasterSnapshot({
      paymaster: selected,
      isRelatedParty,
      isLargePrivateCompany:
        typeof params.customerDetails.is_large_private_company === "boolean"
          ? params.customerDetails.is_large_private_company
          : undefined,
      document: params.customerDetails.document,
    });
    return {
      paymasterId: selected.id,
      customerDetails: snapshot,
      mismatchCreated: false,
    };
  }

  const submitted = parseSubmittedIdentity(params.customerDetails);
  if (!submitted) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Customer SSM number must be a 12-digit registration number."
    );
  }

  const found = await findPaymasterByRegistration(submitted.registrationNumber);
  let paymaster = found;
  let mismatchCreated = false;

  if (!paymaster) {
    paymaster = await prisma.paymaster.create({
      data: {
        legal_name: submitted.legalName,
        registration_number: submitted.registrationNumber,
        registration_country: submitted.registrationCountry,
        entity_type: submitted.entityType,
        source: "ISSUER_APPLICATION",
      },
    });
    logger.info(
      { paymasterId: paymaster.id, registrationNumber: submitted.registrationNumber },
      "Paymaster master created from issuer customer details"
    );
  } else {
    const mismatch = describePaymasterMismatch(paymaster, submitted);
    if (mismatch) {
      await createMismatch({
        paymasterId: paymaster.id,
        existing: paymaster,
        submitted,
        applicationId: params.applicationId,
        contractId: params.contractId,
      });
      mismatchCreated = true;
      logger.info(
        { paymasterId: paymaster.id, mismatch },
        "Paymaster descriptive mismatch flagged; legal identity not overwritten"
      );
    }
  }

  const isRelatedParty = Boolean(params.customerDetails.is_related_party);
  await upsertIssuerLink({
    issuerOrganizationId: params.issuerOrganizationId,
    paymasterId: paymaster.id,
    isRelatedParty,
  });

  const snapshot = buildPaymasterSnapshot({
    paymaster,
    isRelatedParty,
    isLargePrivateCompany:
      typeof params.customerDetails.is_large_private_company === "boolean"
        ? params.customerDetails.is_large_private_company
        : undefined,
    document: params.customerDetails.document,
  });

  return { paymasterId: paymaster.id, customerDetails: snapshot, mismatchCreated };
}

export async function listIssuerPaymasters(
  issuerOrganizationId: string
): Promise<IssuerPaymasterOption[]> {
  const links = await prisma.issuerPaymasterLink.findMany({
    where: { issuer_organization_id: issuerOrganizationId },
    include: { paymaster: true },
    orderBy: { last_used_at: "desc" },
  });
  return links.map((link) => ({
    id: link.paymaster.id,
    legalName: link.paymaster.legal_name,
    registrationNumber: link.paymaster.registration_number,
    registrationCountry: link.paymaster.registration_country,
    entityType: link.paymaster.entity_type,
    isRelatedParty: link.is_related_party,
    lastUsedAt: link.last_used_at.toISOString(),
  }));
}

export async function listAdminPaymasters(input: {
  q?: string;
  mismatchPending?: boolean;
  page: number;
  pageSize: number;
}): Promise<{ items: PaymasterListItem[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.PaymasterWhereInput = {};
  if (input.mismatchPending === true) where.mismatch_pending = true;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { legal_name: { contains: q, mode: "insensitive" } },
      { registration_number: { contains: q.replace(/\D/g, "") || q } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.paymaster.count({ where }),
    prisma.paymaster.findMany({
      where,
      orderBy: { updated_at: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        _count: { select: { issuer_links: true, notes: true } },
        issuer_links: { select: { last_used_at: true }, orderBy: { last_used_at: "desc" }, take: 1 },
      },
    }),
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      legalName: row.legal_name,
      registrationNumber: row.registration_number,
      registrationCountry: row.registration_country,
      entityType: row.entity_type,
      mismatchPending: row.mismatch_pending,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      linkedIssuerCount: row._count.issuer_links,
      linkedNoteCount: row._count.notes,
      lastUsedAt: row.issuer_links[0]?.last_used_at.toISOString() ?? null,
    })),
  };
}

export async function getAdminPaymasterDetail(id: string): Promise<PaymasterDetail> {
  const row = await prisma.paymaster.findUnique({
    where: { id },
    include: {
      issuer_links: {
        include: {
          issuer_organization: { select: { id: true, name: true, display_reference: true } },
        },
        orderBy: { last_used_at: "desc" },
      },
      mismatches: { orderBy: { created_at: "desc" }, take: 50 },
      assignment_notices: {
        orderBy: { created_at: "desc" },
        take: 50,
        include: {
          issuer_organization: { select: { name: true } },
          contract: { select: { display_reference: true } },
          invoice: { select: { display_reference: true } },
          note: { select: { note_reference: true } },
        },
      },
      contracts: {
        select: {
          id: true,
          display_reference: true,
          issuer_organization_id: true,
          status: true,
          updated_at: true,
          issuer_organization: { select: { name: true } },
          applications: { select: { id: true, display_reference: true }, take: 1 },
        },
        take: 50,
        orderBy: { updated_at: "desc" },
      },
      notes: {
        select: {
          id: true,
          note_reference: true,
          issuer_organization_id: true,
          status: true,
          updated_at: true,
          target_amount: true,
        },
        take: 50,
        orderBy: { updated_at: "desc" },
      },
    },
  });
  if (!row) throw new AppError(404, "PAYMASTER_NOT_FOUND", "Paymaster not found");

  const issuerNameById = new Map(
    row.issuer_links.map((link) => [link.issuer_organization_id, link.issuer_organization.name])
  );

  return {
    id: row.id,
    legalName: row.legal_name,
    registrationNumber: row.registration_number,
    registrationCountry: row.registration_country,
    entityType: row.entity_type,
    mismatchPending: row.mismatch_pending,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    issuers: row.issuer_links.map((link) => ({
      issuerOrganizationId: link.issuer_organization_id,
      issuerName: link.issuer_organization.name,
      issuerDisplayReference: link.issuer_organization.display_reference,
      isRelatedParty: link.is_related_party,
      lastUsedAt: link.last_used_at.toISOString(),
    })),
    financings: [
      ...row.contracts.map((contract) => ({
        applicationId: contract.applications[0]?.id ?? null,
        applicationDisplayReference: contract.applications[0]?.display_reference ?? null,
        contractId: contract.id,
        contractDisplayReference: contract.display_reference,
        invoiceId: null,
        invoiceDisplayReference: null,
        noteId: null,
        noteReference: null,
        issuerOrganizationId: contract.issuer_organization_id,
        issuerName: contract.issuer_organization.name,
        status: contract.status,
        amount: null,
        updatedAt: contract.updated_at.toISOString(),
      })),
      ...row.notes.map((note) => ({
        applicationId: null,
        applicationDisplayReference: null,
        contractId: null,
        contractDisplayReference: null,
        invoiceId: null,
        invoiceDisplayReference: null,
        noteId: note.id,
        noteReference: note.note_reference,
        issuerOrganizationId: note.issuer_organization_id,
        issuerName: issuerNameById.get(note.issuer_organization_id) ?? null,
        status: note.status,
        amount: decimalToNumber(note.target_amount),
        updatedAt: note.updated_at.toISOString(),
      })),
    ],
    mismatches: row.mismatches.map((mismatch) => ({
      id: mismatch.id,
      status: mismatch.status,
      submittedLegalName: mismatch.submitted_legal_name,
      submittedEntityType: mismatch.submitted_entity_type,
      submittedCountry: mismatch.submitted_country,
      existingLegalName: mismatch.existing_legal_name,
      existingEntityType: mismatch.existing_entity_type,
      existingCountry: mismatch.existing_country,
      applicationId: mismatch.application_id,
      contractId: mismatch.contract_id,
      createdAt: mismatch.created_at.toISOString(),
      resolvedAt: mismatch.resolved_at?.toISOString() ?? null,
    })),
    notices: row.assignment_notices.map((notice) => ({
      id: notice.id,
      status: notice.status,
      version: notice.version,
      issuerOrganizationId: notice.issuer_organization_id,
      issuerName: notice.issuer_organization.name,
      contractId: notice.contract_id,
      contractDisplayReference: notice.contract?.display_reference ?? null,
      invoiceId: notice.invoice_id,
      invoiceDisplayReference: notice.invoice?.display_reference ?? null,
      noteId: notice.note_id,
      noteReference: notice.note?.note_reference ?? null,
      generatedAt: notice.generated_at?.toISOString() ?? null,
      sentAt: notice.sent_at?.toISOString() ?? null,
      acknowledgedAt: notice.acknowledged_at?.toISOString() ?? null,
    })),
  };
}

export async function resolvePaymasterMismatch(params: {
  paymasterId: string;
  mismatchId: string;
  actorUserId: string;
}): Promise<void> {
  const mismatch = await prisma.paymasterMismatch.findFirst({
    where: { id: params.mismatchId, paymaster_id: params.paymasterId },
  });
  if (!mismatch) throw new AppError(404, "PAYMASTER_MISMATCH_NOT_FOUND", "Mismatch not found");
  if (mismatch.status === "RESOLVED") return;

  await prisma.paymasterMismatch.update({
    where: { id: mismatch.id },
    data: {
      status: "RESOLVED",
      resolved_at: new Date(),
      resolved_by_user_id: params.actorUserId,
    },
  });

  const pending = await prisma.paymasterMismatch.count({
    where: { paymaster_id: params.paymasterId, status: "PENDING" },
  });
  await prisma.paymaster.update({
    where: { id: params.paymasterId },
    data: { mismatch_pending: pending > 0 },
  });
}

function mapMarcAssessmentRow(row: {
  credit_grade: string;
  credit_score: { toString(): string } | number | null;
  probability_of_default: { toString(): string } | number | null;
  report_date: Date | null;
  report_file_name: string | null;
  report_s3_key?: string | null;
  created_at: Date;
}): MarcAssessmentSnapshot {
  return {
    creditGrade: row.credit_grade,
    creditScore: decimalToNumber(row.credit_score),
    probabilityOfDefault: decimalToNumber(row.probability_of_default),
    reportDate: row.report_date?.toISOString() ?? null,
    reportFileName: row.report_file_name,
    reportS3Key: row.report_s3_key ?? null,
    assessedAt: row.created_at.toISOString(),
  };
}

export async function getCurrentMarcAssessment(
  issuerOrganizationId: string
): Promise<MarcAssessmentSnapshot | null> {
  const latest = await prisma.issuerOrganizationMarcAssessment.findFirst({
    where: { issuer_organization_id: issuerOrganizationId },
    orderBy: { created_at: "desc" },
  });
  if (!latest) return null;
  return mapMarcAssessmentRow(latest);
}

export function assertIssuerMarcAssessmentComplete(
  marc: MarcAssessmentSnapshot | null | undefined
): MarcAssessmentSnapshot {
  if (!marc || !isCompleteIssuerMarcAssessment(marc)) {
    throw new AppError(400, "MARC_ASSESSMENT_REQUIRED", MARC_ASSESSMENT_REQUIRED_MESSAGE);
  }
  return marc;
}

export async function requestIssuerMarcReportUploadUrl(params: {
  issuerOrganizationId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number; fileName: string }> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: params.issuerOrganizationId },
    select: { id: true },
  });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
  }
  const validation = validateDocument({
    contentType: params.contentType,
    fileSize: params.fileSize,
  });
  if (!validation.valid) {
    throw new AppError(400, "INVALID_DOCUMENT", validation.error ?? MARC_REPORT_REQUIRED_MESSAGE);
  }
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const key = `marc-reports/${params.issuerOrganizationId}/${Date.now()}-${safeName}`;
  const uploaded = await generatePresignedUploadUrl({
    key,
    contentType: params.contentType,
  });
  return { uploadUrl: uploaded.uploadUrl, s3Key: uploaded.key, expiresIn: uploaded.expiresIn, fileName: params.fileName };
}

export async function createMarcAssessment(params: {
  issuerOrganizationId: string;
  actorUserId: string;
  creditScore?: unknown;
  probabilityOfDefault?: unknown;
  reportDate?: string | null;
  reportS3Key?: string | null;
  reportFileName?: string | null;
}): Promise<MarcAssessmentSnapshot> {
  const score = parseMarcCreditScore(params.creditScore);
  if (!score.ok) {
    throw new AppError(400, "VALIDATION_ERROR", score.message);
  }
  const derivedGrade = marcSmeGradeFromCreditScore(score.value);
  if (!derivedGrade) {
    throw new AppError(400, "VALIDATION_ERROR", MARC_CREDIT_SCORE_RANGE_MESSAGE);
  }
  const pd = parseMarcProbabilityOfDefault(params.probabilityOfDefault);
  if (!pd.ok) {
    throw new AppError(400, "VALIDATION_ERROR", pd.message);
  }
  const reportFileName = params.reportFileName?.trim() || "";
  const reportS3Key = params.reportS3Key?.trim() || "";
  if (!reportFileName && !reportS3Key) {
    throw new AppError(400, "VALIDATION_ERROR", MARC_REPORT_REQUIRED_MESSAGE);
  }
  const reportDateRaw = params.reportDate?.trim() || "";
  if (!reportDateRaw) {
    throw new AppError(400, "VALIDATION_ERROR", MARC_REPORT_DATE_REQUIRED_MESSAGE);
  }
  const reportDate = new Date(reportDateRaw);
  if (Number.isNaN(reportDate.getTime())) {
    throw new AppError(400, "VALIDATION_ERROR", MARC_REPORT_DATE_REQUIRED_MESSAGE);
  }

  const created = await prisma.issuerOrganizationMarcAssessment.create({
    data: {
      issuer_organization_id: params.issuerOrganizationId,
      credit_grade: derivedGrade,
      credit_score: score.value,
      probability_of_default: pd.value,
      report_date: reportDate,
      report_s3_key: reportS3Key || null,
      report_file_name: reportFileName || null,
      created_by_user_id: params.actorUserId,
    },
  });
  return mapMarcAssessmentRow(created);
}

export function mapAssignmentNotice(
  row: {
    id: string;
    paymaster_id: string;
    issuer_organization_id: string;
    contract_id: string | null;
    invoice_id: string | null;
    note_id: string | null;
    status: PaymasterAssignmentNoticeDto["status"];
    version: number;
    notice_file_name: string | null;
    notice_s3_key: string | null;
    generated_at: Date | null;
    sent_at: Date | null;
    acknowledgement_file_name: string | null;
    acknowledgement_uploaded_at: Date | null;
    acknowledged_at: Date | null;
    template_pending: boolean;
    generation_error: string | null;
  }
): PaymasterAssignmentNoticeDto {
  return {
    id: row.id,
    paymasterId: row.paymaster_id,
    issuerOrganizationId: row.issuer_organization_id,
    contractId: row.contract_id,
    invoiceId: row.invoice_id,
    noteId: row.note_id,
    status: row.status,
    version: row.version,
    noticeFileName: row.notice_file_name,
    noticeS3Key: row.notice_s3_key,
    generatedAt: row.generated_at?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acknowledgementFileName: row.acknowledgement_file_name,
    acknowledgementUploadedAt: row.acknowledgement_uploaded_at?.toISOString() ?? null,
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
    templatePending: row.template_pending,
    generationError: row.generation_error,
  };
}

export async function getLatestAssignmentNoticeForNote(noteId: string) {
  return prisma.paymasterAssignmentNotice.findFirst({
    where: { note_id: noteId },
    orderBy: [{ version: "desc" }, { created_at: "desc" }],
  });
}

export async function isPaymasterNoticeAcknowledgedForNote(noteId: string): Promise<boolean> {
  const notice = await getLatestAssignmentNoticeForNote(noteId);
  return notice?.status === "ACKNOWLEDGED";
}

export async function assertPaymasterAcknowledgementForDisbursement(noteId: string): Promise<void> {
  const acknowledged = await isPaymasterNoticeAcknowledgedForNote(noteId);
  if (!acknowledged) {
    throw new AppError(
      409,
      PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE,
      PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE
    );
  }
}

export async function isExecutionPackCompleteForNote(params: {
  sourceApplicationId: string;
  sourceContractId: string | null;
  sourceInvoiceId: string | null;
}): Promise<boolean> {
  const envelope = await prisma.signingEnvelope.findFirst({
    where: {
      status: "COMPLETED",
      application_id: params.sourceApplicationId,
      OR: [
        ...(params.sourceInvoiceId ? [{ invoice_id: params.sourceInvoiceId }] : []),
        ...(params.sourceContractId
          ? [{ contract_id: params.sourceContractId, invoice_id: null }]
          : []),
      ],
    },
    select: { id: true },
  });
  return Boolean(envelope);
}

export { asRecord };
