/**
 * Forensic actor snapshots.
 *
 * Readers on origin/main resolve actor display names live from the User table. That stays the
 * primary source, so displayed names never change. The snapshot is stored alongside in dedicated
 * `actor_name_snapshot` / `actor_email_snapshot` columns (the naming already used by
 * `legal_document_audit_logs` on origin/main) so the historical identity survives user deletion.
 *
 * The snapshot is deliberately NOT merged into `metadata`: several admin surfaces render metadata
 * generically (`Object.entries`) or gate a "View details" expander on metadata being truthy, so new
 * metadata keys would change what users see and what CSV exports contain. Dedicated columns are
 * invisible to every existing reader.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export type AuditActorSnapshot = {
  actor_name_snapshot: string | null;
  actor_email_snapshot: string | null;
};

export const EMPTY_ACTOR_SNAPSHOT: AuditActorSnapshot = {
  actor_name_snapshot: null,
  actor_email_snapshot: null,
};

type AuditDb = Prisma.TransactionClient | typeof prisma;

export async function loadAuditActorSnapshot(
  userId: string | null | undefined,
  db: AuditDb = prisma
): Promise<AuditActorSnapshot> {
  if (!userId) return EMPTY_ACTOR_SNAPSHOT;

  const user = await db.user.findUnique({
    where: { user_id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user) return EMPTY_ACTOR_SNAPSHOT;

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return {
    actor_name_snapshot: name || null,
    actor_email_snapshot: user.email ?? null,
  };
}

/**
 * Field-level diff used to describe before/after changes without inventing values.
 *
 * Runs inside business transactions, so it must not throw. BigInt values reach it from counter
 * columns and would otherwise break JSON serialization; Prisma's Decimal serializes via toJSON.
 */
export function changedFieldsOf(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): string[] {
  const stable = (value: unknown) =>
    JSON.stringify(value, (_key, inner) => (typeof inner === "bigint" ? inner.toString() : inner));

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changed: string[] = [];
  for (const key of keys) {
    if (stable(before?.[key]) !== stable(after?.[key])) changed.push(key);
  }
  return changed.sort();
}
