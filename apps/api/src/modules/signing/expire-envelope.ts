import type { Prisma } from "@prisma/client";
import {
  AUDIT_SOURCE,
  systemAuditContext,
  type AuditRequestContext,
} from "../../lib/audit/context";
import {
  SIGNING_AUDIT_TARGET_TYPE,
  SIGNING_EXPIRY_TRIGGER,
  type SigningExpiryTrigger,
} from "./audit/events";
import { writeSigningAuditLog } from "./audit/writer";

const ACTIVE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;

export { SIGNING_EXPIRY_TRIGGER };
export type { SigningExpiryTrigger };

export type ExpireSigningEnvelopeInput = {
  envelopeId: string;
  previousStatus: string;
  expiresAt: Date | null;
  trigger: SigningExpiryTrigger;
  applicationId: string;
  organizationId?: string | null;
  context?: AuditRequestContext;
};

export async function expireSigningEnvelopeInTx(
  tx: Prisma.TransactionClient,
  input: ExpireSigningEnvelopeInput
): Promise<boolean> {
  if (!ACTIVE_ENVELOPE_STATUSES.includes(input.previousStatus as (typeof ACTIVE_ENVELOPE_STATUSES)[number])) {
    return false;
  }

  const result = await tx.signingEnvelope.updateMany({
    where: {
      id: input.envelopeId,
      status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
    },
    data: { status: "EXPIRED" },
  });
  if (result.count === 0) return false;

  await writeSigningAuditLog(
    {
      eventType: "SIGNING_PACKAGE_EXPIRED",
      context:
        input.context ??
        systemAuditContext({ source: AUDIT_SOURCE.SYSTEM_JOB, portal: null }),
      signingEnvelopeId: input.envelopeId,
      applicationId: input.applicationId,
      organizationId: input.organizationId,
      targetType: SIGNING_AUDIT_TARGET_TYPE.ENVELOPE,
      targetId: input.envelopeId,
      metadata: {
        previousStatus: input.previousStatus,
        newStatus: "EXPIRED",
        expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
        trigger: input.trigger,
      },
    },
    tx
  );

  return true;
}
