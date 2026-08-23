import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { AuditRequestContext } from "../../../lib/audit/context";
import { writeOnboardingAuditLog } from "./writer";
import { ONBOARDING_AUDIT_TARGET_TYPE } from "./events";
import type { DirectorKycFinalOutcome } from "./diff";

export async function writeDirectorKycOutcomeAuditLogs(
  params: {
    outcomes: DirectorKycFinalOutcome[];
    context: AuditRequestContext;
    subjectUserId?: string | null;
    onboardingId?: string | null;
    organizationId: string;
    organizationKind: "INVESTOR" | "ISSUER";
    organizationType?: "PERSONAL" | "COMPANY" | null;
  },
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  for (const outcome of params.outcomes) {
    const targetId = outcome.eodRequestId || outcome.partyKey || params.organizationId;
    await writeOnboardingAuditLog(
      {
        eventType: "DIRECTOR_KYC_STATUS_UPDATED",
        context: params.context,
        subjectUserId: params.subjectUserId,
        onboardingId: params.onboardingId,
        organizationId: params.organizationId,
        organizationKind: params.organizationKind,
        organizationType: params.organizationType ?? "COMPANY",
        targetType: ONBOARDING_AUDIT_TARGET_TYPE.DIRECTOR,
        targetId,
        metadata: {
          previousKycStatus: outcome.previousKycStatus,
          newKycStatus: outcome.newKycStatus,
          ...(outcome.eodRequestId ? { eodRequestId: outcome.eodRequestId } : {}),
          ...(outcome.partyKey ? { partyKey: outcome.partyKey } : {}),
          ...(outcome.directorName ? { directorName: outcome.directorName } : {}),
        },
      },
      db
    );
  }
}
