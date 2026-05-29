import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/http/error-handler";
import {
  fetchWiseAiSessionCredentials,
  decryptWiseAiEkycPayload,
  type WiseAiEncryption,
} from "../../lib/wiseai/crypto";
import {
  getSigningCloudEkycSession,
  submitSigningCloudEkycResult,
} from "./signingcloud-ekyc";

const router = Router();

const sessionQuerySchema = z.object({
  email: z.string().email(),
  docType: z.enum(["mykad", "passport"]).default("mykad"),
});

const statusQuerySchema = z.object({
  token: z.string().min(1),
});

const completeBodySchema = z.object({
  token: z.string().min(1),
  result: z.unknown(),
});

type PrototypeSessionStatus = "pending" | "submitted" | "error";

type StoredSession = {
  email: string;
  docType: "mykad" | "passport";
  url: string;
  encryption: WiseAiEncryption | null;
  status: PrototypeSessionStatus;
  rawResult?: unknown;
  decrypted?: unknown;
  submitResponse?: unknown;
  error?: string;
};

const sessions = new Map<string, StoredSession>();

function correlationId(res: Response): string {
  return res.locals.correlationId || "unknown";
}

function extractEncryptedData(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (typeof record.encryptedData === "string" && record.encryptedData.trim()) {
    return record.encryptedData.trim();
  }

  const nestedData = record.data;
  if (!nestedData || typeof nestedData !== "object") {
    return null;
  }

  const nestedRecord = nestedData as Record<string, unknown>;
  return typeof nestedRecord.encryptedData === "string" && nestedRecord.encryptedData.trim()
    ? nestedRecord.encryptedData.trim()
    : null;
}

function normalizeMykadNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

function normalizePassportNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  return compact.length > 0 ? compact : null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim().toUpperCase();
  return name.length > 0 ? name : null;
}

function buildSubmitPayload(
  decrypted: unknown,
  session: Pick<StoredSession, "email" | "docType">
): { name: string; icNumber: string; country: string; ekycDocType: string } {
  if (!decrypted || typeof decrypted !== "object") {
    throw new AppError(400, "INVALID_EKYC_RESULT", "WiseAI result is not an object");
  }

  const record = decrypted as Record<string, unknown>;
  if (record.ekycSuccess !== true) {
    throw new AppError(400, "EKYC_NOT_SUCCESSFUL", "WiseAI eKYC did not complete successfully");
  }

  if (session.docType === "mykad") {
    const mykadFront =
      record.mykadFront && typeof record.mykadFront === "object"
        ? (record.mykadFront as Record<string, unknown>)
        : null;

    const name = normalizeName(mykadFront?.name);
    const icNumber = normalizeMykadNumber(mykadFront?.icNumber);
    if (!name || !icNumber) {
      throw new AppError(
        400,
        "INVALID_EKYC_RESULT",
        "WiseAI MyKad result is missing name or icNumber"
      );
    }

    return {
      name,
      icNumber,
      country: "MYS",
      ekycDocType: "mykad",
    };
  }

  const passport =
    record.passport && typeof record.passport === "object"
      ? (record.passport as Record<string, unknown>)
      : null;

  const name = normalizeName(passport?.name);
  const passportNumber = normalizePassportNumber(passport?.passportNumber);
  if (!name || !passportNumber) {
    throw new AppError(
      400,
      "INVALID_EKYC_RESULT",
      "WiseAI passport result is missing name or passportNumber"
    );
  }

  return {
    name,
    // Passport numbers can be alphanumeric in practice, even though the provider doc labels this field as `icNumber`.
    icNumber: passportNumber,
    country: "MYS",
    ekycDocType: "PASSPORT",
  };
}

router.get(
  "/session",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, docType } = sessionQuerySchema.parse(req.query);
      const { url, token } = await getSigningCloudEkycSession(email);
      const credentials = await fetchWiseAiSessionCredentials(url, token);

      sessions.set(token, {
        email,
        docType,
        url,
        encryption: credentials?.encryption ?? null,
        status: "pending",
      });

      res.json({
        success: true,
        data: {
          email,
          docType,
          url,
          token,
        },
        correlationId: correlationId(res),
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

router.get(
  "/status",
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = statusQuerySchema.parse(req.query);
      const stored = sessions.get(token);
      if (!stored) {
        throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
      }

      res.json({
        success: true,
        data: {
          status: stored.status,
          decrypted: stored.decrypted ?? null,
          submitResponse: stored.submitResponse ?? null,
          error: stored.error ?? null,
        },
        correlationId: correlationId(res),
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

router.post(
  "/complete",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, result } = completeBodySchema.parse(req.body);
      const stored = sessions.get(token);
      if (!stored) {
        throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
      }

      const encryptedData = extractEncryptedData(result);
      if (!encryptedData) {
        throw new AppError(
          400,
          "INVALID_EKYC_RESULT",
          "WiseAI result did not include encryptedData"
        );
      }

      if (!stored.encryption) {
        throw new AppError(
          400,
          "MISSING_WISEAI_KEYS",
          "WiseAI encryption keys were not available for this session"
        );
      }

      const decrypted = decryptWiseAiEkycPayload(encryptedData, stored.encryption);
      const submitPayload = buildSubmitPayload(decrypted, stored);
      const submitResponse = await submitSigningCloudEkycResult({
        email: stored.email,
        ekycResult: encryptedData,
        name: submitPayload.name,
        icNumber: submitPayload.icNumber,
        country: submitPayload.country,
        ekycDocType: submitPayload.ekycDocType,
        token,
      });

      stored.rawResult = result;
      stored.decrypted = decrypted;
      stored.submitResponse = submitResponse;
      stored.status = "submitted";
      stored.error = undefined;

      res.json({
        success: true,
        data: {
          status: stored.status,
          decrypted: stored.decrypted,
          submitResponse: stored.submitResponse,
          error: null,
        },
        correlationId: correlationId(res),
      });
    } catch (error) {
      const parsed =
        error instanceof AppError
          ? error
          : error instanceof Error
            ? new AppError(400, "VALIDATION_ERROR", error.message)
            : error;

      if (req.body && typeof req.body === "object") {
        const body = req.body as Record<string, unknown>;
        if (typeof body.token === "string") {
          const stored = sessions.get(body.token);
          if (stored && parsed instanceof AppError) {
            stored.status = "error";
            stored.error = parsed.message;
          }
        }
      }

      next(parsed);
    }
  }
);

export const ekycPrototypeRouter = router;
