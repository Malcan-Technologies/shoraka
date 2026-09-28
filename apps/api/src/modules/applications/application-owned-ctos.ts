/**
 * CTOS financials that belong to one application.
 * A submitted application keeps the organisation report that existed at first submission.
 * Later CTOS pulls stay on the organisation and on new applications. They do not replace this one.
 * A draft that has never been submitted still sees the latest report.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type CtosReader = PrismaClient | Prisma.TransactionClient;

export type ApplicationOwnedCtosFinancialReport = {
  id: string;
  fetchedAt: Date;
  financialsJson: unknown;
};

export async function loadApplicationOwnedCtosFinancialReport(params: {
  issuerOrganizationId: string;
  /** Application.submitted_at. Null while the application is still a draft. */
  submittedAt: Date | null;
  db?: CtosReader;
}): Promise<ApplicationOwnedCtosFinancialReport | null> {
  const db = params.db ?? prisma;
  const report = await db.ctosReport.findFirst({
    where: {
      issuer_organization_id: params.issuerOrganizationId,
      subject_ref: null,
      ...(params.submittedAt ? { fetched_at: { lte: params.submittedAt } } : {}),
    },
    orderBy: { fetched_at: "desc" },
    select: { id: true, fetched_at: true, financials_json: true },
  });
  if (!report) return null;
  return {
    id: report.id,
    fetchedAt: report.fetched_at,
    financialsJson: report.financials_json,
  };
}
