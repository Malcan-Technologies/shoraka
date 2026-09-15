import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  OperatorAdvisorDto,
  OperatorCompanyStampFields,
  OperatorDocumentExecutionSlotDto,
  OperatorFinancialStatementDto,
  OperatorInterestDto,
  OperatorOfficerDto,
  OperatorProfileDto,
  OperatorShareCapitalDto,
  OperatorShareholderDto,
  OperatorSigningPersonDto,
  OperatorSigningRole,
  ScCompanyType,
} from "@cashsouk/types";
import {
  documentExecutionBindingIssues,
  emptyDocumentExecutionSlots,
  executionRoleSigningRole,
  isAutomaticSignerProviderReady,
  isOperatorDocumentRepresentativeRole,
  legacyAuthorisedSignatoryNameFromSigningPeople,
  normalizeScIdentityNumber,
  normalizeScRegistrationNumber,
  OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS,
  type OperatorDocumentExecutionRole,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { generatePresignedUploadUrl, generatePresignedViewUrl } from "../../lib/s3/client";
import { decimalToString, parseDateInput, toIsoDate } from "../organization-profile/serialize";
import { parseDocumentAuthorisationConfig } from "../notes/document-authorisation/config";
import type {
  OperatorAdvisorInput,
  OperatorCompanyStampPatchInput,
  OperatorDocumentExecutionBindingsPutInput,
  OperatorFinancialStatementInput,
  OperatorInterestInput,
  OperatorOfficerInput,
  OperatorShareCapitalInput,
  OperatorShareholderInput,
  OperatorSigningPersonCreateInput,
  OperatorSigningPersonUpdateInput,
} from "../organization-profile/schemas";
import {
  assertOperatorSignatureS3Key,
  assertOperatorSignatureUploadDeclared,
  confirmOperatorSignatureObject,
  OPERATOR_SIGNING_SIGNATURE_S3_PREFIX,
  type ConfirmedOperatorSignature,
} from "./signature-asset";

const SINGLETON = "cashsouk";

const PROFILE_INCLUDE = {
  share_capital: true,
  shareholders: { orderBy: { created_at: "asc" as const } },
  officers: { orderBy: { created_at: "asc" as const } },
  advisors: { orderBy: { created_at: "asc" as const } },
  interests: { orderBy: { created_at: "asc" as const } },
  financial_statements: { orderBy: { financial_year_end: "desc" as const } },
  signing_people: { include: { officer: true }, orderBy: { created_at: "asc" as const } },
  document_execution_bindings: { orderBy: [{ role_key: "asc" as const }, { slot_index: "asc" as const }] },
};

function holderIdentityNumber(
  entityType: OperatorShareholderInput["entityType"],
  value: string | null | undefined,
  nationality?: string | null
): string | null {
  return normalizeScIdentityNumber({
    value,
    entityType,
    nationality,
  });
}

function dec(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value);
}

function optionalDec(value: string | number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  return dec(value);
}

function decimalToScIntegerString(value: Prisma.Decimal | null): string | null {
  const raw = decimalToString(value);
  if (!raw) return null;
  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw;
}

function serializeShareCapital(row: {
  id: string;
  ordinary_units: Prisma.Decimal | null;
  ordinary_amount: Prisma.Decimal | null;
  preference_units: Prisma.Decimal | null;
  preference_amount: Prisma.Decimal | null;
  others_units: Prisma.Decimal | null;
  others_amount: Prisma.Decimal | null;
  total_paid_up_capital: Prisma.Decimal | null;
  llp_members_capital_units: Prisma.Decimal | null;
  llp_members_capital_amount: Prisma.Decimal | null;
  llp_members_reserves_units: Prisma.Decimal | null;
  llp_members_reserves_amount: Prisma.Decimal | null;
  llp_subordinated_loans_units: Prisma.Decimal | null;
  llp_subordinated_loans_amount: Prisma.Decimal | null;
  total_llp: Prisma.Decimal | null;
}): OperatorShareCapitalDto {
  return {
    id: row.id,
    ordinaryUnits: decimalToScIntegerString(row.ordinary_units),
    ordinaryAmount: decimalToString(row.ordinary_amount),
    preferenceUnits: decimalToScIntegerString(row.preference_units),
    preferenceAmount: decimalToString(row.preference_amount),
    othersUnits: decimalToScIntegerString(row.others_units),
    othersAmount: decimalToString(row.others_amount),
    totalPaidUpCapital: decimalToScIntegerString(row.total_paid_up_capital),
    llpMembersCapitalUnits: decimalToScIntegerString(row.llp_members_capital_units),
    llpMembersCapitalAmount: decimalToString(row.llp_members_capital_amount),
    llpMembersReservesUnits: decimalToScIntegerString(row.llp_members_reserves_units),
    llpMembersReservesAmount: decimalToString(row.llp_members_reserves_amount),
    llpSubordinatedLoansUnits: decimalToScIntegerString(row.llp_subordinated_loans_units),
    llpSubordinatedLoansAmount: decimalToString(row.llp_subordinated_loans_amount),
    totalLlp: decimalToString(row.total_llp),
  };
}

function serializeShareholder(row: {
  id: string;
  holder_type: OperatorShareholderDto["holderType"];
  entity_type: OperatorShareholderDto["entityType"];
  name: string | null;
  salutation: string | null;
  identity_number: string | null;
  date_of_birth: Date | null;
  date_of_incorporation: Date | null;
  nationality: string | null;
  address: string | null;
  date_acquired: Date | null;
  date_disposal: Date | null;
  share_type: OperatorShareholderDto["shareType"];
  share_type_other: string | null;
  shareholding_units: Prisma.Decimal | null;
  shareholding_amount: Prisma.Decimal | null;
  shareholding_percentage: Prisma.Decimal | null;
}): OperatorShareholderDto {
  return {
    id: row.id,
    holderType: row.holder_type,
    entityType: row.entity_type,
    name: row.name,
    salutation: row.salutation,
    identityNumber: row.identity_number,
    dateOfBirth: toIsoDate(row.date_of_birth),
    dateOfIncorporation: toIsoDate(row.date_of_incorporation),
    nationality: row.nationality,
    address: row.address,
    dateAcquired: toIsoDate(row.date_acquired),
    dateDisposal: toIsoDate(row.date_disposal),
    shareType: row.share_type,
    shareTypeOther: row.share_type_other,
    shareholdingUnits: decimalToString(row.shareholding_units),
    shareholdingAmount: decimalToString(row.shareholding_amount),
    shareholdingPercentage: decimalToString(row.shareholding_percentage),
  };
}

function serializeOfficer(row: {
  id: string;
  person_kind: OperatorOfficerDto["personKind"];
  name: string | null;
  salutation: string | null;
  is_responsible_person: boolean;
  identity_number: string | null;
  date_of_birth: Date | null;
  nationality: string | null;
  address: string | null;
  designation: OperatorOfficerDto["designation"];
  designation_other: string | null;
  appointment_date: Date | null;
  resignation_date: Date | null;
}): OperatorOfficerDto {
  return {
    id: row.id,
    personKind: row.person_kind,
    name: row.name,
    salutation: row.salutation,
    isResponsiblePerson: row.is_responsible_person,
    identityNumber: row.identity_number,
    dateOfBirth: toIsoDate(row.date_of_birth),
    nationality: row.nationality,
    address: row.address,
    designation: row.designation,
    designationOther: row.designation_other,
    appointmentDate: toIsoDate(row.appointment_date),
    resignationDate: toIsoDate(row.resignation_date),
  };
}

function serializeSigningPerson(row: {
  id: string;
  officer_id: string;
  roles: OperatorSigningRole[];
  signing_email: string | null;
  signature_s3_key: string | null;
  signature_file_name: string | null;
  signature_content_type: string | null;
  signature_sha256: string | null;
  signature_width_px: number | null;
  signature_height_px: number | null;
  signature_byte_size: number | null;
  signature_confirmed_at: Date | null;
  active: boolean;
  officer: {
    name: string | null;
    person_kind: OperatorOfficerDto["personKind"];
    designation: OperatorOfficerDto["designation"];
    designation_other: string | null;
    identity_number: string | null;
  };
}): OperatorSigningPersonDto {
  const signature = row.signature_s3_key
    ? {
        s3Key: row.signature_s3_key,
        ...(row.signature_file_name ? { fileName: row.signature_file_name } : {}),
        ...(row.signature_content_type ? { contentType: row.signature_content_type } : {}),
        ...(row.signature_sha256 ? { sha256: row.signature_sha256 } : {}),
        ...(row.signature_width_px != null ? { widthPx: row.signature_width_px } : {}),
        ...(row.signature_height_px != null ? { heightPx: row.signature_height_px } : {}),
        ...(row.signature_byte_size != null ? { byteSize: row.signature_byte_size } : {}),
        ...(row.signature_confirmed_at
          ? { confirmedAt: row.signature_confirmed_at.toISOString() }
          : {}),
      }
    : null;
  const readyInput = {
    active: row.active,
    roles: row.roles,
    signingEmail: row.signing_email,
    signatureS3Key: row.signature_s3_key,
    signatureSha256: row.signature_sha256,
    signatureConfirmedAt: row.signature_confirmed_at?.toISOString() ?? null,
  };
  return {
    id: row.id,
    officerId: row.officer_id,
    personName: row.officer.name,
    personKind: row.officer.person_kind,
    designation: row.officer.designation,
    designationOther: row.officer.designation_other,
    identityNumber: row.officer.identity_number,
    roles: row.roles,
    signingEmail: row.signing_email,
    signature,
    signatureProviderReady: isAutomaticSignerProviderReady(readyInput),
    witnessProviderReady: isAutomaticSignerProviderReady({
      ...readyInput,
      requiredRole: "WITNESS",
    }),
    active: row.active,
  };
}

function serializeDocumentExecutionSlots(
  bindings: Array<{
    role_key: OperatorDocumentExecutionRole;
    slot_index: number;
    signing_person_id: string;
  }>
): OperatorDocumentExecutionSlotDto[] {
  const byKey = new Map(
    bindings.map((row) => [`${row.role_key}:${row.slot_index}`, row] as const)
  );
  return emptyDocumentExecutionSlots().map((slot) => {
    const row = byKey.get(`${slot.roleKey}:${slot.slotIndex}`);
    if (!row) return slot;
    return {
      ...slot,
      signingPersonId: row.signing_person_id,
    };
  });
}

function companyStampFromConfig(value: unknown): OperatorCompanyStampFields | null {
  const config = parseDocumentAuthorisationConfig(value);
  const stamp = config.certificateCompanyStamp;
  if (!stamp?.s3Key) return null;
  return stamp;
}

function serializeAdvisor(row: {
  id: string;
  advisor_type: OperatorAdvisorDto["advisorType"];
  name: string | null;
  registration_number: string | null;
  country: string | null;
  address: string | null;
  appointment_date: Date | null;
  cessation_date: Date | null;
}): OperatorAdvisorDto {
  return {
    id: row.id,
    advisorType: row.advisor_type,
    name: row.name,
    registrationNumber: row.registration_number,
    country: row.country,
    address: row.address,
    appointmentDate: toIsoDate(row.appointment_date),
    cessationDate: toIsoDate(row.cessation_date),
  };
}

function serializeInterest(row: {
  id: string;
  name: string | null;
  registration_number: string | null;
  country: string | null;
  address: string | null;
  acquisition_date: Date | null;
  disposal_date: Date | null;
  share_type: OperatorInterestDto["shareType"];
  share_type_other: string | null;
  shareholding_units: Prisma.Decimal | null;
  shareholding_percentage: Prisma.Decimal | null;
}): OperatorInterestDto {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number,
    country: row.country,
    address: row.address,
    acquisitionDate: toIsoDate(row.acquisition_date),
    disposalDate: toIsoDate(row.disposal_date),
    shareType: row.share_type,
    shareTypeOther: row.share_type_other,
    shareholdingUnits: decimalToString(row.shareholding_units),
    shareholdingPercentage: decimalToString(row.shareholding_percentage),
  };
}

function serializeFinancial(row: {
  id: string;
  consolidated_accounts: boolean | null;
  auditor_name: string | null;
  financial_year_end: Date | null;
  unmodified_reports: boolean | null;
  date_tabled_to_board: Date | null;
  currency: string | null;
  number_of_shares: Prisma.Decimal | null;
  total_assets: Prisma.Decimal | null;
  non_current_assets: Prisma.Decimal | null;
  current_assets: Prisma.Decimal | null;
  total_equity: Prisma.Decimal | null;
  paid_up_capital: Prisma.Decimal | null;
  share_application_account: Prisma.Decimal | null;
  share_premium_and_reserves: Prisma.Decimal | null;
  accumulated_profit_carried_forward: Prisma.Decimal | null;
  equity_minority_interest: Prisma.Decimal | null;
  total_liabilities: Prisma.Decimal | null;
  non_current_liabilities: Prisma.Decimal | null;
  current_liabilities: Prisma.Decimal | null;
  total_revenue: Prisma.Decimal | null;
  revenue_donation: Prisma.Decimal | null;
  revenue_reward: Prisma.Decimal | null;
  revenue_lending: Prisma.Decimal | null;
  revenue_equity: Prisma.Decimal | null;
  revenue_fees: Prisma.Decimal | null;
  revenue_other: Prisma.Decimal | null;
  income_deposit_interest: Prisma.Decimal | null;
  income_other: Prisma.Decimal | null;
  total_cost: Prisma.Decimal | null;
  cost_staff: Prisma.Decimal | null;
  cost_system: Prisma.Decimal | null;
  cost_promotion: Prisma.Decimal | null;
  cost_other: Prisma.Decimal | null;
  profit_before_tax: Prisma.Decimal | null;
  taxation: Prisma.Decimal | null;
  profit_after_tax: Prisma.Decimal | null;
  pnl_minority_interest: Prisma.Decimal | null;
  net_dividend: Prisma.Decimal | null;
}): OperatorFinancialStatementDto {
  return {
    id: row.id,
    consolidatedAccounts: row.consolidated_accounts,
    auditorName: row.auditor_name,
    financialYearEnd: toIsoDate(row.financial_year_end),
    unmodifiedReports: row.unmodified_reports,
    dateTabledToBoard: toIsoDate(row.date_tabled_to_board),
    currency: row.currency,
    numberOfShares: decimalToString(row.number_of_shares),
    totalAssets: decimalToString(row.total_assets),
    nonCurrentAssets: decimalToString(row.non_current_assets),
    currentAssets: decimalToString(row.current_assets),
    totalEquity: decimalToString(row.total_equity),
    paidUpCapital: decimalToString(row.paid_up_capital),
    shareApplicationAccount: decimalToString(row.share_application_account),
    sharePremiumAndReserves: decimalToString(row.share_premium_and_reserves),
    accumulatedProfitCarriedForward: decimalToString(row.accumulated_profit_carried_forward),
    equityMinorityInterest: decimalToString(row.equity_minority_interest),
    totalLiabilities: decimalToString(row.total_liabilities),
    nonCurrentLiabilities: decimalToString(row.non_current_liabilities),
    currentLiabilities: decimalToString(row.current_liabilities),
    totalRevenue: decimalToString(row.total_revenue),
    revenueDonation: decimalToString(row.revenue_donation),
    revenueReward: decimalToString(row.revenue_reward),
    revenueLending: decimalToString(row.revenue_lending),
    revenueEquity: decimalToString(row.revenue_equity),
    revenueFees: decimalToString(row.revenue_fees),
    revenueOther: decimalToString(row.revenue_other),
    incomeDepositInterest: decimalToString(row.income_deposit_interest),
    incomeOther: decimalToString(row.income_other),
    totalCost: decimalToString(row.total_cost),
    costStaff: decimalToString(row.cost_staff),
    costSystem: decimalToString(row.cost_system),
    costPromotion: decimalToString(row.cost_promotion),
    costOther: decimalToString(row.cost_other),
    profitBeforeTax: decimalToString(row.profit_before_tax),
    taxation: decimalToString(row.taxation),
    profitAfterTax: decimalToString(row.profit_after_tax),
    pnlMinorityInterest: decimalToString(row.pnl_minority_interest),
    netDividend: decimalToString(row.net_dividend),
  };
}

export async function getOrCreateOperatorProfile(): Promise<OperatorProfileDto> {
  const existing = await prisma.operatorProfile.findUnique({
    where: { singleton_key: SINGLETON },
    include: PROFILE_INCLUDE,
  });
  const row =
    existing ??
    (await prisma.operatorProfile.create({
      data: { singleton_key: SINGLETON },
      include: PROFILE_INCLUDE,
    }));
  const finance = await prisma.platformFinanceSetting.findUnique({
    where: { key: "DEFAULT" },
    select: { document_authorisation_config: true },
  });
  return {
    id: row.id,
    singletonKey: row.singleton_key,
    name: row.name,
    registrationNumber: row.registration_number,
    trusteeRegistrationNumber: row.trustee_registration_number,
    scCompanyType: row.sc_company_type,
    responsiblePersonName: row.responsible_person_name,
    responsiblePersonPhone: row.responsible_person_phone,
    shareCapital: row.share_capital ? serializeShareCapital(row.share_capital) : null,
    shareholders: row.shareholders.map(serializeShareholder),
    officers: row.officers.map(serializeOfficer),
    advisors: row.advisors.map(serializeAdvisor),
    interests: row.interests.map(serializeInterest),
    financialStatements: row.financial_statements.map(serializeFinancial),
    signingPeople: row.signing_people.map(serializeSigningPerson),
    documentExecutionSlots: serializeDocumentExecutionSlots(row.document_execution_bindings),
    companyStamp: companyStampFromConfig(finance?.document_authorisation_config),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function patchOperatorProfile(input: {
  name?: string | null;
  registrationNumber?: string | null;
  trusteeRegistrationNumber?: string | null;
  scCompanyType?: ScCompanyType | null;
  responsiblePersonName?: string | null;
  responsiblePersonPhone?: string | null;
}): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorProfile.update({
    where: { id: current.id },
    data: {
      name: input.name === undefined ? undefined : input.name,
      registration_number:
        input.registrationNumber === undefined
          ? undefined
          : normalizeScRegistrationNumber(input.registrationNumber),
      trustee_registration_number:
        input.trusteeRegistrationNumber === undefined
          ? undefined
          : normalizeScRegistrationNumber(input.trusteeRegistrationNumber),
      sc_company_type: input.scCompanyType === undefined ? undefined : input.scCompanyType,
      responsible_person_name:
        input.responsiblePersonName === undefined ? undefined : input.responsiblePersonName,
      responsible_person_phone:
        input.responsiblePersonPhone === undefined ? undefined : input.responsiblePersonPhone,
    },
  });
  return getOrCreateOperatorProfile();
}

export async function upsertShareCapital(
  input: OperatorShareCapitalInput
): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  const data = {
    ordinary_units: optionalDec(input.ordinaryUnits),
    ordinary_amount: optionalDec(input.ordinaryAmount),
    preference_units: optionalDec(input.preferenceUnits),
    preference_amount: optionalDec(input.preferenceAmount),
    others_units: optionalDec(input.othersUnits),
    others_amount: optionalDec(input.othersAmount),
    total_paid_up_capital: optionalDec(input.totalPaidUpCapital),
    llp_members_capital_units: optionalDec(input.llpMembersCapitalUnits),
    llp_members_capital_amount: optionalDec(input.llpMembersCapitalAmount),
    llp_members_reserves_units: optionalDec(input.llpMembersReservesUnits),
    llp_members_reserves_amount: optionalDec(input.llpMembersReservesAmount),
    llp_subordinated_loans_units: optionalDec(input.llpSubordinatedLoansUnits),
    llp_subordinated_loans_amount: optionalDec(input.llpSubordinatedLoansAmount),
    total_llp: optionalDec(input.totalLlp),
  };
  await prisma.operatorShareCapital.upsert({
    where: { operator_profile_id: current.id },
    create: { operator_profile_id: current.id, ...data },
    update: data,
  });
  return getOrCreateOperatorProfile();
}

export async function createShareholder(input: OperatorShareholderInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorShareholder.create({
    data: {
      operator_profile_id: current.id,
      holder_type: input.holderType,
      entity_type: input.entityType,
      name: input.name ?? null,
      salutation: input.salutation ?? null,
      identity_number: holderIdentityNumber(input.entityType, input.identityNumber, input.nationality),
      date_of_birth: parseDateInput(input.dateOfBirth),
      date_of_incorporation: parseDateInput(input.dateOfIncorporation),
      nationality: input.nationality ?? null,
      address: input.address ?? null,
      date_acquired: parseDateInput(input.dateAcquired),
      date_disposal: parseDateInput(input.dateDisposal),
      share_type: input.shareType ?? null,
      share_type_other: input.shareTypeOther ?? null,
      shareholding_units: dec(input.shareholdingUnits),
      shareholding_amount: dec(input.shareholdingAmount),
      shareholding_percentage: dec(input.shareholdingPercentage),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function updateShareholder(
  id: string,
  input: Parameters<typeof createShareholder>[0]
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorShareholder.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Shareholder not found");
  await prisma.operatorShareholder.update({
    where: { id },
    data: {
      holder_type: input.holderType,
      entity_type: input.entityType,
      name: input.name ?? null,
      salutation: input.salutation ?? null,
      identity_number: holderIdentityNumber(input.entityType, input.identityNumber, input.nationality),
      date_of_birth: parseDateInput(input.dateOfBirth),
      date_of_incorporation: parseDateInput(input.dateOfIncorporation),
      nationality: input.nationality ?? null,
      address: input.address ?? null,
      date_acquired: parseDateInput(input.dateAcquired),
      date_disposal: parseDateInput(input.dateDisposal),
      share_type: input.shareType ?? null,
      share_type_other: input.shareTypeOther ?? null,
      shareholding_units: dec(input.shareholdingUnits),
      shareholding_amount: dec(input.shareholdingAmount),
      shareholding_percentage: dec(input.shareholdingPercentage),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function deleteShareholder(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorShareholder.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Shareholder not found");
  });
  return getOrCreateOperatorProfile();
}

export async function createOfficer(input: OperatorOfficerInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorOfficer.create({
    data: {
      operator_profile_id: current.id,
      person_kind: input.personKind,
      name: input.name ?? null,
      salutation: input.salutation ?? null,
      is_responsible_person: input.isResponsiblePerson ?? false,
      identity_number: normalizeScIdentityNumber({
        value: input.identityNumber,
        entityType: "INDIVIDUAL",
        nationality: input.nationality,
      }),
      date_of_birth: parseDateInput(input.dateOfBirth),
      nationality: input.nationality ?? null,
      address: input.address ?? null,
      designation: input.designation ?? null,
      designation_other: input.designationOther ?? null,
      appointment_date: parseDateInput(input.appointmentDate),
      resignation_date: parseDateInput(input.resignationDate),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function updateOfficer(
  id: string,
  input: Parameters<typeof createOfficer>[0]
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorOfficer.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Officer not found");
  await prisma.operatorOfficer.update({
    where: { id },
    data: {
      person_kind: input.personKind,
      name: input.name ?? null,
      salutation: input.salutation ?? null,
      is_responsible_person: input.isResponsiblePerson ?? false,
      identity_number: normalizeScIdentityNumber({
        value: input.identityNumber,
        entityType: "INDIVIDUAL",
        nationality: input.nationality,
      }),
      date_of_birth: parseDateInput(input.dateOfBirth),
      nationality: input.nationality ?? null,
      address: input.address ?? null,
      designation: input.designation ?? null,
      designation_other: input.designationOther ?? null,
      appointment_date: parseDateInput(input.appointmentDate),
      resignation_date: parseDateInput(input.resignationDate),
    },
  });
  await syncLegacyAuthorisedSignatoryName();
  return getOrCreateOperatorProfile();
}

export async function deleteOfficer(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorOfficer.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Officer not found");
  });
  await syncLegacyAuthorisedSignatoryName();
  return getOrCreateOperatorProfile();
}

export async function createAdvisor(input: OperatorAdvisorInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorAdvisor.create({
    data: {
      operator_profile_id: current.id,
      advisor_type: input.advisorType,
      name: input.name ?? null,
      registration_number: normalizeScRegistrationNumber(input.registrationNumber),
      country: input.country ?? null,
      address: input.address ?? null,
      appointment_date: parseDateInput(input.appointmentDate),
      cessation_date: parseDateInput(input.cessationDate),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function updateAdvisor(
  id: string,
  input: Parameters<typeof createAdvisor>[0]
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorAdvisor.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Advisor not found");
  await prisma.operatorAdvisor.update({
    where: { id },
    data: {
      advisor_type: input.advisorType,
      name: input.name ?? null,
      registration_number: normalizeScRegistrationNumber(input.registrationNumber),
      country: input.country ?? null,
      address: input.address ?? null,
      appointment_date: parseDateInput(input.appointmentDate),
      cessation_date: parseDateInput(input.cessationDate),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function deleteAdvisor(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorAdvisor.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Advisor not found");
  });
  return getOrCreateOperatorProfile();
}

export async function createInterest(input: OperatorInterestInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorInterest.create({
    data: {
      operator_profile_id: current.id,
      name: input.name ?? null,
      registration_number: normalizeScRegistrationNumber(input.registrationNumber),
      country: input.country ?? null,
      address: input.address ?? null,
      acquisition_date: parseDateInput(input.acquisitionDate),
      disposal_date: parseDateInput(input.disposalDate),
      share_type: input.shareType ?? null,
      share_type_other: input.shareTypeOther ?? null,
      shareholding_units: dec(input.shareholdingUnits),
      shareholding_percentage: dec(input.shareholdingPercentage),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function updateInterest(
  id: string,
  input: Parameters<typeof createInterest>[0]
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorInterest.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Interest not found");
  await prisma.operatorInterest.update({
    where: { id },
    data: {
      name: input.name ?? null,
      registration_number: normalizeScRegistrationNumber(input.registrationNumber),
      country: input.country ?? null,
      address: input.address ?? null,
      acquisition_date: parseDateInput(input.acquisitionDate),
      disposal_date: parseDateInput(input.disposalDate),
      share_type: input.shareType ?? null,
      share_type_other: input.shareTypeOther ?? null,
      shareholding_units: dec(input.shareholdingUnits),
      shareholding_percentage: dec(input.shareholdingPercentage),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function deleteInterest(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorInterest.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Interest not found");
  });
  return getOrCreateOperatorProfile();
}

type FinancialInput = OperatorFinancialStatementInput;

function financialData(input: FinancialInput) {
  return {
    consolidated_accounts:
      typeof input.consolidatedAccounts === "boolean" ? input.consolidatedAccounts : null,
    auditor_name: input.auditorName ?? null,
    financial_year_end: parseDateInput(input.financialYearEnd),
    unmodified_reports: typeof input.unmodifiedReports === "boolean" ? input.unmodifiedReports : null,
    date_tabled_to_board: parseDateInput(input.dateTabledToBoard),
    currency: input.currency ?? null,
    number_of_shares: dec(input.numberOfShares),
    total_assets: dec(input.totalAssets),
    non_current_assets: dec(input.nonCurrentAssets),
    current_assets: dec(input.currentAssets),
    total_equity: dec(input.totalEquity),
    paid_up_capital: dec(input.paidUpCapital),
    share_application_account: dec(input.shareApplicationAccount),
    share_premium_and_reserves: dec(input.sharePremiumAndReserves),
    accumulated_profit_carried_forward: dec(input.accumulatedProfitCarriedForward),
    equity_minority_interest: dec(input.equityMinorityInterest),
    total_liabilities: dec(input.totalLiabilities),
    non_current_liabilities: dec(input.nonCurrentLiabilities),
    current_liabilities: dec(input.currentLiabilities),
    total_revenue: dec(input.totalRevenue),
    revenue_donation: dec(input.revenueDonation),
    revenue_reward: dec(input.revenueReward),
    revenue_lending: dec(input.revenueLending),
    revenue_equity: dec(input.revenueEquity),
    revenue_fees: dec(input.revenueFees),
    revenue_other: dec(input.revenueOther),
    income_deposit_interest: dec(input.incomeDepositInterest),
    income_other: dec(input.incomeOther),
    total_cost: dec(input.totalCost),
    cost_staff: dec(input.costStaff),
    cost_system: dec(input.costSystem),
    cost_promotion: dec(input.costPromotion),
    cost_other: dec(input.costOther),
    profit_before_tax: dec(input.profitBeforeTax),
    taxation: dec(input.taxation),
    profit_after_tax: dec(input.profitAfterTax),
    pnl_minority_interest: dec(input.pnlMinorityInterest),
    net_dividend: dec(input.netDividend),
  };
}

export async function createFinancialStatement(input: FinancialInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorFinancialStatement.create({
    data: { operator_profile_id: current.id, ...financialData(input) },
  });
  return getOrCreateOperatorProfile();
}

export async function updateFinancialStatement(
  id: string,
  input: FinancialInput
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorFinancialStatement.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Financial statement not found");
  await prisma.operatorFinancialStatement.update({
    where: { id },
    data: financialData(input),
  });
  return getOrCreateOperatorProfile();
}

export async function deleteFinancialStatement(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorFinancialStatement.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Financial statement not found");
  });
  return getOrCreateOperatorProfile();
}

function imageExtensionForContentType(contentType: string): string {
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

async function patchDocumentAuthorisationConfig(patch: {
  authorisedSignatoryName?: string;
  certificateCompanyStamp?: OperatorCompanyStampFields;
}): Promise<void> {
  const existing = await prisma.platformFinanceSetting.findUnique({
    where: { key: "DEFAULT" },
    select: { document_authorisation_config: true },
  });
  const current = parseDocumentAuthorisationConfig(existing?.document_authorisation_config);
  const next = {
    authorisedSignatoryName:
      patch.authorisedSignatoryName !== undefined
        ? patch.authorisedSignatoryName
        : current.authorisedSignatoryName,
    useSameCompanyStamp: current.useSameCompanyStamp,
    certificateCompanyStamp: patch.certificateCompanyStamp ?? current.certificateCompanyStamp,
    receiptCompanyStamp: current.receiptCompanyStamp,
  };
  await prisma.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    create: {
      key: "DEFAULT",
      document_authorisation_config: next as Prisma.InputJsonValue,
    },
    update: {
      document_authorisation_config: next as Prisma.InputJsonValue,
    },
  });
}

async function syncLegacyAuthorisedSignatoryName(): Promise<void> {
  const people = await prisma.operatorSigningPerson.findMany({
    include: { officer: true },
    orderBy: { created_at: "asc" },
  });
  const name = legacyAuthorisedSignatoryNameFromSigningPeople(
    people.map((row) => ({
      active: row.active,
      roles: row.roles as OperatorSigningRole[],
      personName: row.officer.name,
    }))
  );
  if (!name) return;
  await patchDocumentAuthorisationConfig({ authorisedSignatoryName: name });
}

function uniqueConstraintTarget(error: unknown): string {
  if (!error || typeof error !== "object" || !("meta" in error)) return "";
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (typeof target === "string") return target;
  if (Array.isArray(target)) return target.map(String).join(",");
  return "";
}

export function rethrowSigningPersonUniqueConflict(error: unknown): never {
  const isUnique =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002";
  if (!isUnique) throw error;
  if (uniqueConstraintTarget(error).includes("signing_email")) {
    throw new AppError(
      409,
      "SIGNING_EMAIL_TAKEN",
      "This signing email is already used by another person"
    );
  }
  throw new AppError(
    409,
    "SIGNING_PERSON_EXISTS",
    "This person already has a signing configuration"
  );
}

function signatureData(signature: OperatorSigningPersonCreateInput["signature"]): {
  signature_s3_key: string | null;
  signature_file_name: string | null;
  signature_content_type: string | null;
  signature_sha256: string | null;
  signature_width_px: number | null;
  signature_height_px: number | null;
  signature_byte_size: number | null;
  signature_confirmed_at: Date | null;
} {
  if (!signature?.s3Key) {
    return {
      signature_s3_key: null,
      signature_file_name: null,
      signature_content_type: null,
      signature_sha256: null,
      signature_width_px: null,
      signature_height_px: null,
      signature_byte_size: null,
      signature_confirmed_at: null,
    };
  }
  assertOperatorSignatureS3Key(signature.s3Key);
  return {
    signature_s3_key: signature.s3Key,
    signature_file_name: signature.fileName ?? null,
    signature_content_type: signature.contentType ?? null,
    signature_sha256: null,
    signature_width_px: null,
    signature_height_px: null,
    signature_byte_size: null,
    signature_confirmed_at: null,
  };
}

export async function createSigningPerson(
  input: OperatorSigningPersonCreateInput
): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  const officer = await prisma.operatorOfficer.findFirst({
    where: { id: input.officerId, operator_profile_id: current.id },
  });
  if (!officer) throw new AppError(404, "NOT_FOUND", "Shoraka person not found");
  try {
    await prisma.operatorSigningPerson.create({
      data: {
        operator_profile_id: current.id,
        officer_id: officer.id,
        roles: input.roles,
        signing_email: input.signingEmail ?? null,
        active: input.active ?? true,
        ...signatureData(input.signature),
      },
    });
  } catch (error) {
    rethrowSigningPersonUniqueConflict(error);
  }
  await syncLegacyAuthorisedSignatoryName();
  return getOrCreateOperatorProfile();
}

export async function updateSigningPerson(
  id: string,
  input: OperatorSigningPersonUpdateInput
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorSigningPerson.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Signing person not found");
  const signaturePatch =
    input.signature === undefined
      ? {}
      : input.signature?.s3Key
        ? signatureData(input.signature)
        : {
            signature_s3_key: null,
            signature_file_name: null,
            signature_content_type: null,
            signature_sha256: null,
            signature_width_px: null,
            signature_height_px: null,
            signature_byte_size: null,
            signature_confirmed_at: null,
          };
  try {
    await prisma.operatorSigningPerson.update({
      where: { id },
      data: {
        ...(input.roles ? { roles: input.roles } : {}),
        ...(input.signingEmail === undefined ? {} : { signing_email: input.signingEmail }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...signaturePatch,
      },
    });
  } catch (error) {
    rethrowSigningPersonUniqueConflict(error);
  }
  await syncLegacyAuthorisedSignatoryName();
  return getOrCreateOperatorProfile();
}

export async function confirmSigningSignatureObject(
  s3Key: string
): Promise<ConfirmedOperatorSignature> {
  return confirmOperatorSignatureObject(s3Key);
}

export async function confirmSigningPersonSignature(
  id: string,
  s3Key: string
): Promise<OperatorProfileDto> {
  const row = await prisma.operatorSigningPerson.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Signing person not found");
  if (!row.signature_s3_key) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Upload a signature for this person before confirming it"
    );
  }
  if (s3Key !== row.signature_s3_key) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Confirm the signature that is currently stored for this person"
    );
  }
  const confirmed = await confirmOperatorSignatureObject(s3Key);
  await prisma.operatorSigningPerson.update({
    where: { id },
    data: {
      signature_sha256: confirmed.sha256,
      signature_width_px: confirmed.widthPx,
      signature_height_px: confirmed.heightPx,
      signature_byte_size: confirmed.byteSize,
      signature_content_type: confirmed.contentType,
      signature_confirmed_at: new Date(confirmed.confirmedAt),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function getSigningPersonSignaturePreview(
  id: string
): Promise<{ viewUrl: string; expiresIn: number } | { viewUrl: null; expiresIn: null }> {
  const row = await prisma.operatorSigningPerson.findUnique({
    where: { id },
    select: { signature_s3_key: true },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Signing person not found");
  const key = row.signature_s3_key?.trim();
  if (!key) return { viewUrl: null, expiresIn: null };
  const data = await generatePresignedViewUrl({ key });
  return { viewUrl: data.viewUrl, expiresIn: data.expiresIn };
}

type BindingPerson = {
  id: string;
  active: boolean;
  roles: OperatorSigningRole[];
  signing_email: string | null;
  signature_s3_key: string | null;
  signature_sha256: string | null;
  signature_confirmed_at: Date | null;
  officerName: string | null;
  designation: string | null;
  identityNumber: string | null;
};

export function assertEligibleDocumentExecutionPerson(
  person: BindingPerson | undefined,
  requiredRole: "AUTHORISED_SIGNATORY" | "WITNESS" = "AUTHORISED_SIGNATORY"
): asserts person is BindingPerson {
  if (!person) throw new AppError(404, "NOT_FOUND", "Signing person not found");
  if (!person.active || !person.roles.includes(requiredRole)) {
    const needed =
      requiredRole === "WITNESS" ? "an active Witness" : "an active Authorised Signatory";
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      person.active
        ? requiredRole === "WITNESS"
          ? "Authorised Signatories cannot be assigned to witness roles unless they are also a Witness"
          : "Witness-only people cannot be assigned to authorised representative roles"
        : `Assign ${needed}`
    );
  }
  if (
    !isAutomaticSignerProviderReady({
      active: person.active,
      roles: person.roles,
      signingEmail: person.signing_email,
      signatureS3Key: person.signature_s3_key,
      signatureSha256: person.signature_sha256,
      signatureConfirmedAt: person.signature_confirmed_at?.toISOString() ?? null,
      requiredRole,
    })
  ) {
    throw new AppError(
      400,
      "SIGNING_AUTOMATIC_SIGNER_NOT_READY",
      requiredRole === "WITNESS"
        ? "Assign a Witness with a signing email and confirmed signature"
        : "Assign an Authorised Signatory with a signing email and confirmed signature"
    );
  }
}

export function buildDocumentExecutionBindingRows(input: {
  operatorProfileId: string;
  bindings: OperatorDocumentExecutionBindingsPutInput["bindings"];
  people: BindingPerson[];
}): Array<{
  operator_profile_id: string;
  role_key: OperatorDocumentExecutionRole;
  slot_index: number;
  signing_person_id: string;
}> {
  const byId = new Map(input.people.map((person) => [person.id, person]));
  const rows: Array<{
    operator_profile_id: string;
    role_key: OperatorDocumentExecutionRole;
    slot_index: number;
    signing_person_id: string;
  }> = [];
  const byRole = new Map<
    OperatorDocumentExecutionRole,
    Array<(typeof input.bindings)[number]>
  >();
  for (const binding of input.bindings) {
    const list = byRole.get(binding.roleKey) ?? [];
    list.push(binding);
    byRole.set(binding.roleKey, list);
  }
  for (const [roleKey, group] of byRole) {
    if (!isOperatorDocumentRepresentativeRole(roleKey)) continue;
    const bound = group.filter((row) => Boolean(row.signingPersonId));
    if (bound.length === 1) {
      throw new AppError(
        400,
        "SIGNING_AUTOMATIC_ROLE_UNBOUND",
        `${OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey]} needs both representatives before it can be saved.`
      );
    }
  }
  for (const binding of input.bindings) {
    if (!binding.signingPersonId) continue;
    const person = byId.get(binding.signingPersonId);
    assertEligibleDocumentExecutionPerson(person, executionRoleSigningRole(binding.roleKey));
    rows.push({
      operator_profile_id: input.operatorProfileId,
      role_key: binding.roleKey,
      slot_index: binding.slotIndex,
      signing_person_id: person.id,
    });
  }
  const issues = documentExecutionBindingIssues({
    requiredSlots: input.bindings
      .filter((row) => Boolean(row.signingPersonId))
      .map((row) => ({ roleKey: row.roleKey, slotIndex: row.slotIndex })),
    bindings: input.bindings.map((row) => {
      const person = row.signingPersonId ? byId.get(row.signingPersonId) : undefined;
      return {
        roleKey: row.roleKey,
        slotIndex: row.slotIndex,
        signingPersonId: row.signingPersonId,
        signingEmail: person?.signing_email ?? null,
        officerName: person?.officerName ?? null,
        designation: person?.designation ?? null,
        identityNumber: person?.identityNumber ?? null,
        providerReady: person
          ? isAutomaticSignerProviderReady({
              active: person.active,
              roles: person.roles,
              signingEmail: person.signing_email,
              signatureS3Key: person.signature_s3_key,
              signatureSha256: person.signature_sha256,
              signatureConfirmedAt: person.signature_confirmed_at?.toISOString() ?? null,
              requiredRole: executionRoleSigningRole(row.roleKey),
            })
          : false,
      };
    }),
  });
  const blocking = issues.find(
    (issue) =>
      issue.code === "DOCUMENT_EXECUTION_DUPLICATE_SIGNER" ||
      issue.code === "DOCUMENT_EXECUTION_EMAIL_COLLISION" ||
      issue.code === "SIGNING_AUTOMATIC_SIGNER_NOT_READY" ||
      issue.code === "SIGNING_AUTOMATIC_IDENTITY_MISSING"
  );
  if (blocking) {
    throw new AppError(400, blocking.code, blocking.message);
  }
  return rows;
}

export async function putDocumentExecutionBindings(
  input: OperatorDocumentExecutionBindingsPutInput
): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  const people = await prisma.operatorSigningPerson.findMany({
    where: { operator_profile_id: current.id },
    select: {
      id: true,
      active: true,
      roles: true,
      signing_email: true,
      signature_s3_key: true,
      signature_sha256: true,
      signature_confirmed_at: true,
      officer: {
        select: {
          name: true,
          designation: true,
          designation_other: true,
          identity_number: true,
        },
      },
    },
  });
  const rows = buildDocumentExecutionBindingRows({
    operatorProfileId: current.id,
    bindings: input.bindings,
    people: people.map((person) => ({
      id: person.id,
      active: person.active,
      roles: person.roles,
      signing_email: person.signing_email,
      signature_s3_key: person.signature_s3_key,
      signature_sha256: person.signature_sha256,
      signature_confirmed_at: person.signature_confirmed_at,
      officerName: person.officer.name,
      designation:
        person.officer.designation === "OTHERS"
          ? person.officer.designation_other
          : person.officer.designation,
      identityNumber: person.officer.identity_number,
    })),
  });
  await prisma.$transaction(async (tx) => {
    await tx.operatorDocumentExecutionBinding.deleteMany({
      where: { operator_profile_id: current.id },
    });
    if (rows.length > 0) {
      await tx.operatorDocumentExecutionBinding.createMany({ data: rows });
    }
  });
  return getOrCreateOperatorProfile();
}

export async function patchOperatorCompanyStamp(
  input: OperatorCompanyStampPatchInput
): Promise<OperatorProfileDto> {
  await patchDocumentAuthorisationConfig({
    certificateCompanyStamp: {
      s3Key: input.s3Key,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.contentType ? { contentType: input.contentType } : {}),
    },
  });
  return getOrCreateOperatorProfile();
}

export async function requestOperatorSigningImageUploadUrl(input: {
  fileName: string;
  contentType: string;
  fileSize: number;
  kind: "signature" | "company_stamp";
}): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
  const extension = imageExtensionForContentType(input.contentType);
  const date = new Date().toISOString().split("T")[0];
  if (input.kind === "signature") {
    assertOperatorSignatureUploadDeclared(input.contentType, input.fileSize);
  }
  const folder =
    input.kind === "company_stamp"
      ? "platform-finance/document-stamps/certificate"
      : OPERATOR_SIGNING_SIGNATURE_S3_PREFIX;
  const key = `${folder}/v1-${date}-${randomUUID()}.${extension}`;
  const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
    key,
    contentType: input.contentType,
    contentLength: input.fileSize,
  });
  return { uploadUrl, s3Key, expiresIn };
}
