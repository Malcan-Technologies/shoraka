/**
 * Snapshot helpers for human/business display references (identifier class B).
 *
 * Never store a canonical DB id (class A) as a display reference. Callers that already hold the
 * row pass the value in; `logApplicationActivity` may look the row up best-effort without failing
 * the audit write.
 */

export function snapshotBusinessReference(
  value: string | null | undefined,
  canonicalId?: string | null
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (canonicalId && trimmed === canonicalId) return undefined;
  return trimmed;
}

export function mergeDisplayReferences(
  metadata: Record<string, unknown> | undefined,
  refs: {
    applicationReference?: string | null;
    contractReference?: string | null;
    invoiceReference?: string | null;
    noteReference?: string | null;
    organizationReference?: string | null;
    withdrawalReference?: string | null;
    settlementReference?: string | null;
  }
): Record<string, unknown> | undefined {
  const next = { ...(metadata ?? {}) };
  const applicationReference = snapshotBusinessReference(
    typeof next.applicationReference === "string"
      ? next.applicationReference
      : refs.applicationReference,
    typeof next.application_id === "string" ? next.application_id : undefined
  );
  const contractReference = snapshotBusinessReference(
    typeof next.contractReference === "string" ? next.contractReference : refs.contractReference
  );
  const invoiceReference = snapshotBusinessReference(
    typeof next.invoiceReference === "string" ? next.invoiceReference : refs.invoiceReference
  );
  const noteReference = snapshotBusinessReference(
    typeof next.noteReference === "string" ? next.noteReference : refs.noteReference
  );
  const organizationReference = snapshotBusinessReference(
    typeof next.organizationReference === "string"
      ? next.organizationReference
      : refs.organizationReference
  );
  const withdrawalReference = snapshotBusinessReference(
    typeof next.withdrawalReference === "string"
      ? next.withdrawalReference
      : refs.withdrawalReference
  );
  const settlementReference = snapshotBusinessReference(
    typeof next.settlementReference === "string"
      ? next.settlementReference
      : refs.settlementReference
  );
  if (applicationReference) next.applicationReference = applicationReference;
  if (contractReference) next.contractReference = contractReference;
  if (invoiceReference) next.invoiceReference = invoiceReference;
  if (noteReference) next.noteReference = noteReference;
  if (organizationReference) next.organizationReference = organizationReference;
  if (withdrawalReference) next.withdrawalReference = withdrawalReference;
  if (settlementReference) next.settlementReference = settlementReference;
  return Object.keys(next).length > 0 ? next : metadata;
}
