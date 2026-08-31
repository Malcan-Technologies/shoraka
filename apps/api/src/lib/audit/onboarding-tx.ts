/**
 * Same-database onboarding state + evidence writes.
 *
 * Material onboarding/status mutations must not commit if the corresponding
 * onboarding_logs row cannot be written. Callers pass every evidence row that
 * belongs to this mutation; the transaction rolls back if any insert fails.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { createOnboardingLogRow, CreateOnboardingLogParams } from "./account-logs";

export async function persistOrganizationUpdateAndOnboardingLogs(params: {
  portalType: "investor" | "issuer";
  organizationId: string;
  data: Prisma.InvestorOrganizationUpdateInput | Prisma.IssuerOrganizationUpdateInput;
  logs: CreateOnboardingLogParams[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (params.portalType === "investor") {
      await tx.investorOrganization.update({
        where: { id: params.organizationId },
        data: params.data as Prisma.InvestorOrganizationUpdateInput,
      });
    } else {
      await tx.issuerOrganization.update({
        where: { id: params.organizationId },
        data: params.data as Prisma.IssuerOrganizationUpdateInput,
      });
    }
    for (const log of params.logs) {
      await createOnboardingLogRow(log, tx);
    }
  });
}
