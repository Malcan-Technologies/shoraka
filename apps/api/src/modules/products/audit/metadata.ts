import { z } from "zod";
import { PRODUCT_AUDIT_EVENTS, type ProductAuditEventType } from "./events";

const productStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);

const productIdentitySchema = z.object({
  productName: z.string(),
  baseId: z.string().min(1),
  version: z.number().int(),
});

export const productCreatedAuditMetadataSchema = productIdentitySchema.extend({
  status: productStatusSchema,
  productCode: z.string().nullable().optional(),
  marketplaceListingDurationDays: z.number().int().nullable().optional(),
  serviceFeeRatePercent: z.number().nullable().optional(),
  defaultFacilityFeeRatePercent: z.number().nullable().optional(),
});

export const productUpdatedAuditMetadataSchema = productIdentitySchema.extend({
  changedFields: z.array(z.string()).min(1),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
  previousProductId: z.string().min(1).optional(),
  newProductId: z.string().min(1).optional(),
  previousVersion: z.number().int().optional(),
  newVersion: z.number().int().optional(),
});

export const productStatusChangedAuditMetadataSchema = productIdentitySchema.extend({
  previousStatus: productStatusSchema,
  newStatus: productStatusSchema,
  replacedByProductId: z.string().min(1).optional(),
  replacedByVersion: z.number().int().optional(),
});

export const productDeletedAuditMetadataSchema = productIdentitySchema.extend({
  previousStatus: productStatusSchema,
  newStatus: z.literal("DELETED"),
});

export type ProductCreatedAuditMetadata = z.infer<typeof productCreatedAuditMetadataSchema>;
export type ProductUpdatedAuditMetadata = z.infer<typeof productUpdatedAuditMetadataSchema>;
export type ProductStatusChangedAuditMetadata = z.infer<typeof productStatusChangedAuditMetadataSchema>;
export type ProductDeletedAuditMetadata = z.infer<typeof productDeletedAuditMetadataSchema>;

const metadataByEvent = {
  PRODUCT_CREATED: productCreatedAuditMetadataSchema,
  PRODUCT_UPDATED: productUpdatedAuditMetadataSchema,
  PRODUCT_INACTIVATED: productStatusChangedAuditMetadataSchema,
  PRODUCT_REACTIVATED: productStatusChangedAuditMetadataSchema,
  PRODUCT_DELETED: productDeletedAuditMetadataSchema,
} as const;

export function parseProductAuditMetadata(
  eventType: ProductAuditEventType,
  metadata: unknown
): Record<string, unknown> {
  const schema = metadataByEvent[eventType];
  return schema.parse(metadata);
}

export function isProductAuditEventType(value: string): value is ProductAuditEventType {
  return (PRODUCT_AUDIT_EVENTS as readonly string[]).includes(value);
}
