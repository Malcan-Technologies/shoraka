import type { EkycMeStatus, EkycSession, EkycSessionStatus } from "@cashsouk/types";
import { SigningCloudEkycStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import {
  maskMalaysianIcNumber,
  parseConfirmedEkycIdentity,
  type EkycConfirmedIdentityInput,
} from "./confirmed-identity";
import {
  resolveIssuerEkycIdentityForOrganization,
} from "./resolve-issuer-ekyc-identity";
import {
  getSigningCloudEkycSession,
  submitSigningCloudEkycResult,
} from "./signingcloud-ekyc";

/** SigningCloud eKYC is MyKad-only in CashSouk. */
const EKYC_DOC_TYPE = "mykad";

/** SigningCloud eKYC tokens are short-lived; reuse only within this window. */
const EKYC_SESSION_TTL_MS = 25 * 60 * 1000;

const EKYC_VERIFICATION_FAILED_MESSAGE =
  "We could not verify your identity. Ensure your full name matches your MyKad exactly, then try again with a clear photo of your IC.";

const EKYC_VERIFICATION_NAME_IC_MISMATCH_MESSAGE =
  "We could not verify your identity. Ensure your full name matches your MyKad exactly, edit your details on your computer, and scan again.";

const EKYC_SESSION_ORG_MISSING_MESSAGE =
  "This verification session is invalid. Generate a new QR code on your computer and try again.";

function isPendingSessionFresh(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() < EKYC_SESSION_TTL_MS;
}

function sanitizeClientFailureReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : "Identity verification failed";
}

function unwrapPlainEkycResult(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (record.ekycSuccess !== undefined || record.mykadFront) {
    return record;
  }

  const nested = record.data;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }

  const nestedRecord = nested as Record<string, unknown>;
  if (nestedRecord.ekycSuccess !== undefined || nestedRecord.mykadFront) {
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

class EkycService {
  async getIdentityPreview(
    userId: string,
    issuerOrganizationId: string
  ): Promise<{ name: string; icNumber: string; icNumberMasked: string }> {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { email: true },
    });
    if (!user?.email?.trim()) {
      throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
    }

    const identity = await resolveIssuerEkycIdentityForOrganization(
      userId,
      issuerOrganizationId,
      user.email.trim()
    );

    return {
      name: identity.name,
      icNumber: identity.icNumber,
      icNumberMasked: maskMalaysianIcNumber(identity.icNumber),
    };
  }

  async getMeStatus(userId: string): Promise<EkycMeStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { user_id: userId },
      select: { status: true, completed_at: true },
    });

    return {
      completed: record?.status === SigningCloudEkycStatus.verified,
      completedAt: record?.completed_at?.toISOString() ?? null,
    };
  }

  async createSession(
    userId: string,
    issuerOrganizationId: string,
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

    const email = user.email.trim();
    await resolveIssuerEkycIdentityForOrganization(userId, issuerOrganizationId, email);

    const existing = await prisma.signingCloudEkyc.findUnique({
      where: { user_id: userId },
      select: {
        status: true,
        session_token: true,
        sdk_endpoint: true,
        updated_at: true,
      },
    });
    if (existing?.status === SigningCloudEkycStatus.verified) {
      throw new AppError(409, "EKYC_ALREADY_COMPLETED", "Identity verification has already been completed");
    }

    if (
      !force &&
      existing?.status === SigningCloudEkycStatus.pending &&
      existing.session_token &&
      existing.sdk_endpoint &&
      isPendingSessionFresh(existing.updated_at)
    ) {
      await prisma.signingCloudEkyc.update({
        where: { user_id: userId },
        data: { issuer_organization_id: issuerOrganizationId },
      });

      return {
        url: existing.sdk_endpoint,
        token: existing.session_token,
      };
    }

    const { url, token } = await getSigningCloudEkycSession(email);

    await prisma.signingCloudEkyc.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        issuer_organization_id: issuerOrganizationId,
        doc_type: EKYC_DOC_TYPE,
        session_token: token,
        sdk_endpoint: url,
        status: SigningCloudEkycStatus.pending,
        last_error: null,
        completed_at: null,
      },
      update: {
        issuer_organization_id: issuerOrganizationId,
        doc_type: EKYC_DOC_TYPE,
        session_token: token,
        sdk_endpoint: url,
        status: SigningCloudEkycStatus.pending,
        last_error: null,
        completed_at: null,
      },
    });

    return { url, token };
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

    if (record.status === SigningCloudEkycStatus.verified) {
      return {
        status: "verified" as const,
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
      status: "error" as const,
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

  async completeSession(
    token: string,
    result: unknown,
    confirmed?: EkycConfirmedIdentityInput
  ): Promise<EkycSessionStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { session_token: token },
      select: {
        user_id: true,
        issuer_organization_id: true,
        status: true,
        completed_at: true,
        user: { select: { email: true } },
      },
    });
    if (!record) {
      throw new AppError(404, "NOT_FOUND", "Unknown eKYC session token");
    }

    const accountEmail = record.user.email.trim();
    if (!accountEmail) {
      throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
    }

    if (record.status === SigningCloudEkycStatus.verified) {
      return {
        status: "verified" as const,
        error: null,
        completedAt: record.completed_at?.toISOString() ?? null,
      };
    }

    try {
      assertSdkCaptureSuccess(result);

      if (!record.issuer_organization_id) {
        throw new AppError(400, "EKYC_SESSION_ORG_MISSING", EKYC_SESSION_ORG_MISSING_MESSAGE);
      }

      const confirmedIdentity = parseConfirmedEkycIdentity(confirmed ?? {});
      const identity =
        confirmedIdentity ??
        (await resolveIssuerEkycIdentityForOrganization(
          record.user_id,
          record.issuer_organization_id,
          accountEmail
        ));

      const ekycResult = extractEkycResult(result);
      const submitResult = await submitSigningCloudEkycResult({
        email: accountEmail,
        ekycResult,
        name: identity.name,
        icNumber: identity.icNumber,
        token,
      });

      if (!submitResult.userVerificationSuccess) {
        const failureMessage = confirmedIdentity
          ? EKYC_VERIFICATION_NAME_IC_MISMATCH_MESSAGE
          : EKYC_VERIFICATION_FAILED_MESSAGE;

        await prisma.signingCloudEkyc.update({
          where: { user_id: record.user_id },
          data: {
            status: SigningCloudEkycStatus.failed,
            last_error: failureMessage,
            completed_at: null,
          },
        });

        return {
          status: "failed" as const,
          error: failureMessage,
          completedAt: null,
        };
      }

      const completedAt = new Date();
      await prisma.signingCloudEkyc.update({
        where: { user_id: record.user_id },
        data: {
          status: SigningCloudEkycStatus.verified,
          last_error: null,
          completed_at: completedAt,
        },
      });

      return {
        status: "verified" as const,
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
