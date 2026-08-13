import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export type AuditActorSnapshot = {
  name: string | null;
  email: string | null;
};

export async function loadAuditActorSnapshot(
  userId: string | null | undefined,
  db: Prisma.TransactionClient = prisma
): Promise<AuditActorSnapshot> {
  if (!userId) return { name: null, email: null };
  const user = await db.user.findUnique({
    where: { user_id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user) return { name: null, email: null };
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return { name: name || null, email: user.email };
}

export function roleDiff(previous: string[], next: string[]) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    previousRoles: previous,
    newRoles: next,
    addedRoles: next.filter((role) => !previousSet.has(role)),
    removedRoles: previous.filter((role) => !nextSet.has(role)),
  };
}

export function permissionDiff(previous: string[], next: string[]) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    addedPermissions: next.filter((permission) => !previousSet.has(permission)),
    removedPermissions: previous.filter((permission) => !nextSet.has(permission)),
  };
}

export function changedFieldsOf<T extends Record<string, unknown>>(
  before: T,
  after: T
): string[] {
  return (Object.keys(after) as Array<keyof T & string>).filter(
    (key) => before[key] !== after[key]
  );
}
