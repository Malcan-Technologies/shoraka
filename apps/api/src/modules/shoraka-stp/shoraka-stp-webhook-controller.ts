import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { normalizeProviderStatus } from "./shoraka-stp-service";

const router = Router();

const callbackBodySchema = z.object({
  orderId: z.string().min(1),
  status: z.string().min(1),
  apiId: z.string().min(1),
  signature: z.string().min(1),

  // Optional fields used in signature generation
  bankName: z.union([z.string(), z.null()]).nullable().optional(),
  ownershipName: z.union([z.string(), z.null()]).nullable().optional(),
  commodityType: z.union([z.string(), z.null()]).nullable().optional(),
  unit: z.union([z.string(), z.number(), z.null()]).nullable().optional(),
  volume: z.union([z.string(), z.number(), z.null()]).nullable().optional(),
  productType: z.union([z.string(), z.null()]).nullable().optional(),
  valueDate: z.union([z.string(), z.null()]).nullable().optional(),
  cancelDate: z.union([z.string(), z.null()]).nullable().optional(),
  orderType: z.union([z.string(), z.null()]).nullable().optional(),
  orderCurrency: z.union([z.string(), z.null()]).nullable().optional(),
  orderAmount: z.union([z.string(), z.number(), z.null()]).nullable().optional(),
  murabahaAmount: z.union([z.string(), z.number(), z.null()]).nullable().optional(),
  tenor: z.union([z.string(), z.null()]).nullable().optional(),
  tenorOther: z.union([z.string(), z.null()]).nullable().optional(),
  tenorOtherUnit: z.union([z.string(), z.null()]).nullable().optional(),

  // Other certificate details we store as payload for audit.
  certificateDetails1: z.union([z.string(), z.null()]).nullable().optional(),
  certificateDetails2: z.union([z.string(), z.null()]).nullable().optional(),
  certificateDetails3: z.union([z.string(), z.null()]).nullable().optional(),
  certificateUrl: z.union([z.string(), z.null()]).nullable().optional(),
});

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function envRequired(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function sigPart(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildCallbackSignatureSource(body: z.infer<typeof callbackBodySchema>): string {
  // Signature format:
  // SECRET_KEY;API_ID;order_id;status;bank_name;ownership_name;commodity_type;unit;volume;product_type;value_date;cancel_date;order_type;order_currency;order_amount;murabaha_amount;tenor;tenor_other;tenor_other_unit
  const secretKey = envRequired("SHORAKA_SECRET_KEY");
  const apiId = envRequired("SHORAKA_API_ID");

  return [
    secretKey,
    apiId,
    body.orderId,
    sigPart(body.status),
    sigPart(body.bankName),
    sigPart(body.ownershipName),
    sigPart(body.commodityType),
    sigPart(body.unit),
    sigPart(body.volume),
    sigPart(body.productType),
    sigPart(body.valueDate),
    sigPart(body.cancelDate),
    sigPart(body.orderType),
    sigPart(body.orderCurrency),
    sigPart(body.orderAmount),
    sigPart(body.murabahaAmount),
    sigPart(body.tenor),
    sigPart(body.tenorOther),
    sigPart(body.tenorOtherUnit),
  ].join(";");
}

export async function shorakaStpCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = callbackBodySchema.parse(req.body);

    const expectedApiId = envRequired("SHORAKA_API_ID");
    if (parsed.apiId !== expectedApiId) {
      throw new AppError(401, "SHORAKA_API_ID_INVALID", "Invalid Shoraka apiId");
    }

    const signatureSource = buildCallbackSignatureSource(parsed);
    const expectedSignature = sha256Hex(signatureSource);

    if (expectedSignature !== parsed.signature) {
      // Log only a short preview; never log secrets or the signature source string.
      logger.warn({ signaturePreview: parsed.signature.slice(0, 6) }, "Shoraka callback signature mismatch");
      throw new AppError(401, "INVALID_SIGNATURE", "Invalid webhook signature");
    }

    const orderId = parsed.orderId;
    const existing = await prisma.shorakaTradeOrder.findUnique({
      where: { provider_order_id: orderId },
    });

    if (!existing) {
      throw new AppError(404, "SHORAKA_ORDER_NOT_FOUND", "Shoraka trade order not found for this provider_order_id");
    }

    const normalizedStatus = normalizeProviderStatus(parsed.status);

    // Update status only (do not auto-fetch certificate).
    await prisma.shorakaTradeOrder.update({
      where: { id: existing.id },
      data: {
        status: normalizedStatus,
        callback_payload: req.body,
        callback_received_at: new Date(),
        status_last_checked_at: new Date(),
      },
    });

    // Success log for operations: confirm webhook was verified + persisted.
    logger.info(
      {
        correlationId: res.locals.correlationId,
        orderId: parsed.orderId,
        status: normalizedStatus,
      },
      "Shoraka callback processed successfully"
    );

    res.status(200).type("text/plain").send("OK");
  } catch (error) {
    next(error);
  }
}

router.post("/shoraka-stp/callback", shorakaStpCallbackHandler);

export const shorakaStpWebhookRouter = router;

