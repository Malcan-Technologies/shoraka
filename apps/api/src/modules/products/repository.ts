import { prisma } from "../../lib/prisma";
import { Product, Prisma } from "@prisma/client";
import type { ProductEventType, GetProductLogsQuery, DateRangeValue } from "./schemas";
import { normalizeAndValidateProductCode } from "../../lib/display-reference";
import { createProductLogRow } from "./audit";

export interface ListProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  activeOnly?: boolean;
  /** When true with activeOnly false, include rows with status DELETED (admin sidebar grouping). */
  includeDeleted?: boolean;
}

export interface UpdateProductData {
  workflow?: unknown[];
  /** When true, replace workflow without incrementing version (used only for the first update right after create). */
  completeCreate?: boolean;
  marketplace_listing_duration_days?: number | null;
  service_fee_rate_percent?: number | null;
  default_facility_fee_rate_percent?: number | null;
  product_code?: string;
}

export interface CreateProductData {
  workflow: unknown[];
  marketplace_listing_duration_days?: number | null;
  service_fee_rate_percent?: number | null;
  default_facility_fee_rate_percent?: number | null;
  product_code?: string;
}

export interface LogContext {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
}

function effectiveBaseId(product: { id: string; base_id?: string | null }): string {
  return product.base_id ?? product.id;
}

function normalizeOptionalProductCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  return normalizeAndValidateProductCode(trimmed);
}

async function getFamilyProductCode(
  tx: Prisma.TransactionClient,
  baseId: string
): Promise<string | null> {
  const rows = await tx.product.findMany({
    where: {
      OR: [{ id: baseId }, { base_id: baseId }],
    },
    select: { id: true, base_id: true, product_code: true },
  });

  let familyCode: string | null = null;
  for (const row of rows) {
    const code = normalizeOptionalProductCode(row.product_code);
    if (!code) continue;
    if (!familyCode) {
      familyCode = code;
      continue;
    }
    if (familyCode !== code) {
      throw new Error("Product family has inconsistent product codes.");
    }
  }
  return familyCode;
}

async function assertCodeNotUsedByOtherFamily(
  tx: Prisma.TransactionClient,
  expectedBaseId: string,
  candidateCode: string
): Promise<void> {
  const rows = await tx.product.findMany({
    where: { product_code: candidateCode },
    select: { id: true, base_id: true },
  });
  const conflict = rows.find((row) => effectiveBaseId(row) !== expectedBaseId);
  if (conflict) {
    throw new Error(`Product code ${candidateCode} is already used by another product family.`);
  }
}

async function assertFamilyCodeMutable(
  tx: Prisma.TransactionClient,
  currentCode: string
): Promise<void> {
  const allocation = await tx.displayReferenceAllocation.findFirst({
    where: { product_code: currentCode },
    select: { id: true },
  });
  if (allocation) {
    throw new Error(
      "Product code cannot be changed after canonical references have been allocated."
    );
  }
}

/** Deep equality for JSON-like workflow (arrays and plain objects). Used to avoid version bump when nothing changed. */
function workflowDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => workflowDeepEqual(item, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as Record<string, unknown>).sort();
  const keysB = Object.keys(b as Record<string, unknown>).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) =>
    workflowDeepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k]
    )
  );
}

/**
 * Product read/write: findById, list, create, update, delete. Used by applications module and admin products list.
 */
export class ProductRepository {
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  /**
   * Resolve the product row for a frozen application.product_version within the same
   * base_id family as `productId` (includes INACTIVE historical versions).
   */
  async findByBaseAndVersion(productId: string, version: number): Promise<Product | null> {
    const row = await this.findById(productId);
    if (!row || row.status === "DELETED") return null;

    if (row.version === version) return row;

    const baseId = row.base_id ?? row.id;
    const byVersion = await prisma.product.findFirst({
      where: {
        base_id: baseId,
        version,
        status: { not: "DELETED" },
      },
      orderBy: { created_at: "desc" },
    });
    return byVersion;
  }

  /**
   * Guard-only: which product.version to compare to application.product_version.
   * If the id row cannot supply a live version (missing, deleted, inactive with no active sibling), returns UNAVAILABLE.
   */
  async getVersionCompareTarget(productId: string): Promise<
    | { kind: "UNAVAILABLE" }
    | { kind: "COMPARE"; version: number; resolvedProductId: string }
  > {
    const row = await this.findById(productId);
    if (!row || row.status === "DELETED") {
      return { kind: "UNAVAILABLE" };
    }
    if (row.status === "ACTIVE") {
      return { kind: "COMPARE", version: row.version, resolvedProductId: row.id };
    }
    const baseId = row.base_id ?? row.id;
    const active = await prisma.product.findFirst({
      where: { base_id: baseId, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    if (!active) {
      return { kind: "UNAVAILABLE" };
    }
    return { kind: "COMPARE", version: active.version, resolvedProductId: active.id };
  }

  async create(data: CreateProductData, logContext?: LogContext): Promise<Product> {
    // Determine category and ordering from workflow config (financing type step)
    const workflow = data.workflow as unknown[];
    const financingStep = (workflow || []).find((step: any) =>
      String(step?.name).toLowerCase().includes("financing type")
    ) as any | undefined;
    const config = financingStep?.config ?? {};
    const categoryName = (config.category as string) || "Other";

    const normalizedProductCode = normalizeOptionalProductCode(data.product_code);

    // Run in transaction to avoid race conditions when computing max + 1
    return await prisma.$transaction(async (tx) => {
      if (normalizedProductCode) {
        const existing = await tx.product.findFirst({
          where: { product_code: normalizedProductCode },
          select: { id: true },
        });
        if (existing) {
          throw new Error(
            `Product code ${normalizedProductCode} is already used by another product family.`
          );
        }
      }

      // Find max product_display_order within the category using JSONB filter
      const prodMaxRows = await tx.$queryRaw<Array<{ max: number | null }>>`
        SELECT MAX(product_display_order) as max
        FROM products
        WHERE (workflow::jsonb->0->'config'->>'category') = ${categoryName}
          AND status = 'ACTIVE'
      `;
      const nextProductOrder = (prodMaxRows[0]?.max ?? 0) + 1;

      // Determine category_display_order: reuse existing category's MIN display order if present,
      // otherwise append at global max + 1.
      const catMinRows = await tx.$queryRaw<Array<{ min: number | null }>>`
        SELECT MIN(category_display_order) as min
        FROM products
        WHERE (workflow::jsonb->0->'config'->>'category') = ${categoryName}
          AND category_display_order IS NOT NULL
          AND status = 'ACTIVE'
      `;
      let categoryDisplayOrder: number;
      if (catMinRows[0]?.min != null) {
        categoryDisplayOrder = catMinRows[0].min;
      } else {
        const catMaxRows = await tx.$queryRaw<Array<{ max: number | null }>>`
          SELECT MAX(category_display_order) as max FROM products WHERE status = 'ACTIVE'
        `;
        categoryDisplayOrder = (catMaxRows[0]?.max ?? 0) + 1;
      }

      const created = await tx.product.create({
        data: {
          version: 1,
          product_code: normalizedProductCode ?? undefined,
          workflow: data.workflow as Prisma.InputJsonValue,
          category_display_order: categoryDisplayOrder,
          product_display_order: nextProductOrder,
          marketplace_listing_duration_days: data.marketplace_listing_duration_days ?? undefined,
          service_fee_rate_percent:
            data.service_fee_rate_percent != null ? new Prisma.Decimal(data.service_fee_rate_percent) : undefined,
          default_facility_fee_rate_percent:
            data.default_facility_fee_rate_percent != null
              ? new Prisma.Decimal(data.default_facility_fee_rate_percent)
              : undefined,
        },
      } as any);

      /** New products are their own base; set base_id = id for versioning grouping. */
      const finalized = await tx.product.update({
        where: { id: created.id },
        data: {
          base_id: created.id,
          product_code: normalizedProductCode ?? undefined,
        },
      } as any);

      // Write PRODUCT_CREATED log with the initial config snapshot.
      // Later `completeCreate` calls write PRODUCT_UPDATED (not PRODUCT_CREATED) to avoid duplicates.
      if (logContext?.userId) {
        const createdAny = created as any;
        await createProductLogRow(
          {
            userId: logContext.userId,
            productId: created.id,
            eventType: "PRODUCT_CREATED",
            ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: {
              workflow: JSON.parse(JSON.stringify(createdAny.workflow)),
              category_display_order: createdAny.category_display_order ?? null,
              product_display_order: createdAny.product_display_order ?? null,
              marketplace_listing_duration_days: createdAny.marketplace_listing_duration_days ?? null,
              service_fee_rate_percent: createdAny.service_fee_rate_percent ?? null,
              default_facility_fee_rate_percent: createdAny.default_facility_fee_rate_percent ?? null,
              product_code: normalizedProductCode ?? null,
              version: createdAny.version ?? null,
              base_id: createdAny.base_id ?? created.id ?? null,
              status: createdAny.status ?? null,
              product_created_at: createdAny.created_at?.toISOString?.() ?? null,
              product_updated_at: createdAny.updated_at?.toISOString?.() ?? null,
            } as Prisma.InputJsonValue,
          },
          tx
        );
      }

      return finalized;
    });
  }

  /**
   * Versioned product update: never modify existing product except to set status INACTIVE.
   * When completeCreate is true: in-place update only (first save after create, e.g. merging image/template keys).
   * Otherwise: 1) Set old product INACTIVE, 2) Create new version row, 3) Return new product.
   */
  async update(id: string, data: UpdateProductData, logContext?: LogContext): Promise<Product> {
    if (
      data.workflow === undefined &&
      data.marketplace_listing_duration_days === undefined &&
      data.service_fee_rate_percent === undefined &&
      data.default_facility_fee_rate_percent === undefined &&
      data.product_code === undefined
    ) {
      return prisma.product.findUniqueOrThrow({ where: { id } });
    }
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw new Error("Product not found");
    }
    const currentWorkflow = current.workflow as unknown;
    const normalizedRequestedProductCode =
      data.product_code === undefined
        ? undefined
        : normalizeOptionalProductCode(data.product_code);
    const workflowUnchanged = data.workflow === undefined || workflowDeepEqual(data.workflow, currentWorkflow);
    const currentMarketplaceListingDuration = (current as {
      marketplace_listing_duration_days?: number | null;
    }).marketplace_listing_duration_days ?? null;
    const marketplaceListingDurationUnchanged =
      data.marketplace_listing_duration_days === undefined ||
      (data.marketplace_listing_duration_days === currentMarketplaceListingDuration ||
        (data.marketplace_listing_duration_days == null && currentMarketplaceListingDuration == null));

    const currentServiceFeeRatePercent = (current as any).service_fee_rate_percent
      ? (current as any).service_fee_rate_percent.toNumber()
      : null;
    const serviceFeeRatePercentUnchanged =
      data.service_fee_rate_percent === undefined ||
      (data.service_fee_rate_percent === currentServiceFeeRatePercent ||
        (data.service_fee_rate_percent == null && currentServiceFeeRatePercent == null));

    const currentDefaultFacilityFeeRatePercent = (current as any).default_facility_fee_rate_percent
      ? (current as any).default_facility_fee_rate_percent.toNumber()
      : null;
    const defaultFacilityFeeRatePercentUnchanged =
      data.default_facility_fee_rate_percent === undefined ||
      (data.default_facility_fee_rate_percent === currentDefaultFacilityFeeRatePercent ||
        (data.default_facility_fee_rate_percent == null && currentDefaultFacilityFeeRatePercent == null));

    if (
      workflowUnchanged &&
      marketplaceListingDurationUnchanged &&
      serviceFeeRatePercentUnchanged &&
      defaultFacilityFeeRatePercentUnchanged &&
      normalizedRequestedProductCode === undefined
    ) {
      return current;
    }

    /** completeCreate: first update after create (merge image/template keys). In-place update only; no new version row. */
    if (data.completeCreate === true) {
      const workflowPayload = (data.workflow === undefined ? current.workflow : data.workflow) as Prisma.InputJsonValue;
      const marketplaceListingDurationPayload =
        data.marketplace_listing_duration_days !== undefined
          ? data.marketplace_listing_duration_days
          : (current as { marketplace_listing_duration_days?: number | null }).marketplace_listing_duration_days ?? null;
      return prisma.$transaction(async (tx) => {
        const baseId = effectiveBaseId(current as { id: string; base_id?: string | null });
        const familyCode = await getFamilyProductCode(tx, baseId);
        let nextFamilyCode = familyCode;

        if (normalizedRequestedProductCode !== undefined) {
          if (familyCode && normalizedRequestedProductCode !== familyCode) {
            await assertFamilyCodeMutable(tx, familyCode);
          }
          if (normalizedRequestedProductCode) {
            await assertCodeNotUsedByOtherFamily(tx, baseId, normalizedRequestedProductCode);
          }
          nextFamilyCode = normalizedRequestedProductCode;
          await tx.product.updateMany({
            where: {
              OR: [{ id: baseId }, { base_id: baseId }],
            },
            data: { product_code: nextFamilyCode ?? null },
          });
        }

        const updated = await tx.product.update({
          where: { id },
          data: {
            workflow: workflowPayload,
            marketplace_listing_duration_days: marketplaceListingDurationPayload ?? undefined,
            service_fee_rate_percent:
              data.service_fee_rate_percent !== undefined
                ? new Prisma.Decimal(
                    data.service_fee_rate_percent == null
                      ? currentServiceFeeRatePercent ?? 15
                      : data.service_fee_rate_percent
                  )
                : undefined,
            default_facility_fee_rate_percent:
              data.default_facility_fee_rate_percent !== undefined
                ? new Prisma.Decimal(
                    data.default_facility_fee_rate_percent == null
                      ? currentDefaultFacilityFeeRatePercent ?? 1
                      : data.default_facility_fee_rate_percent
                  )
                : undefined,
            product_code: nextFamilyCode ?? undefined,
          },
        } as any);

        if (logContext?.userId) {
          const updatedAny = updated as any;
          const metadata = {
            workflow: JSON.parse(JSON.stringify(updatedAny.workflow)),
            category_display_order: updatedAny.category_display_order ?? null,
            product_display_order: updatedAny.product_display_order ?? null,
            marketplace_listing_duration_days: updatedAny.marketplace_listing_duration_days ?? null,
            service_fee_rate_percent: updatedAny.service_fee_rate_percent ?? null,
            default_facility_fee_rate_percent: updatedAny.default_facility_fee_rate_percent ?? null,
            product_code: nextFamilyCode ?? null,
            version: updatedAny.version,
            base_id: updatedAny.base_id ?? null,
            status: updatedAny.status ?? null,
            product_created_at: updatedAny.created_at.toISOString(),
            product_updated_at: updatedAny.updated_at.toISOString(),
            replaced_product_id: null,
          };
          await createProductLogRow(
            {
              userId: logContext.userId,
              productId: updated.id,
              eventType: "PRODUCT_UPDATED",
              ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
              userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
              deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
              metadata: metadata as Prisma.InputJsonValue,
            },
            tx
          );
        }
        return updated;
      });
    }

    const newVersion = current.version + 1;
    const workflowPayload = (data.workflow === undefined ? current.workflow : data.workflow) as Prisma.InputJsonValue;
    const marketplaceListingDurationPayload =
      data.marketplace_listing_duration_days !== undefined
        ? data.marketplace_listing_duration_days
        : (current as { marketplace_listing_duration_days?: number | null }).marketplace_listing_duration_days ?? null;
    const serviceFeeRatePercentPayload =
      data.service_fee_rate_percent !== undefined
        ? data.service_fee_rate_percent
        : currentServiceFeeRatePercent;
    const defaultFacilityFeeRatePercentPayload =
      data.default_facility_fee_rate_percent !== undefined
        ? data.default_facility_fee_rate_percent
        : currentDefaultFacilityFeeRatePercent;

    const currentAny = current as any;
    const newWorkflow = (data.workflow ?? current.workflow) as unknown[];
    const newFinancingStep = (newWorkflow || []).find((step: any) =>
      String(step?.name).toLowerCase().includes("financing type")
    ) as any | undefined;
    const newConfig = newFinancingStep?.config ?? {};
    const newCategoryName = (newConfig.category as string) || "Other";

    const currentFinancingStep = (currentWorkflow as any[] || []).find((step: any) =>
      String(step?.name).toLowerCase().includes("financing type")
    ) as any | undefined;
    const currentCategoryName = (currentFinancingStep?.config?.category as string) || "Other";

    return await prisma.$transaction(async (tx) => {
      /** Ensure base_id exists before versioning; abort if initialization fails. */
      let baseId = (current as { base_id?: string | null }).base_id ?? null;
      if (!baseId) {
        await tx.product.update({
          where: { id },
          data: { base_id: current.id },
        } as any);
        baseId = current.id;
        if (!baseId) {
          throw new Error("Failed to initialize product base_id. Product update aborted.");
        }
      }
      const resolvedBaseId = baseId!;
      const familyCode = await getFamilyProductCode(tx, resolvedBaseId);
      let nextFamilyCode = familyCode;
      if (normalizedRequestedProductCode !== undefined) {
        if (familyCode && normalizedRequestedProductCode !== familyCode) {
          throw new Error(
            `New product versions must use the existing family product code (${familyCode}).`
          );
        }
        if (!familyCode && normalizedRequestedProductCode) {
          await assertCodeNotUsedByOtherFamily(tx, resolvedBaseId, normalizedRequestedProductCode);
        }
        nextFamilyCode = normalizedRequestedProductCode;
      }

      /** Prevent multiple ACTIVE versions per base_id. */
      const activeProduct = await tx.product.findFirst({
        where: {
          base_id: baseId,
          status: "ACTIVE" as any,
        },
      });
      if (activeProduct && activeProduct.id !== current.id) {
        throw new Error("Another ACTIVE product version already exists.");
      }

      await tx.product.update({
        where: { id },
        data: { status: "INACTIVE" as any },
      } as any);

      let categoryDisplayOrder: number;
      let productDisplayOrder: number;

      if (newCategoryName !== currentCategoryName) {
        const prodMaxRows = await tx.$queryRaw<Array<{ max: number | null }>>`
          SELECT MAX(product_display_order) as max
          FROM products
          WHERE (workflow::jsonb->0->'config'->>'category') = ${newCategoryName}
            AND status = 'ACTIVE'
        `;
        productDisplayOrder = (prodMaxRows[0]?.max ?? 0) + 1;

        const catMinRows = await tx.$queryRaw<Array<{ min: number | null }>>`
          SELECT MIN(category_display_order) as min
          FROM products
          WHERE (workflow::jsonb->0->'config'->>'category') = ${newCategoryName}
            AND category_display_order IS NOT NULL
            AND status = 'ACTIVE'
        `;
        if (catMinRows[0]?.min != null) {
          categoryDisplayOrder = catMinRows[0].min;
        } else {
          const catMaxRows = await tx.$queryRaw<Array<{ max: number | null }>>`
            SELECT MAX(category_display_order) as max FROM products WHERE status = 'ACTIVE'
          `;
          categoryDisplayOrder = (catMaxRows[0]?.max ?? 0) + 1;
        }
      } else {
        categoryDisplayOrder = currentAny.category_display_order ?? 0;
        productDisplayOrder = currentAny.product_display_order ?? 0;
      }

      const created = await tx.product.create({
        data: {
          version: newVersion,
          product_code: nextFamilyCode ?? undefined,
          workflow: workflowPayload,
          category_display_order: categoryDisplayOrder,
          product_display_order: productDisplayOrder,
          marketplace_listing_duration_days: marketplaceListingDurationPayload ?? undefined,
          service_fee_rate_percent: serviceFeeRatePercentPayload ?? undefined,
          default_facility_fee_rate_percent: defaultFacilityFeeRatePercentPayload ?? undefined,
          base_id: baseId,
          status: "ACTIVE" as any,
        },
      } as any);

      if (!familyCode && normalizedRequestedProductCode !== undefined) {
        await tx.product.updateMany({
          where: {
            OR: [{ id: resolvedBaseId }, { base_id: resolvedBaseId }],
          },
          data: { product_code: nextFamilyCode ?? null },
        });
      }

      if (logContext?.userId) {
        const createdAny = created as any;
        const metadata = {
          workflow: JSON.parse(JSON.stringify(createdAny.workflow)),
          category_display_order: createdAny.category_display_order ?? null,
          product_display_order: createdAny.product_display_order ?? null,
          marketplace_listing_duration_days: createdAny.marketplace_listing_duration_days ?? null,
          service_fee_rate_percent: createdAny.service_fee_rate_percent ?? null,
          default_facility_fee_rate_percent: createdAny.default_facility_fee_rate_percent ?? null,
          product_code: nextFamilyCode ?? null,
          version: createdAny.version,
          base_id: createdAny.base_id ?? null,
          status: createdAny.status ?? null,
          product_created_at: createdAny.created_at.toISOString(),
          product_updated_at: createdAny.updated_at.toISOString(),
          replaced_product_id: id,
        };
        await createProductLogRow(
          {
            userId: logContext.userId,
            productId: created.id,
            eventType: "PRODUCT_UPDATED",
            ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: metadata as Prisma.InputJsonValue,
          },
          tx
        );
      }

      return created;
    });
  }

  async delete(id: string, logContext?: LogContext): Promise<Product> {
    // Perform delete inside transaction and snapshot metadata before deletion when logContext provided
    if (logContext?.userId) {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id } });
        if (!current) {
          throw new Error("Product not found");
        }
        const currentAny = current as any;
        const metadata = {
          workflow: JSON.parse(JSON.stringify(currentAny.workflow)),
          category_display_order: currentAny.category_display_order ?? null,
          product_display_order: currentAny.product_display_order ?? null,
          marketplace_listing_duration_days: currentAny.marketplace_listing_duration_days ?? null,
          version: currentAny.version,
          base_id: currentAny.base_id ?? null,
          status: currentAny.status ?? null,
          product_created_at: currentAny.created_at.toISOString(),
          product_updated_at: currentAny.updated_at.toISOString(),
          replaced_product_id: null,
        };
        // create log before soft-delete so snapshot represents persisted state
        await createProductLogRow(
          {
            userId: logContext.userId!,
            productId: current.id,
            eventType: "PRODUCT_DELETED",
            ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: metadata as Prisma.InputJsonValue,
          },
          tx
        );

        // soft-delete: mark status and deleted_at
        return tx.product.update({
          where: { id },
          data: {
            // Note: cast to any as Prisma client may need regen
            status: "DELETED" as any,
            deleted_at: new Date(),
          },
        } as any);
      });
    }

    // non-logged path: perform soft-delete update
    return prisma.product.update({
      where: { id },
      data: {
        status: "DELETED" as any,
        deleted_at: new Date(),
      },
    } as any);
  }

  // Helper: mark product inactive (manual/future hide action)
  async setInactive(id: string, logContext?: LogContext): Promise<Product> {
    const current = await prisma.product.findUnique({ where: { id } });
    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: "INACTIVE" as any,
      },
    } as any);

    if (logContext?.userId && current) {
      const currentAny = current as any;
      await createProductLogRow({
        userId: logContext.userId,
        productId: updated.id,
        eventType: "PRODUCT_INACTIVATED",
        ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
        userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
        deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
        metadata: {
          previous_status: currentAny.status ?? null,
          new_status: "INACTIVE",
          version: currentAny.version ?? null,
          base_id: currentAny.base_id ?? null,
          product_created_at: currentAny.created_at?.toISOString?.() ?? null,
          product_updated_at: currentAny.updated_at?.toISOString?.() ?? null,
        } as Prisma.InputJsonValue,
      });
    }

    return updated;
  }

  // Helper: restore product to ACTIVE (undo soft-delete)
  async restoreProduct(id: string, logContext?: LogContext): Promise<Product> {
    const current = await prisma.product.findUnique({ where: { id } });
    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: "ACTIVE" as any,
        deleted_at: null,
      },
    } as any);

    if (logContext?.userId && current) {
      const currentAny = current as any;
      await createProductLogRow({
        userId: logContext.userId,
        productId: updated.id,
        eventType: "PRODUCT_REACTIVATED",
        ipAddress: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
        userAgent: logContext.userAgent ? String(logContext.userAgent) : undefined,
        deviceInfo: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
        metadata: {
          previous_status: currentAny.status ?? null,
          new_status: "ACTIVE",
          version: currentAny.version ?? null,
          base_id: currentAny.base_id ?? null,
          product_created_at: currentAny.created_at?.toISOString?.() ?? null,
          product_updated_at: currentAny.updated_at?.toISOString?.() ?? null,
        } as Prisma.InputJsonValue,
      });
    }

    return updated;
  }

  /**
   * Hard delete for failed creation rollback only. Removes product_logs and product.
   * Do NOT use for admin-initiated delete (use delete() for soft delete).
   */
  async hardDeleteForFailedCreate(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.productLog.deleteMany({ where: { product_id: id } });
      await tx.product.delete({ where: { id } });
    });
  }

  async findAll(params: ListProductsParams): Promise<{ products: Product[]; total: number }> {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;
    const searchTrim = search?.trim();
    const includeDeleted = params.includeDeleted === true;

    if (!searchTrim) {
      /** activeOnly: show only ACTIVE versions (one per base_id). Supports pagination. */
      if (params.activeOnly) {
        const [products, countResult] = await Promise.all([
          prisma.$queryRaw<Product[]>`
            SELECT * FROM products
            WHERE status = 'ACTIVE'
            ORDER BY COALESCE(category_display_order, 999999), COALESCE(product_display_order, 999999), created_at ASC
            LIMIT ${pageSize} OFFSET ${skip}
          `,
          prisma.$queryRaw<[{ count: number }]>`
            SELECT COUNT(*)::int as count FROM products WHERE status = 'ACTIVE'
          `,
        ]);
        const total = countResult[0]?.count ?? 0;
        return { products, total };
      }

      const whereAdmin = includeDeleted ? ({} as any) : ({ status: { not: "DELETED" } } as any);
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: whereAdmin,
          skip,
          take: pageSize,
          orderBy: { updated_at: "desc" },
        }),
        prisma.product.count({ where: whereAdmin }),
      ]);
      return { products, total };
    }

    const pattern = `%${searchTrim}%`;
    /** Search with optional activeOnly; when true, only ACTIVE versions. */
    if (params.activeOnly) {
      const [products, countResult] = await Promise.all([
        prisma.$queryRaw<Product[]>`
          SELECT * FROM products
          WHERE (
            (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
            OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
          )
            AND status = 'ACTIVE'
          ORDER BY updated_at DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int as count FROM products
          WHERE (
            (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
            OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
          )
            AND status = 'ACTIVE'
        `,
      ]);
      const total = countResult[0]?.count ?? 0;
      return { products, total };
    }
    const deletedClause = includeDeleted ? Prisma.sql`` : Prisma.sql`AND status != 'DELETED'`;
    const [products, countResult] = await Promise.all([
      prisma.$queryRaw<Product[]>`
        SELECT * FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
        ${deletedClause}
        ORDER BY updated_at DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
        ${deletedClause}
      `,
    ]);
    const total = countResult[0]?.count ?? 0;
    return { products, total };
  }
}

export interface CreateProductLogData {
  userId: string;
  productId?: string | null;
  eventType: ProductEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Product log repository: read/write product audit logs only.
 * Product CRUD and image logic have been removed.
 */
export class ProductLogRepository {
  async create(data: CreateProductLogData) {
    return createProductLogRow({
      userId: data.userId,
      productId: data.productId ?? null,
      eventType: data.eventType,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      deviceInfo: data.deviceInfo ?? null,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    });
  }

  async findAll(params: GetProductLogsQuery) {
    const { page, pageSize, search, eventType, dateRange } = params;
    const skip = (page - 1) * pageSize;

    const where = {} as Record<string, unknown>;

    if (eventType) {
      where.event_type = eventType;
    }

    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (dateRange) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      where.created_at = { gte: startDate };
    }

    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { first_name: { contains: search, mode: "insensitive" } } },
        { user: { last_name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.productLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
              roles: true,
            },
          },
        },
      }),
      prisma.productLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findForExport(params: {
    search?: string;
    eventType?: ProductEventType;
    eventTypes?: ProductEventType[];
    dateRange: DateRangeValue;
  }) {
    const where = {} as Record<string, unknown>;

    if (params.eventType) {
      where.event_type = params.eventType;
    } else if (params.eventTypes && params.eventTypes.length > 0) {
      where.event_type = { in: params.eventTypes };
    }

    if (params.dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (params.dateRange) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      where.created_at = { gte: startDate };
    }

    if (params.search) {
      where.OR = [
        { user: { email: { contains: params.search, mode: "insensitive" } } },
        { user: { first_name: { contains: params.search, mode: "insensitive" } } },
        { user: { last_name: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    return prisma.productLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 10000, // Limit export to prevent memory issues
      include: {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  }
}

export const productLogRepository = new ProductLogRepository();
