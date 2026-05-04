import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import type { RegTankKYBWebhook } from "../types";

type Portal = "investor" | "issuer";

/** COD id for a business shareholder row (RegTank corp biz shareholder shape). */
export function getCorporateShareholderCodId(row: Record<string, unknown>): string {
  const nested = row.corporateOnboardingRequest;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const rid = (nested as Record<string, unknown>).requestId;
    if (typeof rid === "string" && rid.trim()) return rid.trim();
  }
  const top = row.requestId;
  if (typeof top === "string" && top.trim()) return top.trim();
  return "";
}

export function normalizeBusinessRegKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function collectFormFieldMap(obj: unknown, out: Map<string, string>): void {
  if (obj == null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        if (typeof o.fieldName === "string" && typeof o.fieldValue === "string" && o.fieldValue.trim()) {
          out.set(o.fieldName.trim().toLowerCase(), o.fieldValue.trim());
        }
        collectFormFieldMap(o.content, out);
        collectFormFieldMap(o.displayAreas, out);
      } else {
        collectFormFieldMap(item, out);
      }
    }
    return;
  }
  const rec = obj as Record<string, unknown>;
  for (const v of Object.values(rec)) {
    collectFormFieldMap(v, out);
  }
}

function normalizedBrnFromFieldMap(m: Map<string, string>): string | null {
  const keyCandidates = [
    "business number",
    "business registration number",
    "company registration no.",
    "company registration number",
    "ssm number",
    "registration number",
    "roc / rob",
    "roc/rob",
  ];
  for (const k of keyCandidates) {
    const v = m.get(k);
    if (v) {
      const n = normalizeBusinessRegKey(v);
      if (n) return n;
    }
  }
  return null;
}

/** BRN / SSM from RegTank form trees (COD details, stored row, KYB payload). */
export function extractNormalizedBrnFromRegTankFormTree(root: unknown): string | null {
  const m = new Map<string, string>();
  collectFormFieldMap(root, m);
  return normalizedBrnFromFieldMap(m);
}

function extractNormalizedBrnFromCorpShareholderRow(row: Record<string, unknown>): string | null {
  return extractNormalizedBrnFromRegTankFormTree(row.formContent);
}

function extractNormalizedBrnFromKybPayload(payload: RegTankKYBWebhook): string | null {
  const p = payload as Record<string, unknown>;
  const fromForm = extractNormalizedBrnFromRegTankFormTree(p);
  if (fromForm) return fromForm;
  for (const k of ["businessNumber", "registrationNumber", "brn_ssm", "companyRegistrationNumber"] as const) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) {
      const n = normalizeBusinessRegKey(v);
      if (n) return n;
    }
  }
  return null;
}

export function findCorporateShareholderMatchIndex(
  rows: Record<string, unknown>[],
  incomingCodRequestId: string,
  fallbackNormalizedBrn: string | null
): { index: number; matchedBy: "codRequestId" | "businessNumber" } | null {
  const codTrim = (incomingCodRequestId || "").trim();
  if (codTrim) {
    const byCod = rows.findIndex((r) => getCorporateShareholderCodId(r) === codTrim);
    if (byCod >= 0) return { index: byCod, matchedBy: "codRequestId" };
  }
  if (!fallbackNormalizedBrn) return null;
  const matches: number[] = [];
  rows.forEach((r, i) => {
    const rowBrn = extractNormalizedBrnFromCorpShareholderRow(r);
    if (rowBrn && rowBrn === fallbackNormalizedBrn) matches.push(i);
  });
  if (matches.length === 1) return { index: matches[0], matchedBy: "businessNumber" };
  if (matches.length > 1) {
    logger.warn(
      { fallbackNormalizedBrn, matchCount: matches.length },
      "[KYB/COD] Multiple corporate shareholders match same business number; skipping ambiguous update"
    );
  }
  return null;
}

export type CorporateShareholderStatusSource = "KYB" | "COD";

/**
 * Updates only corporate_entities.corporateShareholders[i].status when a single row matches
 * by COD requestId (primary) or normalized business number from form payload (fallback).
 */
export async function syncCorporateShareholderStatusInOrganization(params: {
  organizationId: string;
  portalType: Portal;
  incomingCodRequestId: string;
  newStatus: string;
  source: CorporateShareholderStatusSource;
  /** When COD primary match fails, BRN from approved COD details form tree. */
  codDetailsForBrnFallback: unknown | null;
  /** When KYB primary match fails, BRN from KYB webhook JSON / form tree. */
  kybPayloadForBrnFallback: RegTankKYBWebhook | null;
  /** e.g. KYB requestId from webhook (not the COD); included in logs when set. */
  logWebhookRequestId?: string | null;
}): Promise<boolean> {
  const {
    organizationId,
    portalType,
    incomingCodRequestId,
    newStatus,
    source,
    codDetailsForBrnFallback,
    kybPayloadForBrnFallback,
    logWebhookRequestId,
  } = params;

  const org =
    portalType === "investor"
      ? await prisma.investorOrganization.findUnique({
          where: { id: organizationId },
          select: { corporate_entities: true },
        })
      : await prisma.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: { corporate_entities: true },
        });

  if (!org?.corporate_entities || typeof org.corporate_entities !== "object" || Array.isArray(org.corporate_entities)) {
    return false;
  }

  const corporateEntities = { ...(org.corporate_entities as Record<string, unknown>) };
  const rawList = corporateEntities.corporateShareholders;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return false;
  }

  const rows = rawList.filter((x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x));

  const rowCodRequestIds = rows.map((r) => getCorporateShareholderCodId(r));

  let fallbackBrn: string | null = null;
  if (codDetailsForBrnFallback) {
    const codObj = codDetailsForBrnFallback as Record<string, unknown>;
    fallbackBrn = extractNormalizedBrnFromRegTankFormTree(codObj.formContent);
  }
  if (!fallbackBrn && kybPayloadForBrnFallback) {
    fallbackBrn = extractNormalizedBrnFromKybPayload(kybPayloadForBrnFallback);
  }

  logger.info(
    {
      source,
      incomingCodRequestId,
      webhookRequestId: logWebhookRequestId ?? undefined,
      corporateShareholderCodIds: rowCodRequestIds,
      fallbackBrnPresent: Boolean(fallbackBrn),
      organizationId,
    },
    `[${source}] Corporate shareholder status sync: incoming COD and stored row COD ids`
  );

  const match = findCorporateShareholderMatchIndex(rows, incomingCodRequestId, fallbackBrn);
  if (!match) {
    logger.warn(
      {
        source,
        incomingCodRequestId,
        webhookRequestId: logWebhookRequestId ?? undefined,
        rowCodIds: rowCodRequestIds,
        fallbackBrnPresent: Boolean(fallbackBrn),
        organizationId,
      },
      "[KYB/COD] No matching corporate shareholder found"
    );
    return false;
  }

  const row = rows[match.index];
  const oldStatus = typeof row.status === "string" ? row.status : row.status == null ? "" : String(row.status);
  const matchedCod = getCorporateShareholderCodId(row);
  const matchedBrn = extractNormalizedBrnFromCorpShareholderRow(row);

  const nextRow = { ...row, status: newStatus };
  const nextRows = [...rows];
  nextRows[match.index] = nextRow;
  corporateEntities.corporateShareholders = nextRows;

  logger.info(
    {
      source,
      incomingCodRequestId,
      webhookRequestId: logWebhookRequestId ?? undefined,
      matchedBy: match.matchedBy,
      matchedRowCodRequestId: matchedCod || null,
      matchedRowBusinessNumberNormalized: matchedBrn,
      oldStatus,
      newStatus,
      organizationId,
    },
    `[${source}] Updated corporate_entities.corporateShareholders[].status`
  );

  if (portalType === "investor") {
    await prisma.investorOrganization.update({
      where: { id: organizationId },
      data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
    });
  } else {
    await prisma.issuerOrganization.update({
      where: { id: organizationId },
      data: { corporate_entities: corporateEntities as Prisma.InputJsonValue },
    });
  }

  return true;
}
