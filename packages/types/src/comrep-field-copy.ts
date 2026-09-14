/**
 * Exact SC ComRep RMO-P2P field labels and dropdown wording.
 * Labels are section-specific. Do not reuse one wording across tables.
 * Helper text is plain English for Operations users; it keeps the SC meaning
 * without exposing table numbers or implementation language.
 */

export const SC_BRN_ROC_FORMAT_HELP =
  "Enter the Company Registration Number (ROC) or SSM Business Registration Number (BRN) without dashes, spaces, or special characters. Do not mix BRN and ROC.";

export const SC_NRIC_FORMAT_HELP =
  "Enter the NRIC number without dashes, spaces, or special characters. Example: 800101011234";

export const SC_LLP_SHARES_NOTE = "For an LLP, enter capital contribution as shares.";

export const SC_INTEGER_SHARES_HELP = "Enter a whole number.";

export const SC_APPENDIX_A_COUNTRY_HELP = "Select the country from the list.";

export const SC_BLANK_VALUE_HELP =
  "Leave this blank if there is nothing to enter. Do not type N/A, “–”, or “Not Applicable” unless the field is required.";

/** Annual [00000] / [01000] */
export const SC_ANNUAL_GENERAL = {
  companyRegistrationNumber: {
    label: "Company Registration Number",
    help: "Enter Shoraka’s SSM Business Registration Number (BRN) or Company Registration Number (ROC). Use the same type of number already on file. Do not mix BRN and ROC.",
    required: true as const,
    requiredReason: "CashSouk master completeness for all ComRep reports",
  },
  trusteeCompanyRegistrationNumber: {
    label: "Trustee Company Registration Number",
    help: "Enter this number if you prepare a trustee report. Do not mix BRN and ROC.",
    required: false as const,
    requiredReason: "SC requires this only when Reporting Level = Company(Trustee)",
  },
  nameOfRmo: {
    label: "Name of RMO",
    help: "Enter the name of Shoraka.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  nameOfResponsiblePerson: {
    label: "Name of Responsible Person",
    help: "Enter the name of the Responsible Person appointed for Shoraka. If there is more than one, enter one name only.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  contactNumber: {
    label: "Contact Number",
    help: "Enter the contact number of the Responsible Person.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  typeOfCompany: {
    label: "Type of Company",
    help: "Select the company type to show the correct Share Capital fields.",
    required: true as const,
    requiredReason: "CashSouk business requirement to select the [02000] share-capital block",
  },
} as const;

/** Annual [02000] Summary of Share Capital */
export const SC_ANNUAL_SHARE_CAPITAL = {
  ordinaryForSdnBhd: {
    label: "Ordinary (for Sdn Bhd)",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Private Limited (Sdn Bhd)",
  },
  preferenceForSdnBhd: {
    label: "Preference (for Sdn Bhd)",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Private Limited (Sdn Bhd)",
  },
  othersForSdnBhd: {
    label: "Others (for Sdn Bhd)",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Private Limited (Sdn Bhd)",
  },
  totalPaidUpCapitalForSdnBhd: {
    label: "Total paid up capital (for Sdn Bhd)",
    help: "Enter the total issued and paid-up capital (RM) for all share types. Enter a whole number.",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Private Limited (Sdn Bhd)",
  },
  limitedLiabilityPartnership: { label: "Limited liability partnership" },
  membersCapital: {
    label: "Members' Capital",
    help: `${SC_INTEGER_SHARES_HELP} ${SC_LLP_SHARES_NOTE}`,
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Limited Liability Partnership",
  },
  membersReserves: {
    label: "Members' Reserves",
    help: `Enter members’ reserve “shares” if relevant. ${SC_INTEGER_SHARES_HELP} ${SC_LLP_SHARES_NOTE}`,
    required: false as const,
  },
  subordinatedLoans: {
    label: "Subordinated Loans",
    help: "Enter the subordinated loans amount. Enter a whole number.",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Limited Liability Partnership",
  },
  totalLimitedLiabilityPartnership: {
    label: "Total Limited Liability Partnership",
    help: `Enter the total partners’ capital contribution for the LLP. ${SC_LLP_SHARES_NOTE}`,
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Limited Liability Partnership",
  },
  noOfShares: { label: "No. of Shares", help: SC_INTEGER_SHARES_HELP },
  nominalValueRm: { label: "Nominal Value (RM)" },
} as const;

/** Annual [03000] Shareholders/Members */
export const SC_ANNUAL_SHAREHOLDER = {
  name: {
    label: "Name",
    help: "Enter the full name of the shareholder (individual or company) as shown on official documents. If this row is a beneficial owner, enter the shareholder’s name here.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  salutation: {
    label: "Salutation",
    help: "Enter a salutation if this shareholder is an individual or beneficial owner.",
    required: "conditional" as const,
    requiredReason: "Required for an individual or beneficial owner; hidden for a company",
  },
  icPassportNumber: {
    label: "IC/Passport number",
    help: "Use NRIC for a Malaysian individual, Passport for a foreign individual, or BRN/ROC for a company.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "For an individual, enter the date of birth. For a company, enter the date of incorporation.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  nationality: {
    label: "Nationality",
    help: "For an individual, enter nationality. For a company, enter the country of incorporation. Select the country from the list.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  address: {
    label: "Address",
    help: "Use a residential address for an individual and a business address for a company.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateAcquired: {
    label: "Date Acquired (dd/mm/yyyy)",
    help: "Enter the date the shares were acquired, as recorded with SSM.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateDisposal: {
    label: "Date Disposal (dd/mm/yyyy)",
    help: "Enter the date the shares were disposed of, as recorded with SSM. Leave this blank if the holding is still held.",
    required: false as const,
  },
  typeOfShares: {
    label: "Type of Shares",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  typeOfSharesOthers: {
    label: "Type of Shares - Others (please specify)",
    help: "Enter the other share type because ‘Others’ is selected.",
    required: "conditional" as const,
    requiredReason: "Required only when Type of Shares = Others",
  },
  shareholdingUnits: {
    label: "Shareholding Units (Unit)",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  shareholdingAmount: {
    label: "Shareholding Amount (RM)",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  shareholdingPercentage: {
    label: "Shareholding Percentage (%)",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
} as const;

/** Annual [04000] Board of Director/Management Team */
export const SC_ANNUAL_OFFICER = {
  boardOfDirectorManagementTeam: {
    label: "Board of Director/Management Team",
    required: true as const,
    requiredReason: "SC requires one of the two dropdown values on each row",
  },
  name: {
    label: "Name",
    help: "Enter the full name as shown on official documents (for example, IC or passport).",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  salutation: {
    label: "Salutation",
    help: "Enter a salutation if applicable.",
    required: false as const,
  },
  responsiblePerson: {
    label: "Responsible Person",
    help: "Select Yes or No.",
    required: true as const,
    requiredReason: "SC requires Yes or No on each row; CashSouk completeness also requires at least one Yes",
  },
  identityNumber: {
    label: "Identity Number (NRIC/ Passport No.)",
    help: "Use NRIC for a Malaysian individual or Passport for a foreign individual. Enter NRIC without dashes, spaces, or special characters (for example, 800101011234).",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "Enter the date of birth. Use the dd/mm/yyyy format.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  nationality: {
    label: "Nationality",
    help: "Select the nationality. Select the country from the list.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  address: {
    label: "Address",
    help: "Enter the residential address.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  designation: {
    label: "Designation",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  designationOthers: {
    label: "Designation - Others (Please specify)",
    help: "Enter the designation because ‘Others’ is selected.",
    required: "conditional" as const,
    requiredReason: "Required only when Designation = Others",
  },
  appointmentDate: {
    label: "Appointment Date (dd/mm/yyyy)",
    help: "Enter the date this person was appointed to their current role. Use the dd/mm/yyyy format.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  resignationDate: {
    label: "Resignation date (dd/mm/yyyy)",
    help: "Enter the date this person left the role. Leave this blank if the person has not resigned.",
    required: false as const,
  },
} as const;

/** Annual [05000] Advisor */
export const SC_ANNUAL_ADVISOR = {
  name: {
    label: "Name",
    help: "Enter the full company name of the appointed adviser as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  companyRegistrationNo: {
    label: "Company Registration No.",
    help: "Enter the BRN or ROC as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  country: {
    label: "Country",
    help: "Select the country of incorporation. Select the country from the list.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  address: {
    label: "Address",
    help: "Enter the adviser’s business address.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  appointmentDate: {
    label: "Appointment Date (dd/mm/yyyy)",
    help: "Enter the date the adviser was appointed.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  cessationDate: {
    label: "Cessation Date (dd/mm/yyyy)",
    help: "Enter the date the adviser stopped being appointed. Leave this blank if the adviser is still appointed.",
    required: false as const,
  },
  typeOfAdvisor: {
    label: "Type of Advisor",
    required: true as const,
    requiredReason: "SC requires one advisor type on each row",
  },
} as const;

/** Annual [10000] Interest in Other Company */
export const SC_ANNUAL_INTEREST = {
  name: {
    label: "Name",
    help: "Enter the full company name as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  roc: {
    label: "ROC",
    help: "Enter the BRN or ROC as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  country: {
    label: "Country",
    help: "Select the country of incorporation. Select the country from the list.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  address: {
    label: "Address",
    help: "Enter the company’s business address.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  acquisitionDate: {
    label: "Acquisition Date (dd/mm/yyyy)",
    help: "Enter the date the interest was acquired, as recorded on official documents.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  disposalDate: {
    label: "Disposal Date (dd/mm/yyyy)",
    help: "Enter the date the shares were transferred, as recorded on official documents. Leave this blank if the interest is still held.",
    required: false as const,
  },
  typeOfShares: {
    label: "Type of Shares",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  typeOfSharesOthers: {
    label: "Type of Shares - Others (please specify)",
    help: "Enter the other share type because ‘Others’ is selected.",
    required: "conditional" as const,
    requiredReason: "Required only when Type of Shares = Others",
  },
  shareholdingUnits: {
    label: "Shareholding Units (unit)",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  shareholdingPercentage: {
    label: "Shareholding Percentage (%)",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
} as const;

/** Annual [11000] Financial Statement */
export const SC_ANNUAL_FINANCIAL = {
  consolidatedAccounts: {
    label: "Consolidated Accounts",
    help: "Select Yes if these figures are from consolidated financial statements. Select No if they are from a single-entity financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  auditorsName: {
    label: "Auditor's Name",
    help: "Enter the full name of the audit firm as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  financialYearEnd: {
    label: "Financial Year End",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  unmodifiedReports: {
    label: "Unmodified Reports",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  dateOfTablingToBoard: {
    label: "Date of Tabling to Board",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  currency: {
    label: "Currency",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  numberOfShares: {
    label: "Number of Shares",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  totalAssets: {
    label: "Total Assets",
    help: "Enter the total shown in the financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  nonCurrentAssets: {
    label: "Non-current Assets",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  currentAssets: {
    label: "Current Assets",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  totalEquity: {
    label: "Total Equity",
    help: "Enter the total shown in the financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  paidUpCapital: {
    label: "Paid-up Capital",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  shareApplicationAccount: {
    label: "Share Application Account",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  sharePremiumAndOtherReserves: {
    label: "Share Premium & Other Reserves",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  accumulatedProfitCarriedForward: {
    label: "Accumulated Profit / (Loss)",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  minorityInterest: {
    label: "Minority Interest",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  totalLiabilities: {
    label: "Total Liabilities",
    help: "Enter the total shown in the financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  nonCurrentLiabilities: {
    label: "Non-current Liabilities",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  currentLiabilities: {
    label: "Current Liabilities",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  totalRevenue: {
    label: "Total Revenue",
    help: "Enter the total shown in the financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  donationBased: {
    label: "Donation Based",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  rewardBased: {
    label: "Reward Based",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  lendingBased: {
    label: "Lending Based",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  equityBased: {
    label: "Equity Based",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  feesCharges: {
    label: "Fees charges",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  otherRevenue: {
    label: "Other - Revenue",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  otherIncome: { label: "Other Income" },
  interestFromDepositPlacement: {
    label: "Interest from deposit placement",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  otherIncomeLine: {
    label: "Other - Income",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  totalCost: {
    label: "Total Cost",
    help: "Enter the total shown in the financial statement.",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  staffCost: {
    label: "Staff Cost",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  systemCost: {
    label: "System Cost",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  promotionActivities: {
    label: "Promotion Activities",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  otherCost: {
    label: "Other - Cost",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  profitLossBeforeTax: {
    label: "Profit / (Loss) Before Tax",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  taxation: {
    label: "Taxation",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  profitLossAfterTax: {
    label: "Profit / (Loss) After Tax",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  netDividend: {
    label: "Net Dividend",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
} as const;

/** Monthly [02000] Profile of Issuer */
export const SC_MONTHLY_ISSUER = {
  nameOfIssuer: {
    label: "Name of Issuer",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  issuerRoc: {
    label: "Issuer ROC",
    help: "Enter the BRN or ROC as shown on official documents.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  companyCategory: {
    label: "Company category",
    help: "Select Technology if the issuer or campaign is mainly technology-related. Select Non-Technology if it is not.",
    required: false as const,
    requiredReason: "Campaign-specific; not issuer profile completeness",
  },
  issuerIdIfAny: {
    label: "Issuer ID (if any)",
    help: "Enter the unique ID assigned to this issuer, if there is one.",
    required: false as const,
    requiredReason: "SC explicitly says if any",
  },
  dateOfIncorporation: {
    label: "Date of Incorporation (dd/mm/yyyy)",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateOfCommencement: {
    label: "Date of Commencement (dd/mm/yyyy)",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  countryOfIncorporation: {
    label: "Country of Incorporation",
    help: SC_APPENDIX_A_COUNTRY_HELP,
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  typeOfCompany: {
    label: "Type of Company",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  registeredAddress: {
    label: "Registered Address",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  registeredAddressState: {
    label: "Registered Address - State",
    help: "This should match the registered address above. If the location is outside Malaysia, select “Outside Malaysia.”",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  registeredAddressPostcode: {
    label: "Registered Address - Postcode",
    help: "If the location is outside Malaysia, enter the international postcode if there is one.",
    required: "conditional" as const,
    requiredReason: "Required except when Registered Address - State is Outside Malaysia",
  },
  businessAddress: {
    label: "Business Address",
    help: "If this issuer is a subsidiary, enter the subsidiary’s business address.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  businessAddressState: {
    label: "Business Address - State",
    help: "This should match the business address above. If the location is outside Malaysia, select “Outside Malaysia.”",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  businessAddressPostcode: {
    label: "Business Address - Postcode",
    help: "If the location is outside Malaysia, enter the international postcode if there is one.",
    required: "conditional" as const,
    requiredReason: "Required except when Business Address - State is Outside Malaysia",
  },
  phoneNumber: {
    label: "Phone Number",
    help: "If the issuer is a sole proprietor or partnership, enter the phone number of the person who deals with CashSouk for fundraising.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  emailAddress: {
    label: "E-mail Address",
    help: "If the issuer is a sole proprietor or partnership, enter the e-mail address of the person who deals with CashSouk for fundraising.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  website: {
    label: "Website",
    help: "Enter the issuer’s website URL if there is one.",
    required: false as const,
    requiredReason: "SC explicitly says where applicable",
  },
  companyActivities: {
    label: "Company Activities",
    help: "Enter the issuer’s general or current business activity. Campaign-specific ComRep reporting of this field remains Needs business/compliance confirmation.",
    required: false as const,
    requiredReason: "Stored on Issuer Profile; campaign-specific ComRep source unresolved",
  },
} as const;

/** Monthly [03000] campaign fields used in offer UI */
export const SC_MONTHLY_CAMPAIGN = {
  companyCategory: {
    label: "Company category",
    help: "Select Technology or Non-Technology for this invoice/campaign. CashSouk-required for application completeness.",
  },
  campaignSector: {
    label: "Campaign Sector",
    help: "Select the sector for this fundraising campaign. Use SME Corp definitions. CashSouk-required for application completeness.",
  },
  sustainabilityCategory: { label: "Sustainability Category of the Campaign" },
  purposeOfFundRaising: { label: "Purpose of Fund Raising" },
  purposeOfFundRaisingOthers: {
    label: "Purpose of Fund Raising - Others (please specify)",
    help: "Enter the purpose because ‘Others’ is selected in Purpose of Fund Raising.",
  },
} as const;

/** Monthly [05000] Issuer - Shareholding Structure */
export const SC_MONTHLY_SHAREHOLDER = {
  shareholderType: { label: "Shareholder Type" },
  shareholderName: {
    label: "Shareholder Name",
    help: "Enter the full name of the shareholder (individual, company, or beneficial owner) as shown on official documents.",
  },
  salutation: {
    label: "Salutation (if applicable)",
    help: "Enter a salutation if this shareholder is an individual.",
  },
  identityPrefix: { label: "Identity Prefix" },
  shareholderIdentity: {
    label: "Shareholder Identity (NRIC/Passport/Company Registration No.)",
    help: "Use NRIC for a Malaysian individual, Passport for a foreign individual, or BRN/ROC for a company.",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "For an individual, enter the date of birth. For a company, enter the date of incorporation.",
  },
  gender: {
    label: "Gender",
    help: "Select Not Applicable only if this shareholder is a company. For an individual, enter the gender shown on official documents.",
  },
  nationalityCountry: {
    label: "Nationality/Country",
    help: "For an individual, select nationality. For a company, select the country of incorporation. Select the country from the list.",
  },
  businessResidentialAddress: { label: "Business/Residential Address" },
  businessResidentialAddressState: {
    label: "Business/Residential Address - State",
    help: "This should match the address above.",
  },
  businessResidentialAddressPostcode: {
    label: "Business/Residential Address - Postcode",
    help: "If the location is outside Malaysia, enter the international postcode if there is one.",
  },
  typeOfShares: { label: "Type of Shares" },
  typeOfSharesOthers: { label: "Type of Shares - Others (please specify)" },
  shareholdingUnits: { label: "Shareholding Units (unit)" },
  shareholdingAmount: { label: "Shareholding Amount (RM)" },
  shareholdingPercentage: { label: "Shareholding Percentage (%)" },
} as const;

/** Monthly [06000] Board of Director/Management Team (Successful Campaign) */
export const SC_MONTHLY_BOARD = {
  boardOfDirectorManagementTeam: { label: "Board of Director/Management Team" },
  name: {
    label: "Name",
    help: "Enter the full name as shown on official documents (for example, IC or passport).",
  },
  salutation: {
    label: "Salutation (if applicable)",
    help: "Enter a salutation if applicable.",
  },
  identityPrefix: { label: "Identity Prefix" },
  identityNumber: {
    label: "Identity Number (NRIC/Passport No.)",
    help: "Use NRIC for a Malaysian individual or Passport for a foreign individual. Enter NRIC without dashes or special characters (for example, 800101011234).",
  },
  gender: {
    label: "Gender",
    help: "Enter the gender shown on official documents.",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "Enter the date of birth as shown on official documents.",
  },
  nationality: {
    label: "Nationality",
    help: "Select the nationality. Select the country from the list.",
  },
  residentialAddress: { label: "Residential Address" },
  residentialAddressState: {
    label: "Residential Address - State",
    help: "This should match the residential address above.",
  },
  residentialAddressPostcode: {
    label: "Residential Address - Postcode",
    help: "If the location is outside Malaysia, enter the international postcode if there is one.",
  },
  designation: { label: "Designation" },
  designationOthers: {
    label: "Designation - Others (please specify)",
    help: "Enter the designation because ‘Others’ is selected.",
  },
  appointmentDate: { label: "Appointment Date (dd/mm/yyyy)" },
  resignationDate: {
    label: "Resignation Date (dd/mm/yyyy)",
    help: "Enter the resignation date if this person has resigned. Leave this blank if they have not resigned.",
  },
} as const;

/** Monthly [07000] Investor Details */
export const SC_MONTHLY_INVESTOR = {
  investorName: {
    label: "Investor Name",
    help: "Enter the investor name as shown on official documents.",
  },
  identityPrefix: { label: "Identity Prefix" },
  investorIdentification: {
    label: "Investor Identification (NRIC / Passport / Company Registration No.)",
    help: "Use NRIC for a Malaysian individual, Passport for a foreign individual, or BRN/ROC for a company.",
  },
  dateOfBirthIncorporation: {
    label: "Date of Birth/Incorporation (dd/mm/yyyy)",
    help: "Enter the date of birth for an individual, or the date of incorporation for a company.",
  },
  gender: {
    label: "Gender",
    help: "Select Not Applicable only if this investor is a company. For an individual, enter the gender shown on official documents.",
  },
  businessResidentialAddressState: {
    label: "Business/Residential Address - State",
    help: "Enter the investor’s current address. This may differ from the address on their IC.",
  },
  businessResidentialAddressPostcode: { label: "Business/Residential Address - Postcode" },
  nationalityCountry: {
    label: "Nationality/Country",
    help: "For an individual, select nationality. For a company, select the country of incorporation. Select the country from the list.",
  },
  typeOfInvestor: { label: "Type of Investor" },
} as const;

/** Monthly [09000] / [09100] issuer financials — exact SC item labels */
export const SC_MONTHLY_ISSUER_FINANCIAL_LABELS: Record<string, string> = {
  bscatot: "Assets|Current (RM)",
  bsclbank: "Assets|Non Current (RM)",
  curlib_borrowing: "Liabilities|Current - Borrowing (RM)",
  curlib_non_borrowing: "Liabilities|Current - Non Borrowing (RM)",
  ncl_loan: "Liabilities|Non Current - Loan (RM)",
  ncl_non_loan: "Liabilities|Non Current - Non Loan (RM)",
  bsqpuc: "Equity|Capital (RM)",
  equity_share_application: "Equity|Share Application Account (if applicable) (RM)",
  equity_share_premium: "Equity|Share Premium & Other Reserves (if applicable) (RM)",
  equity_accumulated_profit: "Equity|Accumulated Profit Carried Forward (RM)",
  equity_minority: "Equity|Minority Interest (if applicable) (RM)",
  turnover: "Total Revenue and Income (RM)",
  operating_cost: "Operating Cost (RM)",
  admin_cost: "Administrative Cost (RM)",
  interest_cost: "Interest Cost (RM)",
  other_cost: "Other Cost (RM)",
  plnpbt: "Profit/Loss Before Tax (RM)",
  plnpat: "Profit/Loss After Tax (RM)",
  pl_minority: "Minority Interest (RM)",
  plnetdiv: "Net Dividend (RM)",
};

/** SC item names for ComRep mapping. Profile UI uses `profileFinancialFieldLabel`. */
export const SC_MONTHLY_ISSUER_FINANCIAL_HELP: Record<string, string> = {};

export const SC_ANNUAL_PERSON_KIND_LABELS = {
  BOARD: "Board of director",
  MANAGEMENT: "Management team",
} as const;

export const SC_MONTHLY_PERSON_KIND_LABELS = {
  BOARD: "Board of Director",
  MANAGEMENT: "Management Team",
} as const;

export const SC_MONTHLY_SHAREHOLDER_IDENTITY_PREFIX_LABELS = {
  NRIC: "NRIC – for local Malaysian Identification Card",
  PASSPORT: "Passport – for foreign Nationals",
  ROC: "ROC",
} as const;

export const SC_MONTHLY_BOARD_IDENTITY_PREFIX_LABELS = {
  NRIC: "IC – for local Malaysian Identification Card.",
  PASSPORT: "Passport – for foreign Nationals.",
} as const;

export const SC_MONTHLY_INVESTOR_IDENTITY_PREFIX_LABELS = {
  NRIC: "NRIC – for local Malaysian Identification Card",
  PASSPORT: "Passport – for foreign nationals",
  ROC: "ROC",
} as const;

import {
  PROFILE_ADDRESS_FIELD_LABELS,
  PROFILE_ADDRESS_HELP,
  PROFILE_HELP,
  PROFILE_LABEL,
} from "./profile-field-copy";

/** Monthly issuer people: [05000] labels when the row is a shareholder; [06000] when board/management only. */
export function monthlyIssuerPersonCopy(roles: { shareholder: boolean; officer: boolean }) {
  if (roles.shareholder) {
    return {
      name: { ...SC_MONTHLY_SHAREHOLDER.shareholderName, label: PROFILE_LABEL.fullName },
      salutation: { label: PROFILE_LABEL.salutation, help: undefined },
      identityPrefix: { label: PROFILE_LABEL.identityPrefix },
      identityPrefixLabels: SC_MONTHLY_SHAREHOLDER_IDENTITY_PREFIX_LABELS,
      identity: {
        label: PROFILE_LABEL.identityNumber,
        help: PROFILE_HELP.identityNumberPersonOrCompany,
      },
      dateOfBirth: { label: PROFILE_LABEL.dateOfBirthOrIncorporation, help: undefined },
      nationality: { label: PROFILE_LABEL.nationalityOrCountry, help: undefined },
      gender: { label: PROFILE_LABEL.gender, help: undefined },
      address: { label: PROFILE_ADDRESS_FIELD_LABELS.address },
      addressState: { label: PROFILE_ADDRESS_FIELD_LABELS.state, help: PROFILE_ADDRESS_HELP.state },
      addressPostcode: { label: PROFILE_ADDRESS_FIELD_LABELS.postcode, help: PROFILE_ADDRESS_HELP.postcode },
      includeRocPrefix: true,
    };
  }
  return {
    name: { ...SC_MONTHLY_BOARD.name, label: PROFILE_LABEL.fullName },
    salutation: { label: PROFILE_LABEL.salutation, help: undefined },
    identityPrefix: { label: PROFILE_LABEL.identityPrefix },
    identityPrefixLabels: SC_MONTHLY_BOARD_IDENTITY_PREFIX_LABELS,
    identity: {
      label: PROFILE_LABEL.identityNumber,
      help: PROFILE_HELP.identityNumberNric,
    },
    dateOfBirth: { label: PROFILE_LABEL.dateOfBirth, help: undefined },
    nationality: { label: PROFILE_LABEL.nationality, help: undefined },
    gender: { label: PROFILE_LABEL.gender, help: undefined },
    address: { label: PROFILE_ADDRESS_FIELD_LABELS.address },
    addressState: { label: PROFILE_ADDRESS_FIELD_LABELS.state, help: PROFILE_ADDRESS_HELP.state },
    addressPostcode: { label: PROFILE_ADDRESS_FIELD_LABELS.postcode, help: PROFILE_ADDRESS_HELP.postcode },
    includeRocPrefix: false,
  };
}

export const SC_ANNUAL_ADVISOR_TYPE_LABELS = {
  ACCOUNTING: "Accounting – Accountant appointed by RMO.",
  AUDITOR: "Auditor – Auditor which RMO currently engages.",
  BANKER: "Banker – Bank which RMO currently engages for deposits and withdrawal of trust monies.",
  COMPLIANCE_AND_RISK: "Compliance & Risk – Advisor appointed to provide compliance and risk services.",
  CREDIT_RATING: "Credit Rating – Credit Rating/Scoring Agency the RMOs engages for services.",
  LEGAL: "Legal – Legal advisor appointed by the RMOs",
  TAXATION: "Taxation – Tax advisor appointed by the RMOs.",
  TRUSTEE_ESCROW:
    "Trustee/Escrow Account – Trustee which RMO currently engages to manage deposits and withdrawal of trust monies.",
} as const;

export const OPERATOR_SHAREHOLDER_BODY_KEYS = [
  "holderType",
  "entityType",
  "name",
  "salutation",
  "identityNumber",
  "dateOfBirth",
  "dateOfIncorporation",
  "nationality",
  "address",
  "dateAcquired",
  "dateDisposal",
  "shareType",
  "shareTypeOther",
  "shareholdingUnits",
  "shareholdingAmount",
  "shareholdingPercentage",
] as const;

export const OPERATOR_OFFICER_BODY_KEYS = [
  "personKind",
  "name",
  "salutation",
  "isResponsiblePerson",
  "identityNumber",
  "dateOfBirth",
  "nationality",
  "address",
  "designation",
  "designationOther",
  "appointmentDate",
  "resignationDate",
] as const;

export const OPERATOR_ADVISOR_BODY_KEYS = [
  "advisorType",
  "name",
  "registrationNumber",
  "country",
  "address",
  "appointmentDate",
  "cessationDate",
] as const;

export const OPERATOR_INTEREST_BODY_KEYS = [
  "name",
  "registrationNumber",
  "country",
  "address",
  "acquisitionDate",
  "disposalDate",
  "shareType",
  "shareTypeOther",
  "shareholdingUnits",
  "shareholdingPercentage",
] as const;

export const OPERATOR_FINANCIAL_STATEMENT_BODY_KEYS = [
  "consolidatedAccounts",
  "auditorName",
  "financialYearEnd",
  "unmodifiedReports",
  "dateTabledToBoard",
  "currency",
  "numberOfShares",
  "totalAssets",
  "nonCurrentAssets",
  "currentAssets",
  "totalEquity",
  "paidUpCapital",
  "shareApplicationAccount",
  "sharePremiumAndReserves",
  "accumulatedProfitCarriedForward",
  "equityMinorityInterest",
  "totalLiabilities",
  "nonCurrentLiabilities",
  "currentLiabilities",
  "totalRevenue",
  "revenueDonation",
  "revenueReward",
  "revenueLending",
  "revenueEquity",
  "revenueFees",
  "revenueOther",
  "incomeDepositInterest",
  "incomeOther",
  "totalCost",
  "costStaff",
  "costSystem",
  "costPromotion",
  "costOther",
  "profitBeforeTax",
  "taxation",
  "profitAfterTax",
  "pnlMinorityInterest",
  "netDividend",
] as const;
