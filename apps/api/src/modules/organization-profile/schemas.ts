import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  applyPartyComrepSemantics,
  isScIntegerWithoutDecimal,
  OPERATOR_ADVISOR_TYPES,
  OPERATOR_HOLDER_TYPES,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  othersSpecifyValue,
  SC_COMPANY_CATEGORIES,
  SC_COMPANY_TYPES,
  SC_DESIGNATIONS,
  SC_GENDERS,
  SC_IDENTITY_PREFIXES,
  SC_INVESTOR_CATEGORIES,
  SC_PERSON_KINDS,
  SC_SHARE_TYPES,
  validateIssuerFinancialFieldsPatch,
  validateOperatorShareCapitalPatch,
  validateIssuerMasterPatch,
  validateIssuerPersonForm,
  validateOperatorAdvisor,
  validateOperatorFinancialStatement,
  validateOperatorGeneralPatch,
  validateOperatorInterest,
  validateOperatorOfficer,
  validateOperatorShareholder,
  validatePartyPatch,
  type ComrepFieldIssue,
} from "@cashsouk/types";

function addComrepIssues(ctx: z.RefinementCtx, issues: ComrepFieldIssue[]): void {
  for (const issue of issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: issue.field.split("."),
      message: issue.message,
    });
  }
}

function requirePhoneWhenPresent(value: string | null | undefined, ctx: z.RefinementCtx, path: string): void {
  if (value == null || value === undefined) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (!isValidPhoneNumber(trimmed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: "Invalid phone number format",
    });
  }
}

const optionalText = z.string().max(500).optional().nullable();
const optionalDate = z.string().optional().nullable();
const optionalDecimal = z.union([z.string(), z.number()]).optional().nullable();
const scIntegerWithoutDecimal = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .refine((value) => isScIntegerWithoutDecimal(value), {
    message: "Integer value without decimal points",
  });

/** DTO/UI `id` belongs in the URL, not the strict body. Unknown keys still fail. */
export function parseOperatorBody<T>(schema: { parse: (data: unknown) => T }, body: unknown): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return schema.parse(body);
  }
  const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete copy.id;
  return schema.parse(copy);
}

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
    companyEmail: z.string().max(255).optional().nullable(),
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
  .strict()
  .superRefine((value, ctx) => {
    const patch = value as Record<string, unknown>;
    const issuerIssues = validateIssuerMasterPatch(patch, "issuer").filter((issue) => {
      if (issue.field === "name" && patch.name !== undefined) return true;
      if (issue.field.startsWith("registeredAddress") || issue.field.startsWith("businessAddress")) {
        return true;
      }
      return (
        issue.field === "companyEmail" ||
        issue.field === "phoneNumber" ||
        issue.field === "dateOfIncorporation" ||
        issue.field === "dateOfCommencement" ||
        issue.field === "countryOfIncorporation" ||
        issue.field === "scCompanyType"
      );
    });
    const investorIssues = validateIssuerMasterPatch(patch, "investor").filter((issue) => {
      return (
        issue.field === "dateOfBirth" ||
        issue.field === "nationality" ||
        issue.field === "gender" ||
        issue.field.startsWith("residentialAddress")
      );
    });
    addComrepIssues(ctx, [...issuerIssues, ...investorIssues]);
    requirePhoneWhenPresent(value.phoneNumber, ctx, "phoneNumber");
  });

export const partyPatchObjectSchema = z
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

export const partyPatchSchema = partyPatchObjectSchema.superRefine((value, ctx) => {
  addComrepIssues(ctx, validatePartyPatch(value as Record<string, unknown>));
});

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
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateIssuerFinancialFieldsPatch(value.fields));
  });

export const operatorProfilePatchSchema = z
  .object({
    name: optionalText,
    registrationNumber: optionalText,
    trusteeRegistrationNumber: optionalText,
    scCompanyType: z.enum(SC_COMPANY_TYPES).optional().nullable(),
    responsiblePersonName: optionalText,
    responsiblePersonPhone: optionalText,
  })
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorGeneralPatch(value as Record<string, unknown>));
    requirePhoneWhenPresent(value.responsiblePersonPhone, ctx, "responsiblePersonPhone");
  });

export const operatorShareCapitalPatchSchema = z
  .object({
    ordinaryUnits: scIntegerWithoutDecimal,
    ordinaryAmount: optionalDecimal,
    preferenceUnits: scIntegerWithoutDecimal,
    preferenceAmount: optionalDecimal,
    othersUnits: scIntegerWithoutDecimal,
    othersAmount: optionalDecimal,
    totalPaidUpCapital: scIntegerWithoutDecimal,
    llpMembersCapitalUnits: scIntegerWithoutDecimal,
    llpMembersCapitalAmount: optionalDecimal,
    llpMembersReservesUnits: scIntegerWithoutDecimal,
    llpMembersReservesAmount: optionalDecimal,
    llpSubordinatedLoansUnits: scIntegerWithoutDecimal,
    llpSubordinatedLoansAmount: optionalDecimal,
    totalLlp: optionalDecimal,
  })
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorShareCapitalPatch(value as Record<string, unknown>));
  });

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
  })
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorShareholder(value));
    const other = othersSpecifyValue(value.shareType, value.shareTypeOther);
    if (other.issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shareTypeOther"],
        message: "Type of Shares - Others (please specify) is required when Type of Shares is Others.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    salutation: value.entityType === "CORPORATE" ? null : value.salutation,
    shareTypeOther: othersSpecifyValue(value.shareType, value.shareTypeOther).value,
  }));

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
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorOfficer(value));
    if (othersSpecifyValue(value.designation, value.designationOther).issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["designationOther"],
        message: "Designation - Others (Please specify) is required when Designation is Others.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    designationOther: othersSpecifyValue(value.designation, value.designationOther).value,
  }));

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
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorAdvisor(value));
  });

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
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorInterest(value));
    if (othersSpecifyValue(value.shareType, value.shareTypeOther).issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shareTypeOther"],
        message: "Type of Shares - Others (please specify) is required when Type of Shares is Others.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    shareTypeOther: othersSpecifyValue(value.shareType, value.shareTypeOther).value,
  }));

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
  .strict()
  .superRefine((value, ctx) => {
    addComrepIssues(ctx, validateOperatorFinancialStatement(value as Record<string, unknown>));
  });

export const createPartySchema = partyPatchObjectSchema
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
  )
  .superRefine((value, ctx) => {
    const entityType =
      value.entityType === "CORPORATE" || value.identityPrefix === "ROC" ? "CORPORATE" : "INDIVIDUAL";
    const applied = applyPartyComrepSemantics({
      entityType,
      isOfficer:
        value.isDirector === true ||
        value.isBoard === true ||
        value.isManagement === true ||
        value.personKind === "BOARD" ||
        value.personKind === "MANAGEMENT",
      gender: value.gender,
      salutation: value.salutation,
      identityPrefix: value.identityPrefix,
      identityNumber: value.identityNumber,
      nationality: value.nationality,
      shareType: value.shareType,
      shareTypeOther: value.shareTypeOther,
      designation: value.designation,
      designationOther: value.designationOther,
    });
    for (const issue of applied.issues) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
    }
    const officer =
      value.isDirector === true ||
      value.isBoard === true ||
      value.isManagement === true ||
      value.personKind === "BOARD" ||
      value.personKind === "MANAGEMENT";
    addComrepIssues(
      ctx,
      validateIssuerPersonForm({
        entityType,
        name: value.name,
        identityPrefix: value.identityPrefix,
        identityNumber: value.identityNumber,
        dateOfBirth: value.dateOfBirth,
        dateOfIncorporation: value.dateOfIncorporation,
        gender: value.gender,
        nationality: value.nationality,
        countryOfIncorporation: value.countryOfIncorporation,
        line1: value.address?.line1,
        state: value.address?.state,
        postalCode: value.address?.postalCode,
        isShareholder: value.isShareholder === true || entityType === "CORPORATE",
        isOfficer: officer,
        shareType: value.shareType,
        shareTypeOther: value.shareTypeOther,
        shareholdingUnits: value.shareholdingUnits,
        shareholdingAmount: value.shareholdingAmount,
        shareholdingPercentage: value.shareholdingPercentage,
        personKind: value.personKind,
        designation: value.designation,
        designationOther: value.designationOther,
        appointmentDate: value.appointmentDate,
      })
    );
  });

export type OrgMasterPatchInput = z.infer<typeof orgMasterPatchSchema>;
export type PartyPatchInput = z.infer<typeof partyPatchSchema>;
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type OperatorShareholderInput = z.infer<typeof operatorShareholderSchema>;
export type OperatorOfficerInput = z.infer<typeof operatorOfficerSchema>;
export type OperatorAdvisorInput = z.infer<typeof operatorAdvisorSchema>;
export type OperatorInterestInput = z.infer<typeof operatorInterestSchema>;
export type OperatorFinancialStatementInput = z.infer<typeof operatorFinancialStatementSchema>;
export type OperatorShareCapitalInput = z.infer<typeof operatorShareCapitalPatchSchema>;
