import type { EkycDocType, EkycMeStatus, EkycSession, EkycSessionStatus } from "@cashsouk/types";
import { SigningCloudEkycStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { EKYC_DOC_TYPES } from "./schemas";
import {
  getSigningCloudEkycSession,
  submitSigningCloudEkycResult,
} from "./signingcloud-ekyc";

export { EKYC_DOC_TYPES };

/** SigningCloud eKYC tokens are short-lived; reuse only within this window. */
const EKYC_SESSION_TTL_MS = 25 * 60 * 1000;

function isPendingSessionFresh(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() < EKYC_SESSION_TTL_MS;
}

function sanitizeClientFailureReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : "Identity verification failed";
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

function unwrapPlainEkycResult(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (record.ekycSuccess !== undefined || record.mykadFront || record.passport) {
    return record;
  }

  const nested = record.data;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }

  const nestedRecord = nested as Record<string, unknown>;
  if (
    nestedRecord.ekycSuccess !== undefined ||
    nestedRecord.mykadFront ||
    nestedRecord.passport
  ) {
    return nestedRecord;
  }

  return null;
}

function assertSdkCaptureSuccess(result: unknown): void {
  if (!result || typeof result !== "object") {
    throw new AppError(400, "INVALID_EKYC_RESULT", "SDK result is not an object");
  }

  const record = result as Record<string, unknown>;
  if (record.status === "success" || record.code === "SUCCESS") {
    return;
  }

  const plain = unwrapPlainEkycResult(result);
  if (plain?.ekycSuccess === true) {
    return;
  }

  throw new AppError(400, "EKYC_NOT_SUCCESSFUL", "eKYC capture did not complete successfully");
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

/** SigningCloud submitResult expects SDK encryptedData as-is — no local decryption. */
function extractEkycResult(result: unknown): string {
  const encryptedData = extractEncryptedData(result);
  if (encryptedData) {
    return encryptedData;
  }

  const plain = unwrapPlainEkycResult(result);
  if (plain) {
    return JSON.stringify(plain);
  }

  throw new AppError(400, "INVALID_EKYC_RESULT", "SDK result did not include capture data");
}

function buildSubmitFields(
  docType: EkycDocType,
  plain: Record<string, unknown> | null
): { name: string; icNumber: string; country: string; ekycDocType: string } {
  const country = "MYS";
  const ekycDocType = docType === "mykad" ? "mykad" : "PASSPORT";

  if (plain) {
    if (docType === "mykad") {
      const mykadFront =
        plain.mykadFront && typeof plain.mykadFront === "object"
          ? (plain.mykadFront as Record<string, unknown>)
          : null;
      const name = normalizeName(mykadFront?.name);
      const icNumber = normalizeMykadNumber(mykadFront?.icNumber);
      if (name && icNumber) {
        return { name, icNumber, country, ekycDocType };
      }
    } else {
      const passport =
        plain.passport && typeof plain.passport === "object"
          ? (plain.passport as Record<string, unknown>)
          : null;
      const name = normalizeName(passport?.name);
      const icNumber = normalizePassportNumber(passport?.passportNumber);
      if (name && icNumber) {
        return { name, icNumber, country, ekycDocType };
      }
    }
  }

  // SigningCloud decrypts ekycResult server-side when the SDK returns encryptedData.
  return { name: "", icNumber: "", country, ekycDocType };
}

function logSdkCaptureResult(sessionToken: string, result: unknown): void {
  const encryptedData = extractEncryptedData(result);
  const plain = unwrapPlainEkycResult(result);

  logger.info(
    {
      sessionToken,
      hasEncryptedData: Boolean(encryptedData),
      encryptedDataLength: encryptedData?.length ?? 0,
      hasPlainPayload: Boolean(plain),
      ekycSuccess: plain?.ekycSuccess,
      hasMykadFront: Boolean(plain?.mykadFront),
      hasPassport: Boolean(plain?.passport),
    },
    "eKYC SDK capture result received"
  );
}

class EkycService {
  async getMeStatus(userId: string): Promise<EkycMeStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { user_id: userId },
      select: { status: true, completed_at: true },
    });

    return {
      completed: record?.status === SigningCloudEkycStatus.submitted,
      completedAt: record?.completed_at?.toISOString() ?? null,
    };
  }

  async createSession(
    userId: string,
    docType: EkycDocType,
    options?: { force?: boolean }
  ): Promise<EkycSession> {
    const force = options?.force === true;
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { email: true },
    });
    if (!user?.email?.trim()) {
      throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
    }

    const existing = await prisma.signingCloudEkyc.findUnique({
      where: { user_id: userId },
      select: {
        status: true,
        session_token: true,
        sdk_endpoint: true,
        doc_type: true,
        updated_at: true,
      },
    });
    if (existing?.status === SigningCloudEkycStatus.submitted) {
      throw new AppError(409, "EKYC_ALREADY_COMPLETED", "Identity verification has already been completed");
    }

    // Reuse a fresh in-progress session so the same QR stays valid when the modal is reopened.
    if (
      !force &&
      existing?.status === SigningCloudEkycStatus.pending &&
      existing.session_token &&
      existing.sdk_endpoint &&
      isPendingSessionFresh(existing.updated_at)
    ) {
      logger.info(
        {
          userId,
          sessionToken: existing.session_token,
          ageMs: Date.now() - existing.updated_at.getTime(),
        },
        "Reusing in-progress eKYC session"
      );
      return {
        docType: existing.doc_type as EkycDocType,
        url: existing.sdk_endpoint,
        token: existing.session_token,
      };
    }

    const { url, token } = await getSigningCloudEkycSession(user.email.trim());
    logger.info({ userId, force, sdkEndpoint: url }, "Minted new eKYC session");

    await prisma.signingCloudEkyc.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        doc_type: docType,
        session_token: token,
        sdk_endpoint: url,
        status: SigningCloudEkycStatus.pending,
        last_error: null,
        completed_at: null,
      },
      update: {
        doc_type: docType,
        session_token: token,
        sdk_endpoint: url,
        status: SigningCloudEkycStatus.pending,
        last_error: null,
        completed_at: null,
      },
    });

    return { docType, url, token };
  }

  async failSession(
    token: string,
    reason: string,
    code?: string
  ): Promise<EkycSessionStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { session_token: token },
      select: { user_id: true, status: true, last_error: true, completed_at: true },
    });
    if (!record) {
      throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
    }

    if (record.status === SigningCloudEkycStatus.submitted) {
      return {
        status: "submitted",
        error: null,
        completedAt: record.completed_at?.toISOString() ?? null,
      };
    }

    const message = sanitizeClientFailureReason(reason);

    await prisma.signingCloudEkyc.update({
      where: { user_id: record.user_id },
      data: {
        status: SigningCloudEkycStatus.error,
        last_error: message,
      },
    });

    logger.warn(
      {
        userId: record.user_id,
        sessionToken: token,
        code: code ?? null,
      },
      "eKYC session failed from capture client"
    );

    return {
      status: "error",
      error: message,
      completedAt: null,
    };
  }

  async getSessionStatus(token: string): Promise<EkycSessionStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { session_token: token },
      select: { status: true, last_error: true, completed_at: true },
    });
    if (!record) {
      throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
    }

    return {
      status: record.status,
      error: record.last_error,
      completedAt: record.completed_at?.toISOString() ?? null,
    };
  }

  async completeSession(token: string, result: unknown): Promise<EkycSessionStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { session_token: token },
      select: {
        user_id: true,
        doc_type: true,
        status: true,
        completed_at: true,
        user: { select: { email: true } },
      },
    });
    if (!record) {
      throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
    }

    const email = record.user.email.trim();
    if (!email) {
      throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
    }

    if (record.status === SigningCloudEkycStatus.submitted) {
      return {
        status: "submitted",
        error: null,
        completedAt: record.completed_at?.toISOString() ?? null,
      };
    }

    try {
      assertSdkCaptureSuccess(result);
      logSdkCaptureResult(token, result);

      const ekycResult = extractEkycResult(result);
      const plain = unwrapPlainEkycResult(result);
      const submitFields = buildSubmitFields(record.doc_type as EkycDocType, plain);
      await submitSigningCloudEkycResult({
        email,
        ekycResult,
        name: submitFields.name,
        icNumber: submitFields.icNumber,
        country: submitFields.country,
        ekycDocType: submitFields.ekycDocType,
        token,
      });

      const completedAt = new Date();
      await prisma.signingCloudEkyc.update({
        where: { user_id: record.user_id },
        data: {
          status: SigningCloudEkycStatus.submitted,
          last_error: null,
          completed_at: completedAt,
        },
      });

      return {
        status: "submitted",
        error: null,
        completedAt: completedAt.toISOString(),
      };
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The eKYC session failed";

      await prisma.signingCloudEkyc.update({
        where: { user_id: record.user_id },
        data: {
          status: SigningCloudEkycStatus.error,
          last_error: message,
        },
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(400, "VALIDATION_ERROR", message);
    }
  }
}

export const ekycService = new EkycService();
