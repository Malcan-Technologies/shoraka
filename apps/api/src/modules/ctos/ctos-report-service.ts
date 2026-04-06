/**
 * SECTION: Persist CTOS snapshots per issuer org
 * WHY: Append-only reports; orchestrate fetch, parse, HTML, DB insert
 * INPUT: issuer org id; Prisma client
 * OUTPUT: created CtosReport row (selected fields)
 * WHERE USED: admin routes
 */

import type { CtosReport, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";
import { getCtosConfig } from "./config";
import { callCtosSoap } from "./client";
import { buildCtosEnquiryXml, buildCtosSubjectEnquiryXml } from "./enquiry-builder";
import { parseCtosReportXml } from "./parser";
import { renderCtosReportHtml } from "./render-html";
import { resolveCtosSubjectFromOrgJson, type CtosSubjectKind } from "./resolve-subject-from-org";

const listSelect = {
  id: true,
  issuer_organization_id: true,
  subject_ref: true,
  fetched_at: true,
  created_at: true,
  updated_at: true,
  report_html: true,
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

export async function listCtosReportsForIssuerOrg(issuerOrganizationId: string): Promise<CtosReportListItem[]> {
  const rows = await prisma.ctosReport.findMany({
    where: { issuer_organization_id: issuerOrganizationId, subject_ref: null },
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

export async function getCtosReportById(
  issuerOrganizationId: string,
  reportId: string
): Promise<CtosReport | null> {
  return prisma.ctosReport.findFirst({
    where: { id: reportId, issuer_organization_id: issuerOrganizationId },
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

  const innerXml = buildCtosEnquiryXml(cfg, org);
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

  const row = await prisma.ctosReport.create({
    data: {
      issuer_organization_id: issuerOrganizationId,
      subject_ref: null,
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json: parsed.company_json as Prisma.InputJsonValue,
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  console.log("Inserted CTOS report row:", row.id, "for org:", issuerOrganizationId);
  return row;
}

export async function fetchAndInsertCtosSubjectReport(
  issuerOrganizationId: string,
  input: { subjectRef: string; subjectKind: CtosSubjectKind },
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

  const resolved = resolveCtosSubjectFromOrgJson(
    org.corporate_entities,
    org.director_kyc_status,
    input.subjectRef.trim(),
    input.subjectKind
  );
  if (!resolved) {
    throw new AppError(400, "CTOS_SUBJECT_UNKNOWN", "Subject not found for this organization or missing IC/SSM");
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
  const row = await prisma.ctosReport.create({
    data: {
      issuer_organization_id: issuerOrganizationId,
      subject_ref: input.subjectRef.trim(),
      fetched_at: fetchedAt,
      raw_xml: parsed.raw_xml,
      report_html: reportHtml,
      summary_json: parsed.summary_json as Prisma.InputJsonValue,
      company_json: parsed.company_json as Prisma.InputJsonValue,
      legal_json: parsed.legal_json as Prisma.InputJsonValue,
      ccris_json: parsed.ccris_json as Prisma.InputJsonValue,
      financials_json: parsed.financials_json as unknown as Prisma.InputJsonValue,
    },
  });

  console.log("Inserted CTOS subject report row:", row.id, "subject_ref:", input.subjectRef, "org:", issuerOrganizationId);
  return row;
}
