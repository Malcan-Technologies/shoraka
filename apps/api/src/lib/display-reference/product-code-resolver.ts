import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeAndValidateProductCode } from "./product-code";

type ProductLookupClient = Pick<PrismaClient, "product"> | Prisma.TransactionClient;

export type ApplicationProductContext = {
  id: string;
  financing_type: Prisma.JsonValue | null;
  product_version: number | null;
};

export type NoteProductContext = {
  id: string;
  product_snapshot: Prisma.JsonValue | null;
  source_application_id: string | null;
};

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getSnapshotProductCode(context: ApplicationProductContext): string | null {
  const financingType = asRecord(context.financing_type);
  const code = financingType?.product_code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return null;
  }
  return normalizeAndValidateProductCode(code);
}

function getSnapshotProductId(context: ApplicationProductContext): string | null {
  const financingType = asRecord(context.financing_type);
  const productId = financingType?.product_id;
  if (typeof productId !== "string" || productId.trim().length === 0) {
    return null;
  }
  return productId.trim();
}

function getNoteSnapshotProductCode(context: NoteProductContext): string | null {
  const productSnapshot = asRecord(context.product_snapshot);
  const code = productSnapshot?.product_code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return null;
  }
  return normalizeAndValidateProductCode(code);
}

async function getProductCodeForVersion(
  db: ProductLookupClient,
  baseId: string,
  productVersion: number
): Promise<string | null> {
  const versionRow = await db.product.findFirst({
    where: {
      OR: [{ id: baseId }, { base_id: baseId }],
      version: productVersion,
    },
    select: { product_code: true },
  });
  if (!versionRow?.product_code) {
    return null;
  }
  return normalizeAndValidateProductCode(versionRow.product_code);
}

export async function resolveApplicationProductCode(
  db: ProductLookupClient,
  context: ApplicationProductContext
): Promise<string | null> {
  const snapshotCode = getSnapshotProductCode(context);
  if (snapshotCode) {
    return snapshotCode;
  }

  const snapshotProductId = getSnapshotProductId(context);
  if (!snapshotProductId) {
    return null;
  }

  const directRow = await db.product.findUnique({
    where: { id: snapshotProductId },
    select: { id: true, base_id: true, product_code: true },
  });

  if (directRow?.product_code) {
    return normalizeAndValidateProductCode(directRow.product_code);
  }

  if (context.product_version != null) {
    const baseId = directRow?.base_id ?? directRow?.id ?? snapshotProductId;
    const byVersionCode = await getProductCodeForVersion(db, baseId, context.product_version);
    if (byVersionCode) {
      return byVersionCode;
    }
  }

  return null;
}

export async function resolveNoteProductCode(
  db: Prisma.TransactionClient,
  context: NoteProductContext
): Promise<string | null> {
  const snapshotCode = getNoteSnapshotProductCode(context);
  if (snapshotCode) {
    return snapshotCode;
  }

  if (!context.source_application_id) {
    return null;
  }

  const sourceApplication = await db.application.findUnique({
    where: { id: context.source_application_id },
    select: { id: true, financing_type: true, product_version: true },
  });
  if (!sourceApplication) {
    return null;
  }

  return resolveApplicationProductCode(db, sourceApplication);
}
