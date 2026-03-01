/**
 * Product logs: save a row to product_logs when a product is created, updated, or deleted.
 * Metadata = same shape as the product (workflow snapshot + version, timestamps). Product name is derived from workflow (financing type step).
 * Also: helpers for the controller to find S3 keys to delete on update/delete.
 */

import { Request } from "express";
import { logger } from "../../lib/logger";
import { getClientIp, getDeviceInfo } from "../../lib/http/request-utils";
import { productLogRepository } from "./repository";
import type { ProductEventType } from "./schemas";

const PRODUCT_S3_PREFIX = "products/";
const SUPPORTING_CATEGORIES = ["financial_docs", "legal_docs", "compliance_docs", "others"];

// --- Build metadata (what we store in product_logs.metadata) ---

/** Copy workflow so we store a snapshot, not a reference. */
function copyWorkflow(workflow: unknown[]): unknown[] {
  try {
    return JSON.parse(JSON.stringify(workflow));
  } catch {
    return [];
  }
}

/**
 * Build the metadata object for one log row.
 * Always: workflow (copy), version, product_created_at, product_updated_at.
 */
export function buildProductLogMetadata(
  workflow: unknown[],
  version: number,
  productCreatedAt: Date,
  productUpdatedAt: Date
): Record<string, unknown> {
  const steps = Array.isArray(workflow) ? workflow : [];
  return {
    workflow: copyWorkflow(steps),
    version,
    product_created_at: productCreatedAt.toISOString(),
    product_updated_at: productUpdatedAt.toISOString(),
  };
}

// --- Write one log row ---

/** Save one product_log. If it fails we only log a warning (don't break the request). */
export async function createProductLog(
  req: Request,
  eventType: ProductEventType,
  productId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const userId = req.user?.user_id ?? null;
  if (!userId) return;
  try {
    await productLogRepository.create({
      userId,
      productId,
      eventType,
      ipAddress: getClientIp(req) ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      deviceInfo: getDeviceInfo(req),
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.warn({ err, eventType, productId }, "Failed to write product log");
  }
}

// --- S3 key helpers (used by controller to delete files on update/delete) ---

/** Find every s3_key in the workflow that starts with "products/". */
export function getProductS3KeysFromWorkflow(workflow: unknown): string[] {
  const keys = new Set<string>();
  function walk(obj: unknown) {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (k === "s3_key" && typeof v === "string") {
          const path = v.trim();
          if (path.startsWith(PRODUCT_S3_PREFIX)) keys.add(path);
        } else {
          walk(v);
        }
      }
    }
  }
  walk(workflow);
  return [...keys];
}

/** Step id from a step object. */
function stepId(step: unknown): string {
  const s = step as { id?: string };
  return s?.id ?? "";
}

/** Config object from a step. */
function stepConfig(step: unknown): Record<string, unknown> {
  const s = step as { config?: unknown };
  const c = s?.config;
  return (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
}

/**
 * S3 keys that were in the old workflow but are gone or changed in the new one.
 * Controller uses this to delete those files from S3 after an update.
 */
export function getReplacedProductS3Keys(oldWorkflow: unknown[], newWorkflow: unknown[]): string[] {
  const keys = new Set<string>();
  const oldSteps = Array.isArray(oldWorkflow) ? oldWorkflow : [];
  const newSteps = Array.isArray(newWorkflow) ? newWorkflow : [];

  // Financing type image: if old had an image and it's different in new, mark old for delete
  const oldFinancing = oldSteps.find((s) => stepId(s).startsWith("financing_type"));
  const newFinancing = newSteps.find((s) => stepId(s).startsWith("financing_type"));
  const oldC = oldFinancing ? stepConfig(oldFinancing) : {};
  const newC = newFinancing ? stepConfig(newFinancing) : {};
  const oldImg = oldC.image as { s3_key?: string } | undefined;
  const newImg = newC.image as { s3_key?: string } | undefined;
  const oldKey = (oldImg?.s3_key ?? (oldC.s3_key as string))?.trim();
  const newKey = (newImg?.s3_key ?? (newC.s3_key as string))?.trim();
  if (oldKey && oldKey !== newKey && oldKey.startsWith(PRODUCT_S3_PREFIX)) {
    keys.add(oldKey);
  }

  // Supporting docs: for each category, compare template s3_keys; if old template replaced, mark for delete
  const oldSupport = oldSteps.find((s) => stepId(s).startsWith("supporting_documents"));
  const newSupport = newSteps.find((s) => stepId(s).startsWith("supporting_documents"));
  const oldSupportC = oldSupport ? stepConfig(oldSupport) : {};
  const newSupportC = newSupport ? stepConfig(newSupport) : {};
  for (const cat of SUPPORTING_CATEGORIES) {
    const oldList = (oldSupportC[cat] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const newList = (newSupportC[cat] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const n = Math.max(oldList.length, newList.length);
    for (let i = 0; i < n; i++) {
      const oldItem = oldList[i];
      const newItem = newList[i];
      const oldT = oldItem?.template?.s3_key?.trim();
      const newT = newItem?.template?.s3_key?.trim() ?? "";
      if (oldT && oldT !== newT && oldT.startsWith(PRODUCT_S3_PREFIX)) {
        keys.add(oldT);
      }
    }
  }
  return [...keys];
}
