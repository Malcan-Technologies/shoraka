/**
 * Validate authorised-representatives declared at offer-acceptance Step 1
 * against the same issuer director pool used for signing bindings.
 */

import {
  isGuarantorAuthorizedParty,
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type ApplicationPersonRow,
  type AuthorizedParty,
  type AuthorizedPartyCorporateGuarantor,
  type AuthorizedPartyIndividualGuarantor,
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

export type ApplicationGuarantorForParties = {
  id: string;
  client_guarantor_id?: string | null;
  guarantor_type: "individual" | "company";
  name: string | null;
  email: string;
  ic_number: string | null;
  business_name: string | null;
};

export function applicationGuarantorsForParties(value: unknown): ApplicationGuarantorForParties[] {
  if (!Array.isArray(value)) return [];
  const rows: ApplicationGuarantorForParties[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    const clientGuarantorId =
      typeof row.client_guarantor_id === "string" ? row.client_guarantor_id.trim() : "";
    rows.push({
      id,
      client_guarantor_id: clientGuarantorId || null,
      guarantor_type: row.guarantor_type === "company" ? "company" : "individual",
      name: typeof row.name === "string" ? row.name : null,
      email: typeof row.email === "string" ? row.email : "",
      ic_number: typeof row.ic_number === "string" ? row.ic_number : null,
      business_name: typeof row.business_name === "string" ? row.business_name : null,
    });
  }
  return rows;
}

function throwAuthorizedPartiesInvalid(message: string): never {
  throw new AppError(400, "AUTHORIZED_PARTIES_INVALID", message);
}

function stampCorporateRepresentative(representative: AuthorizedRepresentative): void {
  const name = representative.name.trim();
  const email = normalizeSigningEmail(representative.email);
  const ic = normalizeSigningIcNumber(representative.ic_number);
  if (!name || !email) {
    throwAuthorizedPartiesInvalid(
      "Each company guarantor representative must have a name and email."
    );
  }
  if (ic && !isValidSigningIcNumber(ic)) {
    throwAuthorizedPartiesInvalid(
      "Company guarantor representative IC must be 12 digits when provided."
    );
  }
  if (representative.capacity !== "director" && representative.capacity !== "authorised_signatory") {
    throwAuthorizedPartiesInvalid(
      "Company guarantor representatives must be a director or authorised signatory."
    );
  }
  representative.name = name;
  representative.email = email;
  representative.ic_number = ic;
}

function assertCorporateGuarantorPartyValid(party: AuthorizedPartyCorporateGuarantor): void {
  if (party.representatives.length === 0) {
    throwAuthorizedPartiesInvalid(
      "Each company guarantor needs at least one authorised representative."
    );
  }
  const seenEmails = new Set<string>();
  const seenIcs = new Set<string>();
  for (const representative of party.representatives) {
    stampCorporateRepresentative(representative);
    if (seenEmails.has(representative.email)) {
      throwAuthorizedPartiesInvalid("The same person cannot be listed twice for this company.");
    }
    if (representative.ic_number && seenIcs.has(representative.ic_number)) {
      throwAuthorizedPartiesInvalid("The same person cannot be listed twice for this company.");
    }
    seenEmails.add(representative.email);
    if (representative.ic_number) seenIcs.add(representative.ic_number);
  }
}

function assertIndividualGuarantorPartyValid(
  party: AuthorizedPartyIndividualGuarantor,
  row: ApplicationGuarantorForParties
): void {
  if (party.representatives.length !== 1) {
    throwAuthorizedPartiesInvalid("Each individual guarantor must sign as themselves.");
  }
  const name = String(row.name ?? "").trim();
  const ic = normalizeSigningIcNumber(String(row.ic_number ?? ""));
  if (!name || !isValidSigningIcNumber(ic)) {
    throwAuthorizedPartiesInvalid(
      "Each individual guarantor must have a name and 12-digit IC on the application."
    );
  }
  const representative = party.representatives[0]!;
  const email = normalizeSigningEmail(representative.email);
  if (!email) {
    throwAuthorizedPartiesInvalid("Each individual guarantor needs a valid email.");
  }
  representative.name = name;
  representative.email = email;
  representative.ic_number = ic;
  representative.capacity = "authorised_signatory";
}

export function assertGuarantorAuthorizedPartiesValid(
  parties: AuthorizedParty[],
  guarantors: ApplicationGuarantorForParties[]
): void {
  const guarantorParties = parties.filter(isGuarantorAuthorizedParty);
  const resolvedRows: ApplicationGuarantorForParties[] = [];
  const usedRowIds = new Set<string>();

  for (const party of guarantorParties) {
    const row = guarantors.find(
      (item) =>
        !usedRowIds.has(item.id) &&
        (item.id === party.application_guarantor_id ||
          item.client_guarantor_id === party.application_guarantor_id ||
          (party.client_guarantor_id != null &&
            party.client_guarantor_id !== "" &&
            item.client_guarantor_id === party.client_guarantor_id))
    );
    if (!row) {
      throwAuthorizedPartiesInvalid(
        "Authorised parties include a guarantor that is not on this application."
      );
    }
    usedRowIds.add(row.id);
    resolvedRows.push(row);
    party.application_guarantor_id = row.id;
    if (row.client_guarantor_id) party.client_guarantor_id = row.client_guarantor_id;
    party.key = row.client_guarantor_id || row.id;
  }

  if (usedRowIds.size !== guarantorParties.length) {
    throwAuthorizedPartiesInvalid("Each guarantor may appear only once.");
  }

  for (const row of guarantors) {
    if (!usedRowIds.has(row.id)) {
      throwAuthorizedPartiesInvalid(
        "Declare authorised representatives for every guarantor on this application."
      );
    }
  }

  for (let index = 0; index < guarantorParties.length; index += 1) {
    const party = guarantorParties[index];
    const row = resolvedRows[index];
    if (!party || !row) continue;
    if (row.guarantor_type === "company") {
      if (party.entity_kind !== "CORPORATE_GUARANTOR") {
        throwAuthorizedPartiesInvalid("Company guarantors cannot be submitted as individuals.");
      }
      assertCorporateGuarantorPartyValid(party);
    } else {
      if (party.entity_kind !== "INDIVIDUAL_GUARANTOR") {
        throwAuthorizedPartiesInvalid("Individual guarantors must sign as themselves.");
      }
      assertIndividualGuarantorPartyValid(party, row);
    }
  }
}

export function assertAuthorizedPartiesValid(
  parties: AuthorizedParty[],
  pool: IssuerDirectorPoolEntry[],
  guarantors: ApplicationGuarantorForParties[]
): void {
  assertIssuerAuthorizedPartiesValid(parties, pool);
  assertGuarantorAuthorizedPartiesValid(parties, guarantors);
}
