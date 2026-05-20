import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { financialStatementsV2Schema } from "./schemas";

/**
 * Upsert the latest reusable org financial statements for an issuer organization.
 *
 * Important:
 * - This is for "latest prefill" only (org-level reusable data).
 * - Do not break submit/resubmit if the application has no financial_statements
 *   (e.g. legacy data or optional step).
 */
export async function upsertLatestOrganizationFinancialStatementsFromApplication(params: {
  applicationId: string;
  sourceApplicationRevisionId?: string | null;
}): Promise<void> {
  const { applicationId, sourceApplicationRevisionId = null } = params;

  const application = await prisma.application.findUnique({
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
    await prisma.issuerOrganizationFinancialStatement.upsert({
      where: { issuer_organization_id: issuerOrganizationId },
      create: {
        issuer_organization_id: issuerOrganizationId,
        financial_statements: parsed.data as unknown as any,
        source_application_id: applicationId,
        source_application_revision_id: sourceApplicationRevisionId,
      },
      update: {
        financial_statements: parsed.data as unknown as any,
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

