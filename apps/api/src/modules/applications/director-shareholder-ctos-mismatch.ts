/**
 * SECTION: CTOS vs declared director/shareholder mismatch
 * WHY: Flags on application JSON when admin refreshes CTOS; separate from AML gap detection
 * INPUT: Issuer org corporate_entities + CTOS company_json
 * OUTPUT: Mismatch keys + merged company_details patch
 * WHERE USED: Admin CTOS report POST handlers
 */

import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import {
  getDirectorShareholderDisplayRows,
  getDirectorShareholderWorkflowFromCompanyDetails,
  mergeDirectorShareholderWorkflowIntoCompanyDetails,
  normalizeDirectorShareholderIdKey,
  type DirectorShareholderPersonWorkflow,
  type DirectorShareholderPersonWorkflowStatus,
} from "@cashsouk/types";
import { extractCtosIndividuals } from "../regtank/helpers/detect-director-gaps";
import { NotificationService } from "../notification/service";
import { NotificationTypeIds } from "../notification/registry";

function ctosSafeCompanyJson(ctos: unknown): Record<string, unknown> | null {
  if (!ctos || typeof ctos !== "object" || Array.isArray(ctos)) return null;
  const o = ctos as Record<string, unknown>;
  return {
    ...o,
    directors: Array.isArray(o.directors) ? o.directors : [],
    shareholders: Array.isArray(o.shareholders) ? o.shareholders : [],
  };
}

/** CTOS individual keys using same >=5% shareholder rule as buildAdminPeopleList. */
export function ctosIndividualMatchKeysFromCompanyJson(companyJson: unknown): Set<string> {
  const ctosSafe = ctosSafeCompanyJson(companyJson);
  if (!ctosSafe) return new Set();
  const peopleMap = new Map<
    string,
    { matchKey: string; roles: Set<"DIRECTOR" | "SHAREHOLDER">; sharePercentage: number | null }
  >();
  for (const p of extractCtosIndividuals(ctosSafe)) {
    if (p.entityType !== "INDIVIDUAL" || !p.matchKey) continue;
    const role = p.type === "DIRECTOR" || p.type === "SHAREHOLDER" ? p.type : "DIRECTOR";
    const incomingSharePercentage = typeof p.sharePercentage === "number" ? p.sharePercentage : null;
    if (role === "SHAREHOLDER" && (incomingSharePercentage === null || incomingSharePercentage < 5)) {
      continue;
    }
    if (!peopleMap.has(p.matchKey)) {
      peopleMap.set(p.matchKey, {
        matchKey: p.matchKey,
        roles: new Set([role]),
        sharePercentage: incomingSharePercentage,
      });
      continue;
    }
    const existing = peopleMap.get(p.matchKey)!;
    existing.roles.add(role);
    if (incomingSharePercentage !== null) {
      existing.sharePercentage =
        existing.sharePercentage === null
          ? incomingSharePercentage
          : Math.max(existing.sharePercentage, incomingSharePercentage);
    }
  }
  return new Set(peopleMap.keys());
}

/** Declared individual keys from corporate_entities (onboarding path; CTOS input null). */
export function declaredIndividualMatchKeys(corporateEntities: unknown, directorKycStatus: unknown): Set<string> {
  const rows = getDirectorShareholderDisplayRows({
    corporateEntities,
    directorKycStatus,
    directorAmlStatus: null,
    organizationCtosCompanyJson: null,
    ctosPartySupplements: [],
    sentRowIds: null,
  });
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.type !== "INDIVIDUAL") continue;
    const pk = normalizeDirectorShareholderIdKey(
      row.idNumber?.trim() || row.registrationNumber?.trim() || row.enquiryId?.trim() || ""
    );
    if (pk) keys.add(pk);
  }
  return keys;
}

export function detectDirectorShareholderCtosMismatchKeys(params: {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  ctosCompanyJson: unknown;
}): { mismatchKeys: string[]; declaredOnly: string[]; ctosOnly: string[] } {
  const declared = declaredIndividualMatchKeys(params.corporateEntities, params.directorKycStatus);
  const ctosKeys = ctosIndividualMatchKeysFromCompanyJson(params.ctosCompanyJson);
  const mismatch = new Set<string>();
  for (const k of declared) {
    if (!ctosKeys.has(k)) mismatch.add(k);
  }
  for (const k of ctosKeys) {
    if (!declared.has(k)) mismatch.add(k);
  }
  const declaredOnly = [...declared].filter((k) => !ctosKeys.has(k));
  const ctosOnly = [...ctosKeys].filter((k) => !declared.has(k));
  return { mismatchKeys: [...mismatch], declaredOnly, ctosOnly };
}

export async function recomputeMismatchForIssuerOrganizationApplications(params: {
  issuerOrganizationId: string;
  ctosReportId: string;
  ctosCompanyJson: unknown;
}): Promise<void> {
  const apps = await prisma.application.findMany({
    where: {
      issuer_organization_id: params.issuerOrganizationId,
      status: { notIn: ["ARCHIVED", "REJECTED", "WITHDRAWN"] },
    },
    select: { id: true },
  });
  for (const a of apps) {
    await recomputeDirectorShareholderWorkflowForApplication({
      applicationId: a.id,
      issuerOrganizationId: params.issuerOrganizationId,
      ctosReportId: params.ctosReportId,
      ctosCompanyJson: params.ctosCompanyJson,
    });
  }
}

export async function recomputeDirectorShareholderWorkflowForApplication(params: {
  applicationId: string;
  issuerOrganizationId: string;
  ctosReportId: string;
  ctosCompanyJson: unknown;
}): Promise<void> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: params.issuerOrganizationId },
    select: { corporate_entities: true, director_kyc_status: true, owner_user_id: true },
  });
  if (!org) {
    logger.warn({ issuerOrganizationId: params.issuerOrganizationId }, "Mismatch recompute skipped: org missing");
    return;
  }

  const mismatchSet = new Set(
    detectDirectorShareholderCtosMismatchKeys({
      corporateEntities: org.corporate_entities,
      directorKycStatus: org.director_kyc_status,
      ctosCompanyJson: params.ctosCompanyJson,
    }).mismatchKeys
  );

  const app = await prisma.application.findUnique({
    where: { id: params.applicationId },
    select: { company_details: true },
  });
  if (!app) return;

  const nowIso = new Date().toISOString();
  const companyDetails = app.company_details;
  const prevWorkflow = getDirectorShareholderWorkflowFromCompanyDetails(companyDetails);
  const prevPending = Boolean(prevWorkflow.directorShareholderPending);

  const nextPersons: Record<
    string,
    { matchKey: string; status: DirectorShareholderPersonWorkflowStatus; remark?: string; updatedAt: string }
  > = {};

  const prevPersons = prevWorkflow.persons ?? {};
  for (const [k, v] of Object.entries(prevPersons) as [string, DirectorShareholderPersonWorkflow][]) {
    if (v.status === "UNDER_REVIEW" || v.status === "APPROVED") {
      nextPersons[k] = {
        matchKey: v.matchKey,
        status: v.status,
        ...(v.remark ? { remark: v.remark } : {}),
        updatedAt: v.updatedAt ?? nowIso,
      };
    } else if (v.status === "PENDING" && mismatchSet.has(k)) {
      nextPersons[k] = { matchKey: v.matchKey, status: "PENDING", updatedAt: v.updatedAt ?? nowIso };
    }
  }

  if (mismatchSet.size === 0) {
    const merged = mergeDirectorShareholderWorkflowIntoCompanyDetails(companyDetails, {
      directorShareholderPending: false,
      persons: nextPersons,
      replacePersons: true,
      lastMismatchCheckAt: nowIso,
      lastCtosReportId: params.ctosReportId,
    });
    await prisma.application.update({
      where: { id: params.applicationId },
      data: { company_details: merged as object },
    });
    return;
  }

  for (const k of mismatchSet) {
    const existing = prevWorkflow.persons?.[k];
    if (existing?.status === "APPROVED" || existing?.status === "UNDER_REVIEW") {
      nextPersons[k] = {
        matchKey: existing.matchKey,
        status: existing.status,
        ...(existing.remark ? { remark: existing.remark } : {}),
        updatedAt: existing.updatedAt ?? nowIso,
      };
    } else {
      nextPersons[k] = { matchKey: k, status: "PENDING", updatedAt: nowIso };
    }
  }

  const merged = mergeDirectorShareholderWorkflowIntoCompanyDetails(companyDetails, {
    directorShareholderPending: true,
    persons: nextPersons,
    replacePersons: true,
    lastMismatchCheckAt: nowIso,
    lastCtosReportId: params.ctosReportId,
  });

  await prisma.application.update({
    where: { id: params.applicationId },
    data: { company_details: merged as object },
  });

  if (!prevPending && org.owner_user_id) {
    const ns = new NotificationService();
    try {
      await ns.sendTyped(
        org.owner_user_id,
        NotificationTypeIds.DIRECTOR_SHAREHOLDER_UPDATE_REQUIRED,
        { applicationId: params.applicationId },
        `director-sh-pending:${params.applicationId}:${params.ctosReportId}`
      );
    } catch (e) {
      logger.error(
        { applicationId: params.applicationId, err: e instanceof Error ? e.message : String(e) },
        "Failed to send director/shareholder pending notification"
      );
    }
  }
}
