import { Prisma } from "@prisma/client";
import type { CtosPartySupplement } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * CTOS party RegTank `referenceId` is built as `buildSafeReferenceId(organizationId, partyKey)`:
 * sanitized org id, then `_`, then party segment — so the org id is the substring before the first `_`.
 */
export function parseOrganizationIdFromCtosPartyReferenceId(referenceId: string): string | null {
  const r = referenceId.trim();
  if (!r) return null;
  const i = r.indexOf("_");
  if (i <= 0) return null;
  const prefix = r.slice(0, i);
  return prefix.length >= 6 ? prefix : null;
}

export function buildWhereCtosPartySupplementByOnboardingJsonOr(
  onboardingIdForJsonRequestId: string,
  webhookReferenceId: string,
  organizationIdFromReferenceParse: string | null
): Prisma.CtosPartySupplementWhereInput | null {
  const jsonOr: Prisma.CtosPartySupplementWhereInput[] = [];
  if (onboardingIdForJsonRequestId) {
    jsonOr.push({
      onboarding_json: { path: ["requestId"], equals: onboardingIdForJsonRequestId },
    });
  }
  if (webhookReferenceId) {
    jsonOr.push({
      onboarding_json: { path: ["referenceId"], equals: webhookReferenceId },
    });
    jsonOr.push({
      onboarding_json: { path: ["onboarding", "referenceId"], equals: webhookReferenceId },
    });
  }
  if (jsonOr.length === 0) {
    return null;
  }
  if (organizationIdFromReferenceParse) {
    return {
      AND: [
        {
          OR: [
            { issuer_organization_id: organizationIdFromReferenceParse },
            { investor_organization_id: organizationIdFromReferenceParse },
          ],
        },
        { OR: jsonOr },
      ],
    };
  }
  return { OR: jsonOr };
}

export async function findCtosPartySupplementByOnboardingJsonMatch(
  onboardingIdForJson: string | undefined,
  webhookReferenceId: string | undefined
): Promise<CtosPartySupplement | null> {
  const oid = typeof onboardingIdForJson === "string" ? onboardingIdForJson.trim() : "";
  const ref = typeof webhookReferenceId === "string" ? webhookReferenceId.trim() : "";
  const orgScope = parseOrganizationIdFromCtosPartyReferenceId(ref);
  const where = buildWhereCtosPartySupplementByOnboardingJsonOr(oid, ref, orgScope);
  if (!where) {
    return null;
  }
  return prisma.ctosPartySupplement.findFirst({ where });
}
