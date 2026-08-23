import type { Prisma, Product } from "@prisma/client";
import {
  PRODUCT_AUDIT_TARGET_TYPE,
  type ProductAuditEventType,
} from "./events";
import type { ProductAuditContext } from "./context";
import { parseProductAuditMetadata } from "./metadata";
import {
  diffProductScalars,
  diffWorkflow,
  mergeUpdatedDiff,
} from "./diff";
import {
  productIdentityFields,
  productScalarSnapshot,
  productStatusOf,
} from "./snapshot";

export type ProductAuditWriteInput = {
  productId: string;
  eventType: ProductAuditEventType;
  context: ProductAuditContext;
  metadata: unknown;
  occurredAt?: Date;
};

export async function writeProductAuditLog(
  tx: Prisma.TransactionClient,
  input: ProductAuditWriteInput
): Promise<void> {
  if (!input.context.actorUserId) {
    throw new Error("Product audit write requires actorUserId.");
  }

  const metadata = parseProductAuditMetadata(input.eventType, input.metadata);

  await tx.productAuditLog.create({
    data: {
      product_id: input.productId,
      event_type: input.eventType,
      actor_type: input.context.actorType,
      actor_user_id: input.context.actorUserId,
      organization_id: input.context.organizationId ?? null,
      organization_kind: input.context.organizationKind ?? null,
      target_type: PRODUCT_AUDIT_TARGET_TYPE,
      target_id: input.productId,
      source: input.context.source,
      portal: input.context.portal ?? null,
      ip_address: input.context.ipAddress ?? null,
      user_agent: input.context.userAgent ?? null,
      correlation_id: input.context.correlationId ?? null,
      idempotency_key: input.context.idempotencyKey ?? null,
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    },
  });
}

export async function writeProductCreatedAudit(
  tx: Prisma.TransactionClient,
  product: Product,
  context: ProductAuditContext
): Promise<void> {
  const identity = productIdentityFields(product);
  const scalars = productScalarSnapshot(product);
  await writeProductAuditLog(tx, {
    productId: product.id,
    eventType: "PRODUCT_CREATED",
    context,
    metadata: {
      ...identity,
      status: productStatusOf(product),
      productCode: scalars.productCode,
      marketplaceListingDurationDays: scalars.marketplaceListingDurationDays,
      serviceFeeRatePercent: scalars.serviceFeeRatePercent,
      defaultFacilityFeeRatePercent: scalars.defaultFacilityFeeRatePercent,
    },
  });
}

export function buildProductUpdatedMetadata(
  before: Product,
  after: Product,
  options?: { versioned?: boolean }
): Record<string, unknown> | null {
  const scalarDiff = diffProductScalars(productScalarSnapshot(before), productScalarSnapshot(after));
  const workflowDiff = diffWorkflow(before.workflow, after.workflow);
  const merged = mergeUpdatedDiff(scalarDiff, workflowDiff);
  if (!merged) return null;

  const identity = productIdentityFields(after);
  const metadata: Record<string, unknown> = {
    ...identity,
    changedFields: merged.changedFields,
    before: merged.before,
    after: merged.after,
  };

  if (options?.versioned) {
    metadata.previousProductId = before.id;
    metadata.newProductId = after.id;
    metadata.previousVersion = before.version;
    metadata.newVersion = after.version;
  }

  return metadata;
}

export async function writeProductUpdatedAudit(
  tx: Prisma.TransactionClient,
  before: Product,
  after: Product,
  context: ProductAuditContext,
  options?: { versioned?: boolean }
): Promise<boolean> {
  const metadata = buildProductUpdatedMetadata(before, after, options);
  if (!metadata) return false;

  await writeProductAuditLog(tx, {
    productId: after.id,
    eventType: "PRODUCT_UPDATED",
    context,
    metadata,
  });
  return true;
}

export async function writeProductInactivatedAudit(
  tx: Prisma.TransactionClient,
  product: Product,
  context: ProductAuditContext,
  options?: { replacedByProductId?: string; replacedByVersion?: number }
): Promise<void> {
  const identity = productIdentityFields(product);
  await writeProductAuditLog(tx, {
    productId: product.id,
    eventType: "PRODUCT_INACTIVATED",
    context,
    metadata: {
      ...identity,
      previousStatus: productStatusOf(product),
      newStatus: "INACTIVE",
      ...(options?.replacedByProductId ? { replacedByProductId: options.replacedByProductId } : {}),
      ...(options?.replacedByVersion != null ? { replacedByVersion: options.replacedByVersion } : {}),
    },
  });
}

export async function writeProductReactivatedAudit(
  tx: Prisma.TransactionClient,
  product: Product,
  context: ProductAuditContext
): Promise<void> {
  const identity = productIdentityFields(product);
  await writeProductAuditLog(tx, {
    productId: product.id,
    eventType: "PRODUCT_REACTIVATED",
    context,
    metadata: {
      ...identity,
      previousStatus: productStatusOf(product),
      newStatus: "ACTIVE",
    },
  });
}

export async function writeProductDeletedAudit(
  tx: Prisma.TransactionClient,
  product: Product,
  context: ProductAuditContext
): Promise<void> {
  const identity = productIdentityFields(product);
  await writeProductAuditLog(tx, {
    productId: product.id,
    eventType: "PRODUCT_DELETED",
    context,
    metadata: {
      ...identity,
      previousStatus: productStatusOf(product),
      newStatus: "DELETED",
    },
  });
}
