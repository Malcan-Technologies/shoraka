import { UserRole, type Prisma } from "@prisma/client";
import {
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  MARC_CREDIT_SCORE_RANGE_MESSAGE,
  MARC_REPORT_DATE_REQUIRED_MESSAGE,
  MARC_REPORT_REQUIRED_MESSAGE,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
  PAYMASTER_IDENTITY_UNRESOLVED_CODE,
  PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE,
  PAYMASTER_NOT_LINKED_CODE,
  PAYMASTER_NOT_LINKED_MESSAGE,
  PAYMASTER_NOT_VERIFIED_CODE,
  PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE,
  PAYMASTER_NOT_VERIFIED_FOR_USE_VERIFIED_MESSAGE,
  RELATED_PARTY_REQUIRED_CODE,
  RELATED_PARTY_REQUIRED_MESSAGE,
  isCompleteIssuerMarcAssessment,
  isPaymasterVerified,
  resolveCompletedSigningEnvelopeWhere,
  paymasterIdentityOfferBlockReason,
  submittedIdentityDiffersFromVerified,
  marcSmeGradeFromCreditScore,
  parseMarcCreditScore,
  parseMarcProbabilityOfDefault,
  type IssuerPaymasterOption,
  type MarcAssessmentSnapshot,
  type PaymasterAssignmentNotice as PaymasterAssignmentNoticeDto,
  type PaymasterDetail,
  type PaymasterListItem,
  type PaymasterLookupMatch,
  type PaymasterLookupResult,
  type PaymasterVerificationStatus,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import {
  createOnboardingLogRow,
  type AuditRequestContext,
} from "../../lib/audit";
import { snapshotBusinessReference } from "../../lib/audit/display-references";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import {
  MARC_ASSESSMENT_SAVED,
  buildMarcAssessmentAuditMetadata,
  marcAssessmentAuditValues,
} from "./marc-assessment-audit";
import { generatePresignedUploadUrl, validateDocument } from "../../lib/s3/client";
import {
  parseRegistrationLookup,
  parseRelatedPartyFlag,
  parseSubmittedIdentity,
  type PaymasterSubmittedIdentity,
} from "./identity";
import {
  buildPaymasterIdentityAuditMetadata,
  writePaymasterIdentityApplicationLog,
} from "./identity-audit";
import { buildSubmittedCustomerDetails, snapshotAsJson } from "./snapshot";

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

type PaymasterRow = {
  id: string;
  legal_name: string;
  registration_number: string;
  registration_country: string;
  entity_type: string;
  verification_status: PaymasterVerificationStatus;
  verified_at: Date | null;
  verified_by_user_id: string | null;
  source?: string;
  created_at: Date;
  updated_at: Date;
};

function requireRelatedParty(value: unknown): boolean {
  const parsed = parseRelatedPartyFlag(value);
  if (parsed == null) {
    throw new AppError(400, RELATED_PARTY_REQUIRED_CODE, RELATED_PARTY_REQUIRED_MESSAGE);
  }
  return parsed;
}

function resolveLargePrivateCompany(params: {
  incoming: unknown;
  previous: boolean | undefined;
}): boolean | undefined {
  if (typeof params.incoming === "boolean") return params.incoming;
  return params.previous;
}

function toLookupMatch(row: {
  id: string;
  legal_name: string;
  registration_number: string;
  registration_country: string;
  entity_type: string;
  verification_status: PaymasterVerificationStatus;
}): PaymasterLookupMatch {
  return {
    id: row.id,
    legalName: row.legal_name,
    registrationNumber: row.registration_number,
    registrationCountry: row.registration_country,
    entityType: row.entity_type,
    verificationStatus: row.verification_status,
  };
}

function mapIdentityFields(row: PaymasterRow) {
  return {
    id: row.id,
    legalName: row.legal_name,
    registrationNumber: row.registration_number,
    registrationCountry: row.registration_country,
    entityType: row.entity_type,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at?.toISOString() ?? null,
    verifiedByUserId: row.verified_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findPaymasterByRegistration(registrationNumber: string) {
  return prisma.paymaster.findUnique({
    where: { registration_number: registrationNumber },
  });
}

function requireSubmittedIdentity(customerDetails: CustomerDetailsJson): PaymasterSubmittedIdentity {
  const submitted = parseSubmittedIdentity(customerDetails);
  if (!submitted) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Customer name, entity type, and a 12-digit SSM number are required."
    );
  }
  return submitted;
}

function isRegistrationUniqueConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002"
  );
}

/** Live facility identity is locked after the facility leaves draft / amendment. */
export function shouldRetainLinkedFacilityPaymaster(contractStatus: string | null | undefined): boolean {
  return contractStatus != null && contractStatus !== "DRAFT" && contractStatus !== "AMENDMENT_REQUESTED";
}

/**
 * Persist issuer-submitted Customer Details without creating or linking a Paymaster master.
 * Used on draft Save & Continue and amendment saves.
 */
export function persistDraftCustomerDetails(params: {
  customerDetails: CustomerDetailsJson;
  previousLargePrivateCompany?: boolean;
  previousDocument?: unknown;
  retainPaymasterId?: string | null;
}): CustomerDetailsJson {
  const submitted = requireSubmittedIdentity(params.customerDetails);
  const isRelatedParty = requireRelatedParty(params.customerDetails.is_related_party);
  const isLargePrivateCompany = resolveLargePrivateCompany({
    incoming: params.customerDetails.is_large_private_company,
    previous: params.previousLargePrivateCompany,
  });
  const document =
    params.customerDetails.document != null ? params.customerDetails.document : params.previousDocument;
  return buildSubmittedCustomerDetails({
    submitted,
    isRelatedParty,
    isLargePrivateCompany,
    document,
    paymasterId: params.retainPaymasterId,
  });
}

async function upsertIssuerLink(params: {
  issuerOrganizationId: string;
  paymasterId: string;
  isRelatedParty: boolean | null;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.issuerPaymasterLink.findUnique({
    where: {
      issuer_organization_id_paymaster_id: {
        issuer_organization_id: params.issuerOrganizationId,
        paymaster_id: params.paymasterId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    const updated = await prisma.issuerPaymasterLink.update({
      where: { id: existing.id },
      data: {
        is_related_party: params.isRelatedParty,
        last_used_at: new Date(),
      },
    });
    return { id: updated.id, created: false };
  }
  const created = await prisma.issuerPaymasterLink.create({
    data: {
      issuer_organization_id: params.issuerOrganizationId,
      paymaster_id: params.paymasterId,
      is_related_party: params.isRelatedParty,
      last_used_at: new Date(),
    },
  });
  return { id: created.id, created: true };
}

/**
 * Resolve or create a global Paymaster from submitted Customer Details (submit / resubmit only).
 * Matches by SSM only. Never overwrites master legal identity or this application's submitted JSON.
 */
export async function resolvePaymasterFromCustomerDetails(params: {
  issuerOrganizationId: string;
  customerDetails: CustomerDetailsJson;
  applicationId?: string | null;
  contractId?: string | null;
  selectedPaymasterId?: string | null;
  /** When set, keep an already-linked facility Paymaster even if SSM in JSON differs. */
  lockExistingPaymasterId?: string | null;
  previousLargePrivateCompany?: boolean;
  previousDocument?: unknown;
  actorUserId?: string | null;
  auditContext?: AuditRequestContext | null;
}): Promise<{
  paymasterId: string;
  customerDetails: CustomerDetailsJson;
  paymasterCreated: boolean;
  issuerLinkCreated: boolean;
}> {
  const lockId = params.lockExistingPaymasterId?.trim() || null;
  const submitted = requireSubmittedIdentity(params.customerDetails);
  const isRelatedParty = requireRelatedParty(params.customerDetails.is_related_party);
  const isLargePrivateCompany = resolveLargePrivateCompany({
    incoming: params.customerDetails.is_large_private_company,
    previous: params.previousLargePrivateCompany,
  });
  const document =
    params.customerDetails.document != null ? params.customerDetails.document : params.previousDocument;

  const finish = async (
    paymaster: {
      id: string;
      legal_name: string;
      entity_type: string;
      registration_number: string;
      registration_country: string;
      verification_status: PaymasterVerificationStatus;
    },
    paymasterCreated: boolean
  ) => {
    const link = await upsertIssuerLink({
      issuerOrganizationId: params.issuerOrganizationId,
      paymasterId: paymaster.id,
      isRelatedParty,
    });
    const issuerLinkCreated = !paymasterCreated && link.created;
    const customerDetails = buildSubmittedCustomerDetails({
      submitted,
      isRelatedParty,
      isLargePrivateCompany,
      document,
      paymasterId: paymaster.id,
    });
    const applicationId = params.applicationId?.trim() || null;
    const actorUserId = params.actorUserId?.trim() || null;
    if (actorUserId && applicationId && (paymasterCreated || issuerLinkCreated)) {
      const metadata = buildPaymasterIdentityAuditMetadata({
        paymasterId: paymaster.id,
        registrationNumber: paymaster.registration_number,
        legalName: paymaster.legal_name,
        verificationStatus: paymaster.verification_status,
        issuerOrganizationId: params.issuerOrganizationId,
        issuerPaymasterLinkId: link.id,
        applicationId,
        contractId: params.contractId,
        relatedParty: isRelatedParty,
        source: paymasterCreated ? "issuer" : "issuer_reuse",
      });
      await writePaymasterIdentityApplicationLog({
        eventType: paymasterCreated
          ? ApplicationLogEventType.PAYMASTER_CREATED
          : ApplicationLogEventType.PAYMASTER_LINKED_TO_ISSUER,
        actorUserId,
        applicationId,
        portal: ActivityPortal.ISSUER,
        paymasterId: paymaster.id,
        metadata,
        context: params.auditContext,
      });
    }
    return {
      paymasterId: paymaster.id,
      customerDetails,
      paymasterCreated,
      issuerLinkCreated,
    };
  };

  if (lockId) {
    const existing = await prisma.paymaster.findUnique({ where: { id: lockId } });
    if (!existing) {
      throw new AppError(404, "PAYMASTER_NOT_FOUND", "Facility Paymaster was not found.");
    }
    return finish(existing, false);
  }

  const found = await findPaymasterByRegistration(submitted.registrationNumber);
  if (found) {
    return finish(found, false);
  }

  let paymaster;
  try {
    paymaster = await prisma.paymaster.create({
      data: {
        legal_name: submitted.legalName,
        registration_number: submitted.registrationNumber,
        registration_country: submitted.registrationCountry,
        entity_type: submitted.entityType,
        verification_status: "UNVERIFIED",
        source: "ISSUER_APPLICATION",
      },
    });
  } catch (error) {
    if (!isRegistrationUniqueConflict(error)) throw error;
    const raced = await findPaymasterByRegistration(submitted.registrationNumber);
    if (!raced) throw error;
    return finish(raced, false);
  }
  logger.info(
    { paymasterId: paymaster.id, registrationNumber: submitted.registrationNumber },
    "Paymaster master created from issuer application submit"
  );
  return finish(paymaster, true);
}

/**
 * Submit / resubmit: create or link the Paymaster master, keep this application's submitted identity.
 */
export async function linkPaymasterForApplicationSubmission(params: {
  contractId: string;
  issuerOrganizationId: string;
  applicationId: string;
  actorUserId: string;
  auditContext?: AuditRequestContext | null;
  lockExistingPaymasterId?: string | null;
}): Promise<{
  id: string;
  customer_details: Prisma.JsonValue | null;
  paymaster_id: string | null;
  status: string;
} | null> {
  const contract = await prisma.contract.findUnique({ where: { id: params.contractId } });
  if (!contract) {
    throw new AppError(404, "CONTRACT_NOT_FOUND", "Facility not found");
  }
  const previousCustomer = asRecord(contract.customer_details);
  if (!previousCustomer) {
    throw new AppError(400, "VALIDATION_ERROR", "Customer details are required before submitting.");
  }
  const previousLpc = previousCustomer.is_large_private_company;
  const lockExistingPaymasterId =
    params.lockExistingPaymasterId?.trim() ||
    (shouldRetainLinkedFacilityPaymaster(contract.status) ? contract.paymaster_id : null);
  const resolved = await resolvePaymasterFromCustomerDetails({
    issuerOrganizationId: params.issuerOrganizationId,
    customerDetails: previousCustomer,
    applicationId: params.applicationId,
    contractId: params.contractId,
    lockExistingPaymasterId,
    previousLargePrivateCompany: typeof previousLpc === "boolean" ? previousLpc : undefined,
    previousDocument: previousCustomer.document,
    actorUserId: params.actorUserId,
    auditContext: params.auditContext,
  });
  return prisma.contract.update({
    where: { id: params.contractId },
    data: {
      customer_details: resolved.customerDetails as Prisma.InputJsonValue,
      paymaster: { connect: { id: resolved.paymasterId } },
    },
  });
}

export async function lookupPaymasterByRegistration(
  registrationNumberRaw: unknown
): Promise<PaymasterLookupResult> {
  const registrationNumber = parseRegistrationLookup(registrationNumberRaw);
  if (!registrationNumber) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Customer SSM number must be a 12-digit registration number."
    );
  }
  const found = await findPaymasterByRegistration(registrationNumber);
  if (!found) {
    return { status: "NOT_FOUND", paymaster: null };
  }
  return {
    status: isPaymasterVerified(found.verification_status) ? "FOUND_VERIFIED" : "FOUND_UNVERIFIED",
    paymaster: toLookupMatch(found),
  };
}

/** Issuer lookup: verified identity only. Unverified masters are treated as not found. */
export async function lookupIssuerPaymasterByRegistration(
  registrationNumberRaw: unknown
): Promise<PaymasterLookupResult> {
  const result = await lookupPaymasterByRegistration(registrationNumberRaw);
  if (result.status !== "FOUND_VERIFIED") {
    return { status: "NOT_FOUND", paymaster: null };
  }
  return result;
}

function customerDetailsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function assertApplicationPaymasterReadyForOffer(applicationId: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      contract: {
        select: {
          customer_details: true,
          paymaster: {
            select: {
              legal_name: true,
              entity_type: true,
              registration_number: true,
              registration_country: true,
              verification_status: true,
            },
          },
        },
      },
    },
  });
  const reason = paymasterIdentityOfferBlockReason({
    submitted: customerDetailsRecord(application?.contract?.customer_details),
    paymaster: application?.contract?.paymaster ?? null,
  });
  if (!reason) return;
  if (reason === PAYMASTER_NOT_LINKED_MESSAGE) {
    throw new AppError(400, PAYMASTER_NOT_LINKED_CODE, reason);
  }
  if (reason === PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE) {
    throw new AppError(400, PAYMASTER_NOT_VERIFIED_CODE, reason);
  }
  throw new AppError(400, PAYMASTER_IDENTITY_UNRESOLVED_CODE, PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE);
}

export async function applyVerifiedPaymasterIdentityToApplication(params: {
  applicationId: string;
  actorUserId: string;
  auditContext?: AuditRequestContext | null;
}): Promise<{ customer_details: ReturnType<typeof buildSubmittedCustomerDetails> }> {
  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
    select: {
      id: true,
      contract: {
        select: {
          id: true,
          customer_details: true,
          paymaster: true,
        },
      },
    },
  });
  if (!application?.contract) {
    throw new AppError(400, PAYMASTER_NOT_LINKED_CODE, PAYMASTER_NOT_LINKED_MESSAGE);
  }
  const paymaster = application.contract.paymaster;
  if (!paymaster) {
    throw new AppError(400, PAYMASTER_NOT_LINKED_CODE, PAYMASTER_NOT_LINKED_MESSAGE);
  }
  if (!isPaymasterVerified(paymaster.verification_status)) {
    throw new AppError(
      400,
      PAYMASTER_NOT_VERIFIED_CODE,
      PAYMASTER_NOT_VERIFIED_FOR_USE_VERIFIED_MESSAGE
    );
  }

  const existing = customerDetailsRecord(application.contract.customer_details);
  if (
    !submittedIdentityDiffersFromVerified({
      submitted: existing,
      paymaster,
    })
  ) {
    return {
      customer_details: buildSubmittedCustomerDetails({
        submitted: {
          legalName: String(existing.name ?? paymaster.legal_name),
          entityType: String(existing.entity_type ?? paymaster.entity_type),
          registrationNumber: String(existing.ssm_number ?? paymaster.registration_number),
          registrationCountry: String(existing.country ?? paymaster.registration_country),
        },
        isRelatedParty: existing.is_related_party === true,
        isLargePrivateCompany:
          typeof existing.is_large_private_company === "boolean"
            ? existing.is_large_private_company
            : undefined,
        document: existing.document,
        paymasterId: paymaster.id,
      }),
    };
  }

  const submittedBefore = {
    name: typeof existing.name === "string" ? existing.name : "",
    entity_type: typeof existing.entity_type === "string" ? existing.entity_type : "",
    ssm_number: typeof existing.ssm_number === "string" ? existing.ssm_number : "",
    country: typeof existing.country === "string" ? existing.country : "",
  };
  const next = buildSubmittedCustomerDetails({
    submitted: {
      legalName: paymaster.legal_name,
      entityType: paymaster.entity_type,
      registrationNumber: paymaster.registration_number,
      registrationCountry: paymaster.registration_country,
    },
    isRelatedParty: existing.is_related_party === true,
    isLargePrivateCompany:
      typeof existing.is_large_private_company === "boolean"
        ? existing.is_large_private_company
        : undefined,
    document: existing.document,
    paymasterId: paymaster.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: application.contract!.id },
      data: { customer_details: snapshotAsJson(next) },
    });
    await writePaymasterIdentityApplicationLog(
      {
        eventType: ApplicationLogEventType.PAYMASTER_IDENTITY_RESOLVED,
        actorUserId: params.actorUserId,
        applicationId: params.applicationId,
        portal: ActivityPortal.ADMIN,
        paymasterId: paymaster.id,
        metadata: {
          ...buildPaymasterIdentityAuditMetadata({
            paymasterId: paymaster.id,
            registrationNumber: paymaster.registration_number,
            legalName: paymaster.legal_name,
            verificationStatus: paymaster.verification_status,
            applicationId: params.applicationId,
            source: "admin",
          }),
          resolution: "USE_VERIFIED_PAYMASTER",
          submitted: submittedBefore,
          verified: {
            name: paymaster.legal_name,
            entity_type: paymaster.entity_type,
            ssm_number: paymaster.registration_number,
            country: paymaster.registration_country,
          },
        },
        context: params.auditContext,
      },
      tx
    );
  });

  return { customer_details: next };
}

export async function verifyPaymaster(params: {
  paymasterId: string;
  actorUserId: string;
  applicationId?: string | null;
  auditContext?: AuditRequestContext | null;
}): Promise<PaymasterDetail> {
  const existing = await prisma.paymaster.findUnique({ where: { id: params.paymasterId } });
  if (!existing) throw new AppError(404, "PAYMASTER_NOT_FOUND", "Paymaster not found");
  if (!isPaymasterVerified(existing.verification_status)) {
    await prisma.$transaction(async (tx) => {
      await tx.paymaster.update({
        where: { id: params.paymasterId },
        data: {
          verification_status: "VERIFIED",
          verified_at: new Date(),
          verified_by_user_id: params.actorUserId,
        },
      });
      logger.info(
        { paymasterId: params.paymasterId, actorUserId: params.actorUserId },
        "Paymaster identity reviewed"
      );
      const applicationId =
        params.applicationId?.trim() || (await findLinkedApplicationId(params.paymasterId, tx));
      if (!applicationId) return;
      await writePaymasterIdentityApplicationLog(
        {
          eventType: ApplicationLogEventType.PAYMASTER_VERIFIED,
          actorUserId: params.actorUserId,
          applicationId,
          portal: ActivityPortal.ADMIN,
          paymasterId: params.paymasterId,
          metadata: buildPaymasterIdentityAuditMetadata({
            paymasterId: params.paymasterId,
            registrationNumber: existing.registration_number,
            legalName: existing.legal_name,
            verificationStatus: "VERIFIED",
            applicationId,
            previousStatus: "UNVERIFIED",
            newStatus: "VERIFIED",
            verifiedByUserId: params.actorUserId,
            source: "admin",
          }),
          context: params.auditContext,
        },
        tx
      );
    });
  }
  return getAdminPaymasterDetail(params.paymasterId);
}

async function findLinkedApplicationId(
  paymasterId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  const contract = await db.contract.findFirst({
    where: { paymaster_id: paymasterId },
    orderBy: { updated_at: "desc" },
    select: {
      originating_application_id: true,
      applications: { select: { id: true }, take: 1, orderBy: { updated_at: "desc" } },
    },
  });
  return contract?.applications[0]?.id ?? contract?.originating_application_id ?? null;
}

export async function listIssuerPaymasters(
  issuerOrganizationId: string
): Promise<IssuerPaymasterOption[]> {
  const links = await prisma.issuerPaymasterLink.findMany({
    where: {
      issuer_organization_id: issuerOrganizationId,
      paymaster: { verification_status: "VERIFIED" },
    },
    include: { paymaster: true },
    orderBy: { last_used_at: "desc" },
  });
  return links.map((link) => ({
    id: link.paymaster.id,
    legalName: link.paymaster.legal_name,
    registrationNumber: link.paymaster.registration_number,
    registrationCountry: link.paymaster.registration_country,
    entityType: link.paymaster.entity_type,
    verificationStatus: link.paymaster.verification_status,
    isRelatedParty: link.is_related_party,
    lastUsedAt: link.last_used_at.toISOString(),
  }));
}

export async function listAdminPaymasters(input: {
  q?: string;
  verificationStatus?: PaymasterVerificationStatus;
  page: number;
  pageSize: number;
}): Promise<{ items: PaymasterListItem[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.PaymasterWhereInput = {};
  if (input.verificationStatus) where.verification_status = input.verificationStatus;
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
        _count: {
          select: { issuer_links: true, notes: true, contracts: true, assignment_notices: true },
        },
        issuer_links: {
          select: {
            last_used_at: true,
            issuer_organization: { select: { name: true } },
          },
          orderBy: { last_used_at: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    items: rows.map((row) => ({
      ...mapIdentityFields(row),
      linkedIssuerCount: row._count.issuer_links,
      linkedNoteCount: row._count.notes,
      linkedFacilityCount: row._count.contracts,
      noticeCount: row._count.assignment_notices,
      lastUsedAt: row.issuer_links[0]?.last_used_at.toISOString() ?? null,
      latestIssuerName: row.issuer_links[0]?.issuer_organization.name ?? null,
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
  const verifier = row.verified_by_user_id
    ? await prisma.user.findUnique({
        where: { user_id: row.verified_by_user_id },
        select: { first_name: true, last_name: true },
      })
    : null;
  const verifiedByName = verifier
    ? [verifier.first_name, verifier.last_name].filter(Boolean).join(" ").trim() || null
    : null;

  return {
    ...mapIdentityFields(row),
    source: row.source,
    verifiedByName,
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
  context?: AuditRequestContext | null;
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

  return prisma.$transaction(async (tx) => {
    const org = await tx.issuerOrganization.findUnique({
      where: { id: params.issuerOrganizationId },
      select: { id: true, owner_user_id: true, name: true, display_reference: true },
    });
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
    }

    const previousRow = await tx.issuerOrganizationMarcAssessment.findFirst({
      where: { issuer_organization_id: params.issuerOrganizationId },
      orderBy: { created_at: "desc" },
    });
    const previous = marcAssessmentAuditValues(
      previousRow ? mapMarcAssessmentRow(previousRow) : null
    );

    const created = await tx.issuerOrganizationMarcAssessment.create({
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
    const saved = mapMarcAssessmentRow(created);
    const next = marcAssessmentAuditValues(saved);
    if (!next) {
      throw new AppError(500, "INTERNAL_ERROR", "MARC assessment could not be recorded");
    }

    await createOnboardingLogRow(
      {
        userId: org.owner_user_id,
        actorUserId: params.actorUserId,
        role: UserRole.ISSUER,
        eventType: MARC_ASSESSMENT_SAVED,
        portal: "issuer",
        issuerOrganizationId: org.id,
        organizationName: org.name ?? undefined,
        ipAddress: params.context?.ipAddress,
        userAgent: params.context?.userAgent,
        correlationId: params.context?.correlationId,
        context: params.context,
        metadata: buildMarcAssessmentAuditMetadata({
          organizationId: org.id,
          organizationReference: snapshotBusinessReference(org.display_reference, org.id),
          actorUserId: params.actorUserId,
          previous,
          next,
          reportS3Key: saved.reportS3Key,
        }),
      },
      tx
    );

    return saved;
  });
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

/**
 * Same completed-envelope rule as note publish: contract-linked invoices reuse the
 * facility package (any application). Do not require the envelope to live on the
 * note's source application or on the invoice row.
 */
export async function isExecutionPackCompleteForNote(params: {
  sourceContractId: string | null;
  sourceInvoiceId: string | null;
}): Promise<boolean> {
  let invoiceContractId: string | null = null;
  if (params.sourceInvoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.sourceInvoiceId },
      select: { contract_id: true },
    });
    invoiceContractId = invoice?.contract_id ?? null;
  }
  const envelopeWhere = resolveCompletedSigningEnvelopeWhere({
    sourceInvoiceId: params.sourceInvoiceId,
    sourceContractId: params.sourceContractId,
    invoiceContractId,
  });
  if (!envelopeWhere) return false;
  const envelope = await prisma.signingEnvelope.findFirst({
    where: { status: "COMPLETED", ...envelopeWhere },
    select: { id: true },
  });
  return Boolean(envelope);
}

export { asRecord };
