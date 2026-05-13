import type { NoteInvestmentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/** Owner plus every issuer organization membership row (all org members). */
export async function listIssuerOrgMemberUserIds(issuerOrganizationId: string): Promise<string[]> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: { owner_user_id: true },
  });
  const members = await prisma.organizationMember.findMany({
    where: { issuer_organization_id: issuerOrganizationId },
    select: { user_id: true },
  });
  const ids = new Set<string>();
  if (org?.owner_user_id) ids.add(org.owner_user_id);
  for (const m of members) ids.add(m.user_id);
  return [...ids];
}

/** Owner plus every investor organization membership row (all org members). */
export async function listInvestorOrgMemberUserIds(
  investorOrganizationId: string
): Promise<string[]> {
  const org = await prisma.investorOrganization.findUnique({
    where: { id: investorOrganizationId },
    select: { owner_user_id: true },
  });
  const members = await prisma.organizationMember.findMany({
    where: { investor_organization_id: investorOrganizationId },
    select: { user_id: true },
  });
  const ids = new Set<string>();
  if (org?.owner_user_id) ids.add(org.owner_user_id);
  for (const m of members) ids.add(m.user_id);
  return [...ids];
}

export async function listDistinctInvestorOrganizationIdsForNote(
  noteId: string,
  statuses: NoteInvestmentStatus[]
): Promise<string[]> {
  const rows = await prisma.noteInvestment.findMany({
    where: { note_id: noteId, status: { in: statuses } },
    select: { investor_organization_id: true },
    distinct: ["investor_organization_id"],
  });
  return rows.map((r) => r.investor_organization_id);
}
