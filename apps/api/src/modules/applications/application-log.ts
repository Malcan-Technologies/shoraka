import { Request } from "express";
import { logger } from "../../lib/logger";
import { getClientIp, getDeviceInfo } from "../../lib/http/request-utils";
import { applicationLogRepository } from "./application-log-repository";
import { ProductRepository } from "../products/repository";
import { prisma } from "../../lib/prisma";

const productRepository = new ProductRepository();

/**
 * Build a deep-copied metadata snapshot for the application event.
 * Includes: application snapshot, product.workflow & product.version (if any), invoices (if any),
 * and request context (ip/user-agent/deviceInfo/correlationId).
 */
export async function buildApplicationMetadata(params: {
  application: any;
  correlationId?: string | null;
  includeInvoices?: boolean;
}): Promise<Record<string, unknown>> {
  const { application, correlationId = null, includeInvoices = true } = params;

  // Fetch product snapshot if available
  let product: any = null;
  const financing = application?.financing_type as any;
  const productId = financing?.product_id;
  if (productId) {
    try {
      product = await productRepository.findById(productId);
    } catch (err) {
      // ignore
    }
  }

  // Fetch invoices if requested and invoices table exists
  let invoices: any[] | null = null;
  if (includeInvoices && application?.id) {
    try {
      invoices = await prisma.invoice.findMany({
        where: { application_id: application.id },
      });
    } catch (err) {
      invoices = null;
    }
  }

  // Build snapshot object and deep-copy to ensure immutability
  const snapshot = {
    application,
    product: product ? { workflow: product.workflow ?? null, version: product.version ?? null } : null,
    invoices,
    correlationId,
  };

  return JSON.parse(JSON.stringify(snapshot));
}

/**
 * Create one application log row. Non-blocking: errors are caught and warned.
 * Accepts either an application object or an application id (string).
 */
export async function createApplicationLog(
  req: Request,
  eventType: string,
  applicationOrId: string | Record<string, unknown> | null,
  options?: { correlationId?: string | null; includeInvoices?: boolean }
): Promise<void> {
  const userId = (req.user as any)?.user_id ?? null;
  if (!userId) return;

  try {
    let applicationObj: any = null;
    if (!applicationOrId) {
      // nothing to snapshot
      applicationObj = null;
    } else if (typeof applicationOrId === "string") {
      // fetch full application with relations
      try {
        const repo = await import("./repository").then((m) => m.ApplicationRepository);
        const appRepo = new repo();
        applicationObj = await appRepo.findById(applicationOrId);
      } catch (err) {
        applicationObj = null;
      }
    } else {
      applicationObj = applicationOrId;
      // If caller passed an application object but it's partial, try to fetch full record by id
      try {
        const id = (applicationObj as any)?.id;
        if (id) {
          const repo = await import("./repository").then((m) => m.ApplicationRepository);
          const appRepo = new repo();
          const full = await appRepo.findById(id);
          if (full) applicationObj = full;
        }
      } catch {
        // ignore and proceed with provided object
      }
    }

    const metadata = await buildApplicationMetadata({
      application: applicationObj,
      correlationId: options?.correlationId ?? null,
      includeInvoices: options?.includeInvoices ?? true,
    });

    await applicationLogRepository.create({
      userId,
      applicationId: applicationObj?.id ?? null,
      eventType,
      ipAddress: getClientIp(req) ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      deviceInfo: getDeviceInfo(req),
      metadata,
    });
  } catch (err) {
    logger.warn({ err, eventType }, "Failed to write application log");
  }
}

