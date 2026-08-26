import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * Product display name is stored on the first workflow step:
 * `workflow[0].config.name` or `workflow[0].config.type.name`.
 *
 * PRODUCT_CREATED / PRODUCT_UPDATED / PRODUCT_DELETED snapshot that workflow
 * onto `product_logs.metadata`. PRODUCT_INACTIVATED / PRODUCT_REACTIVATED do
 * not, so those rows are matched via the live `products` row for `product_id`.
 *
 * Prisma 5 JSON `string_contains` is case-sensitive and awkward with array
 * indexes; the product catalog already uses PostgreSQL `ILIKE` on this path.
 */
export async function findProductLogIdsMatchingName(search: string): Promise<string[]> {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM product_logs
    WHERE (metadata::jsonb->'workflow'->0->'config'->>'name') ILIKE ${pattern}
       OR (metadata::jsonb->'workflow'->0->'config'->'type'->>'name') ILIKE ${pattern}
    UNION
    SELECT pl.id FROM product_logs pl
    INNER JOIN products p ON p.id = pl.product_id
    WHERE (p.workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
       OR (p.workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
  `;

  return rows.map((row) => row.id);
}

export function buildProductLogSearchOr(
  search: string,
  nameMatchedLogIds: string[]
): Prisma.ProductLogWhereInput[] {
  const or: Prisma.ProductLogWhereInput[] = [
    { user: { email: { contains: search, mode: "insensitive" } } },
    { user: { first_name: { contains: search, mode: "insensitive" } } },
    { user: { last_name: { contains: search, mode: "insensitive" } } },
    { product_id: { contains: search, mode: "insensitive" } },
  ];

  if (nameMatchedLogIds.length > 0) {
    or.push({ id: { in: nameMatchedLogIds } });
  }

  return or;
}
