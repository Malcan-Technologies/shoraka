/**
 * SECTION: Persist CTOS snapshots per issuer or investor org
 * WHY: Append-only reports; orchestrate fetch, parse, HTML, DB insert
 * INPUT: org id + portal; Prisma client
 * OUTPUT: created CtosReport row (selected fields)
 * WHERE USED: admin routes (org + application for issuer)
 */

import {
  Prisma,
  ReviewStepStatus,
  type CtosReport,
  type InvestorOrganization,
  type IssuerOrganization,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";
import { getCtosConfig } from "./config";
import { callCtosSoap } from "./client";
import { buildCtosEnquiryXml, buildCtosSubjectEnquiryXml } from "./enquiry-builder";
import { parseCtosReportXml } from "./parser";
import { renderCtosReportHtml } from "./render-html";
import {
  normalizeCtosSubjectRefKey,
  resolveCtosSubjectFromOrgJson,
  type CtosSubjectKind,
} from "./resolve-subject-from-org";
import { OrganizationService } from "../organization/service";
import { runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert } from "../notification/director-shareholder-notifications";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { filterVisiblePeopleRows, normalizeRawStatus, type ApplicationPersonRow } from "@cashsouk/types";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";

export type AdminOrgCtosPortal = "issuer" | "investor";

/**
 * SECTION: AML status helpers for CTOS-triggered financial review reset
 * WHY: Keep reset condition aligned to screening.status only
 * INPUT: Application person rows + application status
 * OUTPUT: booleans for pending/all-approved/final checks
 * WHERE USED: CTOS org report insert hooks
 */
function isAmlApprovedFromScreening(person: ApplicationPersonRow): boolean {
  return normalizeRawStatus(person.screening?.status) === "APPROVED";
}

function visibleIndividualsForAml(people: ApplicationPersonRow[]): ApplicationPersonRow[] {
  return filterVisiblePeopleRows(people).filter((person) => person.entityType === "INDIVIDUAL");
}

function hasPendingAmlIndividuals(individuals: ApplicationPersonRow[]): boolean {
  return individuals.some((person) => !isAmlApprovedFromScreening(person));
}

function isFinalApplicationStatus(status: string | null | undefined): boolean {
  return status === "APPROVED" || status === "FUNDED" || status === "COMPLETED";
}

async function resetFinancialReviewAfterCtosUpdateIfNeeded(params: {
  issuerOrganizationId: string;
  corporateEntities: Prisma.JsonValue;
  directorKycStatus: Prisma.JsonValue;
  directorAmlStatus: Prisma.JsonValue;
  ctosCompanyJson: Prisma.JsonValue;
  ctosPartySupplements: { partyKey: string; onboardingJson: unknown }[];
}): Promise<void> {
  const people = buildAdminPeopleList({
    ctos: params.ctosCompanyJson ?? null,
    issuerDirectorKycStatus: params.directorKycStatus ?? null,
    issuerDirectorAmlStatus: params.directorAmlStatus ?? null,
    ctosPartySupplements: params.ctosPartySupplements,
    corporateEntities: params.corporateEntities ?? null,
  });
  const individuals = visibleIndividualsForAml(people);
  const nowHasPending = hasPendingAmlIndividuals(individuals);
  if (!nowHasPending) return;

  const applicationsToReset = await prisma.applicationReview.findMany({
    where: {
      section: "financial",
      status: ReviewStepStatus.APPROVED,
      application: {
        issuer_organization_id: params.issuerOrganizationId,
        status: { notIn: ["APPROVED", "COMPLETED"] },
      },
    },
    select: { application_id: true, application: { select: { status: true } } },
  });
  const rowsToReset = applicationsToReset.filter(
    (row) => !isFinalApplicationStatus(row.application?.status ?? null)
  );
  if (rowsToReset.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const row of rowsToReset) {
      await tx.applicationReview.update({
        where: {
          application_id_section: { application_id: row.application_id, section: "financial" },
        },
        data: {
          status: ReviewStepStatus.PENDING,
          reviewer_user_id: null,
          reviewed_at: null,
        },
      });
      await logApplicationActivity({
        userId: "system",
        applicationId: row.application_id,
        eventType: ApplicationLogEventType.SECTION_REVIEWED_PENDING,
        portal: ActivityPortal.ADMIN,
        remark: "Reset due to CTOS update / AML pending",
        metadata: { scope: "section", scope_key: "financial", old_status: "APPROVED", new_status: "PENDING" },
      });
    }
  });
}

function fallbackRegistrationNumberFromCorporateOnboardingData(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const basicInfo = (raw as { basicInfo?: unknown }).basicInfo;
  if (!basicInfo || typeof basicInfo !== "object" || Array.isArray(basicInfo)) return null;
  const ssmRegistrationNumber = (basicInfo as { ssmRegistrationNumber?: unknown }).ssmRegistrationNumber;
  const ssmRegisterNumber = (basicInfo as { ssmRegisterNumber?: unknown }).ssmRegisterNumber;
  const candidate =
    (typeof ssmRegistrationNumber === "string" ? ssmRegistrationNumber : "") ||
    (typeof ssmRegisterNumber === "string" ? ssmRegisterNumber : "");
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const listSelect = {
  id: true,
  issuer_organization_id: true,
  investor_organization_id: true,
  subject_ref: true,
  fetched_at: true,
  created_at: true,
  updated_at: true,
  report_html: true,
  company_json: true,
  financials_json: true,
} satisfies Prisma.CtosReportSelect;

export type CtosReportListItem = Omit<
  Prisma.CtosReportGetPayload<{ select: typeof listSelect }>,
  "report_html"
> & {
  has_report_html: boolean;
};

function toListItem(row: Prisma.CtosReportGetPayload<{ select: typeof listSelect }>): CtosReportListItem {
  const { report_html, ...rest } = row;
  return {
    ...rest,
    has_report_html: Boolean(report_html && report_html.length > 0),
  };
}

function orgScope(portal: AdminOrgCtosPortal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId }
    : { investor_organization_id: organizationId };
}

function orgFkCreate(portal: AdminOrgCtosPortal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null as string | null }
    : { issuer_organization_id: null as string | null, investor_organization_id: organizationId };
}

type OrgRowForSubject = {
  corporate_entities: Prisma.JsonValue;
  director_kyc_status: Prisma.JsonValue;
};

async function loadOrgForAdminCtos(
  portal: AdminOrgCtosPortal,
  organizationId: string
): Promise<{ enquiryOrg: IssuerOrganization | InvestorOrganization; subjectOrg: OrgRowForSubject }> {
  if (portal === "issuer") {
    const org = await prisma.issuerOrganization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
    }
    return { enquiryOrg: org, subjectOrg: org };
  }
  const org = await prisma.investorOrganization.findUnique({ where: { id: organizationId } });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Investor organization not found");
  }
  return { enquiryOrg: org, subjectOrg: org };
}

export async function listCtosReportsForIssuerOrg(issuerOrganizationId: string): Promise<CtosReportListItem[]> {
  const rows = await prisma.ctosReport.findMany({
    where: { issuer_organization_id: issuerOrganizationId, subject_ref: null },
    orderBy: { fetched_at: "desc" },
    select: listSelect,
  });
  return rows.map(toListItem);
}

export async function listCtosReportsForAdminOrg(
  portal: AdminOrgCtosPortal,
  organizationId: string
): Promise<CtosReportListItem[]> {
  const rows = await prisma.ctosReport.findMany({
    where: { ...orgScope(portal, organizationId), subject_ref: null },
    orderBy: { fetched_at: "desc" },
    select: listSelect,
  });
  return rows.map(toListItem);
}

/**
 * Latest snapshot per subject_ref (non-null), for admin Director/Shareholder CTOS actions.
 */
export async function listLatestCtosSubjectReportsForIssuerOrg(
  issuerOrganizationId: string
): Promise<CtosReportListItem[]> {
  const rows = await prisma.ctosReport.findMany({
    where: { issuer_organization_id: issuerOrganizationId, subject_ref: { not: null } },
    orderBy: { fetched_at: "desc" },
    select: listSelect,
  });
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (const r of rows) {
    const k = r.subject_ref!;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return deduped.map(toListItem);
}

export async function listLatestCtosSubjectReportsForAdminOrg(
  portal: AdminOrgCtosPortal,
  organizationId: string
): Promise<CtosReportListItem[]> {
  const rows = await prisma.ctosReport.findMany({
    where: { ...orgScope(portal, organizationId), subject_ref: { not: null } },
    orderBy: { fetched_at: "desc" },
    select: listSelect,
  });
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (const r of rows) {
    const k = r.subject_ref!;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return deduped.map(toListItem);
}

export async function getCtosReportById(
  issuerOrganizationId: string,
  reportId: string
): Promise<CtosReport | null> {
  return prisma.ctosReport.findFirst({
    where: { id: reportId, issuer_organization_id: issuerOrganizationId },
  });
}

export async function getCtosReportByAdminOrg(
  portal: AdminOrgCtosPortal,
  organizationId: string,
  reportId: string
): Promise<CtosReport | null> {
  return prisma.ctosReport.findFirst({
    where: { id: reportId, ...orgScope(portal, organizationId) },
  });
}

export async function fetchAndInsertCtosReport(
  issuerOrganizationId: string,
  correlationId?: string
): Promise<CtosReport> {
  const cfg = getCtosConfig();
  if (!cfg) {
    throw new AppError(503, "CTOS_UNAVAILABLE", "CTOS integration is not configured");
  }

  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
  });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
  }

  const regNoFallback = fallbackRegistrationNumberFromCorporateOnboardingData(
    (org as { corporate_onboarding_data?: unknown }).corporate_onboarding_data ?? null
  );
  const enquiryOrg = {
    ...org,
    registration_number: (org.registration_number ?? "").trim() || regNoFallback,
  };

  const innerXml = buildCtosEnquiryXml(cfg, enquiryOrg);
  let rawXml: string;
  try {
    rawXml = await callCtosSoap(cfg, innerXml);
  } catch (e) {
    logger.error(
      { correlationId, issuerOrganizationId, err: e instanceof Error ? e.message : String(e) },
      "CTOS SOAP fetch failed"
    );
    throw new AppError(502, "CTOS_FETCH_FAILED", "Failed to retrieve CTOS report");
  }

  const parsed = await parseCtosReportXml(rawXml);
  let reportHtml: string | null = null;
  try {
    reportHtml = renderCtosReportHtml(rawXml);
  } catch (e) {
    logger.warn(
      { correlationId, issuerOrganizationId, err: e instanceof Error ? e.message : String(e) },
      "CTOS HTML render skipped"
    );
  }

  const fetchedAt = new Date();

  const orgSvc = new OrganizationService();
  const beforeExtras = await orgSvc.getIssuerPartyListExtras(issuerOrganizationId);
  const orgForPeople = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: {
      owner_user_id: true,
      corporate_entities: true,
      director_kyc_status: true,
      director_aml_status: true,
    },
  });

  const row = await prisma.ctosReport.create({
    data: {
      issuer_organization_id: issuerOrganizationId,
      investor_organization_id: null,
      subject_ref: null,
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json:
        parsed.company_json === null ? Prisma.DbNull : (parsed.company_json as Prisma.InputJsonValue),
      person_json:
        parsed.person_json === null
          ? Prisma.DbNull
          : (parsed.person_json as unknown as Prisma.InputJsonValue),
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  if (orgForPeople?.owner_user_id) {
    try {
      await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        issuerOrganizationId,
        ownerUserId: orgForPeople.owner_user_id,
        beforeCompanyJson: beforeExtras.latestOrganizationCtosCompanyJson ?? null,
        afterCompanyJson: row.company_json,
        newCtosReportId: row.id,
        corporateEntities: orgForPeople.corporate_entities ?? null,
        directorKycStatus: orgForPeople.director_kyc_status ?? null,
        directorAmlStatus: orgForPeople.director_aml_status ?? null,
        supplements: beforeExtras.ctosPartySupplements,
      });
    } catch (e) {
      logger.warn(
        {
          issuerOrganizationId,
          err: e instanceof Error ? e.message : String(e),
        },
        "Director/shareholder notification hook after CTOS org report failed (non-blocking)"
      );
    }
  }

  if (orgForPeople) {
    await resetFinancialReviewAfterCtosUpdateIfNeeded({
      issuerOrganizationId,
      corporateEntities: orgForPeople.corporate_entities ?? null,
      directorKycStatus: orgForPeople.director_kyc_status ?? null,
      directorAmlStatus: orgForPeople.director_aml_status ?? null,
      ctosCompanyJson: row.company_json,
      ctosPartySupplements: beforeExtras.ctosPartySupplements,
    });
  }

  logger.debug(
    { rowId: row.id, issuerOrganizationId },
    "Inserted CTOS report row for issuer org"
  );
  logger.debug(
    {
      id: row.id,
      issuer_organization_id: row.issuer_organization_id,
      fetched_at: row.fetched_at,
    },
    "CTOS persisted report row summary"
  );
  return row;
}

export type FetchCtosReportForAdminOrgOptions = {
  /** When true, do not run director/shareholder notification/email hook (e.g. admin onboarding review CTOS pull). */
  skipDirectorShareholderNotifications?: boolean;
};

export async function fetchAndInsertCtosReportForAdminOrg(
  portal: AdminOrgCtosPortal,
  organizationId: string,
  correlationId?: string,
  options?: FetchCtosReportForAdminOrgOptions
): Promise<CtosReport> {
  const cfg = getCtosConfig();
  if (!cfg) {
    throw new AppError(503, "CTOS_UNAVAILABLE", "CTOS integration is not configured");
  }

  const { enquiryOrg } = await loadOrgForAdminCtos(portal, organizationId);
  const regNoFallback = fallbackRegistrationNumberFromCorporateOnboardingData(
    (enquiryOrg as { corporate_onboarding_data?: unknown }).corporate_onboarding_data ?? null
  );
  const enquiryOrgWithFallback = {
    ...enquiryOrg,
    registration_number: (enquiryOrg.registration_number ?? "").trim() || regNoFallback,
  };
  const innerXml = buildCtosEnquiryXml(cfg, enquiryOrgWithFallback);
  let rawXml: string;
  try {
    rawXml = await callCtosSoap(cfg, innerXml);
  } catch (e) {
    logger.error(
      {
        correlationId,
        portal,
        organizationId,
        err: e instanceof Error ? e.message : String(e),
      },
      "CTOS SOAP fetch failed"
    );
    throw new AppError(502, "CTOS_FETCH_FAILED", "Failed to retrieve CTOS report");
  }

  const parsed = await parseCtosReportXml(rawXml);
  let reportHtml: string | null = null;
  try {
    reportHtml = renderCtosReportHtml(rawXml);
  } catch (e) {
    logger.warn(
      { correlationId, portal, organizationId, err: e instanceof Error ? e.message : String(e) },
      "CTOS HTML render skipped"
    );
  }

  const fetchedAt = new Date();

  let beforeExtras: Awaited<ReturnType<OrganizationService["getIssuerPartyListExtras"]>> | null = null;
  let orgForPeople: {
    owner_user_id: string;
    corporate_entities: Prisma.JsonValue;
    director_kyc_status: Prisma.JsonValue;
    director_aml_status: Prisma.JsonValue;
  } | null = null;
  if (portal === "issuer") {
    const orgSvc = new OrganizationService();
    beforeExtras = await orgSvc.getIssuerPartyListExtras(organizationId);
    orgForPeople = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      select: {
        owner_user_id: true,
        corporate_entities: true,
        director_kyc_status: true,
        director_aml_status: true,
      },
    });
  }

  const row = await prisma.ctosReport.create({
    data: {
      ...orgFkCreate(portal, organizationId),
      subject_ref: null,
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json:
        parsed.company_json === null ? Prisma.DbNull : (parsed.company_json as Prisma.InputJsonValue),
      person_json:
        parsed.person_json === null
          ? Prisma.DbNull
          : (parsed.person_json as unknown as Prisma.InputJsonValue),
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  if (
    portal === "issuer" &&
    beforeExtras &&
    orgForPeople?.owner_user_id &&
    !options?.skipDirectorShareholderNotifications
  ) {
    try {
      await runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert({
        issuerOrganizationId: organizationId,
        ownerUserId: orgForPeople.owner_user_id,
        beforeCompanyJson: beforeExtras.latestOrganizationCtosCompanyJson ?? null,
        afterCompanyJson: row.company_json,
        newCtosReportId: row.id,
        corporateEntities: orgForPeople.corporate_entities ?? null,
        directorKycStatus: orgForPeople.director_kyc_status ?? null,
        directorAmlStatus: orgForPeople.director_aml_status ?? null,
        supplements: beforeExtras.ctosPartySupplements,
      });
    } catch (e) {
      logger.warn(
        {
          portal,
          organizationId,
          err: e instanceof Error ? e.message : String(e),
        },
        "Director/shareholder notification hook after admin CTOS org report failed (non-blocking)"
      );
    }
  } else if (portal === "issuer" && options?.skipDirectorShareholderNotifications) {
    logger.info(
      { organizationId, correlationId },
      "CTOS org report inserted from admin; skipped director/shareholder notifications (requested)"
    );
  }

  if (portal === "issuer" && orgForPeople && beforeExtras) {
    await resetFinancialReviewAfterCtosUpdateIfNeeded({
      issuerOrganizationId: organizationId,
      corporateEntities: orgForPeople.corporate_entities ?? null,
      directorKycStatus: orgForPeople.director_kyc_status ?? null,
      directorAmlStatus: orgForPeople.director_aml_status ?? null,
      ctosCompanyJson: row.company_json,
      ctosPartySupplements: beforeExtras.ctosPartySupplements,
    });
  }

  logger.debug(
    { rowId: row.id, portal, organizationId },
    "Inserted CTOS report row (admin org)"
  );
  logger.debug(
    {
      id: row.id,
      portal,
      organizationId,
      subject_ref: row.subject_ref,
      fetched_at: row.fetched_at,
    },
    "CTOS persisted report row summary (admin org)"
  );
  return row;
}

export async function fetchAndInsertCtosSubjectReport(
  issuerOrganizationId: string,
  input: {
    subjectRef: string;
    subjectKind: CtosSubjectKind;
    enquiryOverride?: { displayName: string; idNumber: string };
  },
  correlationId?: string
): Promise<CtosReport> {
  const cfg = getCtosConfig();
  if (!cfg) {
    throw new AppError(503, "CTOS_UNAVAILABLE", "CTOS integration is not configured");
  }

  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
  });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
  }

  let resolved: { displayName: string; idNumber: string };
  if (input.enquiryOverride) {
    const displayName = input.enquiryOverride.displayName.trim();
    const idNumber = input.enquiryOverride.idNumber.trim();
    if (!displayName || !idNumber) {
      throw new AppError(400, "CTOS_SUBJECT_INVALID", "enquiryOverride requires display name and id number");
    }
    resolved = { displayName, idNumber };
  } else {
    const r = resolveCtosSubjectFromOrgJson(
      org.corporate_entities,
      org.director_kyc_status,
      input.subjectRef.trim(),
      input.subjectKind
    );
    if (!r) {
      throw new AppError(400, "CTOS_SUBJECT_UNKNOWN", "Subject not found for this organization or missing IC/SSM");
    }
    resolved = r;
  }

  const innerXml = buildCtosSubjectEnquiryXml(cfg, {
    kind: input.subjectKind,
    displayName: resolved.displayName,
    idNumber: resolved.idNumber,
  });

  let rawXml: string;
  try {
    rawXml = await callCtosSoap(cfg, innerXml);
  } catch (e) {
    logger.error(
      {
        correlationId,
        issuerOrganizationId,
        subjectRef: input.subjectRef,
        err: e instanceof Error ? e.message : String(e),
      },
      "CTOS SOAP fetch failed (subject)"
    );
    throw new AppError(502, "CTOS_FETCH_FAILED", "Failed to retrieve CTOS report");
  }

  const parsed = await parseCtosReportXml(rawXml);
  let reportHtml: string | null = null;
  try {
    reportHtml = renderCtosReportHtml(rawXml);
  } catch (e) {
    logger.warn(
      { correlationId, issuerOrganizationId, err: e instanceof Error ? e.message : String(e) },
      "CTOS HTML render skipped (subject)"
    );
  }

  const fetchedAt = new Date();
  const subjectRefPersisted = normalizeCtosSubjectRefKey(resolved.idNumber);
  const row = await prisma.ctosReport.create({
    data: {
      issuer_organization_id: issuerOrganizationId,
      investor_organization_id: null,
      subject_ref: subjectRefPersisted,
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json:
        parsed.company_json === null ? Prisma.DbNull : (parsed.company_json as Prisma.InputJsonValue),
      person_json:
        parsed.person_json === null
          ? Prisma.DbNull
          : (parsed.person_json as unknown as Prisma.InputJsonValue),
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  logger.debug(
    {
      rowId: row.id,
      subjectRefPersisted,
      issuerOrganizationId,
    },
    "Inserted CTOS subject report row"
  );
  logger.debug(
    {
      id: row.id,
      subject_ref: row.subject_ref,
      issuer_organization_id: row.issuer_organization_id,
    },
    "CTOS persisted subject report row summary"
  );
  return row;
}

export async function fetchAndInsertCtosSubjectReportForAdminOrg(
  portal: AdminOrgCtosPortal,
  organizationId: string,
  input: {
    subjectRef: string;
    subjectKind: CtosSubjectKind;
    enquiryOverride?: { displayName: string; idNumber: string };
  },
  correlationId?: string
): Promise<CtosReport> {
  const cfg = getCtosConfig();
  if (!cfg) {
    throw new AppError(503, "CTOS_UNAVAILABLE", "CTOS integration is not configured");
  }

  const { subjectOrg } = await loadOrgForAdminCtos(portal, organizationId);

  let resolved: { displayName: string; idNumber: string };
  if (input.enquiryOverride) {
    const displayName = input.enquiryOverride.displayName.trim();
    const idNumber = input.enquiryOverride.idNumber.trim();
    if (!displayName || !idNumber) {
      throw new AppError(400, "CTOS_SUBJECT_INVALID", "enquiryOverride requires display name and id number");
    }
    resolved = { displayName, idNumber };
  } else {
    const r = resolveCtosSubjectFromOrgJson(
      subjectOrg.corporate_entities,
      subjectOrg.director_kyc_status,
      input.subjectRef.trim(),
      input.subjectKind
    );
    if (!r) {
      throw new AppError(400, "CTOS_SUBJECT_UNKNOWN", "Subject not found for this organization or missing IC/SSM");
    }
    resolved = r;
  }

  const innerXml = buildCtosSubjectEnquiryXml(cfg, {
    kind: input.subjectKind,
    displayName: resolved.displayName,
    idNumber: resolved.idNumber,
  });

  let rawXml: string;
  try {
    rawXml = await callCtosSoap(cfg, innerXml);
  } catch (e) {
    logger.error(
      {
        correlationId,
        portal,
        organizationId,
        subjectRef: input.subjectRef,
        err: e instanceof Error ? e.message : String(e),
      },
      "CTOS SOAP fetch failed (subject)"
    );
    throw new AppError(502, "CTOS_FETCH_FAILED", "Failed to retrieve CTOS report");
  }

  const parsed = await parseCtosReportXml(rawXml);
  let reportHtml: string | null = null;
  try {
    reportHtml = renderCtosReportHtml(rawXml);
  } catch (e) {
    logger.warn(
      { correlationId, portal, organizationId, err: e instanceof Error ? e.message : String(e) },
      "CTOS HTML render skipped (subject)"
    );
  }

  const fetchedAt = new Date();
  const subjectRefPersisted = normalizeCtosSubjectRefKey(resolved.idNumber);
  const row = await prisma.ctosReport.create({
    data: {
      ...orgFkCreate(portal, organizationId),
      subject_ref: subjectRefPersisted,
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json:
        parsed.company_json === null ? Prisma.DbNull : (parsed.company_json as Prisma.InputJsonValue),
      person_json:
        parsed.person_json === null
          ? Prisma.DbNull
          : (parsed.person_json as unknown as Prisma.InputJsonValue),
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  logger.debug(
    {
      rowId: row.id,
      subjectRefPersisted,
      portal,
      organizationId,
    },
    "Inserted CTOS subject report row (admin org)"
  );
  logger.debug(
    {
      id: row.id,
      subject_ref: row.subject_ref,
      portal,
      organizationId,
    },
    "CTOS persisted subject report row summary (admin org)"
  );
  return row;
}
