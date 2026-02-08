import { Request, Response, NextFunction, Router } from "express";
import { invoiceService } from "./service";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceIdParamSchema,
  requestInvoiceUploadUrlSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { z } from "zod";

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId, contractId, details } = createInvoiceSchema.parse(req.body);
    const userId = getUserId(req);
    const invoice = await invoiceService.createInvoice(applicationId, contractId, details, userId);

    res.status(201).json({
      success: true,
      data: invoice,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = invoiceIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const invoice = await invoiceService.getInvoice(id, userId);

    res.json({ success: true, data: invoice, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = invoiceIdParamSchema.parse(req.params);
    const { details } = updateInvoiceSchema.parse(req.body);
    const userId = getUserId(req);
    const invoice = await invoiceService.updateInvoice(id, details, userId);

    res.json({ success: true, data: invoice, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = invoiceIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    await invoiceService.deleteInvoice(id, userId);

    res.json({ success: true, data: { message: "Invoice deleted successfully" }, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function getInvoicesByApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId } = z.object({ applicationId: z.string().cuid() }).parse(req.params);
    const userId = getUserId(req);
    const invoices = await invoiceService.getInvoicesByApplication(applicationId, userId);

    res.json({ success: true, data: invoices, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function getInvoicesByContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { contractId } = z.object({ contractId: z.string().cuid() }).parse(req.params);
    const userId = getUserId(req);
    const invoices = await invoiceService.getInvoicesByContract(contractId, userId);

    res.json({ success: true, data: invoices, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function requestUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = invoiceIdParamSchema.parse(req.params);
    const input = requestInvoiceUploadUrlSchema.parse(req.body);
    const userId = getUserId(req);

    const result = await invoiceService.requestUploadUrl({
      invoiceId: id,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      existingS3Key: input.existingS3Key,
      userId,
    });

    res.json({ success: true, data: result, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = invoiceIdParamSchema.parse(req.params);
    const input = z.object({ s3Key: z.string() }).parse(req.body);
    const userId = getUserId(req);
  await invoiceService.deleteDocument(id, input.s3Key, userId);
  // clear document reference from invoice details
  try {
    await invoiceService.updateInvoice(id, { document: null }, userId);
  } catch (err) {
    // non-fatal
    // eslint-disable-next-line no-console
    console.error("Failed to clear invoice details after document deletion", err);
  }

  res.json({ success: true, data: { message: "Document deleted successfully" }, correlationId: res.locals.correlationId || "unknown" });
  } catch (error) {
    next(error);
  }
}

export function createInvoiceRouter(): Router {
  const router = Router();

  router.post("/", requireAuth, createInvoice);
  router.get("/by-application/:applicationId", requireAuth, getInvoicesByApplication);
  router.get("/by-contract/:contractId", requireAuth, getInvoicesByContract);
  router.get("/:id", requireAuth, getInvoice);
  router.patch("/:id", requireAuth, updateInvoice);
  router.delete("/:id", requireAuth, deleteInvoice);
  router.post("/:id/upload-url", requireAuth, requestUploadUrl);
  router.delete("/:id/document", requireAuth, deleteDocument);

  return router;
}

