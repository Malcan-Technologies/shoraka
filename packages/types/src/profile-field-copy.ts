/**
 * Canonical Profile / Organisation UI copy.
 * Use these labels in Admin, Issuer, Investor, and Shoraka Profile surfaces.
 * Do not bind Profile UI to backend keys, XBRL names, or SC pipe labels.
 */

import {
  FINANCIAL_FIELD_LABELS,
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
} from "./financial-field-labels";

export const PROFILE_LABEL = {
  companyName: "Company Name",
  fullName: "Full Name",
  investorName: "Investor Name",
  companyRegistrationNumber: "Company Registration Number",
  identityNumber: "Identity Number",
  identityPrefix: "Identity Prefix",
  tin: "Tax Identification Number (TIN)",
  dateOfIncorporation: "Date of Incorporation",
  dateBusinessCommenced: "Date Business Commenced",
  dateOfBirth: "Date of Birth",
  dateOfBirthOrIncorporation: "Date of Birth / Incorporation",
  countryOfIncorporation: "Country of Incorporation",
  nationality: "Nationality",
  nationalityOrCountry: "Nationality / Country",
  typeOfCompany: "Type of Company",
  companyActivities: "Company Activities",
  mainCustomers: "Who are your main customers?",
  industry: "Industry",
  numberOfEmployees: "Number of Employees",
  annualRevenue: "Annual Revenue",
  website: "Website",
  companyPhone: "Company Phone",
  phone: "Phone",
  personInCharge: "Person in Charge",
  personEmail: "Person Email",
  accountEmail: "Account Email",
  accountOwnerEmail: "Account owner email",
  email: "Email",
  salutation: "Salutation",
  gender: "Gender",
  position: "Position",
  shareholdingPercentage: "Shareholding Percentage (%)",
  shareholdingUnits: "Shareholding Units",
  shareholdingAmount: "Shareholding Amount (RM)",
  typeOfShares: "Type of Shares",
  typeOfSharesOther: "Other share type",
  designation: "Designation",
  designationOther: "Other designation",
  appointmentDate: "Appointment Date",
  resignationDate: "Resignation Date",
  registeredAddress: "Registered Address",
  businessAddress: "Business Address",
  residentialAddress: "Residential Address",
  bankName: "Bank name",
  accountType: "Account type",
  bankAccountNumber: "Bank account number",
  sophisticatedInvestor: "Sophisticated Investor",
  typeOfInvestor: "Type of Investor",
} as const;

/** Customer Profile read mode: required + empty. Not used in edit inputs. */
export const PROFILE_REQUIRED_EMPTY_LABEL = "Please fill up";

export const PROFILE_ADDRESS_FIELD_LABELS = {
  address: "Address",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  postcode: "Postcode",
  country: "Country",
} as const;

export const PROFILE_ADDRESS_HELP = {
  state: "Select Outside Malaysia if the address is not in Malaysia.",
  postcode: "Leave this blank only when State is Outside Malaysia.",
} as const;

export const PROFILE_HELP = {
  companyRegistrationNumber:
    "Enter the Company Registration Number (ROC) or SSM Business Registration Number (BRN) without dashes, spaces, or special characters. Do not mix BRN and ROC.",
  identityNumberNric:
    "Use NRIC for a Malaysian individual or Passport for a foreign individual. Enter NRIC without dashes, spaces, or special characters.",
  identityNumberCompany:
    "Enter the Company Registration Number (ROC) or SSM Business Registration Number (BRN) without dashes, spaces, or special characters.",
  identityNumberPersonOrCompany:
    "Use NRIC for a Malaysian individual, Passport for a foreign individual, or the Company Registration Number for a company. Enter NRIC and ROC without dashes, spaces, or special characters.",
  companyPhone:
    "General company phone for payments and receipts. Fundraising contact phone is under Person in Charge.",
  personEmail:
    "Email used for this person’s onboarding and contact. Changing it does not change Account Email.",
  accountEmail: "Login email for the linked CashSouk account. Changing Person Email does not change this.",
  resignationDate: "Leave this blank if this person has not resigned.",
  shareApplicationAccount: "Amounts received for shares applied for but not yet issued.",
  currentBorrowings: "Current liabilities that are borrowings.",
  otherCurrentLiabilities: "Current liabilities other than borrowings.",
  nonCurrentLoans: "Non-current liabilities that are loans.",
  otherNonCurrentLiabilities: "Non-current liabilities other than loans.",
} as const;

/** Completeness-list labels keep a section prefix so missing State/Postcode is unambiguous. */
export function profileAddressCompletenessLabel(
  section: "registered" | "business" | "residential",
  field: "line1" | "state" | "postcode"
): string {
  const heading =
    section === "registered"
      ? PROFILE_LABEL.registeredAddress
      : section === "business"
        ? PROFILE_LABEL.businessAddress
        : PROFILE_LABEL.residentialAddress;
  if (field === "line1") return heading;
  if (field === "state") return `${heading} (${PROFILE_ADDRESS_FIELD_LABELS.state})`;
  return `${heading} (${PROFILE_ADDRESS_FIELD_LABELS.postcode})`;
}

export const PROFILE_FINANCIAL_FIELD_HELP: Record<string, string> = {
  curlib_borrowing: PROFILE_HELP.currentBorrowings,
  curlib_non_borrowing: PROFILE_HELP.otherCurrentLiabilities,
  ncl_loan: PROFILE_HELP.nonCurrentLoans,
  ncl_non_loan: PROFILE_HELP.otherNonCurrentLiabilities,
  equity_share_application: PROFILE_HELP.shareApplicationAccount,
};

export function profileFinancialFieldLabel(key: string, unit = false): string {
  const base = FINANCIAL_FIELD_LABELS[key] ?? key;
  return unit ? `${base} (RM)` : base;
}

export function formatProfileRmAmount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return "—";
  const formatted = num.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `RM ${formatted}`;
}

export const PROFILE_FINANCIAL_EDITABLE_KEYS = [
  ...ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ...ISSUER_PROFILE_PNL_KEYS,
] as const;
