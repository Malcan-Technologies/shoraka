/**
 * Local Admin People & Access demo fixtures.
 * Shapes match current people[] / OPP / CtosPartySupplement / kyc_response contracts.
 * CTOS company_json follows apps/api/src/ctos-test/output company reports (sanitized names/IDs).
 */
import {
  isIssuerShareholderOnlyBelowMinimum,
  PERSON_IDENTITY_CONFLICT_KEY,
  type PersonIdentityConflict,
} from "@cashsouk/types";

export const ADMIN_PEOPLE_DEMO_FIXED_AT = "2026-03-01T08:00:00.000Z";
export const ADMIN_PEOPLE_DEMO_SCREENED_AT = "2026-03-01T09:15:00.000Z";
export const ADMIN_PEOPLE_DEMO_INVITE_PENDING_EXPIRES = "2027-06-01T00:00:00.000Z";
export const ADMIN_PEOPLE_DEMO_INVITE_EXPIRED_AT = "2025-01-15T00:00:00.000Z";
export const ADMIN_PEOPLE_DEMO_CTOS_LATEST_AT = "2026-03-01T10:00:00.000Z";
export const ADMIN_PEOPLE_DEMO_CTOS_OLDER_AT = "2025-09-01T10:00:00.000Z";

export const ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID = "seed_admin_people_test_issuer_org";
export const ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID = "seed_admin_people_test_investor_org";
export const ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID = "seed_admin_people_test_personal_org";

export const ADMIN_PEOPLE_DEMO_ISSUER_NAME = "Admin People Test Sdn Bhd";
export const ADMIN_PEOPLE_DEMO_INVESTOR_NAME = "Admin People Test Investor Sdn Bhd";
export const ADMIN_PEOPLE_DEMO_PERSONAL_NAME = "Lina Aziz";

export const ADMIN_PEOPLE_DEMO_ISSUER_REF = "ISS-APTDEMO";
export const ADMIN_PEOPLE_DEMO_INVESTOR_REF = "IVT-APTDEMO";
export const ADMIN_PEOPLE_DEMO_PERSONAL_REF = "IVT-APTPERS";

export const ADMIN_PEOPLE_DEMO_CTOS_FIXTURE =
  "apps/api/src/ctos-test/output/2026-09-07T13-18-48-048Z_company_200501525124.json";

/** Fictional NRIC/ROC keys — structure matches CTOS nic_brno / ic_lcno, not live customer IDs. */
export const ADMIN_PEOPLE_DEMO_IC = {
  alice: "880101145001",
  benjamin: "850505145002",
  chloe: "900909145003",
  daniel: "820202145004",
  evelyn: "920303145005",
  farid: "870707145006",
  grace: "910404145007",
  henry: "860606145008",
  irene: "890808145009",
  jason: "840101145010",
  karen: "930202145011",
  nathanObserved: "800101145012",
  olivia: "950505145013",
  peter: "810303145014",
  legacyHoldings: "202001A",
  raj: "770101145021",
  siti: "780202145022",
  wei: "790303145023",
  gina: "810404145024",
  owen: "950606145025",
  apexNominees: "201801B",
} as const;

export const ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY = "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";

export const ADMIN_PEOPLE_DEMO_PARTY_ID = {
  alice: "seed_apt_alice",
  benjamin: "seed_apt_benjamin",
  chloe: "seed_apt_chloe",
  daniel: "seed_apt_daniel",
  evelyn: "seed_apt_evelyn",
  farid: "seed_apt_farid",
  grace: "seed_apt_grace",
  henry: "seed_apt_henry",
  irene: "seed_apt_irene",
  jason: "seed_apt_jason",
  karen: "seed_apt_karen",
  nathanOnboarding: "seed_apt_nathan_onboarding",
  nathanObserved: "seed_apt_nathan_ctos",
  olivia: "seed_apt_olivia",
  peter: "seed_apt_peter",
  legacy: "seed_apt_legacy",
  raj: "seed_apt_inv_raj",
  siti: "seed_apt_inv_siti",
  wei: "seed_apt_inv_wei",
  gina: "seed_apt_inv_gina",
  owen: "seed_apt_inv_owen",
  apex: "seed_apt_inv_apex",
} as const;

export const ADMIN_PEOPLE_DEMO_EMAIL = {
  daniel: "daniel.wong@admin-people-test.example",
  benjaminPerson: "person.contact@admin-people-test.example",
  benjaminAccount: "login.account@admin-people-test.example",
  chloe: "chloe.lim@admin-people-test.example",
  finance: "finance.user@admin-people-test.example",
  operations: "operations.admin@admin-people-test.example",
  evelyn: "evelyn.goh@admin-people-test.example",
  farid: "farid.ahmad@admin-people-test.example",
  karen: "karen.ho@admin-people-test.example",
  priya: "priya.menon@admin-people-test.example",
  siti: "siti.rahman@admin-people-test.example",
  investorOps: "investor.ops@admin-people-test.example",
  lina: "lina.aziz@admin-people-test.example",
} as const;

export const ADMIN_PEOPLE_DEMO_INVITE = {
  evelynToken: "seed-apt-invite-evelyn-pending",
  faridToken: "seed-apt-invite-farid-expired",
} as const;

export const ADMIN_PEOPLE_DEMO_REPORT = {
  issuerLatest: "seed_apt_issuer_ctos_latest",
  issuerOlder: "seed_apt_issuer_ctos_older",
  investorLatest: "seed_apt_investor_ctos_latest",
  investorOlder: "seed_apt_investor_ctos_older",
} as const;

export const ADMIN_PEOPLE_DEMO_COD = {
  issuerRequestId: "COD90081",
  issuerReferenceId: "REF90081",
  investorRequestId: "COD90082",
  investorReferenceId: "REF90082",
  personalRequestId: "LD90083",
  personalReferenceId: "REF90083",
} as const;

export type AdminPeopleDemoCtosDirector = {
  name: string;
  nic_brno: string | null;
  ic_lcno: string | null;
  position: "DO" | "SO" | "DS";
  party_type: "I" | "C";
  equity_percentage: number;
  appoint: string | null;
  addr: string | null;
};

export function adminPeopleDemoKycResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tags: ["demo", "admin-people-test"],
    status: "Approved",
    assignee: "",
    systemId: "KYC-APT-001",
    requestId: "KYC-APT-001",
    riskLevel: "Low Risk",
    riskScore: "1.0",
    timestamp: ADMIN_PEOPLE_DEMO_SCREENED_AT,
    referenceId: "APT-REF",
    onboardingId: "EOD-APT-ORG",
    messageStatus: "DONE",
    possibleMatchCount: 0,
    blacklistedMatchCount: 0,
    ...overrides,
  };
}

export function adminPeopleDemoWealthDeclaration(): Record<string, unknown> {
  return {
    content: [
      { fieldName: "NetAssetValue", fieldType: "text", fieldValue: "2500000", alias: "Net Asset Value" },
      {
        fieldName: "SourceOfFunds",
        fieldType: "multi-checkbox",
        fieldValue: ["Business income"],
        alias: "Source of Funds",
      },
      { fieldName: "SourceOfFundsOther", fieldType: "text", fieldValue: "-", alias: "Source of Funds (Other)" },
    ],
    displayArea: "wealth_declaration",
  };
}

export function adminPeopleDemoPersonalWealthDeclaration(): Record<string, unknown> {
  return {
    content: [
      { cn: false, fieldName: "Employment status", fieldType: "picklist", fieldValue: "Employed" },
      { cn: false, fieldName: "Employer", fieldType: "text", fieldValue: "Admin People Test" },
      {
        cn: false,
        fieldName: "Industry",
        fieldType: "picklist",
        fieldValue: "Information & Communication Technology (ICT)",
      },
      { cn: false, fieldName: "Job title", fieldType: "text", fieldValue: "Analyst" },
      { cn: false, fieldName: "Annual income range", fieldType: "picklist", fieldValue: "RM120,001 - RM180,000" },
      {
        cn: false,
        fieldName: "Source of funds",
        fieldType: "multi-checkbox",
        fieldValue: ["Employment Income"],
      },
    ],
    displayArea: "Wealth Declaration",
  };
}

export function adminPeopleDemoDocumentInfo(): Record<string, unknown> {
  return {
    countryCode: "MY",
    documentType: "Identity",
    frontDocumentUrl:
      "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/front/2c083615-6483-449a-8cb7-61cb042c48c6.jpeg",
    backDocumentUrl:
      "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/back/e69e0210-2d14-48f2-84c4-ad5ead3a11fb.png",
  };
}

export function adminPeopleDemoLiveness(): Record<string, unknown> {
  return {
    selfieUrl:
      "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/live-face/99e37a95-e3bc-4211-bd73-dcfa8de9a515.jpeg",
    confidence: 88.1,
    documentUrl:
      "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/front/2c083615-6483-449a-8cb7-61cb042c48c6.jpeg",
    verifyStatus: "LIVENESS_PASSED",
    selfieVideoUrl:
      "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/live-face/c1a63023-cd7f-452d-8296-4a46563b53d7.mp4",
  };
}

export function adminPeopleDemoCompliance(): Record<string, unknown> {
  return {
    content: [
      { fieldName: "PepStatus", fieldType: "multi-checkbox", fieldValue: ["- Not a PEP"], alias: "PEP Status" },
      {
        fieldName: "BelongsToGroups",
        fieldType: "multi-checkbox",
        fieldValue: ["- Not a PEP"],
        alias: "Belongs to Groups",
      },
    ],
    displayArea: "compliance_declaration",
  };
}

export function adminPeopleDemoBankDetails(accountNumber: string): Record<string, unknown> {
  return {
    content: [
      { fieldName: "Bank", fieldType: "picklist", fieldValue: "Maybank / Malayan Banking Berhad", alias: "Bank" },
      { fieldName: "bankAccountNumber", fieldType: "text", fieldValue: accountNumber, alias: "Bank account number" },
      { fieldName: "accountType", fieldType: "picklist", fieldValue: "Current", alias: "Account type" },
    ],
    displayArea: "bank_account_details",
  };
}

export function adminPeopleDemoMatchedObservation(params: {
  name: string;
  identityNumber: string;
  entityType: "INDIVIDUAL" | "CORPORATE";
  isDirector: boolean;
  isShareholder: boolean;
  shareholdingPercentage: number | null;
  appointmentDate?: string | null;
}): Record<string, unknown> {
  return {
    name: params.name,
    identityNumber: params.identityNumber,
    entityType: params.entityType,
    isDirector: params.isDirector,
    isShareholder: params.isShareholder,
    shareholdingPercentage: params.shareholdingPercentage,
    appointmentDate: params.appointmentDate ?? "01-03-2020",
    resignationDate: null,
  };
}

export function adminPeopleDemoHenryObservation(): Record<string, unknown> {
  return {
    ...adminPeopleDemoMatchedObservation({
      name: "Henry Teo",
      identityNumber: ADMIN_PEOPLE_DEMO_IC.henry,
      entityType: "INDIVIDUAL",
      isDirector: true,
      isShareholder: true,
      shareholdingPercentage: 35,
      appointmentDate: "15-06-2018",
    }),
    designation: "Managing Director",
  };
}

export function adminPeopleDemoNathanIdentityConflict(): PersonIdentityConflict {
  return {
    status: "BLOCKED",
    canonicalIdentity: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
    otherPartyId: ADMIN_PEOPLE_DEMO_PARTY_ID.nathanObserved,
    otherPartyKey: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
    otherMembershipStatus: "EXTERNAL_OBSERVED",
    source: "CTOS_OBSERVE",
    at: ADMIN_PEOPLE_DEMO_FIXED_AT,
  };
}

export function adminPeopleDemoNathanOnboardingObservation(): Record<string, unknown> {
  return {
    name: "Nathan Chong",
    identityNumber: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
    [PERSON_IDENTITY_CONFLICT_KEY]: adminPeopleDemoNathanIdentityConflict(),
  };
}

export function adminPeopleDemoOliviaIsBelowFivePercent(): boolean {
  return isIssuerShareholderOnlyBelowMinimum({
    isShareholder: true,
    isDirector: false,
    isBoard: false,
    isManagement: false,
    shareholdingPercentage: 3,
  });
}

export function adminPeopleDemoSupplement(params: {
  requestId?: string;
  status: string;
  email?: string;
  screeningStatus?: string | null;
  screeningRequestId?: string;
}): Record<string, unknown> {
  const requestId = params.requestId?.trim() ?? "";
  const notStarted = !requestId || params.status === "NOT_STARTED";
  const screening =
    params.screeningStatus == null || params.screeningStatus === ""
      ? null
      : {
          requestId: params.screeningRequestId ?? (requestId ? `KYC${requestId.replace(/^[A-Z]+/, "")}` : "KYC90000"),
          status: params.screeningStatus,
          riskLevel: params.screeningStatus === "APPROVED" ? "LOW" : "MEDIUM",
          riskScore: params.screeningStatus === "APPROVED" ? "1.0" : "2.5",
          provider: "REGTANK",
          updatedAt: ADMIN_PEOPLE_DEMO_SCREENED_AT,
          messageStatus: "DONE",
          possibleMatchCount: 0,
          blacklistedMatchCount: 0,
        };
  return {
    requestId,
    status: params.status,
    email: params.email,
    verifyLink: requestId ? `https://onboarding.regtank.com/verify/${requestId}` : undefined,
    referenceId: requestId || undefined,
    sentAt: notStarted ? undefined : ADMIN_PEOPLE_DEMO_FIXED_AT,
    updatedAt: ADMIN_PEOPLE_DEMO_SCREENED_AT,
    screening,
  };
}

function directorRow(params: AdminPeopleDemoCtosDirector): Record<string, unknown> {
  return {
    name: params.name,
    alias: null,
    ic_lcno: params.ic_lcno,
    nic_brno: params.nic_brno,
    position: params.position,
    addr: params.addr,
    appoint: params.appoint,
    resign_date: null,
    equity: params.equity_percentage > 0 ? params.equity_percentage * 1000 : 0,
    equity_percentage: params.equity_percentage,
    remark: null,
    party_type: params.party_type,
  };
}

export function adminPeopleDemoIssuerCtosDirectors(includeIrene: boolean): AdminPeopleDemoCtosDirector[] {
  const rows: AdminPeopleDemoCtosDirector[] = [
    {
      name: "Alice Tan",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.alice,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-03-2020",
      addr: "1 Jalan Demo, 50450 Kuala Lumpur",
    },
    {
      name: "Benjamin Lee",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.benjamin,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 10,
      appoint: "01-03-2020",
      addr: null,
    },
    {
      name: "Chloe Lim",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.chloe,
      ic_lcno: null,
      position: "DS",
      party_type: "I",
      equity_percentage: 25,
      appoint: "12-04-2019",
      addr: null,
    },
    {
      name: "Daniel Wong",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.daniel,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-01-2018",
      addr: null,
    },
    {
      name: "Evelyn Goh",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.evelyn,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "08-08-2021",
      addr: null,
    },
    {
      name: "Farid Ahmad",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.farid,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 8,
      appoint: "08-08-2021",
      addr: null,
    },
    {
      name: "Grace Ong",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.grace,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "20-02-2024",
      addr: null,
    },
    {
      name: "Henry Teo",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.henry,
      ic_lcno: null,
      position: "DS",
      party_type: "I",
      equity_percentage: 35,
      appoint: "15-06-2018",
      addr: null,
    },
    {
      name: "Peter Lim",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.peter,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-07-2017",
      addr: null,
    },
    {
      name: "Jason Ng",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.jason,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-01-2015",
      addr: null,
    },
    {
      name: "Karen Ho",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.karen,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 6,
      appoint: "01-01-2016",
      addr: null,
    },
    {
      name: "Nathan Chong",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-09-2022",
      addr: null,
    },
    {
      name: "Olivia Chan",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.olivia,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 3,
      appoint: "01-11-2023",
      addr: null,
    },
    {
      name: "Legacy Holdings Sdn Bhd",
      nic_brno: null,
      ic_lcno: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
      position: "SO",
      party_type: "C",
      equity_percentage: 20,
      appoint: null,
      addr: null,
    },
  ];
  if (includeIrene) {
    rows.push({
      name: "Irene Yap",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.irene,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-05-2016",
      addr: null,
    });
  }
  return rows;
}

export function adminPeopleDemoCtosCompanyJson(params: {
  companyName: string;
  brn: string;
  directors: AdminPeopleDemoCtosDirector[];
}): Record<string, unknown> {
  return {
    ptype: "C",
    pcode: "24",
    name: params.companyName,
    brn_ssm: params.brn,
    ic_lcno: params.brn,
    nic_brno: null,
    additional_registration_no: null,
    status: "EXISTING",
    type_of_business: "SOFTWARE DEVELOPMENT",
    comp_type: "PRIVATE LIMITED",
    comp_category: "LIMITED BY SHARES",
    address: {
      full: "12, Jalan Ampang, 50450 Kuala Lumpur",
      line1: "12, Jalan Ampang",
      line2: null,
      city: "Kuala Lumpur",
      state: "Wilayah Persekutuan",
      postcode: "50450",
    },
    msic_ssms: [{ code: "62010", priority: "1", description: "Computer programming" }],
    partners: [],
    directors: params.directors.map(directorRow),
    shareholders: [],
  };
}

export function adminPeopleDemoCtosSummary(): Record<string, unknown> {
  return {
    fico_score: 0,
    fico_factors: ["Demo seed — score not generated."],
    bankruptcy: false,
    legal: { total_cases: 0, total_amount: 0 },
    ccris: { applications: 0, approved: 0, pending: 0, arrears: 0 },
    dcheqs: { raw_flag: 0 },
    enquiry_error: null,
  };
}

export function adminPeopleDemoCtosLegalJson(): Record<string, unknown> {
  return { cases: [] };
}

export function adminPeopleDemoCtosCcrisJson(): Record<string, unknown> {
  return { summary: { total_limit: null, total_outstanding: null } };
}

export function adminPeopleDemoCtosFinancials(): Record<string, unknown>[] {
  return [
    {
      financial_year: 2024,
      dates: { pldd: "31-12-2024", bsdd: "2024-12-31" },
      account: {
        bsfatot: 1200000,
        othass: 0,
        bscatot: 3400000,
        bsclbank: 800000,
        totass: 4600000,
        curlib: 900000,
        bsslltd: 400000,
        bsclstd: 0,
        totlib: 1300000,
        bsqpuc: 1000000,
        turnover: 5200000,
        plnpbt: 640000,
        plnpat: 480000,
        plnetdiv: 0,
        plyear: 480000,
        networth: 3300000,
        turnover_growth: 0,
        profit_margin: 12.3,
        return_on_equity: 14.5,
        currat: 3.7,
        workcap: 2500000,
      },
    },
  ];
}

export function adminPeopleDemoIssuerFinancialStatements(): Record<string, unknown> {
  return {
    unaudited_by_year: {
      "2024": {
        bscatot: 3400000,
        assets_non_current: 1200000,
        curlib_borrowing: 400000,
        curlib_non_borrowing: 500000,
        ncl_loan: 300000,
        ncl_non_loan: 100000,
        bsqpuc: 1000000,
        equity_accumulated_profit: 2300000,
        turnover: 5200000,
        operating_cost: 3100000,
        admin_cost: 900000,
        interest_cost: 120000,
        other_cost: 440000,
        plnpbt: 640000,
        plnpat: 480000,
        pl_minority: 0,
        plnetdiv: 0,
      },
    },
  };
}

export function adminPeopleDemoCtosHtml(companyName: string): string {
  return `<html><body><h1>CTOS report (demo)</h1><p>${companyName}</p><p>Sanitized local seed. Structure adapted from ${ADMIN_PEOPLE_DEMO_CTOS_FIXTURE}.</p></body></html>`;
}

export function adminPeopleDemoCtosXml(companyName: string, brn: string): string {
  return `<enq><company><name>${companyName}</name><ic_lcno>${brn}</ic_lcno></company></enq>`;
}

export type AdminPeopleDemoMatrixRow = {
  name: string;
  companyRole: string;
  platformAccess: string;
  kyc: string;
  aml: string;
  ctos: string;
  masterState: string;
  specialCase: string;
};

export const ADMIN_PEOPLE_DEMO_ISSUER_MATRIX: AdminPeopleDemoMatrixRow[] = [
  {
    name: "Alice Tan",
    companyRole: "Director",
    platformAccess: "No access",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Director without platform access",
  },
  {
    name: "Benjamin Lee",
    companyRole: "Shareholder 10%",
    platformAccess: "User",
    kyc: "Approved",
    aml: "Pending",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Person Email ≠ Account Email",
  },
  {
    name: "Chloe Lim",
    companyRole: "Director, Shareholder 25%",
    platformAccess: "Admin",
    kyc: "Pending approval",
    aml: "Not started",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Admin access",
  },
  {
    name: "Daniel Wong",
    companyRole: "Director",
    platformAccess: "Owner",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Owner via owner_user_id",
  },
  {
    name: "Finance User",
    companyRole: "—",
    platformAccess: "User",
    kyc: "—",
    aml: "—",
    ctos: "—",
    masterState: "platform_only",
    specialCase: "OrganizationMember without party",
  },
  {
    name: "Operations Admin",
    companyRole: "—",
    platformAccess: "Admin",
    kyc: "—",
    aml: "—",
    ctos: "—",
    masterState: "platform_only",
    specialCase: "OrganizationMember Admin without party",
  },
  {
    name: "Evelyn Goh",
    companyRole: "Director",
    platformAccess: "Invitation sent",
    kyc: "In progress",
    aml: "Pending",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Person-scoped pending invitation",
  },
  {
    name: "Farid Ahmad",
    companyRole: "Shareholder 8%",
    platformAccess: "Invitation expired",
    kyc: "Not started",
    aml: "Not started",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Person-scoped expired invitation",
  },
  {
    name: "Grace Ong",
    companyRole: "Director",
    platformAccess: "—",
    kyc: "—",
    aml: "—",
    ctos: "Observed only",
    masterState: "EXTERNAL_OBSERVED",
    specialCase: "CTOS observed, no master party",
  },
  {
    name: "Henry Teo",
    companyRole: "Director, Shareholder 20%",
    platformAccess: "No access",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Differs",
    masterState: "MASTER_ACTIVE",
    specialCase: "CTOS shareholding 35% vs master 20%",
  },
  {
    name: "Irene Yap",
    companyRole: "Director",
    platformAccess: "No access",
    kyc: "Expired",
    aml: "Pending",
    ctos: "Not found",
    masterState: "MASTER_ACTIVE",
    specialCase: "absentFromLatestExternal",
  },
  {
    name: "Jason Ng",
    companyRole: "Director",
    platformAccess: "No access",
    kyc: "Rejected",
    aml: "Rejected",
    ctos: "Matched",
    masterState: "MASTER_INACTIVE",
    specialCase: "Inactive, no member",
  },
  {
    name: "Karen Ho",
    companyRole: "Shareholder 6%",
    platformAccess: "User",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_INACTIVE",
    specialCase: "Inactive with preserved OrganizationMember",
  },
  {
    name: "Legacy Holdings Sdn Bhd",
    companyRole: "Shareholder 20%",
    platformAccess: "—",
    kyc: "—",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Corporate shareholder KYB AML",
  },
  {
    name: "Nathan Chong",
    companyRole: "Director",
    platformAccess: "No access",
    kyc: "In progress",
    aml: "Not started",
    ctos: "Differs",
    masterState: "MASTER_ACTIVE",
    specialCase: "Identity conflict BLOCKED vs CTOS observed twin",
  },
  {
    name: "Olivia Chan",
    companyRole: "Shareholder 3%",
    platformAccess: "—",
    kyc: "—",
    aml: "—",
    ctos: "Observed only",
    masterState: "EXTERNAL_OBSERVED",
    specialCase: "Below 5% Adopt gate",
  },
    {
      name: "Peter Lim",
      companyRole: "Director",
      platformAccess: "No access",
      kyc: "Rejected",
      aml: "Rejected",
      ctos: "Matched",
      masterState: "MASTER_ACTIVE",
      specialCase: "Active KYC/AML Rejected",
    },
  ];

export const ADMIN_PEOPLE_DEMO_INVESTOR_MATRIX: AdminPeopleDemoMatrixRow[] = [
  {
    name: "Priya Menon",
    companyRole: "—",
    platformAccess: "Owner",
    kyc: "—",
    aml: "—",
    ctos: "—",
    masterState: "platform_only",
    specialCase: "Owner via owner_user_id, no party profile",
  },
  {
    name: "Raj Kumar",
    companyRole: "Director",
    platformAccess: "No access",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Investor director",
  },
  {
    name: "Siti Rahman",
    companyRole: "Shareholder 12%",
    platformAccess: "User",
    kyc: "Approved",
    aml: "Pending",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "KYC Approved + AML Pending",
  },
  {
    name: "Wei Ming",
    companyRole: "Director, Shareholder 18%",
    platformAccess: "No access",
    kyc: "Approved",
    aml: "Approved",
    ctos: "Differs",
    masterState: "MASTER_ACTIVE",
    specialCase: "CTOS shareholding 30% vs master 18%",
  },
  {
    name: "Gina Foo",
    companyRole: "Director",
    platformAccess: "—",
    kyc: "—",
    aml: "—",
    ctos: "Observed only",
    masterState: "EXTERNAL_OBSERVED",
    specialCase: "Investor CTOS observed director",
  },
  {
    name: "Owen Chin",
    companyRole: "Shareholder 3%",
    platformAccess: "—",
    kyc: "—",
    aml: "—",
    ctos: "Observed only",
    masterState: "EXTERNAL_OBSERVED",
    specialCase: "Investor below 5% Adopt gate",
  },
  {
    name: "Apex Nominees Sdn Bhd",
    companyRole: "Shareholder 15%",
    platformAccess: "—",
    kyc: "—",
    aml: "Approved",
    ctos: "Matched",
    masterState: "MASTER_ACTIVE",
    specialCase: "Investor corporate shareholder",
  },
  {
    name: "Investor Ops",
    companyRole: "—",
    platformAccess: "User",
    kyc: "—",
    aml: "—",
    ctos: "—",
    masterState: "platform_only",
    specialCase: "OrganizationMember without party",
  },
];

export const ADMIN_PEOPLE_DEMO_UNSUPPORTED = [
  {
    caseId: 16,
    name: "Michelle Low — people-only unmatched row",
    reason:
      "Once a structured master exists, retainMasterActiveOperationalPeople drops people[] rows whose matchKey is not MASTER_ACTIVE. A CTOS-only Michelle never reaches people_only. Creating an OrganizationPartyProfile would make her a linked person. This seed does not change that filter.",
  },
] as const;

export function adminPeopleDemoInvestorCtosDirectors(): AdminPeopleDemoCtosDirector[] {
  return [
    {
      name: "Raj Kumar",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.raj,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "01-02-2019",
      addr: null,
    },
    {
      name: "Siti Rahman",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.siti,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 12,
      appoint: "01-02-2019",
      addr: null,
    },
    {
      name: "Wei Ming",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.wei,
      ic_lcno: null,
      position: "DS",
      party_type: "I",
      equity_percentage: 30,
      appoint: "10-10-2017",
      addr: null,
    },
    {
      name: "Gina Foo",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.gina,
      ic_lcno: null,
      position: "DO",
      party_type: "I",
      equity_percentage: 0,
      appoint: "03-03-2024",
      addr: null,
    },
    {
      name: "Owen Chin",
      nic_brno: ADMIN_PEOPLE_DEMO_IC.owen,
      ic_lcno: null,
      position: "SO",
      party_type: "I",
      equity_percentage: 3,
      appoint: "01-11-2023",
      addr: null,
    },
    {
      name: "Apex Nominees Sdn Bhd",
      nic_brno: null,
      ic_lcno: ADMIN_PEOPLE_DEMO_IC.apexNominees,
      position: "SO",
      party_type: "C",
      equity_percentage: 15,
      appoint: null,
      addr: null,
    },
  ];
}

export function adminPeopleDemoWeiObservation(): Record<string, unknown> {
  return adminPeopleDemoMatchedObservation({
    name: "Wei Ming",
    identityNumber: ADMIN_PEOPLE_DEMO_IC.wei,
    entityType: "INDIVIDUAL",
    isDirector: true,
    isShareholder: true,
    shareholdingPercentage: 30,
    appointmentDate: "10-10-2017",
  });
}
