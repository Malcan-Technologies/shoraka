import { prisma } from "../../lib/prisma";
import { Product, Prisma } from "@prisma/client";
import type { ProductEventType, GetProductLogsQuery, DateRangeValue } from "./schemas";

export interface ListProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  activeOnly?: boolean;
}

export interface UpdateProductData {
  workflow?: unknown[];
  /** When true, replace workflow without incrementing version (used only for the first update right after create). */
  completeCreate?: boolean;
  offer_expiry_days?: number | null;
}

export interface CreateProductData {
  workflow: unknown[];
  offer_expiry_days?: number | null;
}

export interface LogContext {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
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

  async create(data: CreateProductData, _logContext?: LogContext): Promise<Product> {
    // Determine category and ordering from workflow config (financing type step)
    const workflow = data.workflow as unknown[];
    const financingStep = (workflow || []).find((step: any) =>
      String(step?.name).toLowerCase().includes("financing type")
    ) as any | undefined;
    const config = financingStep?.config ?? {};
    const categoryName = (config.category as string) || "Other";

    // Run in transaction to avoid race conditions when computing max + 1
    return await prisma.$transaction(async (tx) => {
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
          workflow: data.workflow as Prisma.InputJsonValue,
          category_display_order: categoryDisplayOrder,
          product_display_order: nextProductOrder,
          offer_expiry_days: data.offer_expiry_days ?? undefined,
        },
      } as any);

      /** New products are their own base; set base_id = id for versioning grouping. */
      await tx.product.update({
        where: { id: created.id },
        data: { base_id: created.id },
      } as any);

      /** Skip PRODUCT_CREATED log here. Image is merged in completeCreate update; log is written there with full workflow. */
      return created;
    });
  }

  /**
   * Versioned product update: never modify existing product except to set status INACTIVE.
   * When completeCreate is true: in-place update only (first save after create, e.g. merging image/template keys).
   * Otherwise: 1) Set old product INACTIVE, 2) Create new version row, 3) Return new product.
   */
  async update(id: string, data: UpdateProductData, logContext?: LogContext): Promise<Product> {
    if (data.workflow === undefined && data.offer_expiry_days === undefined) {
      return prisma.product.findUniqueOrThrow({ where: { id } });
    }
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      throw new Error("Product not found");
    }
    const currentWorkflow = current.workflow as unknown;
    const workflowUnchanged = data.workflow === undefined || workflowDeepEqual(data.workflow, currentWorkflow);
    const currentOfferExpiry = (current as { offer_expiry_days?: number | null }).offer_expiry_days ?? null;
    const offerExpiryUnchanged =
      data.offer_expiry_days === undefined ||
      (data.offer_expiry_days === currentOfferExpiry || (data.offer_expiry_days == null && currentOfferExpiry == null));
    if (workflowUnchanged && offerExpiryUnchanged) {
      return current;
    }

    /** completeCreate: first update after create (merge image/template keys). In-place update only; no new version row. */
    if (data.completeCreate === true) {
      const workflowPayload = (data.workflow === undefined ? current.workflow : data.workflow) as Prisma.InputJsonValue;
      const offerExpiryPayload =
        data.offer_expiry_days !== undefined ? data.offer_expiry_days : (current as { offer_expiry_days?: number | null }).offer_expiry_days ?? null;
      const updated = await prisma.product.update({
        where: { id },
        data: {
          workflow: workflowPayload,
          offer_expiry_days: offerExpiryPayload ?? undefined,
        },
      } as any);
      if (logContext?.userId) {
        const updatedAny = updated as any;
        const metadata = {
          workflow: JSON.parse(JSON.stringify(updatedAny.workflow)),
          category_display_order: updatedAny.category_display_order ?? null,
          product_display_order: updatedAny.product_display_order ?? null,
          offer_expiry_days: updatedAny.offer_expiry_days ?? null,
          version: updatedAny.version,
          base_id: updatedAny.base_id ?? null,
          status: updatedAny.status ?? null,
          product_created_at: updatedAny.created_at.toISOString(),
          product_updated_at: updatedAny.updated_at.toISOString(),
          replaced_product_id: null,
        };
        await prisma.productLog.create({
          data: {
            user_id: logContext.userId,
            product_id: updated.id,
            event_type: "PRODUCT_CREATED",
            ip_address: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            user_agent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            device_info: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: metadata as Prisma.InputJsonValue,
          },
        } as any);
      }
      return updated;
    }

    const newVersion = current.version + 1;
    const workflowPayload = (data.workflow === undefined ? current.workflow : data.workflow) as Prisma.InputJsonValue;
    const offerExpiryPayload =
      data.offer_expiry_days !== undefined ? data.offer_expiry_days : (current as { offer_expiry_days?: number | null }).offer_expiry_days ?? null;

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
          workflow: workflowPayload,
          category_display_order: categoryDisplayOrder,
          product_display_order: productDisplayOrder,
          offer_expiry_days: offerExpiryPayload ?? undefined,
          base_id: baseId,
          status: "ACTIVE" as any,
        },
      } as any);

      if (logContext?.userId) {
        const createdAny = created as any;
        const metadata = {
          workflow: JSON.parse(JSON.stringify(createdAny.workflow)),
          category_display_order: createdAny.category_display_order ?? null,
          product_display_order: createdAny.product_display_order ?? null,
          offer_expiry_days: createdAny.offer_expiry_days ?? null,
          version: createdAny.version,
          base_id: createdAny.base_id ?? null,
          status: createdAny.status ?? null,
          product_created_at: createdAny.created_at.toISOString(),
          product_updated_at: createdAny.updated_at.toISOString(),
          replaced_product_id: id,
        };
        await tx.productLog.create({
          data: {
            user_id: logContext.userId,
            product_id: created.id,
            event_type: "PRODUCT_UPDATED",
            ip_address: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            user_agent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            device_info: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: metadata as Prisma.InputJsonValue,
          },
        } as any);
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
          offer_expiry_days: currentAny.offer_expiry_days ?? null,
          version: currentAny.version,
          base_id: currentAny.base_id ?? null,
          status: currentAny.status ?? null,
          product_created_at: currentAny.created_at.toISOString(),
          product_updated_at: currentAny.updated_at.toISOString(),
          replaced_product_id: null,
        };
        // create log before soft-delete so snapshot represents persisted state
        await tx.productLog.create({
          data: {
            user_id: logContext.userId,
            product_id: current.id,
            event_type: "PRODUCT_DELETED",
            ip_address: logContext.ipAddress ? String(logContext.ipAddress) : undefined,
            user_agent: logContext.userAgent ? String(logContext.userAgent) : undefined,
            device_info: logContext.deviceInfo ? String(logContext.deviceInfo) : undefined,
            metadata: metadata as Prisma.InputJsonValue,
          },
        } as any);

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

  // Helper: mark product inactive
  async setInactive(id: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        status: "INACTIVE" as any,
      },
    } as any);
  }

  // Helper: restore product to ACTIVE (undo soft-delete)
  async restoreProduct(id: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        status: "ACTIVE" as any,
        deleted_at: null,
      },
    } as any);
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

      const whereAdmin = { status: { not: "DELETED" } } as any;
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
    const [products, countResult] = await Promise.all([
      prisma.$queryRaw<Product[]>`
        SELECT * FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
          AND status != 'DELETED'
        ORDER BY updated_at DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM products
        WHERE (
          (workflow::jsonb->0->'config'->>'name') ILIKE ${pattern}
          OR (workflow::jsonb->0->'config'->'type'->>'name') ILIKE ${pattern}
        )
          AND status != 'DELETED'
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
    return prisma.productLog.create({
      data: {
        user_id: data.userId,
        product_id: data.productId ?? null,
        event_type: data.eventType,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
        device_info: data.deviceInfo ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
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
