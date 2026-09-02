import {
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  OrganizationPartyOrigin,
  Prisma,
} from "@prisma/client";
import {
  buildInvestorProfileCompleteness,
  buildIssuerProfileCompleteness,
  issuerFinancialsFromYearBlock,
  latestUnauditedYearBlock,
  type ComrepProfileCompleteness,
  type OrganizationPartyProfileDto,
  type PartyMismatchResolveInput,
  type ProfileAddress,
  type ProfileFieldSources,
  type ProfileValueSource,
  type ScCompanyCategory,
  type ScCompanyType,
  type ScGender,
  type ScInvestorCategory,
  type ScPersonKind,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import {
  extractCtosObservationSnapshot,
  extractRegulatoryPartiesFromCorporateEntities,
  extractRegulatoryPartiesFromCtos,
  type RegulatoryPartyCandidate,
} from "./extract-regulatory-parties";
import type { OrgMasterPatchInput, PartyPatchInput } from "./schemas";
import {
  asAddress,
  asJson,
  fillEmptyMaster,
  parseDateInput,
  parseFieldSources,
  serializeParty,
  stampSource,
} from "./serialize";

type Portal = "issuer" | "investor";

function orgWhere(portal: Portal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null }
    : { investor_organization_id: organizationId, issuer_organization_id: null };
}

async function assertOrgExists(portal: Portal, organizationId: string) {
  if (portal === "issuer") {
    const org = await prisma.issuerOrganization.findUnique({ where: { id: organizationId } });
    if (!org) throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
    return org;
  }
  const org = await prisma.investorOrganization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError(404, "NOT_FOUND", "Investor organization not found");
  return org;
}

function candidateToCreateData(
  portal: Portal,
  organizationId: string,
  candidate: RegulatoryPartyCandidate,
  membership: OrganizationPartyMembershipStatus
): Prisma.OrganizationPartyProfileCreateInput {
  const source: ProfileValueSource = candidate.origin === "CTOS_PARTY" ? "CTOS" : "REGTANK";
  const sources: ProfileFieldSources = {};
  const stamp = (field: string) => stampSource(sources, field, source);
  let fieldSources: ProfileFieldSources = {};
  const mark = (field: string, filled: boolean) => {
    if (filled) fieldSources = stamp(field);
  };
  mark("name", Boolean(candidate.name));
  mark("identityNumber", Boolean(candidate.identityNumber));
  mark("identityPrefix", Boolean(candidate.identityPrefix));
  mark("shareholdingPercentage", candidate.shareholdingPercentage != null);
  mark("appointmentDate", Boolean(candidate.appointmentDate));
  const address = candidate.addressLine1 ? { line1: candidate.addressLine1 } : null;
  mark("address", Boolean(address));

  return {
    party_key: candidate.partyKey,
    origin: candidate.origin as OrganizationPartyOrigin,
    membership_status: membership,
    entity_type: candidate.entityType as OrganizationPartyEntityType,
    name: candidate.name,
    identity_number: candidate.identityNumber,
    identity_prefix: candidate.identityPrefix,
    is_director: candidate.isDirector,
    is_shareholder: candidate.isShareholder,
    is_board: candidate.isBoard,
    is_management: false,
    shareholding_percentage:
      candidate.shareholdingPercentage != null
        ? new Prisma.Decimal(candidate.shareholdingPercentage)
        : null,
    appointment_date: parseDateInput(candidate.appointmentDate),
    resignation_date: parseDateInput(candidate.resignationDate),
    address: address ? asJson(address) : undefined,
    field_sources: asJson(fieldSources),
    issuer_organization: portal === "issuer" ? { connect: { id: organizationId } } : undefined,
    investor_organization: portal === "investor" ? { connect: { id: organizationId } } : undefined,
  };
}

export async function seedMasterPartiesIfEmpty(
  portal: Portal,
  organizationId: string
): Promise<void> {
  await assertOrgExists(portal, organizationId);
  const existing = await prisma.organizationPartyProfile.count({
    where: {
      ...orgWhere(portal, organizationId),
      membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    },
  });
  if (existing > 0) return;

  const org =
    portal === "issuer"
      ? await prisma.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: { corporate_entities: true },
        })
      : await prisma.investorOrganization.findUnique({
          where: { id: organizationId },
          select: { corporate_entities: true },
        });
  if (!org) return;

  const ctos = await prisma.ctosReport.findFirst({
    where:
      portal === "issuer"
        ? { issuer_organization_id: organizationId, subject_ref: null }
        : { investor_organization_id: organizationId, subject_ref: null },
    orderBy: { fetched_at: "desc" },
    select: { company_json: true },
  });

  const fromCtos = extractRegulatoryPartiesFromCtos(ctos?.company_json ?? null);
  const candidates = fromCtos.length > 0
    ? fromCtos
    : extractRegulatoryPartiesFromCorporateEntities(org.corporate_entities);
  if (candidates.length === 0) return;

  await prisma.organizationPartyProfile.createMany({
    data: candidates.map((c) => {
      const created = candidateToCreateData(portal, organizationId, c, "MASTER_ACTIVE");
      return {
        party_key: created.party_key,
        origin: created.origin,
        membership_status: created.membership_status,
        entity_type: created.entity_type,
        name: created.name,
        identity_number: created.identity_number,
        identity_prefix: created.identity_prefix,
        is_director: created.is_director,
        is_shareholder: created.is_shareholder,
        is_board: created.is_board,
        is_management: created.is_management,
        shareholding_percentage: created.shareholding_percentage,
        appointment_date: created.appointment_date,
        resignation_date: created.resignation_date,
        address: created.address ?? Prisma.JsonNull,
        field_sources: created.field_sources,
        issuer_organization_id: portal === "issuer" ? organizationId : null,
        investor_organization_id: portal === "investor" ? organizationId : null,
      };
    }),
  });
}

export async function observeExternalCtosParties(
  portal: Portal,
  organizationId: string,
  companyJson: unknown
): Promise<void> {
  await seedMasterPartiesIfEmpty(portal, organizationId);

  const masterCount = await prisma.organizationPartyProfile.count({
    where: {
      ...orgWhere(portal, organizationId),
      membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    },
  });
  if (masterCount === 0) {
    return;
  }

  const snapshot = extractCtosObservationSnapshot(companyJson);
  const existing = await prisma.organizationPartyProfile.findMany({
    where: orgWhere(portal, organizationId),
  });
  const byKey = new Map(existing.map((row) => [row.party_key, row]));
  const seen = new Set<string>();

  for (const [partyKey, observation] of snapshot) {
    seen.add(partyKey);
    const row = byKey.get(partyKey);
    if (!row) {
      const candidate = extractRegulatoryPartiesFromCtos(companyJson).find(
        (p) => p.partyKey === partyKey
      );
      if (!candidate) continue;
      await prisma.organizationPartyProfile.create({
        data: {
          ...candidateToCreateData(portal, organizationId, candidate, "EXTERNAL_OBSERVED"),
          membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
          external_observation: asJson(observation),
        },
      });
      continue;
    }
    await prisma.organizationPartyProfile.update({
      where: { id: row.id },
      data: {
        absent_from_latest_external: false,
        external_observation: asJson(observation),
      },
    });
  }

  for (const row of existing) {
    if (row.membership_status === OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED) continue;
    if (seen.has(row.party_key)) continue;
    if (row.origin === OrganizationPartyOrigin.USER_MANAGEMENT) continue;
    await prisma.organizationPartyProfile.update({
      where: { id: row.id },
      data: { absent_from_latest_external: true },
    });
  }
}

export async function listPartyProfiles(
  portal: Portal,
  organizationId: string
): Promise<OrganizationPartyProfileDto[]> {
  await seedMasterPartiesIfEmpty(portal, organizationId);
  const rows = await prisma.organizationPartyProfile.findMany({
    where: orgWhere(portal, organizationId),
    orderBy: [{ membership_status: "asc" }, { name: "asc" }],
  });
  return rows.map(serializeParty);
}

function addressFromCod(raw: unknown): ProfileAddress | null {
  return asAddress(raw);
}

function pickCodAddress(
  corporateOnboardingData: unknown,
  kind: "registered" | "business"
): ProfileAddress | null {
  if (!corporateOnboardingData || typeof corporateOnboardingData !== "object") return null;
  const addresses = (corporateOnboardingData as { addresses?: { registered?: unknown; business?: unknown } })
    .addresses;
  if (!addresses) return null;
  return kind === "registered" ? addressFromCod(addresses.registered) : addressFromCod(addresses.business);
}

export async function computeOrgProfileCompleteness(
  portal: Portal,
  organizationId: string
): Promise<ComrepProfileCompleteness> {
  await seedMasterPartiesIfEmpty(portal, organizationId);

  if (portal === "issuer") {
    const org = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      include: { party_profiles: true },
    });
    if (!org) throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
    const fs = await prisma.issuerOrganizationFinancialStatement.findUnique({
      where: { issuer_organization_id: organizationId },
    });
    const year = latestUnauditedYearBlock(fs?.financial_statements);
    const cod = (org.corporate_onboarding_data ?? null) as {
      basicInfo?: { businessName?: string; ssmRegisterNumber?: string; ssmRegistrationNumber?: string };
      aboutYourBusiness?: { whatDoesCompanyDo?: string };
      addresses?: { registered?: unknown; business?: unknown };
    } | null;
    const name = org.name || cod?.basicInfo?.businessName || null;
    const roc = org.registration_number || cod?.basicInfo?.ssmRegisterNumber || cod?.basicInfo?.ssmRegistrationNumber || null;
    const masterParties = org.party_profiles.filter(
      (p) => p.membership_status === OrganizationPartyMembershipStatus.MASTER_ACTIVE
    );
    const shareholders = masterParties.filter((p) => p.is_shareholder).map((p) => {
      const addr = asAddress(p.address);
      return {
        partyKey: p.party_key,
        name: p.name,
        entityType: p.entity_type,
        identityPrefix: p.identity_prefix,
        identityNumber: p.identity_number,
        dateOfBirth: p.date_of_birth,
        dateOfIncorporation: p.date_of_incorporation,
        gender: p.gender,
        nationality: p.nationality,
        countryOfIncorporation: p.country_of_incorporation,
        address: addr,
        shareType: p.share_type,
        shareTypeOther: p.share_type_other,
        shareholdingUnits: p.shareholding_units?.toString() ?? null,
        shareholdingAmount: p.shareholding_amount?.toString() ?? null,
        shareholdingPercentage: p.shareholding_percentage?.toString() ?? null,
      };
    });
    const board = masterParties
      .filter((p) => p.is_board || p.is_management || p.is_director)
      .map((p) => {
        const addr = asAddress(p.address);
        return {
          partyKey: p.party_key,
          name: p.name,
          personKind: (p.is_management && !p.is_board ? "MANAGEMENT" : "BOARD") as ScPersonKind,
          identityPrefix: p.identity_prefix,
          identityNumber: p.identity_number,
          gender: p.gender,
          dateOfBirth: p.date_of_birth,
          nationality: p.nationality,
          address: addr,
          designation: p.designation,
          designationOther: p.designation_other,
          appointmentDate: p.appointment_date,
        };
      });

    return buildIssuerProfileCompleteness({
      company: {
        name,
        registrationNumber: roc,
        organizationId: org.id,
        companyCategory: org.company_category,
        dateOfIncorporation: org.date_of_incorporation,
        dateOfCommencement: org.date_of_commencement,
        countryOfIncorporation: org.country_of_incorporation,
        scCompanyType: org.sc_company_type,
        registeredAddress: pickCodAddress(org.corporate_onboarding_data, "registered"),
        businessAddress: pickCodAddress(org.corporate_onboarding_data, "business"),
        phoneNumber: org.phone_number,
        companyEmail: org.company_email,
        companyActivities: cod?.aboutYourBusiness?.whatDoesCompanyDo ?? null,
      },
      shareholders,
      board,
      financials: issuerFinancialsFromYearBlock(year),
    });
  }

  const org = await prisma.investorOrganization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError(404, "NOT_FOUND", "Investor organization not found");
  const residential = asAddress(org.residential_address);
  const name =
    [org.first_name, org.last_name].filter(Boolean).join(" ").trim() || org.name || null;
  if (org.type === "COMPANY") {
    const business = pickCodAddress(org.corporate_onboarding_data, "business");
    return buildInvestorProfileCompleteness({
      organizationType: "COMPANY",
      corporate: {
        name: org.name,
        registrationNumber: org.registration_number,
        identityPrefix: "ROC",
        dateOfIncorporation: org.date_of_incorporation,
        countryOfIncorporation: org.country_of_incorporation,
        gender: "NOT_APPLICABLE",
        businessState: business?.state ?? null,
        businessPostalCode: business?.postalCode ?? null,
        scInvestorCategory: org.sc_investor_category,
      },
    });
  }
  return buildInvestorProfileCompleteness({
    organizationType: "PERSONAL",
    personal: {
      name,
      identityPrefix: org.document_type?.toUpperCase().includes("PASSPORT") ? "PASSPORT" : "NRIC",
      identityNumber: org.document_number,
      dateOfBirth: org.date_of_birth,
      gender: mapStoredGender(org.gender),
      state: residential?.state ?? null,
      postalCode: residential?.postalCode ?? null,
      nationality: org.nationality,
      scInvestorCategory: org.sc_investor_category,
    },
  });
}

function mapStoredGender(value: string | null | undefined): ScGender | null {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "MALE" || v === "M") return "MALE";
  if (v === "FEMALE" || v === "F") return "FEMALE";
  if (v === "NOT_APPLICABLE" || v === "NA") return "NOT_APPLICABLE";
  return null;
}

export type OrgMasterPatch = OrgMasterPatchInput;

export async function patchOrgMasterProfile(params: {
  portal: Portal;
  organizationId: string;
  actorUserId: string;
  source: ProfileValueSource;
  patch: OrgMasterPatch;
  fillEmptyOnly?: boolean;
}): Promise<void> {
  const { portal, organizationId, source, patch, fillEmptyOnly } = params;
  const org = await assertOrgExists(portal, organizationId);
  const sources = parseFieldSources(
    (org as { profile_field_sources?: unknown }).profile_field_sources
  );
  let nextSources = { ...sources };

  const applyScalar = <T,>(field: string, current: T, incoming: T | undefined): T => {
    if (incoming === undefined) return current;
    if (fillEmptyOnly) {
      const result = fillEmptyMaster({
        master: current,
        incoming,
        sources: nextSources,
        field,
        source,
      });
      nextSources = result.sources;
      return result.value;
    }
    nextSources = stampSource(nextSources, field, source);
    return incoming;
  };

  if (portal === "issuer") {
    const issuer = org as Awaited<ReturnType<typeof prisma.issuerOrganization.findUnique>> &
      Record<string, unknown>;
    const data: Prisma.IssuerOrganizationUpdateInput = {
      profile_field_sources: asJson(nextSources),
    };
    if (patch.dateOfIncorporation !== undefined) {
      data.date_of_incorporation = applyScalar(
        "dateOfIncorporation",
        issuer.date_of_incorporation as Date | null,
        parseDateInput(patch.dateOfIncorporation)
      );
    }
    if (patch.dateOfCommencement !== undefined) {
      data.date_of_commencement = applyScalar(
        "dateOfCommencement",
        issuer.date_of_commencement as Date | null,
        parseDateInput(patch.dateOfCommencement)
      );
    }
    if (patch.countryOfIncorporation !== undefined) {
      data.country_of_incorporation = applyScalar(
        "countryOfIncorporation",
        issuer.country_of_incorporation as string | null,
        patch.countryOfIncorporation
      );
    }
    if (patch.scCompanyType !== undefined) {
      data.sc_company_type = applyScalar(
        "scCompanyType",
        issuer.sc_company_type as ScCompanyType | null,
        patch.scCompanyType
      );
    }
    if (patch.companyCategory !== undefined) {
      data.company_category = applyScalar(
        "companyCategory",
        issuer.company_category as ScCompanyCategory | null,
        patch.companyCategory
      );
    }
    if (patch.companyEmail !== undefined) {
      data.company_email = applyScalar(
        "companyEmail",
        issuer.company_email as string | null,
        patch.companyEmail
      );
    }
    if (patch.phoneNumber !== undefined) {
      data.phone_number = applyScalar("phoneNumber", issuer.phone_number as string | null, patch.phoneNumber);
    }
    if (patch.name !== undefined) {
      data.name = applyScalar("name", issuer.name as string | null, patch.name);
    }
    if (
      patch.registeredAddress !== undefined ||
      patch.businessAddress !== undefined ||
      patch.companyActivities !== undefined
    ) {
      const existing =
        (issuer.corporate_onboarding_data as Record<string, unknown> | null) ?? {};
      const addresses = {
        ...((existing.addresses as Record<string, unknown> | undefined) ?? {}),
      };
      if (patch.registeredAddress !== undefined) {
        addresses.registered = applyScalar(
          "registeredAddress",
          addresses.registered ?? null,
          patch.registeredAddress
        );
      }
      if (patch.businessAddress !== undefined) {
        addresses.business = applyScalar(
          "businessAddress",
          addresses.business ?? null,
          patch.businessAddress
        );
      }
      const about =
        ((existing.aboutYourBusiness as Record<string, unknown> | undefined) ?? {});
      if (patch.companyActivities !== undefined) {
        about.whatDoesCompanyDo = applyScalar(
          "companyActivities",
          (about.whatDoesCompanyDo as string | null) ?? null,
          patch.companyActivities
        );
      }
      data.corporate_onboarding_data = asJson({
        ...existing,
        addresses,
        aboutYourBusiness: about,
      });
    }
    data.profile_field_sources = asJson(nextSources);
    await prisma.issuerOrganization.update({ where: { id: organizationId }, data });
    return;
  }

  const investor = org as Awaited<ReturnType<typeof prisma.investorOrganization.findUnique>> &
    Record<string, unknown>;
  const data: Prisma.InvestorOrganizationUpdateInput = {};
  if (patch.dateOfIncorporation !== undefined) {
    data.date_of_incorporation = applyScalar(
      "dateOfIncorporation",
      investor.date_of_incorporation as Date | null,
      parseDateInput(patch.dateOfIncorporation)
    );
  }
  if (patch.countryOfIncorporation !== undefined) {
    data.country_of_incorporation = applyScalar(
      "countryOfIncorporation",
      investor.country_of_incorporation as string | null,
      patch.countryOfIncorporation
    );
  }
  if (patch.scInvestorCategory !== undefined) {
    data.sc_investor_category = applyScalar(
      "scInvestorCategory",
      investor.sc_investor_category as ScInvestorCategory | null,
      patch.scInvestorCategory
    );
  }
  if (patch.residentialAddress !== undefined) {
    data.residential_address = asJson(
      applyScalar(
        "residentialAddress",
        investor.residential_address,
        patch.residentialAddress
      )
    );
  }
  if (patch.gender !== undefined) {
    data.gender = applyScalar("gender", investor.gender as string | null, patch.gender);
  }
  if (patch.nationality !== undefined) {
    data.nationality = applyScalar(
      "nationality",
      investor.nationality as string | null,
      patch.nationality
    );
  }
  if (patch.phoneNumber !== undefined) {
    data.phone_number = applyScalar(
      "phoneNumber",
      investor.phone_number as string | null,
      patch.phoneNumber
    );
  }
  if (
    patch.businessAddress !== undefined ||
    patch.registeredAddress !== undefined
  ) {
    const existing = (investor.corporate_onboarding_data as Record<string, unknown> | null) ?? {};
    const addresses = { ...((existing.addresses as Record<string, unknown> | undefined) ?? {}) };
    if (patch.businessAddress !== undefined) {
      addresses.business = applyScalar(
        "businessAddress",
        addresses.business ?? null,
        patch.businessAddress
      );
    }
    if (patch.registeredAddress !== undefined) {
      addresses.registered = applyScalar(
        "registeredAddress",
        addresses.registered ?? null,
        patch.registeredAddress
      );
    }
    data.corporate_onboarding_data = asJson({ ...existing, addresses });
  }
  data.profile_field_sources = asJson(nextSources);
  await prisma.investorOrganization.update({ where: { id: organizationId }, data });
}

export type PartyPatch = PartyPatchInput;

function decimalOrNull(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value);
}

export async function patchPartyProfile(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
  source: ProfileValueSource;
  patch: PartyPatch;
  fillEmptyOnly?: boolean;
}): Promise<OrganizationPartyProfileDto> {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  if (row.membership_status === OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED) {
    throw new AppError(400, "INVALID_PARTY_STATUS", "Observed parties must be adopted before editing");
  }

  let sources = parseFieldSources(row.field_sources);
  const apply = <T,>(field: string, current: T, incoming: T | undefined): T => {
    if (incoming === undefined) return current;
    if (params.fillEmptyOnly) {
      const result = fillEmptyMaster({
        master: current,
        incoming,
        sources,
        field,
        source: params.source,
      });
      sources = result.sources;
      return result.value;
    }
    sources = stampSource(sources, field, params.source);
    return incoming;
  };

  const data: Prisma.OrganizationPartyProfileUpdateInput = {};
  const p = params.patch;
  if (p.name !== undefined) data.name = apply("name", row.name, p.name);
  if (p.salutation !== undefined) data.salutation = apply("salutation", row.salutation, p.salutation);
  if (p.identityPrefix !== undefined) {
    data.identity_prefix = apply("identityPrefix", row.identity_prefix, p.identityPrefix);
  }
  if (p.identityNumber !== undefined) {
    data.identity_number = apply("identityNumber", row.identity_number, p.identityNumber);
  }
  if (p.dateOfBirth !== undefined) {
    data.date_of_birth = apply("dateOfBirth", row.date_of_birth, parseDateInput(p.dateOfBirth));
  }
  if (p.dateOfIncorporation !== undefined) {
    data.date_of_incorporation = apply(
      "dateOfIncorporation",
      row.date_of_incorporation,
      parseDateInput(p.dateOfIncorporation)
    );
  }
  if (p.gender !== undefined) data.gender = apply("gender", row.gender, p.gender);
  if (p.nationality !== undefined) data.nationality = apply("nationality", row.nationality, p.nationality);
  if (p.countryOfIncorporation !== undefined) {
    data.country_of_incorporation = apply(
      "countryOfIncorporation",
      row.country_of_incorporation,
      p.countryOfIncorporation
    );
  }
  if (p.address !== undefined) {
    data.address = asJson(apply("address", asAddress(row.address), p.address));
  }
  if (p.isDirector !== undefined) data.is_director = p.isDirector;
  if (p.isShareholder !== undefined) data.is_shareholder = p.isShareholder;
  if (p.isBoard !== undefined) data.is_board = p.isBoard;
  if (p.isManagement !== undefined) data.is_management = p.isManagement;
  if (p.personKind === "BOARD") {
    data.is_board = true;
    data.is_management = false;
  }
  if (p.personKind === "MANAGEMENT") {
    data.is_management = true;
    data.is_board = false;
  }
  if (p.shareType !== undefined) data.share_type = apply("shareType", row.share_type, p.shareType);
  if (p.shareTypeOther !== undefined) {
    data.share_type_other = apply("shareTypeOther", row.share_type_other, p.shareTypeOther);
  }
  if (p.shareholdingUnits !== undefined) {
    data.shareholding_units = apply(
      "shareholdingUnits",
      row.shareholding_units,
      decimalOrNull(p.shareholdingUnits)
    );
  }
  if (p.shareholdingAmount !== undefined) {
    data.shareholding_amount = apply(
      "shareholdingAmount",
      row.shareholding_amount,
      decimalOrNull(p.shareholdingAmount)
    );
  }
  if (p.shareholdingPercentage !== undefined) {
    data.shareholding_percentage = apply(
      "shareholdingPercentage",
      row.shareholding_percentage,
      decimalOrNull(p.shareholdingPercentage)
    );
  }
  if (p.designation !== undefined) {
    data.designation = apply("designation", row.designation, p.designation);
  }
  if (p.designationOther !== undefined) {
    data.designation_other = apply("designationOther", row.designation_other, p.designationOther);
  }
  if (p.appointmentDate !== undefined) {
    data.appointment_date = apply(
      "appointmentDate",
      row.appointment_date,
      parseDateInput(p.appointmentDate)
    );
  }
  if (p.resignationDate !== undefined) {
    data.resignation_date = apply(
      "resignationDate",
      row.resignation_date,
      parseDateInput(p.resignationDate)
    );
  }
  data.field_sources = asJson(sources);

  const updated = await prisma.organizationPartyProfile.update({
    where: { id: row.id },
    data,
  });
  return serializeParty(updated);
}

export async function createManagementParty(params: {
  portal: Portal;
  organizationId: string;
  patch: PartyPatch;
  source: ProfileValueSource;
}): Promise<OrganizationPartyProfileDto> {
  await assertOrgExists(params.portal, params.organizationId);
  const identity = params.patch.identityNumber?.trim();
  if (!identity) {
    throw new AppError(400, "VALIDATION_ERROR", "Identity number is required for management members");
  }
  const partyKey = `mgmt:${identity.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
  const created = await prisma.organizationPartyProfile.create({
    data: {
      ...orgWhere(params.portal, params.organizationId),
      party_key: partyKey,
      origin: OrganizationPartyOrigin.USER_MANAGEMENT,
      membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entity_type: OrganizationPartyEntityType.INDIVIDUAL,
      name: params.patch.name ?? null,
      identity_number: identity,
      identity_prefix: params.patch.identityPrefix ?? null,
      is_director: false,
      is_shareholder: false,
      is_board: params.patch.personKind === "BOARD",
      is_management: params.patch.personKind !== "BOARD",
      gender: params.patch.gender ?? null,
      nationality: params.patch.nationality ?? null,
      date_of_birth: parseDateInput(params.patch.dateOfBirth),
      address: params.patch.address ? asJson(params.patch.address) : undefined,
      designation: params.patch.designation ?? null,
      designation_other: params.patch.designationOther ?? null,
      appointment_date: parseDateInput(params.patch.appointmentDate),
      field_sources: asJson(stampSource({}, "name", params.source)),
    },
  });
  return serializeParty(created);
}

export async function deleteManagementParty(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
}): Promise<void> {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  if (row.origin !== OrganizationPartyOrigin.USER_MANAGEMENT) {
    throw new AppError(400, "INVALID_PARTY", "Only user-added management members can be removed");
  }
  await prisma.organizationPartyProfile.delete({ where: { id: row.id } });
}

export async function resolvePartyMismatch(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
  input: PartyMismatchResolveInput;
}): Promise<OrganizationPartyProfileDto> {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  if (params.input.action === "KEEP") {
    const observation = (row.external_observation as Record<string, unknown> | null) ?? {};
    observation[`resolved:${params.input.field}`] = "KEEP";
    const updated = await prisma.organizationPartyProfile.update({
      where: { id: row.id },
      data: { external_observation: asJson(observation) },
    });
    return serializeParty(updated);
  }
  const observation = (row.external_observation as Record<string, unknown> | null) ?? {};
  const incoming =
    params.input.action === "EDIT" ? params.input.value : observation[params.input.field];
  const fieldMap: Record<string, keyof PartyPatch> = {
    name: "name",
    identityNumber: "identityNumber",
    shareholdingPercentage: "shareholdingPercentage",
    appointmentDate: "appointmentDate",
    resignationDate: "resignationDate",
  };
  const patchKey = fieldMap[params.input.field];
  if (!patchKey) {
    throw new AppError(400, "VALIDATION_ERROR", `Field ${params.input.field} cannot be adopted`);
  }
  return patchPartyProfile({
    portal: params.portal,
    organizationId: params.organizationId,
    partyId: params.partyId,
    source: "ADMIN",
    patch: { [patchKey]: incoming as never },
  });
}

export async function adoptObservedParty(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
}): Promise<OrganizationPartyProfileDto> {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  if (row.membership_status !== OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED) {
    throw new AppError(400, "INVALID_PARTY_STATUS", "Only newly observed parties can be adopted");
  }
  const updated = await prisma.organizationPartyProfile.update({
    where: { id: row.id },
    data: { membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE },
  });
  return serializeParty(updated);
}

export async function inactivateMasterParty(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
}): Promise<OrganizationPartyProfileDto> {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  const updated = await prisma.organizationPartyProfile.update({
    where: { id: row.id },
    data: { membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE },
  });
  return serializeParty(updated);
}

export async function patchIssuerOrgFinancials(params: {
  organizationId: string;
  year: string;
  fields: Record<string, unknown>;
}): Promise<void> {
  const existing = await prisma.issuerOrganizationFinancialStatement.findUnique({
    where: { issuer_organization_id: params.organizationId },
  });
  const current =
    existing?.financial_statements && typeof existing.financial_statements === "object"
      ? (existing.financial_statements as Record<string, unknown>)
      : {};
  const byYear =
    current.unaudited_by_year && typeof current.unaudited_by_year === "object"
      ? { ...(current.unaudited_by_year as Record<string, unknown>) }
      : {};
  const yearBlock =
    byYear[params.year] && typeof byYear[params.year] === "object"
      ? { ...(byYear[params.year] as Record<string, unknown>) }
      : {};
  byYear[params.year] = { ...yearBlock, ...params.fields };
  const next = { ...current, unaudited_by_year: byYear };
  if (existing) {
    await prisma.issuerOrganizationFinancialStatement.update({
      where: { issuer_organization_id: params.organizationId },
      data: { financial_statements: asJson(next) },
    });
    return;
  }
  await prisma.issuerOrganizationFinancialStatement.create({
    data: {
      issuer_organization_id: params.organizationId,
      financial_statements: asJson(next),
    },
  });
}

export async function assertIssuerProfileCompleteForSubmit(issuerOrganizationId: string): Promise<void> {
  const completeness = await computeOrgProfileCompleteness("issuer", issuerOrganizationId);
  if (!completeness.complete) {
    throw new AppError(
      400,
      "PROFILE_INCOMPLETE",
      "Complete the company profile before you submit an application."
    );
  }
}
