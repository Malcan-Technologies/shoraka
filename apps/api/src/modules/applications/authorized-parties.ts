/**
 * Validate authorised-representatives declared at offer-acceptance Step 1
 * against the same issuer director pool used for signing bindings.
 */

import {
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type ApplicationPersonRow,
  type AuthorizedParty,
  type AuthorizedRepresentative,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { OrganizationService } from "../organization/service";
import { buildAdminPeopleList } from "../admin/build-people-list";

export type IssuerDirectorPoolEntry = {
  matchKey: string;
  name: string;
  email: string;
  icNumber: string;
};

export function directorPoolFromPeople(
  people: Array<Pick<ApplicationPersonRow, "matchKey" | "name" | "email" | "roles">>
): IssuerDirectorPoolEntry[] {
  const pool: IssuerDirectorPoolEntry[] = [];
  for (const person of people) {
    if (!person.roles?.some((role) => role.toUpperCase() === "DIRECTOR")) continue;
    const matchKey = String(person.matchKey ?? "").trim();
    const email = normalizeSigningEmail(String(person.email ?? ""));
    const name = String(person.name ?? "").trim();
    if (!matchKey || !email) continue;
    const icFromKey = normalizeSigningIcNumber(matchKey);
    pool.push({
      matchKey,
      name,
      email,
      icNumber: icFromKey.length === 12 ? icFromKey : "",
    });
  }
  return pool;
}

export async function loadIssuerDirectorPool(
  issuerOrganizationId: string
): Promise<IssuerDirectorPoolEntry[]> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: { corporate_entities: true, director_kyc_status: true, director_aml_status: true },
  });
  if (!org) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Issuer organization not found");
  }
  const organizationService = new OrganizationService();
  const extras = await organizationService.getIssuerPartyListExtras(issuerOrganizationId);
  const people = buildAdminPeopleList({
    ctos: extras.latestOrganizationCtosCompanyJson ?? null,
    issuerDirectorKycStatus: org.director_kyc_status ?? null,
    issuerDirectorAmlStatus: org.director_aml_status ?? null,
    ctosPartySupplements: extras.ctosPartySupplements,
    corporateEntities: org.corporate_entities ?? null,
  });
  return directorPoolFromPeople(people);
}

function requireMatchingIssuerDirector(
  representative: AuthorizedRepresentative,
  byMatchKey: Map<string, IssuerDirectorPoolEntry>,
  seenMatchKeys: Set<string>,
  seenEmails: Set<string>
): IssuerDirectorPoolEntry {
  if (representative.capacity !== "director") {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "Issuer representatives must be directors."
    );
  }
  const matchKey = representative.person_match_key?.trim() ?? "";
  const director = byMatchKey.get(matchKey);
  if (!director) {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "Each issuer representative must be one of the application's directors."
    );
  }
  const email = normalizeSigningEmail(representative.email);
  const ic = normalizeSigningIcNumber(representative.ic_number);
  if (director.email !== email) {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "Each issuer representative must be one of the application's directors."
    );
  }
  if (seenMatchKeys.has(director.matchKey) || seenEmails.has(director.email)) {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "The same director cannot be selected twice."
    );
  }
  if (!isValidSigningIcNumber(ic) || !director.icNumber || director.icNumber !== ic) {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "Each issuer director IC must match the director on file."
    );
  }
  seenMatchKeys.add(director.matchKey);
  seenEmails.add(director.email);
  return director;
}

export function assertIssuerAuthorizedPartiesValid(
  parties: AuthorizedParty[],
  pool: IssuerDirectorPoolEntry[]
): void {
  const issuer = parties.find((party) => party.entity_kind === "ISSUER");
  if (!issuer || issuer.representatives.length === 0) {
    throw new AppError(
      400,
      "AUTHORIZED_PARTIES_INVALID",
      "Select at least one director to represent the issuer company."
    );
  }

  const byMatchKey = new Map(pool.map((entry) => [entry.matchKey, entry]));
  const seenMatchKeys = new Set<string>();
  const seenEmails = new Set<string>();

  for (const representative of issuer.representatives) {
    const director = requireMatchingIssuerDirector(
      representative,
      byMatchKey,
      seenMatchKeys,
      seenEmails
    );
    representative.name = director.name;
    representative.email = director.email;
    representative.ic_number = director.icNumber;
    representative.person_match_key = director.matchKey;
  }
}
