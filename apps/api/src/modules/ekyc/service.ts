import type { EkycMeStatus, EkycSession, EkycSessionStatus } from "@cashsouk/types";
import { SigningCloudEkycStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { parseConfirmedEkycName } from "./confirmed-identity";
import {
  parseIssuerEkycIcNumber,
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
  "We could not verify your identity. Check that your full name matches your MyKad exactly, capture a clear photo of your IC, and scan again. Contact support if your IC number on file is incorrect.";

const EKYC_SESSION_ORG_MISSING_MESSAGE =
  "This verification session is invalid. Generate a new QR code on your computer and try again.";

const EKYC_SESSION_IDENTITY_MISSING_MESSAGE =
  "This verification session is invalid. Confirm your MyKad details on your computer and generate a new QR code.";

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

function boundNameMatches(storedName: string | null, confirmedName: string): boolean {
  return storedName === confirmedName;
}

class EkycService {
  async getIdentityPreview(
    userId: string,
    issuerOrganizationId: string,
    icNumberInput: string
  ): Promise<{ name: string }> {
    const identity = await resolveIssuerEkycIdentityForOrganization(
      userId,
      issuerOrganizationId,
      icNumberInput
    );

    return {
      name: identity.name,
    };
  }

  async getMeStatus(userId: string): Promise<EkycMeStatus> {
    const record = await prisma.signingCloudEkyc.findFirst({
      where: {
        user_id: userId,
        status: SigningCloudEkycStatus.verified,
      },
      orderBy: { completed_at: "desc" },
      select: { completed_at: true },
    });

    return {
      completed: record != null,
      completedAt: record?.completed_at?.toISOString() ?? null,
    };
  }

  async createSession(
    userId: string,
    issuerOrganizationId: string,
    icNumberInput: string,
    confirmedNameInput: string,
    options?: { force?: boolean }
  ): Promise<EkycSession> {
    const force = options?.force === true;
    const confirmedName = parseConfirmedEkycName(confirmedNameInput);
    if (!confirmedName) {
      throw new AppError(400, "VALIDATION_ERROR", "Full name is required when confirming identity");
    }

    const icNumber = parseIssuerEkycIcNumber(icNumberInput);
    const orgIdentity = await resolveIssuerEkycIdentityForOrganization(
      userId,
      issuerOrganizationId,
      icNumber
    );
    const workEmail = orgIdentity.email;

    const existing = await prisma.signingCloudEkyc.findUnique({
      where: {
        user_id_email: {
          user_id: userId,
          email: workEmail,
        },
      },
      select: {
        id: true,
        status: true,
        session_token: true,
        sdk_endpoint: true,
        confirmed_name: true,
        confirmed_ic_number: true,
        issuer_organization_id: true,
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
      existing.issuer_organization_id === issuerOrganizationId &&
      existing.confirmed_ic_number === icNumber &&
      boundNameMatches(existing.confirmed_name, confirmedName) &&
      isPendingSessionFresh(existing.updated_at)
    ) {
      await prisma.signingCloudEkyc.update({
        where: { id: existing.id },
        data: {
          issuer_organization_id: issuerOrganizationId,
          confirmed_name: confirmedName,
          confirmed_ic_number: icNumber,
        },
      });

      return {
        url: existing.sdk_endpoint,
        token: existing.session_token,
      };
    }

    const { url, token } = await getSigningCloudEkycSession(workEmail);

    await prisma.signingCloudEkyc.upsert({
      where: {
        user_id_email: {
          user_id: userId,
          email: workEmail,
        },
      },
      create: {
        user_id: userId,
        email: workEmail,
        issuer_organization_id: issuerOrganizationId,
        confirmed_name: confirmedName,
        confirmed_ic_number: icNumber,
        doc_type: EKYC_DOC_TYPE,
        session_token: token,
        sdk_endpoint: url,
        status: SigningCloudEkycStatus.pending,
        last_error: null,
        completed_at: null,
      },
      update: {
        issuer_organization_id: issuerOrganizationId,
        confirmed_name: confirmedName,
        confirmed_ic_number: icNumber,
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
      select: { id: true, user_id: true, status: true, last_error: true, completed_at: true },
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
      where: { id: record.id },
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

  async completeSession(token: string, result: unknown): Promise<EkycSessionStatus> {
    const record = await prisma.signingCloudEkyc.findUnique({
      where: { session_token: token },
      select: {
        id: true,
        user_id: true,
        email: true,
        issuer_organization_id: true,
        confirmed_name: true,
        confirmed_ic_number: true,
        status: true,
        completed_at: true,
      },
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

    try {
      assertSdkCaptureSuccess(result);

      if (!record.issuer_organization_id) {
        throw new AppError(400, "EKYC_SESSION_ORG_MISSING", EKYC_SESSION_ORG_MISSING_MESSAGE);
      }

      if (!record.confirmed_name?.trim()) {
        throw new AppError(400, "EKYC_SESSION_IDENTITY_MISSING", EKYC_SESSION_IDENTITY_MISSING_MESSAGE);
      }

      if (!record.confirmed_ic_number?.trim()) {
        throw new AppError(400, "EKYC_SESSION_IDENTITY_MISSING", EKYC_SESSION_IDENTITY_MISSING_MESSAGE);
      }

      const ekycResult = extractEkycResult(result);
      const submitResult = await submitSigningCloudEkycResult({
        email: record.email,
        ekycResult,
        name: record.confirmed_name,
        icNumber: record.confirmed_ic_number,
        token,
      });

      if (!submitResult.userVerificationSuccess) {
        await prisma.signingCloudEkyc.update({
          where: { id: record.id },
          data: {
            status: SigningCloudEkycStatus.failed,
            last_error: EKYC_VERIFICATION_FAILED_MESSAGE,
            completed_at: null,
          },
        });

        return {
          status: "failed" as const,
          error: EKYC_VERIFICATION_FAILED_MESSAGE,
          completedAt: null,
        };
      }

      const completedAt = new Date();
      await prisma.signingCloudEkyc.update({
        where: { id: record.id },
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
        where: { id: record.id },
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

/** Returns the user's verified IC from any completed eKYC row (same person across orgs). */
export async function getVerifiedIssuerEkycIcNumber(userId: string): Promise<string | null> {
  const record = await prisma.signingCloudEkyc.findFirst({
    where: {
      user_id: userId,
      status: SigningCloudEkycStatus.verified,
      confirmed_ic_number: { not: null },
    },
    orderBy: { completed_at: "desc" },
    select: { confirmed_ic_number: true },
  });

  return record?.confirmed_ic_number?.trim() ?? null;
}

/** Gate offer signing on verified eKYC for the org-specific work email. */
export async function requireCompletedSigningCloudEkycForOrganization(
  userId: string,
  issuerOrganizationId: string
): Promise<{ workEmail: string; icNumber: string }> {
  const verifiedIcNumber = await getVerifiedIssuerEkycIcNumber(userId);
  if (!verifiedIcNumber) {
    throw new AppError(
      403,
      "EKYC_REQUIRED",
      "Identity verification is required before signing. Complete eKYC first."
    );
  }

  const orgIdentity = await resolveIssuerEkycIdentityForOrganization(
    userId,
    issuerOrganizationId,
    verifiedIcNumber
  );

  const verifiedRow = await prisma.signingCloudEkyc.findUnique({
    where: {
      user_id_email: {
        user_id: userId,
        email: orgIdentity.email,
      },
    },
    select: { status: true },
  });

  if (verifiedRow?.status !== SigningCloudEkycStatus.verified) {
    throw new AppError(
      403,
      "EKYC_REQUIRED",
      "Identity verification is required before signing. Complete eKYC first."
    );
  }

  return {
    workEmail: orgIdentity.email,
    icNumber: verifiedIcNumber,
  };
}
