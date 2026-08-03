import * as crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { signingService } from "../signing/service";
import { AppError } from "../../lib/http/error-handler";
import { readSigningCloudConfigFromEnv } from "./signingcloud-api";
import {
  decryptSigningCloudResponse,
  type SigningCloudEncryptedResponse,
} from "../../lib/signingcloud/crypto";
import { signingCloudWebhookRateLimiter } from "../../lib/http/rate-limit";
import { logger } from "../../lib/logger";

const router = Router();
router.use(signingCloudWebhookRateLimiter);
router.use(express.urlencoded({ extended: true, limit: "2mb" }));
router.use(express.json({ limit: "2mb" }));

function looksEncrypted(body: unknown): body is SigningCloudEncryptedResponse {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).data === "string" &&
    typeof (body as Record<string, unknown>).mac === "string"
  );
}

type DecryptWebhookResult =
  | { kind: "plaintext"; value: unknown }
  | { kind: "decrypted"; value: Record<string, unknown> }
  | { kind: "reject" };

function decryptWebhookBody(body: unknown): DecryptWebhookResult {
  if (!looksEncrypted(body)) {
    return { kind: "plaintext", value: body };
  }

  const cfg = readSigningCloudConfigFromEnv();
  if (!cfg) {
    logger.warn("SigningCloud webhook: encrypted body but provider is not configured");
    return { kind: "reject" };
  }

  try {
    const decrypted = decryptSigningCloudResponse<Record<string, unknown>>(
      body as SigningCloudEncryptedResponse,
      cfg.apiSecret
    );
    return { kind: "decrypted", value: decrypted };
  } catch (e) {
    logger.warn({ err: e }, "SigningCloud webhook: MAC verification failed");
    return { kind: "reject" };
  }
}

const CONTRACTNUM_NESTED_KEYS = ["data", "Data", "payload", "Payload", "contractInfo", "body", "Body"];

function readContractnumField(obj: Record<string, unknown>): string | null {
  for (const key of Object.keys(obj)) {
    const kl = key.toLowerCase();
    if (kl !== "contractnum" && kl !== "contractnumber") continue;
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractContractnumDeep(value: unknown, depth = 0): string | null {
  if (depth > 14) return null;

  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = extractContractnumDeep(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  const o = value as Record<string, unknown>;
  const direct = readContractnumField(o);
  if (direct) return direct;

  for (const nk of CONTRACTNUM_NESTED_KEYS) {
    if (!(nk in o)) continue;
    const hit = extractContractnumDeep(o[nk], depth + 1);
    if (hit) return hit;
  }

  return null;
}

function extractContractnumFromRequest(body: unknown, query: Request["query"]): string | null {
  const decrypted = decryptWebhookBody(body);
  if (decrypted.kind === "reject") {
    throw new AppError(400, "BAD_REQUEST", "Invalid webhook payload");
  }

  const fromBody = extractContractnumDeep(decrypted.value);
  if (fromBody) return fromBody;

  const q = query ?? {};
  const qNum =
    (typeof q.contractnum === "string" && q.contractnum.trim()) ||
    (typeof q.contractnumber === "string" && q.contractnumber.trim()) ||
    (typeof q.ContractNum === "string" && q.ContractNum.trim()) ||
    "";
  return qNum || null;
}

function verifyWebhookSecret(req: Request): void {
  const secret = process.env.SIGNINGCLOUD_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(500, "INTERNAL_ERROR", "Webhook secret is not configured");
    }
    return;
  }

  const hdr = req.headers["x-signingcloud-secret"];
  const provided = typeof hdr === "string" ? hdr : Array.isArray(hdr) ? hdr[0] : "";
  if (!provided) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid webhook secret");
  }

  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid webhook secret");
  }
}

async function webhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    verifyWebhookSecret(req);

    const contractnum = extractContractnumFromRequest(req.body, req.query);

    if (!contractnum) {
      logger.warn(
        {
          contentType: req.headers["content-type"],
          bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body as object) : [],
          queryKeys: Object.keys(req.query ?? {}),
        },
        "SigningCloud webhook missing contractnum"
      );
      throw new AppError(400, "BAD_REQUEST", "contractnum is required");
    }

    const envelopeResult = await signingService.applyProviderContractSigned(contractnum);
    if (envelopeResult.skipped) {
      logger.warn(
        { contractnumPrefix: contractnum.slice(0, 8) },
        "SigningCloud webhook: no matching envelope document for contractnum"
      );
    }

    res.status(200).json({
      success: true,
      data: { ok: true },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (e) {
    next(e);
  }
}

router.post("/callback", webhookHandler);

export const signingCloudWebhookRouter = router;
