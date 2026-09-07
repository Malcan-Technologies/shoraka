import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { financialStatementsV2Schema, type FinancialStatementsV2Stored } from "./schemas";

type FinancialStatementClient = typeof prisma | Prisma.TransactionClient;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function yearBlockFromUnknown(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? { ...value } : {};
}

/**
 * Merge application financial JSON into the issuer org master.
 *
 * Application year blocks may update only the keys they actually contain.
 * Zod defaults (e.g. curlib: 0) must not wipe richer master keys omitted from the payload.
 * Do not convert non-equivalent fields (curlib ≠ borrowing splits, turnover ≠ full revenue, etc.).
 */
export function mergeIssuerOrgFinancialStatementsFromApplication(params: {
  existing: unknown;
  incomingRaw: unknown;
  incomingParsed: FinancialStatementsV2Stored;
}): Record<string, unknown> {
  const existing = isPlainObject(params.existing) ? { ...params.existing } : {};
  const existingByYear = isPlainObject(existing.unaudited_by_year)
    ? { ...(existing.unaudited_by_year as Record<string, unknown>) }
    : {};
  const raw = isPlainObject(params.incomingRaw) ? params.incomingRaw : {};
  const rawByYear = isPlainObject(raw.unaudited_by_year) ? raw.unaudited_by_year : {};

  const mergedByYear: Record<string, unknown> = { ...existingByYear };
  for (const year of Object.keys(params.incomingParsed.unaudited_by_year)) {
    const currentBlock = yearBlockFromUnknown(mergedByYear[year]);
    const rawBlock = yearBlockFromUnknown(rawByYear[year]);
    const next = { ...currentBlock };
    for (const [key, value] of Object.entries(rawBlock)) {
      if (value !== undefined) next[key] = value;
    }
    mergedByYear[year] = next;
  }

  return {
    ...existing,
    questionnaire: params.incomingParsed.questionnaire ?? existing.questionnaire,
    unaudited_by_year: mergedByYear,
  };
}

/**
 * Upsert the latest reusable org financial statements for an issuer organization.
 *
 * Important:
 * - This is for "latest prefill" only (org-level reusable data).
 * - Do not break submit/resubmit if the application has no financial_statements
 *   (e.g. legacy data or optional step).
 * - Incoming application payloads merge into existing master year blocks. They must
 *   not replace the whole JSON and erase richer ComRep fields completed on Profile.
 */
export async function upsertLatestOrganizationFinancialStatementsFromApplication(params: {
  applicationId: string;
  sourceApplicationRevisionId?: string | null;
  db?: FinancialStatementClient;
}): Promise<void> {
  const { applicationId, sourceApplicationRevisionId = null, db = prisma } = params;

  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { issuer_organization_id: true, financial_statements: true },
  });

  const issuerOrganizationId = application?.issuer_organization_id;
  const financialStatements = application?.financial_statements;

  if (!issuerOrganizationId) return;
  if (!financialStatements) return;

  const parsed = financialStatementsV2Schema.safeParse(financialStatements);
  if (!parsed.success) {
    logger.warn(
      { applicationId, issuerOrganizationId, issues: parsed.error.issues },
      "Skip upsert: application financial_statements not compatible with expected v2 shape"
    );
    return;
  }

  try {
    const existing = await db.issuerOrganizationFinancialStatement.findUnique({
      where: { issuer_organization_id: issuerOrganizationId },
      select: { financial_statements: true },
    });
    const merged = mergeIssuerOrgFinancialStatementsFromApplication({
      existing: existing?.financial_statements,
      incomingRaw: financialStatements,
      incomingParsed: parsed.data,
    });
    await db.issuerOrganizationFinancialStatement.upsert({
      where: { issuer_organization_id: issuerOrganizationId },
      create: {
        issuer_organization_id: issuerOrganizationId,
        financial_statements: merged as Prisma.InputJsonValue,
        source_application_id: applicationId,
        source_application_revision_id: sourceApplicationRevisionId,
      },
      update: {
        financial_statements: merged as Prisma.InputJsonValue,
        source_application_id: applicationId,
        source_application_revision_id: sourceApplicationRevisionId,
      },
    });
  } catch (error) {
    logger.error(
      { error, applicationId, issuerOrganizationId, sourceApplicationRevisionId },
      "Failed to upsert latest issuer organization financial statements"
    );
    throw error;
  }
}
