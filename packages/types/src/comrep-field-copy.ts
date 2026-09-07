/**
 * Exact SC ComRep RMO-P2P field labels, dropdown wording, and definition help.
 * Labels are section-specific. Do not reuse one wording across tables.
 * Help text is taken from the SC definition/note only.
 */

export const SC_BRN_ROC_FORMAT_HELP =
  "All Company Registration Number (ROC) and/or SSM Business Registration Number (BRN) should be reported without dash or special characters or space, and the BRN and ROC must not be keyed in interchangeably.";

export const SC_NRIC_FORMAT_HELP =
  "National Registration Identity Card (NRIC) number should be reported without dash or special characters or space. e.g. 800101011234";

export const SC_LLP_SHARES_NOTE =
  "For purposes of reporting for LLPs, capital contribution shall be referred to as shares.";

export const SC_INTEGER_SHARES_HELP = "Integer value without decimal points.";

export const SC_APPENDIX_A_COUNTRY_HELP =
  "For the list of Country name – refer Appendix A.";

export const SC_BLANK_VALUE_HELP =
  "If there is no information to be completed, leave it blank, unless it is a mandatory column in the report. Do not fill in N/A or “–” or “Not Applicable”.";

/** Annual [00000] / [01000] */
export const SC_ANNUAL_GENERAL = {
  companyRegistrationNumber: {
    label: "Company Registration Number",
    help: "Please insert the RMO’s SSM Business Registration Number (BRN) or Company Registration Number (ROC), whichever was initially used and registered in ComRep. The BRN and ROC must not be keyed in interchangeably.",
    required: true as const,
    requiredReason: "CashSouk master completeness for all ComRep reports",
  },
  trusteeCompanyRegistrationNumber: {
    label: "Trustee Company Registration Number",
    help: "If preparing a Trustee report and Company(Trustee) is chosen in Reporting Level, please insert RMO’s Trustee’s BRN or ROC. The BRN and ROC must not be keyed in interchangeably.",
    required: false as const,
    requiredReason: "SC requires this only when Reporting Level = Company(Trustee)",
  },
  nameOfRmo: {
    label: "Name of RMO",
    help: "Please insert the name of RMO.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  nameOfResponsiblePerson: {
    label: "Name of Responsible Person",
    help: "Please insert name of the Responsible Person the RMO has appointed in accordance with the RMO Guidelines requirements and as duly informed to the SC. If there is more than 1 responsible person, then only 1 name is required.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  contactNumber: {
    label: "Contact Number",
    help: "Please insert the contact number of the Responsible Person.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  typeOfCompany: {
    label: "Type of Company",
    help: "CashSouk uses this SC Type of Company value to show the [02000] Sdn Bhd block or the Limited liability partnership block. It is not an annual [01000] ComRep column.",
    required: true as const,
    requiredReason: "CashSouk business requirement to select the [02000] share-capital block",
  },
} as const;

/** Annual [02000] Summary of Share Capital */
export const SC_ANNUAL_SHARE_CAPITAL = {
  ordinaryForSdnBhd: { label: "Ordinary (for Sdn Bhd)" },
  preferenceForSdnBhd: { label: "Preference (for Sdn Bhd)" },
  othersForSdnBhd: { label: "Others (for Sdn Bhd)" },
  totalPaidUpCapitalForSdnBhd: {
    label: "Total paid up capital (for Sdn Bhd)",
    help: "Please insert the total amount of issued and paid-up capital (RM) comprising of all the type of shares issued. Integer value without decimal points.",
    required: true as const,
    requiredReason: "CashSouk master completeness when Type of Company is Private Limited (Sdn Bhd)",
  },
  limitedLiabilityPartnership: { label: "Limited liability partnership" },
  membersCapital: {
    label: "Members' Capital",
    help: `${SC_INTEGER_SHARES_HELP} ${SC_LLP_SHARES_NOTE}`,
  },
  membersReserves: {
    label: "Members' Reserves",
    help: `Please insert information relating to Member’s reserve “shares” where relevant. ${SC_INTEGER_SHARES_HELP} ${SC_LLP_SHARES_NOTE}`,
  },
  subordinatedLoans: {
    label: "Subordinated Loans",
    help: "Please insert the relevant information pertaining to Subordinated Loans. Integer value without decimal points.",
  },
  totalLimitedLiabilityPartnership: {
    label: "Total Limited Liability Partnership",
    help: `Please insert total partners’ capital contribution for the LLP. ${SC_LLP_SHARES_NOTE}`,
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
    help: "Please insert the full name of the Shareholder of the RMO (i.e., Individual or Company) as per verified official documents. If the shareholder type is a Beneficial Owner please insert the name of the shareholder in this column.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  salutation: {
    label: "Salutation",
    help: "Please insert salutation for the Shareholder of the RMO only if the Shareholder is an individual or beneficial owner.",
    required: false as const,
  },
  icPassportNumber: {
    label: "IC/Passport number",
    help: "Local Malaysian individual: NRIC. Foreign individual: Passport. Company/legal entity: BRN or ROC.",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "For an individual, enter date of birth. For a company/legal entity, enter date of incorporation.",
    required: false as const,
  },
  nationality: {
    label: "Nationality",
    help: "For an individual, enter nationality. For a company/legal entity, enter country of incorporation. For the list of Country name – refer Appendix A.",
    required: false as const,
  },
  address: {
    label: "Address",
    help: "Use residential address for an individual and business address for an entity.",
    required: false as const,
  },
  dateAcquired: {
    label: "Date Acquired (dd/mm/yyyy)",
    help: "Please insert the date the shares were acquired by the Shareholder of the RMO as officially recorded with SSM, whether by initial subscription or through a share transfer.",
    required: false as const,
  },
  dateDisposal: {
    label: "Date Disposal (dd/mm/yyyy)",
    help: "Please insert the date the Shareholder of the RMO officially disposed of and transferred the Shares as recorded in SSM.",
    required: false as const,
  },
  typeOfShares: { label: "Type of Shares", required: false as const },
  typeOfSharesOthers: {
    label: "Type of Shares - Others (please specify)",
    help: "Please insert the type of shares if “others” was chosen in the previous column.",
    required: "conditional" as const,
    requiredReason: "Required only when Type of Shares = Others",
  },
  shareholdingUnits: { label: "Shareholding Units (Unit)", required: false as const },
  shareholdingAmount: { label: "Shareholding Amount (RM)", required: false as const },
  shareholdingPercentage: { label: "Shareholding Percentage (%)", required: false as const },
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
    help: "Please insert the full name as reflected per verified official documents (e.g., IC or passport).",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  salutation: {
    label: "Salutation",
    help: "Please insert salutation for the individual, if applicable.",
    required: false as const,
  },
  responsiblePerson: {
    label: "Responsible Person",
    help: "Please select one of the following values: Yes / No.",
    required: true as const,
    requiredReason: "SC requires Yes or No on each row; CashSouk completeness also requires at least one Yes",
  },
  identityNumber: {
    label: "Identity Number (NRIC/ Passport No.)",
    help: "Local Malaysian individual: NRIC. Foreign individual: Passport. NRIC numbers must be entered without dashes or space or special characters (e.g., 800101011234).",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "Please insert the date of birth of the individual. The date must follow the dd/mm/yyyy format.",
    required: false as const,
  },
  nationality: {
    label: "Nationality",
    help: "Please select one of the values for the nationality of the person. For the list of Country name – refer Appendix A.",
    required: false as const,
  },
  address: {
    label: "Address",
    help: "Please insert the residential address of the individual.",
    required: false as const,
  },
  designation: { label: "Designation", required: false as const },
  designationOthers: {
    label: "Designation - Others (Please specify)",
    help: "Please insert the Designation if “Others” was chosen in the previous column.",
    required: "conditional" as const,
    requiredReason: "Required only when Designation = Others",
  },
  appointmentDate: {
    label: "Appointment Date (dd/mm/yyyy)",
    help: "Please enter the date the individual was appointed to their current designation/position. The date must follow the dd/mm/yyyy format.",
    required: false as const,
  },
  resignationDate: {
    label: "Resignation date (dd/mm/yyyy)",
    help: "Please enter the date the individual ceased their role or stepped down from their current designation/position. The date must follow the dd/mm/yyyy format.",
    required: false as const,
  },
} as const;

/** Annual [05000] Advisor */
export const SC_ANNUAL_ADVISOR = {
  name: {
    label: "Name",
    help: "Please insert the full name of the Advisor appointed by the RMO as reflected per the verified official document issued for company.",
    required: true as const,
    requiredReason: "CashSouk completeness when an advisor row exists",
  },
  companyRegistrationNo: {
    label: "Company Registration No.",
    help: "Please insert the BRN and or ROC number as reflected per the verified official document issued for company.",
    required: false as const,
  },
  country: {
    label: "Country",
    help: "Please select one of the values for the nationality of the person or the entity’s country of incorporation. For the list of Country name – refer Appendix A.",
    required: false as const,
  },
  address: {
    label: "Address",
    help: "Please insert the Advisor’s business address.",
    required: false as const,
  },
  appointmentDate: {
    label: "Appointment Date (dd/mm/yyyy)",
    help: "Please insert the date of appointment of the Advisor to the RMO.",
    required: false as const,
  },
  cessationDate: {
    label: "Cessation Date (dd/mm/yyyy)",
    help: "Please insert the date the Advisor ceased as an Advisor to the RMO.",
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
    help: "Please insert the full name of the company as reflected per the verified official document issued for company.",
    required: true as const,
    requiredReason: "CashSouk completeness when an interest row exists",
  },
  roc: {
    label: "ROC",
    help: "Please insert the BRN or ROC number as reflected per the verified official document issued for Company.",
    required: false as const,
  },
  country: {
    label: "Country",
    help: "Please select one of the values for the entity’s country of incorporation. For the list of Country name – refer Appendix A.",
    required: false as const,
  },
  address: {
    label: "Address",
    help: "Please insert the business address of the company.",
    required: false as const,
  },
  acquisitionDate: {
    label: "Acquisition Date (dd/mm/yyyy)",
    help: "Please insert the acquisition date as recorded and registered in official documents.",
    required: false as const,
  },
  disposalDate: {
    label: "Disposal Date (dd/mm/yyyy)",
    help: "Please insert the date the shares were recorded and registered as transferred in official documents.",
    required: false as const,
  },
  typeOfShares: { label: "Type of Shares", required: false as const },
  typeOfSharesOthers: {
    label: "Type of Shares - Others (please specify)",
    help: "If Type of Shares selected above is “Others”: Please insert the type of shares.",
    required: "conditional" as const,
    requiredReason: "Required only when Type of Shares = Others",
  },
  shareholdingUnits: { label: "Shareholding Units (unit)", required: false as const },
  shareholdingPercentage: { label: "Shareholding Percentage (%)", required: false as const },
} as const;

/** Annual [11000] Financial Statement */
export const SC_ANNUAL_FINANCIAL = {
  consolidatedAccounts: {
    label: "Consolidated Accounts",
    help: "Yes – Select Yes if the financial information is prepared based on consolidated financial statements. No – Select No if the financial information is based on single-entity financial statements.",
    required: false as const,
  },
  auditorsName: {
    label: "Auditor's Name",
    help: "Please insert the full name of the Audit Firm as reflected per the verified official document issued for company.",
    required: false as const,
  },
  financialYearEnd: {
    label: "Financial Year End (dd/mm/yyyy)",
    required: true as const,
    requiredReason: "CashSouk master completeness when a financial statement row exists",
  },
  unmodifiedReports: { label: "UnModified Reports", required: false as const },
  dateOfTablingToBoard: { label: "Date of Tabling to Board (dd/mm/yyyy)", required: false as const },
  currency: { label: "Currency", required: false as const },
  numberOfShares: { label: "Number of Shares", required: false as const },
  totalAssets: { label: "Total Assets", required: true as const, requiredReason: "CashSouk master completeness" },
  nonCurrentAssets: { label: "Non-Current Assets", required: false as const },
  currentAssets: { label: "Current Assets", required: false as const },
  totalEquity: { label: "Total Equity", required: false as const },
  paidUpCapital: { label: "Paid-up Capital", required: false as const },
  shareApplicationAccount: { label: "Share Application Account", required: false as const },
  sharePremiumAndOtherReserves: { label: "Share Premium & Other Reserves", required: false as const },
  accumulatedProfitCarriedForward: { label: "Accumulated Profit Carried Forward", required: false as const },
  minorityInterest: { label: "Minority Interest", required: false as const },
  totalLiabilities: { label: "Total Liabilities", required: false as const },
  nonCurrentLiabilities: { label: "Non-Current Liabilities", required: false as const },
  currentLiabilities: { label: "Current Liabilities", required: false as const },
  totalRevenue: { label: "Total Revenue", required: true as const, requiredReason: "CashSouk master completeness" },
  donationBased: { label: "Donation Based", required: false as const },
  rewardBased: { label: "Reward Based", required: false as const },
  lendingBased: { label: "Lending Based", required: false as const },
  equityBased: { label: "Equity Based", required: false as const },
  feesCharges: { label: "Fees charges", required: false as const },
  otherRevenue: { label: "Other - Revenue", required: false as const },
  otherIncome: { label: "Other Income", required: false as const },
  interestFromDepositPlacement: { label: "Interest from deposit placement", required: false as const },
  otherIncomeLine: { label: "Other - Income", required: false as const },
  totalCost: { label: "Total Cost", required: false as const },
  staffCost: { label: "Staff Cost", required: false as const },
  systemCost: { label: "System Cost", required: false as const },
  promotionActivities: { label: "Promotion Activities", required: false as const },
  otherCost: { label: "Other - Cost", required: false as const },
  profitLossBeforeTax: {
    label: "Profit/(Loss) Before Tax",
    required: true as const,
    requiredReason: "CashSouk master completeness",
  },
  taxation: { label: "Taxation", required: false as const },
  profitLossAfterTax: { label: "Profit/(Loss) After Tax", required: false as const },
  netDividend: { label: "Net Dividend", required: false as const },
} as const;

/** Monthly [02000] Profile of Issuer */
export const SC_MONTHLY_ISSUER = {
  nameOfIssuer: { label: "Name of Issuer" },
  issuerRoc: {
    label: "Issuer ROC",
    help: "Please insert the BRN or ROC number as reflected per the verified official document issued for Company.",
  },
  companyCategory: {
    label: "Company category",
    help: "Technology: issuers or campaigns that focus on, or are related to, technology-based activities. Non-Technology: issuers or campaigns that are not primarily focused on technology-related activities.",
  },
  issuerIdIfAny: {
    label: "Issuer ID (if any)",
    help: "Please insert the unique ID assigned to the issuer who intends to raise funds on RMO’s platform.",
  },
  dateOfIncorporation: { label: "Date of Incorporation (dd/mm/yyyy)" },
  dateOfCommencement: { label: "Date of Commencement (dd/mm/yyyy)" },
  countryOfIncorporation: {
    label: "Country of Incorporation",
    help: SC_APPENDIX_A_COUNTRY_HELP,
  },
  typeOfCompany: { label: "Type of Company" },
  registeredAddress: { label: "Registered Address" },
  registeredAddressState: {
    label: "Registered Address - State",
    help: "The selection must align with the registered address stated above. If the location is outside Malaysia, select “Outside Malaysia.”",
  },
  registeredAddressPostcode: {
    label: "Registered Address - Postcode",
    help: "If the location is outside Malaysia, please enter the relevant international postcode (if applicable).",
  },
  businessAddress: {
    label: "Business Address",
    help: "If the issuer is a subsidiary of another company, please provide the information relating to the subsidiary.",
  },
  businessAddressState: {
    label: "Business Address - State",
    help: "The selection must align with the business address stated above. If the location is outside Malaysia, select “Outside Malaysia.”",
  },
  businessAddressPostcode: {
    label: "Business Address - Postcode",
    help: "If the location is outside Malaysia, please enter the relevant international postcode (if applicable).",
  },
  phoneNumber: {
    label: "Phone Number",
    help: "Where the issuer is a sole proprietor, partnership etc please insert the contact telephone number of relevant person(s) who liaise with the RMO for the purpose of raising funds.",
  },
  emailAddress: {
    label: "E-mail Address",
    help: "Where the issuer is a sole proprietor, partnership etc please insert the email address of relevant person(s) who liaise with the RMO for the purpose of raising funds.",
  },
  website: {
    label: "Website",
    help: "Please insert the URL link to the issuer’s website where applicable.",
  },
  companyActivities: {
    label: "Company Activities",
    help: "Please insert the issuer’s company activity based on the purpose of the issuer’s fundraising.",
  },
} as const;

/** Monthly [03000] campaign fields used in offer UI */
export const SC_MONTHLY_CAMPAIGN = {
  campaignSector: {
    label: "Campaign Sector",
    help: "Please select the relevant sector relating to the specific fundraising campaign. Definitions should be based on SME Corp’s definitions.",
  },
  sustainabilityCategory: { label: "Sustainability Category of the Campaign" },
  purposeOfFundRaising: { label: "Purpose of Fund Raising" },
  purposeOfFundRaisingOthers: {
    label: "Purpose of Fund Raising - Others (please specify)",
    help: "Please insert the purpose of financing if RMO chose “Others” in Purpose of Fund Raising above.",
  },
} as const;

/** Monthly [05000] Issuer - Shareholding Structure */
export const SC_MONTHLY_SHAREHOLDER = {
  shareholderType: { label: "Shareholder Type" },
  shareholderName: {
    label: "Shareholder Name",
    help: "Please insert the full name of the Shareholder of the issuer (i.e., Individual or Company or Beneficial Owner) as reflected per the verified official documents.",
  },
  salutation: {
    label: "Salutation (if applicable)",
    help: "Please insert salutation for the Shareholder of the issuer only if the Shareholder is an individual.",
  },
  identityPrefix: { label: "Identity Prefix" },
  shareholderIdentity: {
    label: "Shareholder Identity (NRIC/Passport/Company Registration No.)",
    help: "Local Malaysian individual: NRIC. Foreign individual: Passport. Company: BRN or ROC.",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "If Shareholder Type is an Individual, insert date of birth. If Shareholder Type is a Company, insert Date of Incorporation.",
  },
  gender: {
    label: "Gender",
    help: "Not Applicable is only chosen if the shareholder is a non-individual entity. As for individuals, please insert the gender as reflected per the verified official documents.",
  },
  nationalityCountry: {
    label: "Nationality/Country",
    help: "If Individual, select the nationality. If Company, select the Country of Incorporation. For the list of Country name – refer Appendix A.",
  },
  businessResidentialAddress: { label: "Business/Residential Address" },
  businessResidentialAddressState: {
    label: "Business/Residential Address - State",
    help: "The selection must align with the business address stated above.",
  },
  businessResidentialAddressPostcode: {
    label: "Business/Residential Address - Postcode",
    help: "If the location is outside Malaysia, please enter the relevant international postcode (if applicable).",
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
    help: "Please insert the full name as reflected per the verified official documents (e.g., IC or passport).",
  },
  salutation: {
    label: "Salutation (if applicable)",
    help: "Please insert the salutation of the individual named here.",
  },
  identityPrefix: { label: "Identity Prefix" },
  identityNumber: {
    label: "Identity Number (NRIC/Passport No.)",
    help: "Local Malaysian individual: NRIC. Foreign individual: Passport. NRIC numbers must be entered without dashes or special characters (e.g., 800101011234).",
  },
  gender: {
    label: "Gender",
    help: "Please insert the gender of the individual named here, as reflected per the verified official documents.",
  },
  dateOfBirth: {
    label: "Date of Birth (dd/mm/yyyy)",
    help: "Please insert date of birth of the individual named here, as reflected per the verified official documents.",
  },
  nationality: {
    label: "Nationality",
    help: "Please select one of the values for the nationality of the individual named here. For the list of Country name – refer Appendix A.",
  },
  residentialAddress: { label: "Residential Address" },
  residentialAddressState: {
    label: "Residential Address - State",
    help: "The selection must align with the residential address stated above.",
  },
  residentialAddressPostcode: {
    label: "Residential Address - Postcode",
    help: "If the location is outside Malaysia, please enter the relevant international postcode (if applicable).",
  },
  designation: { label: "Designation" },
  designationOthers: {
    label: "Designation - Others (please specify)",
    help: "If Others is chosen in Designation above, please insert the designation of the individual named here.",
  },
  appointmentDate: { label: "Appointment Date (dd/mm/yyyy)" },
  resignationDate: {
    label: "Resignation Date (dd/mm/yyyy)",
    help: "Please insert the resignation date of the individual named here, where applicable.",
  },
} as const;

/** Monthly [07000] Investor Details */
export const SC_MONTHLY_INVESTOR = {
  investorName: {
    label: "Investor Name",
    help: "Please insert the investor name as reflected per the verified official documents.",
  },
  identityPrefix: { label: "Identity Prefix" },
  investorIdentification: {
    label: "Investor Identification (NRIC / Passport / Company Registration No.)",
    help: "Local Malaysian individual: NRIC. Foreign individual: Passport. Company/legal entity: BRN or ROC.",
  },
  dateOfBirthIncorporation: {
    label: "Date of Birth/Incorporation (dd/mm/yyyy)",
    help: "Please insert the (a) date of birth (if the investor is an individual) or (b) date of incorporation (if the investor is a company / legal entity) of the investor.",
  },
  gender: {
    label: "Gender",
    help: "Not Applicable is only chosen if the investor is a non-individual. For individuals, please insert their gender as reflected per the verified official documents.",
  },
  businessResidentialAddressState: {
    label: "Business/Residential Address - State",
    help: "The business/residential address must reflect the investors current address which may or may not necessarily be the address reflected in their IC.",
  },
  businessResidentialAddressPostcode: { label: "Business/Residential Address - Postcode" },
  nationalityCountry: {
    label: "Nationality/Country",
    help: "Please select one of the values for the nationality of the person or the entity’s country of incorporation. For the list of Country name – refer Appendix A.",
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

export const SC_MONTHLY_ISSUER_FINANCIAL_HELP: Record<string, string> = {
  bscatot:
    "Please insert issuer’s financial information based on the latest available audited financial statements or management account (where applicable).",
  equity_share_application: "Where applicable.",
  equity_share_premium: "Where applicable.",
  equity_minority: "Where applicable.",
};

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

/** Monthly issuer people: [05000] labels when the row is a shareholder; [06000] when board/management only. */
export function monthlyIssuerPersonCopy(roles: { shareholder: boolean; officer: boolean }) {
  if (roles.shareholder) {
    return {
      name: SC_MONTHLY_SHAREHOLDER.shareholderName,
      salutation: SC_MONTHLY_SHAREHOLDER.salutation,
      identityPrefix: SC_MONTHLY_SHAREHOLDER.identityPrefix,
      identityPrefixLabels: SC_MONTHLY_SHAREHOLDER_IDENTITY_PREFIX_LABELS,
      identity: SC_MONTHLY_SHAREHOLDER.shareholderIdentity,
      dateOfBirth: SC_MONTHLY_SHAREHOLDER.dateOfBirth,
      nationality: SC_MONTHLY_SHAREHOLDER.nationalityCountry,
      gender: SC_MONTHLY_SHAREHOLDER.gender,
      address: SC_MONTHLY_SHAREHOLDER.businessResidentialAddress,
      addressState: SC_MONTHLY_SHAREHOLDER.businessResidentialAddressState,
      addressPostcode: SC_MONTHLY_SHAREHOLDER.businessResidentialAddressPostcode,
      includeRocPrefix: true,
    };
  }
  return {
    name: SC_MONTHLY_BOARD.name,
    salutation: SC_MONTHLY_BOARD.salutation,
    identityPrefix: SC_MONTHLY_BOARD.identityPrefix,
    identityPrefixLabels: SC_MONTHLY_BOARD_IDENTITY_PREFIX_LABELS,
    identity: SC_MONTHLY_BOARD.identityNumber,
    dateOfBirth: SC_MONTHLY_BOARD.dateOfBirth,
    nationality: SC_MONTHLY_BOARD.nationality,
    gender: SC_MONTHLY_BOARD.gender,
    address: SC_MONTHLY_BOARD.residentialAddress,
    addressState: SC_MONTHLY_BOARD.residentialAddressState,
    addressPostcode: SC_MONTHLY_BOARD.residentialAddressPostcode,
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
