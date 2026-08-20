import { Prisma, PrismaClient } from "@prisma/client";

type UserLookupClient = PrismaClient | Prisma.TransactionClient;

const SKIP_ACTOR_IDS = new Set(["system", "admin"]);

export function formatUserDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} | null | undefined): string | null {
  if (!user) return null;
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  const email = user.email?.trim();
  return email || null;
}

export async function loadUserDisplayNameMap(
  db: UserLookupClient,
  userIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      userIds
        .map((id) => id?.trim() ?? "")
        .filter((id) => id.length > 0 && !SKIP_ACTOR_IDS.has(id.toLowerCase()))
    ),
  ];
  if (ids.length === 0) return new Map();

  const users = await db.user.findMany({
    where: { user_id: { in: ids } },
    select: { user_id: true, first_name: true, last_name: true, email: true },
  });

  const names = new Map<string, string>();
  for (const user of users) {
    const name = formatUserDisplayName(user);
    if (name) names.set(user.user_id, name);
  }
  return names;
}
