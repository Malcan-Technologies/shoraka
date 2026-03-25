import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { applicationService } from "../applications/service";
import { AppError } from "../../lib/http/error-handler";
import { readSigningCloudConfigFromEnv } from "./signingcloud-api";
import {
  decryptSigningCloudResponse,
  type SigningCloudEncryptedResponse,
} from "../../lib/signingcloud/crypto";
import { logger } from "../../lib/logger";

const router = Router();
router.use(express.urlencoded({ extended: true, limit: "2mb" }));
router.use(express.json({ limit: "2mb" }));

function tryDecryptWebhookBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  if (typeof b.data !== "string" || typeof b.mac !== "string") {
    return body;
  }
  const cfg = readSigningCloudConfigFromEnv();
  if (!cfg) {
    return body;
  }
  try {
    return decryptSigningCloudResponse<Record<string, unknown>>(
      body as SigningCloudEncryptedResponse,
      cfg.apiSecret
    );
  } catch (e) {
    logger.warn({ err: e }, "SigningCloud webhook: could not decrypt envelope");
    return body;
  }
}

function extractContractnumDeep(value: unknown, depth = 0): string | null {
  if (depth > 14) return null;

  if (typeof value === "string") {
    const t = value.trim();
    if (t.length >= 8) return t;
    return null;
  }

  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = extractContractnumDeep(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  const o = value as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const kl = key.toLowerCase();
    if (kl === "contractnum" || kl === "contractnumber") {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  const nestedKeys = ["data", "Data", "payload", "Payload", "contractInfo", "body", "Body"];
  for (const nk of nestedKeys) {
    if (nk in o) {
      const hit = extractContractnumDeep(o[nk], depth + 1);
      if (hit) return hit;
    }
  }

  for (const key of Object.keys(o)) {
    if (nestedKeys.includes(key)) continue;
    const hit = extractContractnumDeep(o[key], depth + 1);
    if (hit) return hit;
  }

  return null;
}

function extractContractnumFromRequest(body: unknown, query: Request["query"]): string | null {
  const normalized = tryDecryptWebhookBody(body);
  const fromBody = extractContractnumDeep(normalized);
  if (fromBody) return fromBody;

  const q = query ?? {};
  const qNum =
    (typeof q.contractnum === "string" && q.contractnum.trim()) ||
    (typeof q.contractnumber === "string" && q.contractnumber.trim()) ||
    (typeof q.ContractNum === "string" && q.ContractNum.trim()) ||
    "";
  return qNum || null;
}

async function webhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = process.env.SIGNINGCLOUD_WEBHOOK_SECRET?.trim();
    if (secret) {
      const hdr = req.headers["x-signingcloud-secret"];
      if (hdr !== secret) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid webhook secret");
      }
    }

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

    await applicationService.processSigningCloudCallback(contractnum);
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
router.get("/callback", webhookHandler);

export const signingCloudWebhookRouter = router;
