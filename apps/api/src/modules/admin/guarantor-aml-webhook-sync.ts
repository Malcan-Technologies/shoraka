import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { GuarantorAmlMessageStatus, GuarantorAmlStatus } from "./guarantor-aml";
import {
  mapRegTankDjkycMessageToPrisma,
  mapRegTankDjkycStatusToPrismaAmlStatus,
} from "./guarantor-aml";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function toOptionalCount(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toOptionalRiskText(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  return undefined;
}

export interface RegTankGuarantorAmlWebhookFields {
  requestId: string;
  referenceId: string;
  status?: string;
  messageStatus?: string;
  /** RegTank KYC/KYB webhook `riskScore` (string). */
  riskScore?: unknown;
  /** RegTank KYC/KYB webhook `riskLevel` (string). */
  riskLevel?: unknown;
  possibleMatchCount?: unknown;
  blacklistedMatchCount?: unknown;
  timestamp?: string;
}

/**
 * When RegTank sends KYC or KYB webhooks with referenceId = application guarantor
 * `client_guarantor_id`, persist screening snapshot on `metadata.aml_screening` and update AML columns.
 */
export async function syncApplicationGuarantorsFromRegTankAmlWebhook(
  payload: RegTankGuarantorAmlWebhookFields
): Promise<number> {
  const referenceId = typeof payload.referenceId === "string" ? payload.referenceId.trim() : "";
  if (!referenceId) {
    return 0;
  }

  const rows = await prisma.applicationGuarantor.findMany({
    where: { client_guarantor_id: referenceId },
  });
  if (rows.length === 0) {
    return 0;
  }

  const amlStatus: GuarantorAmlStatus = mapRegTankDjkycStatusToPrismaAmlStatus(payload.status);
  const amlMessageStatus: GuarantorAmlMessageStatus = mapRegTankDjkycMessageToPrisma(
    payload.messageStatus
  );

  const possible = toOptionalCount(payload.possibleMatchCount);
  const blacklisted = toOptionalCount(payload.blacklistedMatchCount);

  const screeningUpdatedAt =
    typeof payload.timestamp === "string" && payload.timestamp.trim()
      ? payload.timestamp.trim()
      : new Date().toISOString();

  let updated = 0;
  for (const row of rows) {
    const prevMeta = isPlainObject(row.metadata) ? { ...row.metadata } : {};
    const prevScreening = isPlainObject(prevMeta.aml_screening)
      ? { ...prevMeta.aml_screening }
      : {};

    const riskScore = toOptionalRiskText(payload.riskScore) ?? toOptionalRiskText(prevScreening.riskScore);
    const riskLevel = toOptionalRiskText(payload.riskLevel) ?? toOptionalRiskText(prevScreening.riskLevel);

    const aml_screening = {
      ...prevScreening,
      requestId: payload.requestId,
      regtankStatus: payload.status,
      messageStatus: payload.messageStatus,
      riskScore,
      riskLevel,
      possibleMatchCount: possible ?? prevScreening.possibleMatchCount,
      blacklistedMatchCount: blacklisted ?? prevScreening.blacklistedMatchCount,
      screeningUpdatedAt,
    };

    await prisma.applicationGuarantor.update({
      where: { id: row.id },
      data: {
        aml_status: amlStatus,
        aml_message_status: amlMessageStatus,
        last_synced_at: new Date(),
        metadata: {
          ...prevMeta,
          aml_screening: aml_screening as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
    updated += 1;
  }

  return updated;
}
