import { z } from "zod";
import {
  OPERATOR_ADVISOR_TYPES,
  OPERATOR_HOLDER_TYPES,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  SC_COMPANY_CATEGORIES,
  SC_COMPANY_TYPES,
  SC_DESIGNATIONS,
  SC_GENDERS,
  SC_IDENTITY_PREFIXES,
  SC_INVESTOR_CATEGORIES,
  SC_PERSON_KINDS,
  SC_SHARE_TYPES,
} from "@cashsouk/types";

const optionalText = z.string().max(500).optional().nullable();
const optionalDate = z.string().optional().nullable();
const optionalDecimal = z.union([z.string(), z.number()]).optional().nullable();

export const portalParamSchema = z.enum(["issuer", "investor"]);

export const addressPatchSchema = z
  .object({
    line1: optionalText,
    line2: optionalText,
    city: optionalText,
    postalCode: optionalText,
    state: optionalText,
    country: optionalText,
  })
  .strict();

export const orgMasterPatchSchema = z
  .object({
    dateOfIncorporation: optionalDate,
    dateOfCommencement: optionalDate,
    countryOfIncorporation: optionalText,
    scCompanyType: z.enum(SC_COMPANY_TYPES).optional().nullable(),
    companyCategory: z.enum(SC_COMPANY_CATEGORIES).optional().nullable(),
    companyEmail: z.union([z.string().email().max(255), z.literal(""), z.null()]).optional(),
    scInvestorCategory: z.enum(SC_INVESTOR_CATEGORIES).optional().nullable(),
    residentialAddress: addressPatchSchema.optional().nullable(),
    phoneNumber: optionalText,
    name: optionalText,
    gender: z.enum(SC_GENDERS).optional().nullable(),
    nationality: optionalText,
    registeredAddress: addressPatchSchema.optional().nullable(),
    businessAddress: addressPatchSchema.optional().nullable(),
    companyActivities: z.string().max(2000).optional().nullable(),
  })
  .strict();

export const partyPatchSchema = z
  .object({
    name: optionalText,
    salutation: optionalText,
    identityPrefix: z.enum(SC_IDENTITY_PREFIXES).optional().nullable(),
    identityNumber: optionalText,
    dateOfBirth: optionalDate,
    dateOfIncorporation: optionalDate,
    gender: z.enum(SC_GENDERS).optional().nullable(),
    nationality: optionalText,
    countryOfIncorporation: optionalText,
    address: addressPatchSchema.optional().nullable(),
    isDirector: z.boolean().optional(),
    isShareholder: z.boolean().optional(),
    isBoard: z.boolean().optional(),
    isManagement: z.boolean().optional(),
    personKind: z.enum(SC_PERSON_KINDS).optional().nullable(),
    shareType: z.enum(SC_SHARE_TYPES).optional().nullable(),
    shareTypeOther: optionalText,
    shareholdingUnits: optionalDecimal,
    shareholdingAmount: optionalDecimal,
    shareholdingPercentage: optionalDecimal,
    designation: z.enum(SC_DESIGNATIONS).optional().nullable(),
    designationOther: optionalText,
    appointmentDate: optionalDate,
    resignationDate: optionalDate,
  })
  .strict();

export const mismatchResolveSchema = z
  .object({
    action: z.enum(["KEEP", "USE_EXTERNAL", "EDIT"]),
    field: z.string().min(1).max(100),
    value: z.unknown().optional(),
  })
  .strict();

export const financialYearPatchSchema = z
  .object({
    year: z.string().regex(/^\d{4}$/),
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  })
  .strict();

export const operatorProfilePatchSchema = z
  .object({
    name: optionalText,
    registrationNumber: optionalText,
    trusteeRegistrationNumber: optionalText,
    responsiblePersonName: optionalText,
    responsiblePersonPhone: optionalText,
  })
  .strict();

export const operatorShareCapitalPatchSchema = z
  .object({
    ordinaryUnits: optionalDecimal,
    ordinaryAmount: optionalDecimal,
    preferenceUnits: optionalDecimal,
    preferenceAmount: optionalDecimal,
    othersUnits: optionalDecimal,
    othersAmount: optionalDecimal,
    totalPaidUpCapital: optionalDecimal,
    llpMembersCapitalUnits: optionalDecimal,
    llpMembersCapitalAmount: optionalDecimal,
    llpMembersReservesUnits: optionalDecimal,
    llpMembersReservesAmount: optionalDecimal,
    llpSubordinatedLoansUnits: optionalDecimal,
    llpSubordinatedLoansAmount: optionalDecimal,
    totalLlp: optionalDecimal,
  })
  .strict();

export const operatorShareholderSchema = z
  .object({
    holderType: z.enum(OPERATOR_HOLDER_TYPES),
    entityType: z.enum(ORGANIZATION_PARTY_ENTITY_TYPES),
    name: optionalText,
    salutation: optionalText,
    identityNumber: optionalText,
    dateOfBirth: optionalDate,
    dateOfIncorporation: optionalDate,
    nationality: optionalText,
    address: z.string().max(1000).optional().nullable(),
    dateAcquired: optionalDate,
    dateDisposal: optionalDate,
    shareType: z.enum(SC_SHARE_TYPES).optional().nullable(),
    shareTypeOther: optionalText,
    shareholdingUnits: optionalDecimal,
    shareholdingAmount: optionalDecimal,
    shareholdingPercentage: optionalDecimal,
  })
  .strict()
  .refine((value) => !(value.holderType === "BENEFICIAL_OWNER" && value.entityType === "CORPORATE"), {
    path: ["entityType"],
    message: "ComRep [03000] Beneficial Owner is an individual, not a company",
  });

export const operatorOfficerSchema = z
  .object({
    personKind: z.enum(SC_PERSON_KINDS),
    name: optionalText,
    salutation: optionalText,
    isResponsiblePerson: z.boolean().optional(),
    identityNumber: optionalText,
    dateOfBirth: optionalDate,
    nationality: optionalText,
    address: z.string().max(1000).optional().nullable(),
    designation: z.enum(SC_DESIGNATIONS).optional().nullable(),
    designationOther: optionalText,
    appointmentDate: optionalDate,
    resignationDate: optionalDate,
  })
  .strict();

export const operatorAdvisorSchema = z
  .object({
    advisorType: z.enum(OPERATOR_ADVISOR_TYPES),
    name: optionalText,
    registrationNumber: optionalText,
    country: optionalText,
    address: z.string().max(1000).optional().nullable(),
    appointmentDate: optionalDate,
    cessationDate: optionalDate,
  })
  .strict();

export const operatorInterestSchema = z
  .object({
    name: optionalText,
    registrationNumber: optionalText,
    country: optionalText,
    address: z.string().max(1000).optional().nullable(),
    acquisitionDate: optionalDate,
    disposalDate: optionalDate,
    shareType: z.enum(SC_SHARE_TYPES).optional().nullable(),
    shareTypeOther: optionalText,
    shareholdingUnits: optionalDecimal,
    shareholdingPercentage: optionalDecimal,
  })
  .strict();

export const operatorFinancialStatementSchema = z
  .object({
    consolidatedAccounts: z.boolean().optional().nullable(),
    auditorName: optionalText,
    financialYearEnd: optionalDate,
    unmodifiedReports: z.boolean().optional().nullable(),
    dateTabledToBoard: optionalDate,
    currency: optionalText,
    numberOfShares: optionalDecimal,
    totalAssets: optionalDecimal,
    nonCurrentAssets: optionalDecimal,
    currentAssets: optionalDecimal,
    totalEquity: optionalDecimal,
    paidUpCapital: optionalDecimal,
    shareApplicationAccount: optionalDecimal,
    sharePremiumAndReserves: optionalDecimal,
    accumulatedProfitCarriedForward: optionalDecimal,
    equityMinorityInterest: optionalDecimal,
    totalLiabilities: optionalDecimal,
    nonCurrentLiabilities: optionalDecimal,
    currentLiabilities: optionalDecimal,
    totalRevenue: optionalDecimal,
    revenueDonation: optionalDecimal,
    revenueReward: optionalDecimal,
    revenueLending: optionalDecimal,
    revenueEquity: optionalDecimal,
    revenueFees: optionalDecimal,
    revenueOther: optionalDecimal,
    incomeDepositInterest: optionalDecimal,
    incomeOther: optionalDecimal,
    totalCost: optionalDecimal,
    costStaff: optionalDecimal,
    costSystem: optionalDecimal,
    costPromotion: optionalDecimal,
    costOther: optionalDecimal,
    profitBeforeTax: optionalDecimal,
    taxation: optionalDecimal,
    profitAfterTax: optionalDecimal,
    pnlMinorityInterest: optionalDecimal,
    netDividend: optionalDecimal,
  })
  .strict();

export const createPartySchema = partyPatchSchema
  .extend({
    entityType: z.enum(ORGANIZATION_PARTY_ENTITY_TYPES).optional(),
    email: z.union([z.string().email().max(255), z.literal(""), z.null()]).optional(),
  })
  .refine(
    (value) =>
      value.isDirector === true ||
      value.isShareholder === true ||
      value.isBoard === true ||
      value.isManagement === true ||
      Boolean(value.personKind),
    { message: "Select at least one role" }
  );

export type OrgMasterPatchInput = z.infer<typeof orgMasterPatchSchema>;
export type PartyPatchInput = z.infer<typeof partyPatchSchema>;
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type OperatorShareholderInput = z.infer<typeof operatorShareholderSchema>;
export type OperatorOfficerInput = z.infer<typeof operatorOfficerSchema>;
export type OperatorAdvisorInput = z.infer<typeof operatorAdvisorSchema>;
export type OperatorInterestInput = z.infer<typeof operatorInterestSchema>;
export type OperatorFinancialStatementInput = z.infer<typeof operatorFinancialStatementSchema>;
export type OperatorShareCapitalInput = z.infer<typeof operatorShareCapitalPatchSchema>;
