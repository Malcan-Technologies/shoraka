import { Prisma } from "@prisma/client";
import type {
  OperatorAdvisorDto,
  OperatorFinancialStatementDto,
  OperatorInterestDto,
  OperatorOfficerDto,
  OperatorProfileDto,
  OperatorShareCapitalDto,
  OperatorShareholderDto,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { decimalToString, parseDateInput, toIsoDate } from "../organization-profile/serialize";
import type {
  OperatorAdvisorInput,
  OperatorFinancialStatementInput,
  OperatorInterestInput,
  OperatorOfficerInput,
  OperatorShareCapitalInput,
  OperatorShareholderInput,
} from "../organization-profile/schemas";

const SINGLETON = "cashsouk";

function dec(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value);
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
    ordinaryUnits: decimalToString(row.ordinary_units),
    ordinaryAmount: decimalToString(row.ordinary_amount),
    preferenceUnits: decimalToString(row.preference_units),
    preferenceAmount: decimalToString(row.preference_amount),
    othersUnits: decimalToString(row.others_units),
    othersAmount: decimalToString(row.others_amount),
    totalPaidUpCapital: decimalToString(row.total_paid_up_capital),
    llpMembersCapitalUnits: decimalToString(row.llp_members_capital_units),
    llpMembersCapitalAmount: decimalToString(row.llp_members_capital_amount),
    llpMembersReservesUnits: decimalToString(row.llp_members_reserves_units),
    llpMembersReservesAmount: decimalToString(row.llp_members_reserves_amount),
    llpSubordinatedLoansUnits: decimalToString(row.llp_subordinated_loans_units),
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
    include: {
      share_capital: true,
      shareholders: { orderBy: { created_at: "asc" } },
      officers: { orderBy: { created_at: "asc" } },
      advisors: { orderBy: { created_at: "asc" } },
      interests: { orderBy: { created_at: "asc" } },
      financial_statements: { orderBy: { financial_year_end: "desc" } },
    },
  });
  const row =
    existing ??
    (await prisma.operatorProfile.create({
      data: { singleton_key: SINGLETON },
      include: {
        share_capital: true,
        shareholders: true,
        officers: true,
        advisors: true,
        interests: true,
        financial_statements: true,
      },
    }));
  return {
    id: row.id,
    singletonKey: row.singleton_key,
    name: row.name,
    registrationNumber: row.registration_number,
    trusteeRegistrationNumber: row.trustee_registration_number,
    responsiblePersonName: row.responsible_person_name,
    responsiblePersonPhone: row.responsible_person_phone,
    shareCapital: row.share_capital ? serializeShareCapital(row.share_capital) : null,
    shareholders: row.shareholders.map(serializeShareholder),
    officers: row.officers.map(serializeOfficer),
    advisors: row.advisors.map(serializeAdvisor),
    interests: row.interests.map(serializeInterest),
    financialStatements: row.financial_statements.map(serializeFinancial),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function patchOperatorProfile(input: {
  name?: string | null;
  registrationNumber?: string | null;
  trusteeRegistrationNumber?: string | null;
  responsiblePersonName?: string | null;
  responsiblePersonPhone?: string | null;
}): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorProfile.update({
    where: { id: current.id },
    data: {
      name: input.name === undefined ? undefined : input.name,
      registration_number: input.registrationNumber === undefined ? undefined : input.registrationNumber,
      trustee_registration_number:
        input.trusteeRegistrationNumber === undefined ? undefined : input.trusteeRegistrationNumber,
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
    ordinary_units: dec(input.ordinaryUnits),
    ordinary_amount: dec(input.ordinaryAmount),
    preference_units: dec(input.preferenceUnits),
    preference_amount: dec(input.preferenceAmount),
    others_units: dec(input.othersUnits),
    others_amount: dec(input.othersAmount),
    total_paid_up_capital: dec(input.totalPaidUpCapital),
    llp_members_capital_units: dec(input.llpMembersCapitalUnits),
    llp_members_capital_amount: dec(input.llpMembersCapitalAmount),
    llp_members_reserves_units: dec(input.llpMembersReservesUnits),
    llp_members_reserves_amount: dec(input.llpMembersReservesAmount),
    llp_subordinated_loans_units: dec(input.llpSubordinatedLoansUnits),
    llp_subordinated_loans_amount: dec(input.llpSubordinatedLoansAmount),
    total_llp: dec(input.totalLlp),
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
      identity_number: input.identityNumber ?? null,
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
      identity_number: input.identityNumber ?? null,
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
      identity_number: input.identityNumber ?? null,
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
      identity_number: input.identityNumber ?? null,
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

export async function deleteOfficer(id: string): Promise<OperatorProfileDto> {
  await prisma.operatorOfficer.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Officer not found");
  });
  return getOrCreateOperatorProfile();
}

export async function createAdvisor(input: OperatorAdvisorInput): Promise<OperatorProfileDto> {
  const current = await getOrCreateOperatorProfile();
  await prisma.operatorAdvisor.create({
    data: {
      operator_profile_id: current.id,
      advisor_type: input.advisorType,
      name: input.name ?? null,
      registration_number: input.registrationNumber ?? null,
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
      registration_number: input.registrationNumber ?? null,
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
      registration_number: input.registrationNumber ?? null,
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
      registration_number: input.registrationNumber ?? null,
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
