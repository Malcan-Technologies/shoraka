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
  // Provider sometimes sends these as arrays; accept them and stringify for storage consistency.
  certificateDetails1: z.union([z.string(), z.array(z.unknown()), z.null()]).nullable().optional(),
  certificateDetails2: z.union([z.string(), z.array(z.unknown()), z.null()]).nullable().optional(),
  certificateDetails3: z.union([z.string(), z.array(z.unknown()), z.null()]).nullable().optional(),
  certificateUrl: z.union([z.string(), z.null()]).nullable().optional(),
});

function stringifyIfArray(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  // Store as JSON string so older code/UI that expects string won't break.
  try {
    return JSON.stringify(v);
  } catch {
    // Fallback: keep something predictable even if JSON.stringify fails for weird values.
    return String(v);
  }
}

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

export async function shorakaStpCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Always log that the webhook endpoint was hit (before validation/signature checks).
    // Avoid logging secrets/signature payloads.
    const body = req.body as unknown as Record<string, unknown> | undefined;
    logger.info(
      {
        correlationId: res.locals.correlationId,
        orderId: typeof body?.orderId === "string" ? body.orderId : undefined,
        apiId: typeof body?.apiId === "string" ? body.apiId : undefined,
      },
      "Shoraka callback endpoint hit"
    );

    const parsed = callbackBodySchema.parse(req.body);

    const expectedApiId = envRequired("SHORAKA_API_ID");
    if (parsed.apiId !== expectedApiId) {
      throw new AppError(401, "SHORAKA_API_ID_INVALID", "Invalid Shoraka apiId");
    }

    // Build callback signature source in the exact order expected by the backend.
    // We also build a masked version for safe debug logging (no real secret in logs).
    const secretKey = envRequired("SHORAKA_SECRET_KEY");
    const apiId = envRequired("SHORAKA_API_ID");
    // Signature format:
    // SECRET_KEY;API_ID;order_id;status;bank_name;ownership_name;commodity_type;unit;volume;product_type;value_date;cancel_date;order_type;order_currency;order_amount;murabaha_amount;tenor;tenor_other;tenor_other_unit
    // For optional fields, backend uses: null/undefined => ""

    // TEMP DEBUG - remove after Shoraka signature issue is resolved.
    const tenorIsON = typeof parsed.tenor === "string" && parsed.tenor.trim() === "O/N";

    const receivedSignature = parsed.signature;
    const receivedSignaturePreview = receivedSignature.slice(0, 8);

    const bodyRec = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null;
    const rawBodyForLog =
      bodyRec
        ? {
            ...bodyRec,
            // Avoid logging full signature; only preview.
            signature:
              typeof bodyRec.signature === "string" ? bodyRec.signature.slice(0, 8) + "..." : undefined,
          }
        : req.body;

    logger.warn(
      {
        callbackSignatureRawBody: rawBodyForLog,
        callbackSigningValues: {
          secret: "***SECRET***",
          apiId,
          orderId: parsed.orderId,
          status: parsed.status,
          bankName: parsed.bankName,
          ownershipName: parsed.ownershipName,
          commodityType: parsed.commodityType,
          unit: parsed.unit,
          volume: parsed.volume,
          productType: parsed.productType,
          valueDate: parsed.valueDate,
          cancelDate: parsed.cancelDate,
          orderType: parsed.orderType,
          orderCurrency: parsed.orderCurrency,
          orderAmount: parsed.orderAmount,
          murabahaAmount: parsed.murabahaAmount,
          tenor: parsed.tenor,
          tenorOther: parsed.tenorOther,
          tenorOtherUnit: parsed.tenorOtherUnit,
        },
      },
      "TEMP DEBUG - Shoraka callback signature inputs"
    );

    function buildSignatureSourceMaskedAndHash(input: {
      commodityTypeSigned: unknown;
      tenorOtherSigned: unknown;
      tenorOtherUnitSigned: unknown;
      unitSigned: unknown;
    }): { sourceMasked: string; signature: string } {
      const parts: unknown[] = [
        "***SECRET***",
        apiId,
        parsed.orderId,
        sigPart(parsed.status),
        sigPart(parsed.bankName),
        sigPart(parsed.ownershipName),
        sigPart(input.commodityTypeSigned),
        sigPart(input.unitSigned),
        sigPart(parsed.volume),
        sigPart(parsed.productType),
        sigPart(parsed.valueDate),
        sigPart(parsed.cancelDate),
        sigPart(parsed.orderType),
        sigPart(parsed.orderCurrency),
        sigPart(parsed.orderAmount),
        sigPart(parsed.murabahaAmount),
        sigPart(parsed.tenor),
        sigPart(input.tenorOtherSigned),
        sigPart(input.tenorOtherUnitSigned),
      ];

      // Build real hash with the real secretKey, but only masked string for logs.
      const hashParts: unknown[] = [
        secretKey,
        apiId,
        parsed.orderId,
        sigPart(parsed.status),
        sigPart(parsed.bankName),
        sigPart(parsed.ownershipName),
        sigPart(input.commodityTypeSigned),
        sigPart(input.unitSigned),
        sigPart(parsed.volume),
        sigPart(parsed.productType),
        sigPart(parsed.valueDate),
        sigPart(parsed.cancelDate),
        sigPart(parsed.orderType),
        sigPart(parsed.orderCurrency),
        sigPart(parsed.orderAmount),
        sigPart(parsed.murabahaAmount),
        sigPart(parsed.tenor),
        sigPart(input.tenorOtherSigned),
        sigPart(input.tenorOtherUnitSigned),
      ];

      return {
        sourceMasked: parts.join(";"),
        signature: sha256Hex(hashParts.join(";")),
      };
    }

    const commodityNormalized = parsed.commodityType === "COPPER" ? "000-COPPER" : parsed.commodityType;
    const unitNormalized = parsed.unit === "Tonnes" ? "Tonne" : parsed.unit;

    const candidates = [
      {
        name: "asIs",
        commodityTypeSigned: parsed.commodityType,
        unitSigned: parsed.unit,
        tenorOtherSigned: parsed.tenorOther,
        tenorOtherUnitSigned: parsed.tenorOtherUnit,
      },
      {
        name: "onNormalized",
        commodityTypeSigned: parsed.commodityType,
        unitSigned: parsed.unit,
        tenorOtherSigned: tenorIsON ? "" : parsed.tenorOther,
        tenorOtherUnitSigned: tenorIsON ? "" : parsed.tenorOtherUnit,
      },
      {
        name: "commodityNormalized",
        commodityTypeSigned: commodityNormalized,
        unitSigned: parsed.unit,
        tenorOtherSigned: parsed.tenorOther,
        tenorOtherUnitSigned: parsed.tenorOtherUnit,
      },
      {
        name: "onAndCommodityNormalized",
        commodityTypeSigned: commodityNormalized,
        unitSigned: parsed.unit,
        tenorOtherSigned: tenorIsON ? "" : parsed.tenorOther,
        tenorOtherUnitSigned: tenorIsON ? "" : parsed.tenorOtherUnit,
      },
      {
        name: "unitSingular",
        commodityTypeSigned: parsed.commodityType,
        unitSigned: unitNormalized,
        tenorOtherSigned: parsed.tenorOther,
        tenorOtherUnitSigned: parsed.tenorOtherUnit,
      },
      {
        name: "unitAndCommodityNormalized",
        commodityTypeSigned: commodityNormalized,
        unitSigned: unitNormalized,
        tenorOtherSigned: parsed.tenorOther,
        tenorOtherUnitSigned: parsed.tenorOtherUnit,
      },
      {
        name: "allNormalized",
        commodityTypeSigned: commodityNormalized,
        unitSigned: unitNormalized,
        tenorOtherSigned: tenorIsON ? "" : parsed.tenorOther,
        tenorOtherUnitSigned: tenorIsON ? "" : parsed.tenorOtherUnit,
      },
    ];

    const candidateResults = candidates.map((c) => {
      const built = buildSignatureSourceMaskedAndHash({
        commodityTypeSigned: c.commodityTypeSigned,
        unitSigned: c.unitSigned,
        tenorOtherSigned: c.tenorOtherSigned,
        tenorOtherUnitSigned: c.tenorOtherUnitSigned,
      });
      const candidateMatches = built.signature === receivedSignature;
      return {
        candidate: c.name,
        generatedSignaturePreview: built.signature.slice(0, 8),
        matches: candidateMatches,
        sourceMasked: built.sourceMasked,
      };
    });

    const matching = candidateResults.find((r) => r.matches);

    logger.warn(
      {
        receivedSignaturePreview,
        candidateResults,
      },
      "TEMP DEBUG - Shoraka callback signature candidate previews"
    );

    if (!matching) {
      throw new AppError(401, "INVALID_SIGNATURE", "Invalid webhook signature");
    }

    logger.info(
      {
        receivedSignaturePreview,
        matchedCandidate: matching.candidate,
        matchedGeneratedSignaturePreview: matching.generatedSignaturePreview,
      },
      "Shoraka callback signature matched (after candidate normalization)"
    );

    const orderId = parsed.orderId;
    const existing = await prisma.shorakaTradeOrder.findUnique({
      where: { provider_order_id: orderId },
    });

    if (!existing) {
      throw new AppError(404, "SHORAKA_ORDER_NOT_FOUND", "Shoraka trade order not found for this provider_order_id");
    }

    const normalizedStatus = normalizeProviderStatus(parsed.status);

    // Update status only (do not auto-fetch certificate).
    // Persist payload with stable types (string for certificateDetails1/2/3).
    const payloadForDb = {
      ...req.body,
      certificateDetails1: stringifyIfArray((req.body as Record<string, unknown>)?.certificateDetails1),
      certificateDetails2: stringifyIfArray((req.body as Record<string, unknown>)?.certificateDetails2),
      certificateDetails3: stringifyIfArray((req.body as Record<string, unknown>)?.certificateDetails3),
    };

    await prisma.shorakaTradeOrder.update({
      where: { id: existing.id },
      data: {
        status: normalizedStatus,
        callback_payload: payloadForDb,
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

