/**
 * Org-owned "About your business" fields on corporate_onboarding_data.
 * Mirrored read-only on the application company step.
 */

export const ABOUT_YOUR_BUSINESS_LIMITS = {
  whatDoesCompanyDo: 1000,
  mainCustomers: 400,
  accountingSoftware: 200,
} as const;

export type AboutYourBusiness = {
  whatDoesCompanyDo: string;
  mainCustomers: string;
  /** null when unanswered */
  singleCustomerOver50Revenue: boolean | null;
  accountingSoftware: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function coerceOptionalBoolean(value: unknown): boolean | null {
  if (value === true || value === "yes") return true;
  if (value === false || value === "no") return false;
  return null;
}

export function emptyAboutYourBusiness(): AboutYourBusiness {
  return {
    whatDoesCompanyDo: "",
    mainCustomers: "",
    singleCustomerOver50Revenue: null,
    accountingSoftware: "",
  };
}

export function parseAboutYourBusiness(raw: unknown): AboutYourBusiness {
  const obj = asRecord(raw);
  if (!obj) return emptyAboutYourBusiness();
  return {
    whatDoesCompanyDo: readString(obj.whatDoesCompanyDo ?? obj.what_does_company_do),
    mainCustomers: readString(obj.mainCustomers ?? obj.main_customers),
    singleCustomerOver50Revenue: coerceOptionalBoolean(
      obj.singleCustomerOver50Revenue ?? obj.single_customer_over_50_revenue
    ),
    accountingSoftware: readString(obj.accountingSoftware ?? obj.accounting_software),
  };
}

/** Legacy application JSON: about fields plus accounting software under why_raising_funds. */
export function parseAboutYourBusinessFromBusinessDetails(businessDetails: unknown): AboutYourBusiness {
  const details = asRecord(businessDetails);
  const about = parseAboutYourBusiness(details?.about_your_business ?? details?.aboutYourBusiness);
  const why = asRecord(details?.why_raising_funds ?? details?.whyRaisingFunds);
  const accountingFromWhy = readString(why?.accounting_software ?? why?.accountingSoftware);
  return {
    ...about,
    accountingSoftware: about.accountingSoftware.trim() ? about.accountingSoftware : accountingFromWhy,
  };
}

export function parseAboutYourBusinessFromCorporateData(corporateOnboardingData: unknown): AboutYourBusiness {
  const cod = asRecord(corporateOnboardingData);
  return parseAboutYourBusiness(cod?.aboutYourBusiness ?? cod?.about_your_business);
}

export function isAboutYourBusinessPresent(about: AboutYourBusiness): boolean {
  return Boolean(
    about.whatDoesCompanyDo.trim() ||
      about.mainCustomers.trim() ||
      about.singleCustomerOver50Revenue !== null ||
      about.accountingSoftware.trim()
  );
}

export function isAboutYourBusinessComplete(about: AboutYourBusiness): boolean {
  return Boolean(
    about.whatDoesCompanyDo.trim() &&
      about.mainCustomers.trim() &&
      about.singleCustomerOver50Revenue !== null &&
      about.accountingSoftware.trim()
  );
}

export function serializeAboutYourBusiness(about: AboutYourBusiness): {
  whatDoesCompanyDo: string;
  mainCustomers: string;
  singleCustomerOver50Revenue: boolean | null;
  accountingSoftware: string;
} {
  return {
    whatDoesCompanyDo: about.whatDoesCompanyDo.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo),
    mainCustomers: about.mainCustomers.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers),
    singleCustomerOver50Revenue: about.singleCustomerOver50Revenue,
    accountingSoftware: about.accountingSoftware.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.accountingSoftware),
  };
}
