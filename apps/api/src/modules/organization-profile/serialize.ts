import { Prisma } from "@prisma/client";
import type {
  OrganizationPartyProfileDto,
  OrganizationPartyFieldMismatch,
  ProfileAddress,
  ProfileFieldSources,
  ProfileValueSource,
} from "@cashsouk/types";
import { isMasterFieldEmpty, valuesEqualForMismatch } from "@cashsouk/types";

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export function decimalToString(value: Prisma.Decimal | number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function parseDateInput(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asAddress(value: unknown): ProfileAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  return {
    line1: typeof rec.line1 === "string" ? rec.line1 : rec.line1 == null ? null : String(rec.line1),
    line2: typeof rec.line2 === "string" ? rec.line2 : rec.line2 == null ? null : String(rec.line2),
    city: typeof rec.city === "string" ? rec.city : rec.city == null ? null : String(rec.city),
    postalCode:
      typeof rec.postalCode === "string"
        ? rec.postalCode
        : rec.postalCode == null
          ? null
          : String(rec.postalCode),
    state: typeof rec.state === "string" ? rec.state : rec.state == null ? null : String(rec.state),
    country: typeof rec.country === "string" ? rec.country : rec.country == null ? null : String(rec.country),
  };
}

export function parseFieldSources(value: unknown): ProfileFieldSources {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ProfileFieldSources = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    const source = rec.source;
    if (
      source !== "CTOS" &&
      source !== "REGTANK" &&
      source !== "USER" &&
      source !== "ADMIN" &&
      source !== "SYSTEM"
    ) {
      continue;
    }
    out[key] = {
      source,
      updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString(),
    };
  }
  return out;
}

export function stampSource(
  sources: ProfileFieldSources,
  field: string,
  source: ProfileValueSource
): ProfileFieldSources {
  return {
    ...sources,
    [field]: { source, updatedAt: new Date().toISOString() },
  };
}

export function fillEmptyMaster<T>(params: {
  master: T;
  incoming: T;
  sources: ProfileFieldSources;
  field: string;
  source: ProfileValueSource;
}): { value: T; sources: ProfileFieldSources; wrote: boolean } {
  if (!isMasterFieldEmpty(params.master) || isMasterFieldEmpty(params.incoming)) {
    return { value: params.master, sources: params.sources, wrote: false };
  }
  return {
    value: params.incoming,
    sources: stampSource(params.sources, params.field, params.source),
    wrote: true,
  };
}

const MISMATCH_FIELDS = [
  "name",
  "identityNumber",
  "entityType",
  "isDirector",
  "isShareholder",
  "shareholdingPercentage",
  "appointmentDate",
  "resignationDate",
] as const;

export function computePartyMismatches(params: {
  master: {
    name: string | null;
    identityNumber: string | null;
    entityType: string;
    isDirector: boolean;
    isShareholder: boolean;
    shareholdingPercentage: Prisma.Decimal | number | string | null;
    appointmentDate: Date | null;
    resignationDate: Date | null;
  };
  observation: Record<string, unknown> | null;
  sources: ProfileFieldSources;
}): OrganizationPartyFieldMismatch[] {
  if (!params.observation) return [];
  const mismatches: OrganizationPartyFieldMismatch[] = [];
  const masterMap: Record<string, unknown> = {
    name: params.master.name,
    identityNumber: params.master.identityNumber,
    entityType: params.master.entityType,
    isDirector: params.master.isDirector,
    isShareholder: params.master.isShareholder,
    shareholdingPercentage: decimalToString(params.master.shareholdingPercentage),
    appointmentDate: toIsoDate(params.master.appointmentDate)?.slice(0, 10) ?? null,
    resignationDate: toIsoDate(params.master.resignationDate)?.slice(0, 10) ?? null,
  };
  for (const field of MISMATCH_FIELDS) {
    const masterValue = masterMap[field];
    const externalValue = params.observation[field];
    if (isMasterFieldEmpty(masterValue) || isMasterFieldEmpty(externalValue)) continue;
    if (valuesEqualForMismatch(masterValue, externalValue)) continue;
    mismatches.push({
      field,
      masterValue,
      externalValue,
      source: params.sources[field]?.source ?? null,
    });
  }
  return mismatches;
}

export function serializeParty(
  row: {
    id: string;
    party_key: string;
    origin: OrganizationPartyProfileDto["origin"];
    membership_status: OrganizationPartyProfileDto["membershipStatus"];
    entity_type: OrganizationPartyProfileDto["entityType"];
    absent_from_latest_external: boolean;
    name: string | null;
    salutation: string | null;
    identity_prefix: OrganizationPartyProfileDto["identityPrefix"];
    identity_number: string | null;
    date_of_birth: Date | null;
    date_of_incorporation: Date | null;
    gender: OrganizationPartyProfileDto["gender"];
    nationality: string | null;
    country_of_incorporation: string | null;
    address: Prisma.JsonValue | null;
    is_director: boolean;
    is_shareholder: boolean;
    is_board: boolean;
    is_management: boolean;
    share_type: OrganizationPartyProfileDto["shareType"];
    share_type_other: string | null;
    shareholding_units: Prisma.Decimal | null;
    shareholding_amount: Prisma.Decimal | null;
    shareholding_percentage: Prisma.Decimal | null;
    designation: OrganizationPartyProfileDto["designation"];
    designation_other: string | null;
    appointment_date: Date | null;
    resignation_date: Date | null;
    field_sources: Prisma.JsonValue;
    external_observation: Prisma.JsonValue | null;
    created_at: Date;
    updated_at: Date;
  }
): OrganizationPartyProfileDto {
  const fieldSources = parseFieldSources(row.field_sources);
  const observation =
    row.external_observation && typeof row.external_observation === "object" && !Array.isArray(row.external_observation)
      ? (row.external_observation as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    partyKey: row.party_key,
    origin: row.origin,
    membershipStatus: row.membership_status,
    entityType: row.entity_type,
    absentFromLatestExternal: row.absent_from_latest_external,
    name: row.name,
    salutation: row.salutation,
    identityPrefix: row.identity_prefix,
    identityNumber: row.identity_number,
    dateOfBirth: toIsoDate(row.date_of_birth),
    dateOfIncorporation: toIsoDate(row.date_of_incorporation),
    gender: row.gender,
    nationality: row.nationality,
    countryOfIncorporation: row.country_of_incorporation,
    address: asAddress(row.address),
    isDirector: row.is_director,
    isShareholder: row.is_shareholder,
    isBoard: row.is_board,
    isManagement: row.is_management,
    shareType: row.share_type,
    shareTypeOther: row.share_type_other,
    shareholdingUnits: decimalToString(row.shareholding_units),
    shareholdingAmount: decimalToString(row.shareholding_amount),
    shareholdingPercentage: decimalToString(row.shareholding_percentage),
    designation: row.designation,
    designationOther: row.designation_other,
    appointmentDate: toIsoDate(row.appointment_date),
    resignationDate: toIsoDate(row.resignation_date),
    fieldSources,
    externalObservation: observation,
    mismatches: computePartyMismatches({
      master: {
        name: row.name,
        identityNumber: row.identity_number,
        entityType: row.entity_type,
        isDirector: row.is_director,
        isShareholder: row.is_shareholder,
        shareholdingPercentage: row.shareholding_percentage,
        appointmentDate: row.appointment_date,
        resignationDate: row.resignation_date,
      },
      observation,
      sources: fieldSources,
    }),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
