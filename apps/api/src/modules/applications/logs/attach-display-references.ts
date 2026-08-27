import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { snapshotBusinessReference } from "../../../lib/audit/display-references";
import { AUDIT_TARGET_TYPE } from "../../../lib/audit";
import { CreateApplicationLogParams } from "./types";
import { resolveApplicationLogTarget } from "./audit-fields";

type ApplicationLogDb = Prisma.TransactionClient | typeof prisma;

/**
 * Best-effort display-reference snapshot. Failures are swallowed by the caller so a lookup never
 * drops the audit row. Never copies a UUID into *Reference fields.
 */
export async function attachApplicationLogDisplayReferences(
  params: CreateApplicationLogParams,
  db: ApplicationLogDb
): Promise<CreateApplicationLogParams> {
  const metadata = { ...(params.metadata ?? {}) };
  const applicationId = params.applicationId ?? null;
  const { targetType, targetId } = resolveApplicationLogTarget(params.eventType, {
    applicationId,
    entityId: params.entityId ?? null,
    metadata,
  });

  const alreadyHasApplicationRef = snapshotBusinessReference(
    typeof metadata.applicationReference === "string"
      ? metadata.applicationReference
      : params.applicationReference
  );
  if (!alreadyHasApplicationRef && applicationId) {
    const application = await db.application.findUnique({
      where: { id: applicationId },
      select: { display_reference: true },
    });
    const ref = snapshotBusinessReference(application?.display_reference, applicationId);
    if (ref) metadata.applicationReference = ref;
  }

  if (
    targetType === AUDIT_TARGET_TYPE.CONTRACT &&
    targetId &&
    !snapshotBusinessReference(
      typeof metadata.contractReference === "string" ? metadata.contractReference : params.contractReference
    )
  ) {
    const contract = await db.contract.findUnique({
      where: { id: targetId },
      select: { display_reference: true },
    });
    const ref = snapshotBusinessReference(contract?.display_reference, targetId);
    if (ref) metadata.contractReference = ref;
  }

  if (
    targetType === AUDIT_TARGET_TYPE.INVOICE &&
    targetId &&
    !snapshotBusinessReference(
      typeof metadata.invoiceReference === "string" ? metadata.invoiceReference : params.invoiceReference
    )
  ) {
    const invoice = await db.invoice.findUnique({
      where: { id: targetId },
      select: { display_reference: true },
    });
    const ref = snapshotBusinessReference(invoice?.display_reference, targetId);
    if (ref) metadata.invoiceReference = ref;
  }

  return { ...params, metadata };
}
