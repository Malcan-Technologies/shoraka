#!/usr/bin/env tsx
/**
 * Local Admin People & Access demo seed.
 *
 * Organisation: Admin People Test Sdn Bhd (`seed_admin_people_test_issuer_org`)
 * Investor company: Admin People Test Investor Sdn Bhd (`seed_admin_people_test_investor_org`)
 * Personal investor: Lina Aziz (`seed_admin_people_test_personal_org`)
 *
 * Issuer rows:
 * - Alice — Director / No access / KYC Approved / AML Approved / CTOS Matched
 * - Benjamin — Shareholder / User / Approved / Pending / Matched (Person Email ≠ Account Email)
 * - Chloe — Director+Shareholder / Admin / Pending approval / Not started / Matched
 * - Daniel — Director / Owner (owner_user_id)
 * - Finance user — platform-only User
 * - Operations admin — platform-only Admin
 * - Evelyn — pending invite
 * - Farid — expired invite
 * - Grace — CTOS Observed only
 * - Henry — CTOS Differs (shareholding)
 * - Irene — CTOS Not found
 * - Jason — Inactive / No access
 * - Karen — Inactive / User (member preserved)
 * - Legacy Holdings — Corporate shareholder
 * - Nathan — identity conflict BLOCKED
 * - Olivia — below-5% CTOS shareholder
 * - Peter — KYC/AML Rejected
 *
 * Case 16 (Michelle Low people-only unmatched) is unsupported with a structured master.
 *
 * Also demonstrates:
 * - KYC/AML Screening Result (issuer, investor company, and personal kyc_response)
 * - Wealth Declaration / Document Info / Liveness / Compliance
 * - CTOS report history (latest + older)
 * - PIC current vs RegTank evidence mismatch
 *
 * Party supplements set kybDirectorLinked + kybShareholderLinked so the CTOS KYB
 * retry job does not call the live RegTank trial API with demo KYB/KYC IDs.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed:admin-people-demo
 *   (also invoked from prisma/seed.ts)
 *
 * Idempotent. Safe to re-run. Blocked in production.
 * Does not change production business logic.
 */
import {
  OrganizationMemberRole,
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  OrganizationPartyOrigin,
  OrganizationType,
  Prisma,
  PrismaClient,
  ScCompanyType,
  ScDesignation,
  ScGender,
  ScIdentityPrefix,
  ScInvestorCategory,
  ScShareType,
  UserRole,
} from "@prisma/client";
import { parseComrepCalendarDate } from "@cashsouk/types";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { logger } from "../src/lib/logger";
import {
  ADMIN_PEOPLE_DEMO_COD,
  ADMIN_PEOPLE_DEMO_CTOS_LATEST_AT,
  ADMIN_PEOPLE_DEMO_CTOS_OLDER_AT,
  ADMIN_PEOPLE_DEMO_EMAIL,
  ADMIN_PEOPLE_DEMO_FIXED_AT,
  ADMIN_PEOPLE_DEMO_IC,
  ADMIN_PEOPLE_DEMO_INVITE,
  ADMIN_PEOPLE_DEMO_INVITE_EXPIRED_AT,
  ADMIN_PEOPLE_DEMO_INVITE_PENDING_EXPIRES,
  ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
  ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID,
  ADMIN_PEOPLE_DEMO_INVESTOR_REF,
  ADMIN_PEOPLE_DEMO_ISSUER_NAME,
  ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID,
  ADMIN_PEOPLE_DEMO_ISSUER_REF,
  ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY,
  ADMIN_PEOPLE_DEMO_PARTY_ID,
  ADMIN_PEOPLE_DEMO_PERSONAL_NAME,
  ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID,
  ADMIN_PEOPLE_DEMO_PERSONAL_REF,
  ADMIN_PEOPLE_DEMO_REPORT,
  adminPeopleDemoBankDetails,
  adminPeopleDemoCompliance,
  adminPeopleDemoCtosCcrisJson,
  adminPeopleDemoCtosCompanyJson,
  adminPeopleDemoCtosHtml,
  adminPeopleDemoCtosLegalJson,
  adminPeopleDemoCtosSummary,
  adminPeopleDemoCtosXml,
  adminPeopleDemoDocumentInfo,
  adminPeopleDemoHenryObservation,
  adminPeopleDemoInvestorCtosDirectors,
  adminPeopleDemoIssuerCtosDirectors,
  adminPeopleDemoIssuerFinancialStatements,
  adminPeopleDemoKycResponse,
  adminPeopleDemoLiveness,
  adminPeopleDemoMatchedObservation,
  adminPeopleDemoNathanOnboardingObservation,
  adminPeopleDemoPersonalWealthDeclaration,
  adminPeopleDemoSupplement,
  adminPeopleDemoWealthDeclaration,
  adminPeopleDemoWeiObservation,
} from "../src/modules/admin/admin-people-demo-data";

const FIXED = new Date(ADMIN_PEOPLE_DEMO_FIXED_AT);

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function appointDate(dmy: string | null | undefined): Date | null {
  if (!dmy) return null;
  return parseComrepCalendarDate(dmy);
}

type EnsureUserInput = {
  email: string;
  first: string;
  last: string;
  roles: UserRole[];
  phone?: string;
};

async function ensureUser(prisma: PrismaClient, input: EnsureUserInput): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    await prisma.user.update({
      where: { user_id: existing.user_id },
      data: {
        first_name: input.first,
        last_name: input.last,
        roles: { set: input.roles },
        phone: input.phone ?? existing.phone,
      },
    });
    return existing.user_id;
  }
  const userId = await generateUniqueUserId();
  await prisma.user.create({
    data: {
      user_id: userId,
      email: input.email,
      cognito_sub: `seed_apt_${input.email.replace(/[^a-z0-9]/gi, "_")}`,
      cognito_username: input.email,
      roles: input.roles,
      first_name: input.first,
      last_name: input.last,
      phone: input.phone ?? null,
      investor_account: [],
      issuer_account: [],
    },
  });
  return userId;
}

type PartyCreate = {
  id: string;
  portal: "issuer" | "investor";
  orgId: string;
  partyKey: string;
  origin: OrganizationPartyOrigin;
  membership: OrganizationPartyMembershipStatus;
  entityType: OrganizationPartyEntityType;
  name: string;
  email?: string | null;
  identityPrefix: ScIdentityPrefix | null;
  identityNumber: string | null;
  gender?: ScGender | null;
  nationality?: string | null;
  countryOfIncorporation?: string | null;
  dateOfIncorporation?: Date | null;
  isDirector: boolean;
  isShareholder: boolean;
  shareholding?: number | null;
  appointment?: string | null;
  userId?: string | null;
  absentFromLatest?: boolean;
  observation: Record<string, unknown> | null;
};

async function createParty(prisma: PrismaClient, row: PartyCreate): Promise<void> {
  await prisma.organizationPartyProfile.create({
    data: {
      id: row.id,
      issuer_organization_id: row.portal === "issuer" ? row.orgId : null,
      investor_organization_id: row.portal === "investor" ? row.orgId : null,
      party_key: row.partyKey,
      origin: row.origin,
      membership_status: row.membership,
      entity_type: row.entityType,
      absent_from_latest_external: Boolean(row.absentFromLatest),
      name: row.name,
      email: row.email ?? null,
      identity_prefix: row.identityPrefix,
      identity_number: row.identityNumber,
      gender: row.gender ?? (row.entityType === "CORPORATE" ? ScGender.NOT_APPLICABLE : ScGender.FEMALE),
      nationality: row.nationality ?? (row.entityType === "INDIVIDUAL" ? "MY" : null),
      country_of_incorporation: row.countryOfIncorporation ?? (row.entityType === "CORPORATE" ? "MY" : null),
      date_of_incorporation: row.dateOfIncorporation ?? null,
      is_director: row.isDirector,
      is_shareholder: row.isShareholder,
      share_type: row.isShareholder ? ScShareType.ORDINARY : null,
      shareholding_percentage: row.shareholding ?? null,
      designation: row.isDirector ? ScDesignation.DIRECTOR_EXECUTIVE : null,
      appointment_date: appointDate(row.appointment),
      user_id: row.userId ?? null,
      external_observation: row.observation ? json(row.observation) : Prisma.DbNull,
      field_sources: json({}),
      created_at: FIXED,
      updated_at: FIXED,
    },
  });
}

async function createMember(
  prisma: PrismaClient,
  params: {
    userId: string;
    portal: "issuer" | "investor";
    orgId: string;
    role: OrganizationMemberRole;
  }
): Promise<void> {
  await prisma.organizationMember.create({
    data: {
      user_id: params.userId,
      issuer_organization_id: params.portal === "issuer" ? params.orgId : null,
      investor_organization_id: params.portal === "investor" ? params.orgId : null,
      role: params.role,
      created_at: FIXED,
    },
  });
}

async function createSupplement(
  prisma: PrismaClient,
  params: {
    portal: "issuer" | "investor";
    orgId: string;
    partyKey: string;
    onboarding: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.ctosPartySupplement.create({
    data: {
      issuer_organization_id: params.portal === "issuer" ? params.orgId : null,
      investor_organization_id: params.portal === "investor" ? params.orgId : null,
      party_key: params.partyKey,
      onboarding_json: json(params.onboarding),
      created_at: FIXED,
      updated_at: FIXED,
    },
  });
}

async function upsertCtosReport(
  prisma: PrismaClient,
  params: {
    id: string;
    portal: "issuer" | "investor";
    orgId: string;
    fetchedAt: string;
    companyName: string;
    brn: string;
    directors: ReturnType<typeof adminPeopleDemoIssuerCtosDirectors>;
  }
): Promise<void> {
  const companyJson = adminPeopleDemoCtosCompanyJson({
    companyName: params.companyName,
    brn: params.brn,
    directors: params.directors,
  });
  const payload = {
    issuer_organization_id: params.portal === "issuer" ? params.orgId : null,
    investor_organization_id: params.portal === "investor" ? params.orgId : null,
    subject_ref: null,
    fetched_at: new Date(params.fetchedAt),
    raw_xml: adminPeopleDemoCtosXml(params.companyName, params.brn),
    report_html: adminPeopleDemoCtosHtml(params.companyName),
    summary_json: json(adminPeopleDemoCtosSummary()),
    company_json: json(companyJson),
    person_json: Prisma.DbNull,
    legal_json: json(adminPeopleDemoCtosLegalJson()),
    ccris_json: json(adminPeopleDemoCtosCcrisJson()),
    financials_json: json(
      params.portal === "issuer"
        ? [
            {
              financial_year: 2024,
              dates: { pldd: "31-12-2024", bsdd: "2024-12-31" },
              account: { bscatot: 3400000, turnover: 5200000, plnpbt: 640000, plnpat: 480000 },
            },
          ]
        : []
    ),
  };
  await prisma.ctosReport.upsert({
    where: { id: params.id },
    create: { id: params.id, ...payload },
    update: payload,
  });
}

async function upsertCodOnboarding(
  prisma: PrismaClient,
  params: {
    userId: string;
    portal: "issuer" | "investor";
    orgId: string;
    organizationType: OrganizationType;
    requestId: string;
    referenceId: string;
    onboardingType: string;
    kybId?: string;
  }
): Promise<void> {
  await prisma.regTankOnboarding.upsert({
    where: { request_id: params.requestId },
    create: {
      user_id: params.userId,
      issuer_organization_id: params.portal === "issuer" ? params.orgId : null,
      investor_organization_id: params.portal === "investor" ? params.orgId : null,
      organization_type: params.organizationType,
      portal_type: params.portal,
      request_id: params.requestId,
      reference_id: params.referenceId,
      onboarding_type: params.onboardingType,
      status: "APPROVED",
      verify_link: `https://onboarding.regtank.com/verify/${params.requestId}`,
      created_at: FIXED,
      submitted_at: FIXED,
      completed_at: FIXED,
      webhook_payloads: params.kybId
        ? ([{ kybId: params.kybId, status: "Approved" }] as Prisma.InputJsonValue[])
        : [],
    },
    update: {
      user_id: params.userId,
      issuer_organization_id: params.portal === "issuer" ? params.orgId : null,
      investor_organization_id: params.portal === "investor" ? params.orgId : null,
      organization_type: params.organizationType,
      portal_type: params.portal,
      onboarding_type: params.onboardingType,
      status: "APPROVED",
      verify_link: `https://onboarding.regtank.com/verify/${params.requestId}`,
      webhook_payloads: params.kybId
        ? ([{ kybId: params.kybId, status: "Approved" }] as Prisma.InputJsonValue[])
        : [],
    },
  });
}

function issuerCorporateOnboardingData(): Record<string, unknown> {
  return {
    basicInfo: {
      ssmRegisterNumber: "202401000001",
      tinNumber: "C1234567890",
      industry: "Information & Communication Technology (ICT)",
      entityType: "Private Limited Company (Sdn Bhd)",
      businessName: ADMIN_PEOPLE_DEMO_ISSUER_NAME,
      numberOfEmployees: 18,
      website: "https://admin-people-test.example",
    },
    aboutYourBusiness: {
      whatDoesCompanyDo:
        "Demo issuer used to exercise Admin People & Access, CTOS, and RegTank evidence cards.",
      mainCustomers: "Internal QA and product review.",
      singleCustomerOver50Revenue: false,
      accountingSoftware: "Xero",
    },
    addresses: {
      registered: {
        line1: "12, Jalan Ampang",
        line2: null,
        city: null,
        postalCode: "50450",
        state: "Wilayah Persekutuan",
        country: "MY",
      },
      business: {
        line1: "Level 8, Menara Demo",
        line2: "Jalan Tun Razak",
        city: "Kuala Lumpur",
        postalCode: "50400",
        state: "Wilayah Persekutuan",
        country: "MY",
      },
    },
    contactPerson: {
      name: "Daniel Wong",
      position: "Director",
      email: "pic.current@admin-people-test.example",
      contact: "+60121110001",
    },
    personInCharge: {
      name: "Daniel Wong",
      position: "Director",
      email: "pic.regtank@admin-people-test.example",
      contactNumber: "+60121110001",
    },
  };
}

function investorCorporateOnboardingData(): Record<string, unknown> {
  return {
    basicInfo: {
      ssmRegisterNumber: "202401000002",
      tinNumber: "C0987654321",
      industry: "Financial and Insurance Activities",
      entityType: "Private Limited Company (Sdn Bhd)",
      businessName: ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
      numberOfEmployees: 9,
      website: "https://admin-people-test-investor.example",
    },
    aboutYourBusiness: {
      whatDoesCompanyDo: "Demo investor company for Admin People & Access across investor portal.",
      mainCustomers: "Internal QA.",
      singleCustomerOver50Revenue: false,
      accountingSoftware: "Xero",
    },
    addresses: {
      registered: {
        line1: "22, Jalan Raja Chulan",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "50200",
        state: "Wilayah Persekutuan",
        country: "MY",
      },
      business: {
        line1: "22, Jalan Raja Chulan",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "50200",
        state: "Wilayah Persekutuan",
        country: "MY",
      },
    },
    contactPerson: {
      name: "Priya Menon",
      position: "Finance Manager",
      email: "priya.pic@admin-people-test.example",
      contact: "+60123330001",
    },
    personInCharge: {
      name: "Priya Menon",
      position: "Chief Operating Officer",
      email: "priya.pic@admin-people-test.example",
      contactNumber: "+60123330001",
    },
  };
}

function issuerCorporateEntities(): Record<string, unknown> {
  return {
    directors: [
      {
        status: "APPROVED",
        personalInfo: {
          email: "alice.tan@admin-people-test.example",
          fullName: "Alice Tan",
          governmentIdNumber: ADMIN_PEOPLE_DEMO_IC.alice,
        },
        eodRequestId: "EOD90001",
      },
    ],
    shareholders: [],
    corporateShareholders: [
      {
        businessName: "Legacy Holdings Sdn Bhd",
        ssmRegistrationNumber: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
        sharePercentage: 20,
        kyb_id: "KYB90081",
        corporateOnboardingRequest: { requestId: "COD90084", status: "APPROVED" },
      },
    ],
  };
}

function investorCorporateEntities(): Record<string, unknown> {
  return {
    directors: [
      {
        status: "APPROVED",
        personalInfo: {
          fullName: "Raj Kumar",
          governmentIdNumber: ADMIN_PEOPLE_DEMO_IC.raj,
        },
        eodRequestId: "EOD90021",
      },
    ],
    shareholders: [],
    corporateShareholders: [
      {
        businessName: "Apex Nominees Sdn Bhd",
        ssmRegistrationNumber: ADMIN_PEOPLE_DEMO_IC.apexNominees,
        sharePercentage: 15,
        kyb_id: "KYB90082",
        corporateOnboardingRequest: { requestId: "COD90085", status: "APPROVED" },
      },
    ],
  };
}

async function wipeIssuer(prisma: PrismaClient, orgId: string): Promise<void> {
  await prisma.issuerOrganizationInvitation.deleteMany({ where: { issuer_organization_id: orgId } });
  await prisma.ctosPartySupplement.deleteMany({ where: { issuer_organization_id: orgId } });
  await prisma.organizationMember.deleteMany({ where: { issuer_organization_id: orgId } });
  await prisma.ctosReport.deleteMany({ where: { issuer_organization_id: orgId } });
  await prisma.organizationPartyProfile.deleteMany({ where: { issuer_organization_id: orgId } });
}

async function wipeInvestor(prisma: PrismaClient, orgId: string): Promise<void> {
  await prisma.investorOrganizationInvitation.deleteMany({ where: { investor_organization_id: orgId } });
  await prisma.ctosPartySupplement.deleteMany({ where: { investor_organization_id: orgId } });
  await prisma.organizationMember.deleteMany({ where: { investor_organization_id: orgId } });
  await prisma.ctosReport.deleteMany({ where: { investor_organization_id: orgId } });
  await prisma.organizationPartyProfile.deleteMany({ where: { investor_organization_id: orgId } });
}

async function seedIssuer(prisma: PrismaClient, users: Record<string, string>): Promise<void> {
  const orgId = ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID;
  const ownerId = users.daniel;
  const cod = issuerCorporateOnboardingData();
  await prisma.issuerOrganization.upsert({
    where: { id: orgId },
    create: {
      id: orgId,
      owner_user_id: ownerId,
      type: OrganizationType.COMPANY,
      name: ADMIN_PEOPLE_DEMO_ISSUER_NAME,
      registration_number: "202401000001",
      display_reference: ADMIN_PEOPLE_DEMO_ISSUER_REF,
      onboarding_status: "COMPLETED",
      onboarded_at: FIXED,
      first_name: "Daniel",
      last_name: "Wong",
      nationality: "MY",
      country: "MY",
      phone_number: "+60321110000",
      kyc_id: "KYC90081",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      admin_approved_at: FIXED,
      date_of_incorporation: new Date("2018-01-15T00:00:00.000Z"),
      date_of_commencement: new Date("2018-03-01T00:00:00.000Z"),
      country_of_incorporation: "MY",
      sc_company_type: ScCompanyType.PRIVATE_LIMITED,
      regulatory_structure_established_at: FIXED,
      created_at: FIXED,
      updated_at: FIXED,
      corporate_onboarding_data: json(cod),
      bank_account_details: json(adminPeopleDemoBankDetails("123456789012")),
      wealth_declaration: json(adminPeopleDemoWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90081",
          requestId: "KYC90081",
          onboardingId: "EOD90081",
          referenceId: ADMIN_PEOPLE_DEMO_COD.issuerReferenceId,
        })
      ),
      corporate_entities: json(issuerCorporateEntities()),
      corporate_required_documents: json([
        {
          url: "https://shoraka-trial-onboarding-proxy.regtank.com/downloadFile?fullPath=prod/userportal/Client-00391/COD04313/document/afcba0d1ddd14795ae230f85a0a3db28.png",
          fileName: "SSM-Company-Profile.png",
          fileType: "image/png",
          fieldName: "Latest SSM Company Profile",
        },
      ]),
      business_aml_status: json({
        lastSyncedAt: ADMIN_PEOPLE_DEMO_FIXED_AT,
        businessShareholders: [
          {
            name: "Legacy Holdings Sdn Bhd",
            ssmRegistrationNumber: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
            amlStatus: "Approved",
            kybId: "KYB90081",
          },
        ],
      }),
    },
    update: {
      owner_user_id: ownerId,
      name: ADMIN_PEOPLE_DEMO_ISSUER_NAME,
      registration_number: "202401000001",
      display_reference: ADMIN_PEOPLE_DEMO_ISSUER_REF,
      onboarding_status: "COMPLETED",
      onboarded_at: FIXED,
      first_name: "Daniel",
      last_name: "Wong",
      phone_number: "+60321110000",
      kyc_id: "KYC90081",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      date_of_incorporation: new Date("2018-01-15T00:00:00.000Z"),
      date_of_commencement: new Date("2018-03-01T00:00:00.000Z"),
      country_of_incorporation: "MY",
      sc_company_type: ScCompanyType.PRIVATE_LIMITED,
      regulatory_structure_established_at: FIXED,
      corporate_onboarding_data: json(cod),
      bank_account_details: json(adminPeopleDemoBankDetails("123456789012")),
      wealth_declaration: json(adminPeopleDemoWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90081",
          requestId: "KYC90081",
          onboardingId: "EOD90081",
          referenceId: ADMIN_PEOPLE_DEMO_COD.issuerReferenceId,
        })
      ),
      corporate_entities: json(issuerCorporateEntities()),
      business_aml_status: json({
        lastSyncedAt: ADMIN_PEOPLE_DEMO_FIXED_AT,
        businessShareholders: [
          {
            name: "Legacy Holdings Sdn Bhd",
            ssmRegistrationNumber: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
            amlStatus: "Approved",
            kybId: "KYB90081",
          },
        ],
      }),
    },
  });

  await prisma.issuerOrganizationFinancialStatement.upsert({
    where: { issuer_organization_id: orgId },
    create: {
      issuer_organization_id: orgId,
      financial_statements: json(adminPeopleDemoIssuerFinancialStatements()),
    },
    update: {
      financial_statements: json(adminPeopleDemoIssuerFinancialStatements()),
    },
  });

  await wipeIssuer(prisma, orgId);

  const matched = (name: string, ic: string, flags: { director: boolean; shareholder: boolean; pct: number | null; appoint: string }) =>
    adminPeopleDemoMatchedObservation({
      name,
      identityNumber: ic,
      entityType: "INDIVIDUAL",
      isDirector: flags.director,
      isShareholder: flags.shareholder,
      shareholdingPercentage: flags.pct,
      appointmentDate: flags.appoint,
    });

  const issuerParties: PartyCreate[] = [
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.alice,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.alice,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Alice Tan",
      email: "alice.tan@admin-people-test.example",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.alice,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-03-2020",
      observation: matched("Alice Tan", ADMIN_PEOPLE_DEMO_IC.alice, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-03-2020",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.benjamin,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.benjamin,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Benjamin Lee",
      email: ADMIN_PEOPLE_DEMO_EMAIL.benjaminPerson,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.benjamin,
      gender: ScGender.MALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 10,
      appointment: "01-03-2020",
      userId: users.benjamin,
      observation: matched("Benjamin Lee", ADMIN_PEOPLE_DEMO_IC.benjamin, {
        director: false,
        shareholder: true,
        pct: 10,
        appoint: "01-03-2020",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.chloe,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.chloe,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Chloe Lim",
      email: ADMIN_PEOPLE_DEMO_EMAIL.chloe,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.chloe,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: true,
      shareholding: 25,
      appointment: "12-04-2019",
      userId: users.chloe,
      observation: matched("Chloe Lim", ADMIN_PEOPLE_DEMO_IC.chloe, {
        director: true,
        shareholder: true,
        pct: 25,
        appoint: "12-04-2019",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.daniel,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.daniel,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Daniel Wong",
      email: ADMIN_PEOPLE_DEMO_EMAIL.daniel,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.daniel,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-01-2018",
      userId: users.daniel,
      observation: matched("Daniel Wong", ADMIN_PEOPLE_DEMO_IC.daniel, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-01-2018",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.evelyn,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.evelyn,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Evelyn Goh",
      email: ADMIN_PEOPLE_DEMO_EMAIL.evelyn,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.evelyn,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: false,
      appointment: "08-08-2021",
      observation: matched("Evelyn Goh", ADMIN_PEOPLE_DEMO_IC.evelyn, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "08-08-2021",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.farid,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.farid,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Farid Ahmad",
      email: ADMIN_PEOPLE_DEMO_EMAIL.farid,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.farid,
      gender: ScGender.MALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 8,
      appointment: "08-08-2021",
      observation: matched("Farid Ahmad", ADMIN_PEOPLE_DEMO_IC.farid, {
        director: false,
        shareholder: true,
        pct: 8,
        appoint: "08-08-2021",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.grace,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.grace,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Grace Ong",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.grace,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: false,
      appointment: "20-02-2024",
      observation: matched("Grace Ong", ADMIN_PEOPLE_DEMO_IC.grace, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "20-02-2024",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.henry,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.henry,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Henry Teo",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.henry,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: true,
      shareholding: 20,
      appointment: "15-06-2018",
      observation: adminPeopleDemoHenryObservation(),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.irene,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.irene,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Irene Yap",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.irene,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-05-2016",
      absentFromLatest: true,
      observation: matched("Irene Yap", ADMIN_PEOPLE_DEMO_IC.irene, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-05-2016",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.jason,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.jason,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Jason Ng",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.jason,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-01-2015",
      observation: matched("Jason Ng", ADMIN_PEOPLE_DEMO_IC.jason, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-01-2015",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.karen,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.karen,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Karen Ho",
      email: ADMIN_PEOPLE_DEMO_EMAIL.karen,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.karen,
      gender: ScGender.FEMALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 6,
      appointment: "01-01-2016",
      userId: users.karen,
      observation: matched("Karen Ho", ADMIN_PEOPLE_DEMO_IC.karen, {
        director: false,
        shareholder: true,
        pct: 6,
        appoint: "01-01-2016",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.legacy,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.CORPORATE,
      name: "Legacy Holdings Sdn Bhd",
      identityPrefix: ScIdentityPrefix.ROC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
      gender: ScGender.NOT_APPLICABLE,
      countryOfIncorporation: "MY",
      dateOfIncorporation: new Date("2020-01-10T00:00:00.000Z"),
      isDirector: false,
      isShareholder: true,
      shareholding: 20,
      observation: adminPeopleDemoMatchedObservation({
        name: "Legacy Holdings Sdn Bhd",
        identityNumber: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
        entityType: "CORPORATE",
        isDirector: false,
        isShareholder: true,
        shareholdingPercentage: 20,
        appointmentDate: null,
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.nathanOnboarding,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY,
      origin: OrganizationPartyOrigin.USER_ADDED,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Nathan Chong",
      identityPrefix: null,
      identityNumber: null,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-09-2022",
      observation: adminPeopleDemoNathanOnboardingObservation(),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.nathanObserved,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Nathan Chong",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-09-2022",
      observation: matched("Nathan Chong", ADMIN_PEOPLE_DEMO_IC.nathanObserved, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-09-2022",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.olivia,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.olivia,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Olivia Chan",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.olivia,
      gender: ScGender.FEMALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 3,
      appointment: "01-11-2023",
      observation: matched("Olivia Chan", ADMIN_PEOPLE_DEMO_IC.olivia, {
        director: false,
        shareholder: true,
        pct: 3,
        appoint: "01-11-2023",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.peter,
      portal: "issuer",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.peter,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Peter Lim",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.peter,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-07-2017",
      observation: matched("Peter Lim", ADMIN_PEOPLE_DEMO_IC.peter, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-07-2017",
      }),
    },
  ];

  for (const party of issuerParties) {
    await createParty(prisma, party);
  }

  await createMember(prisma, {
    userId: users.daniel,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_ADMIN,
  });
  await createMember(prisma, {
    userId: users.benjamin,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_MEMBER,
  });
  await createMember(prisma, {
    userId: users.chloe,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_ADMIN,
  });
  await createMember(prisma, {
    userId: users.finance,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_MEMBER,
  });
  await createMember(prisma, {
    userId: users.operations,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_ADMIN,
  });
  await createMember(prisma, {
    userId: users.karen,
    portal: "issuer",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_MEMBER,
  });

  await prisma.issuerOrganizationInvitation.create({
    data: {
      id: "seed_apt_invite_evelyn",
      email: ADMIN_PEOPLE_DEMO_EMAIL.evelyn,
      role: OrganizationMemberRole.ORGANIZATION_MEMBER,
      issuer_organization_id: orgId,
      token: ADMIN_PEOPLE_DEMO_INVITE.evelynToken,
      expires_at: new Date(ADMIN_PEOPLE_DEMO_INVITE_PENDING_EXPIRES),
      accepted: false,
      invited_by_user_id: users.daniel,
      organization_party_profile_id: ADMIN_PEOPLE_DEMO_PARTY_ID.evelyn,
      created_at: FIXED,
    },
  });
  await prisma.issuerOrganizationInvitation.create({
    data: {
      id: "seed_apt_invite_farid",
      email: ADMIN_PEOPLE_DEMO_EMAIL.farid,
      role: OrganizationMemberRole.ORGANIZATION_MEMBER,
      issuer_organization_id: orgId,
      token: ADMIN_PEOPLE_DEMO_INVITE.faridToken,
      expires_at: new Date(ADMIN_PEOPLE_DEMO_INVITE_EXPIRED_AT),
      accepted: false,
      invited_by_user_id: users.daniel,
      organization_party_profile_id: ADMIN_PEOPLE_DEMO_PARTY_ID.farid,
      created_at: new Date("2024-12-01T00:00:00.000Z"),
    },
  });

  const supplements: Array<{ partyKey: string; onboarding: Record<string, unknown> }> = [
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.alice,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90001",
        status: "APPROVED",
        email: "alice.tan@admin-people-test.example",
        screeningStatus: "APPROVED",
        screeningRequestId: "KYC90001",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.benjamin,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90002",
        status: "APPROVED",
        email: ADMIN_PEOPLE_DEMO_EMAIL.benjaminPerson,
        screeningStatus: "PENDING",
        screeningRequestId: "KYC90002",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.chloe,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90003",
        status: "WAIT_FOR_APPROVAL",
        email: ADMIN_PEOPLE_DEMO_EMAIL.chloe,
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.daniel,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90004",
        status: "APPROVED",
        email: ADMIN_PEOPLE_DEMO_EMAIL.daniel,
        screeningStatus: "APPROVED",
        screeningRequestId: "KYC90004",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.evelyn,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90005",
        status: "IN_PROGRESS",
        email: ADMIN_PEOPLE_DEMO_EMAIL.evelyn,
        screeningStatus: "PENDING",
        screeningRequestId: "KYC90005",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.farid,
      onboarding: adminPeopleDemoSupplement({
        status: "NOT_STARTED",
        email: ADMIN_PEOPLE_DEMO_EMAIL.farid,
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.henry,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90008",
        status: "APPROVED",
        screeningStatus: "APPROVED",
        screeningRequestId: "KYC90008",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.irene,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90009",
        status: "EXPIRED",
        screeningStatus: "PENDING",
        screeningRequestId: "KYC90009",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.jason,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90010",
        status: "REJECTED",
        screeningStatus: "REJECTED",
        screeningRequestId: "KYC90010",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.karen,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90011",
        status: "APPROVED",
        email: ADMIN_PEOPLE_DEMO_EMAIL.karen,
        screeningStatus: "APPROVED",
        screeningRequestId: "KYC90011",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
      onboarding: adminPeopleDemoSupplement({
        requestId: "COD90084",
        status: "APPROVED",
        screeningStatus: "APPROVED",
        screeningRequestId: "KYB90081",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90012",
        status: "IN_PROGRESS",
      }),
    },
    {
      partyKey: ADMIN_PEOPLE_DEMO_IC.peter,
      onboarding: adminPeopleDemoSupplement({
        requestId: "EOD90014",
        status: "REJECTED",
        screeningStatus: "REJECTED",
        screeningRequestId: "KYC90014",
      }),
    },
  ];
  for (const row of supplements) {
    await createSupplement(prisma, { portal: "issuer", orgId, partyKey: row.partyKey, onboarding: row.onboarding });
  }

  await upsertCtosReport(prisma, {
    id: ADMIN_PEOPLE_DEMO_REPORT.issuerLatest,
    portal: "issuer",
    orgId,
    fetchedAt: ADMIN_PEOPLE_DEMO_CTOS_LATEST_AT,
    companyName: ADMIN_PEOPLE_DEMO_ISSUER_NAME,
    brn: "202401000001",
    directors: adminPeopleDemoIssuerCtosDirectors(false),
  });
  await upsertCtosReport(prisma, {
    id: ADMIN_PEOPLE_DEMO_REPORT.issuerOlder,
    portal: "issuer",
    orgId,
    fetchedAt: ADMIN_PEOPLE_DEMO_CTOS_OLDER_AT,
    companyName: ADMIN_PEOPLE_DEMO_ISSUER_NAME,
    brn: "202401000001",
    directors: adminPeopleDemoIssuerCtosDirectors(true).filter(
      (row) => row.nic_brno !== ADMIN_PEOPLE_DEMO_IC.grace && row.nic_brno !== ADMIN_PEOPLE_DEMO_IC.olivia
    ),
  });

  await upsertCodOnboarding(prisma, {
    userId: ownerId,
    portal: "issuer",
    orgId,
    organizationType: OrganizationType.COMPANY,
    requestId: ADMIN_PEOPLE_DEMO_COD.issuerRequestId,
    referenceId: ADMIN_PEOPLE_DEMO_COD.issuerReferenceId,
    onboardingType: "CORPORATE",
    kybId: "KYB90081",
  });

  await prisma.user.update({
    where: { user_id: ownerId },
    data: { issuer_account: { set: [orgId] } },
  });
}

async function seedInvestorCompany(prisma: PrismaClient, users: Record<string, string>): Promise<void> {
  const orgId = ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID;
  const ownerId = users.priya;
  await prisma.investorOrganization.upsert({
    where: { id: orgId },
    create: {
      id: orgId,
      owner_user_id: ownerId,
      type: OrganizationType.COMPANY,
      name: ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
      registration_number: "202401000002",
      display_reference: ADMIN_PEOPLE_DEMO_INVESTOR_REF,
      onboarding_status: "COMPLETED",
      onboarded_at: FIXED,
      first_name: "Priya",
      last_name: "Menon",
      nationality: "MY",
      country: "MY",
      phone_number: "+60321110002",
      kyc_id: "KYC90082",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_approved: true,
      is_sophisticated_investor: true,
      sophisticated_investor_reason: "Company organization",
      sc_investor_category: ScInvestorCategory.SOPHISTICATED_HIGH_NET_WORTH_ENTITY,
      date_of_incorporation: new Date("2019-05-20T00:00:00.000Z"),
      country_of_incorporation: "MY",
      regulatory_structure_established_at: FIXED,
      created_at: FIXED,
      updated_at: FIXED,
      corporate_onboarding_data: json(investorCorporateOnboardingData()),
      bank_account_details: json(adminPeopleDemoBankDetails("223344556677")),
      wealth_declaration: json(adminPeopleDemoWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90082",
          requestId: "KYC90082",
          onboardingId: "EOD90082",
          possibleMatchCount: 1,
        })
      ),
      corporate_entities: json(investorCorporateEntities()),
      corporate_required_documents: json([
        {
          url: "https://shoraka-trial-onboarding-proxy.regtank.com/downloadFile?fullPath=prod/userportal/Client-00391/COD04313/document/afcba0d1ddd14795ae230f85a0a3db28.png",
          fileName: "SSM-Investor-Profile.png",
          fileType: "image/png",
          fieldName: "Latest SSM Company Profile",
        },
      ]),
      business_aml_status: json({
        lastSyncedAt: ADMIN_PEOPLE_DEMO_FIXED_AT,
        businessShareholders: [
          {
            name: "Apex Nominees Sdn Bhd",
            ssmRegistrationNumber: ADMIN_PEOPLE_DEMO_IC.apexNominees,
            amlStatus: "Approved",
            kybId: "KYB90082",
          },
        ],
      }),
    },
    update: {
      owner_user_id: ownerId,
      name: ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
      registration_number: "202401000002",
      display_reference: ADMIN_PEOPLE_DEMO_INVESTOR_REF,
      onboarding_status: "COMPLETED",
      kyc_id: "KYC90082",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_approved: true,
      is_sophisticated_investor: true,
      sc_investor_category: ScInvestorCategory.SOPHISTICATED_HIGH_NET_WORTH_ENTITY,
      date_of_incorporation: new Date("2019-05-20T00:00:00.000Z"),
      country_of_incorporation: "MY",
      regulatory_structure_established_at: FIXED,
      corporate_onboarding_data: json(investorCorporateOnboardingData()),
      bank_account_details: json(adminPeopleDemoBankDetails("223344556677")),
      wealth_declaration: json(adminPeopleDemoWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90082",
          requestId: "KYC90082",
          onboardingId: "EOD90082",
          possibleMatchCount: 1,
        })
      ),
      corporate_entities: json(investorCorporateEntities()),
    },
  });

  await wipeInvestor(prisma, orgId);

  const matched = (name: string, ic: string, flags: { director: boolean; shareholder: boolean; pct: number | null; appoint: string }) =>
    adminPeopleDemoMatchedObservation({
      name,
      identityNumber: ic,
      entityType: "INDIVIDUAL",
      isDirector: flags.director,
      isShareholder: flags.shareholder,
      shareholdingPercentage: flags.pct,
      appointmentDate: flags.appoint,
    });

  const parties: PartyCreate[] = [
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.raj,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.raj,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Raj Kumar",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.raj,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: false,
      appointment: "01-02-2019",
      observation: matched("Raj Kumar", ADMIN_PEOPLE_DEMO_IC.raj, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "01-02-2019",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.siti,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.siti,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Siti Rahman",
      email: ADMIN_PEOPLE_DEMO_EMAIL.siti,
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.siti,
      gender: ScGender.FEMALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 12,
      appointment: "01-02-2019",
      userId: users.siti,
      observation: matched("Siti Rahman", ADMIN_PEOPLE_DEMO_IC.siti, {
        director: false,
        shareholder: true,
        pct: 12,
        appoint: "01-02-2019",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.wei,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.wei,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Wei Ming",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.wei,
      gender: ScGender.MALE,
      isDirector: true,
      isShareholder: true,
      shareholding: 18,
      appointment: "10-10-2017",
      observation: adminPeopleDemoWeiObservation(),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.gina,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.gina,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Gina Foo",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.gina,
      gender: ScGender.FEMALE,
      isDirector: true,
      isShareholder: false,
      appointment: "03-03-2024",
      observation: matched("Gina Foo", ADMIN_PEOPLE_DEMO_IC.gina, {
        director: true,
        shareholder: false,
        pct: 0,
        appoint: "03-03-2024",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.owen,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.owen,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      entityType: OrganizationPartyEntityType.INDIVIDUAL,
      name: "Owen Chin",
      identityPrefix: ScIdentityPrefix.NRIC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.owen,
      gender: ScGender.MALE,
      isDirector: false,
      isShareholder: true,
      shareholding: 3,
      appointment: "01-11-2023",
      observation: matched("Owen Chin", ADMIN_PEOPLE_DEMO_IC.owen, {
        director: false,
        shareholder: true,
        pct: 3,
        appoint: "01-11-2023",
      }),
    },
    {
      id: ADMIN_PEOPLE_DEMO_PARTY_ID.apex,
      portal: "investor",
      orgId,
      partyKey: ADMIN_PEOPLE_DEMO_IC.apexNominees,
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      membership: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      entityType: OrganizationPartyEntityType.CORPORATE,
      name: "Apex Nominees Sdn Bhd",
      identityPrefix: ScIdentityPrefix.ROC,
      identityNumber: ADMIN_PEOPLE_DEMO_IC.apexNominees,
      gender: ScGender.NOT_APPLICABLE,
      countryOfIncorporation: "MY",
      isDirector: false,
      isShareholder: true,
      shareholding: 15,
      observation: adminPeopleDemoMatchedObservation({
        name: "Apex Nominees Sdn Bhd",
        identityNumber: ADMIN_PEOPLE_DEMO_IC.apexNominees,
        entityType: "CORPORATE",
        isDirector: false,
        isShareholder: true,
        shareholdingPercentage: 15,
        appointmentDate: null,
      }),
    },
  ];
  for (const party of parties) {
    await createParty(prisma, party);
  }

  await createMember(prisma, {
    userId: users.siti,
    portal: "investor",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_MEMBER,
  });
  await createMember(prisma, {
    userId: users.investorOps,
    portal: "investor",
    orgId,
    role: OrganizationMemberRole.ORGANIZATION_MEMBER,
  });

  await createSupplement(prisma, {
    portal: "investor",
    orgId,
    partyKey: ADMIN_PEOPLE_DEMO_IC.raj,
    onboarding: adminPeopleDemoSupplement({
      requestId: "EOD90021",
      status: "APPROVED",
      screeningStatus: "APPROVED",
      screeningRequestId: "KYC90021",
    }),
  });
  await createSupplement(prisma, {
    portal: "investor",
    orgId,
    partyKey: ADMIN_PEOPLE_DEMO_IC.siti,
    onboarding: adminPeopleDemoSupplement({
      requestId: "EOD90022",
      status: "APPROVED",
      email: ADMIN_PEOPLE_DEMO_EMAIL.siti,
      screeningStatus: "PENDING",
      screeningRequestId: "KYC90022",
    }),
  });
  await createSupplement(prisma, {
    portal: "investor",
    orgId,
    partyKey: ADMIN_PEOPLE_DEMO_IC.wei,
    onboarding: adminPeopleDemoSupplement({
      requestId: "EOD90023",
      status: "APPROVED",
      screeningStatus: "APPROVED",
      screeningRequestId: "KYC90023",
    }),
  });
  await createSupplement(prisma, {
    portal: "investor",
    orgId,
    partyKey: ADMIN_PEOPLE_DEMO_IC.apexNominees,
    onboarding: adminPeopleDemoSupplement({
      requestId: "COD90085",
      status: "APPROVED",
      screeningStatus: "APPROVED",
      screeningRequestId: "KYB90082",
    }),
  });

  const investorDirectors = adminPeopleDemoInvestorCtosDirectors();
  await upsertCtosReport(prisma, {
    id: ADMIN_PEOPLE_DEMO_REPORT.investorLatest,
    portal: "investor",
    orgId,
    fetchedAt: ADMIN_PEOPLE_DEMO_CTOS_LATEST_AT,
    companyName: ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
    brn: "202401000002",
    directors: investorDirectors,
  });
  await upsertCtosReport(prisma, {
    id: ADMIN_PEOPLE_DEMO_REPORT.investorOlder,
    portal: "investor",
    orgId,
    fetchedAt: ADMIN_PEOPLE_DEMO_CTOS_OLDER_AT,
    companyName: ADMIN_PEOPLE_DEMO_INVESTOR_NAME,
    brn: "202401000002",
    directors: investorDirectors.filter(
      (row) => row.nic_brno !== ADMIN_PEOPLE_DEMO_IC.gina && row.nic_brno !== ADMIN_PEOPLE_DEMO_IC.owen
    ),
  });

  await upsertCodOnboarding(prisma, {
    userId: ownerId,
    portal: "investor",
    orgId,
    organizationType: OrganizationType.COMPANY,
    requestId: ADMIN_PEOPLE_DEMO_COD.investorRequestId,
    referenceId: ADMIN_PEOPLE_DEMO_COD.investorReferenceId,
    onboardingType: "CORPORATE",
    kybId: "KYB90082",
  });

  await prisma.user.update({
    where: { user_id: ownerId },
    data: { investor_account: { set: [orgId] } },
  });
}

async function seedPersonalInvestor(prisma: PrismaClient, linaUserId: string): Promise<void> {
  const orgId = ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID;
  await prisma.investorOrganization.upsert({
    where: { id: orgId },
    create: {
      id: orgId,
      owner_user_id: linaUserId,
      type: OrganizationType.PERSONAL,
      name: ADMIN_PEOPLE_DEMO_PERSONAL_NAME,
      display_reference: ADMIN_PEOPLE_DEMO_PERSONAL_REF,
      onboarding_status: "COMPLETED",
      onboarded_at: FIXED,
      first_name: "Lina",
      last_name: "Aziz",
      nationality: "MY",
      country: "MY",
      id_issuing_country: "MY",
      gender: "FEMALE",
      phone_number: "+60124440001",
      kyc_id: "KYC90083",
      document_type: "NRIC",
      document_number: "910101145099",
      date_of_birth: new Date("1991-01-01T00:00:00.000Z"),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      is_sophisticated_investor: false,
      sc_investor_category: ScInvestorCategory.RETAIL,
      created_at: FIXED,
      updated_at: FIXED,
      residential_address: json({
        line1: "8, Jalan Bukit Bintang",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Wilayah Persekutuan",
        country: "MY",
      }),
      bank_account_details: json(adminPeopleDemoBankDetails("334455667788")),
      wealth_declaration: json(adminPeopleDemoPersonalWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90083",
          requestId: "KYC90083",
          onboardingId: "LD90083",
        })
      ),
    },
    update: {
      owner_user_id: linaUserId,
      name: ADMIN_PEOPLE_DEMO_PERSONAL_NAME,
      display_reference: ADMIN_PEOPLE_DEMO_PERSONAL_REF,
      onboarding_status: "COMPLETED",
      first_name: "Lina",
      last_name: "Aziz",
      kyc_id: "KYC90083",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      is_sophisticated_investor: false,
      sc_investor_category: ScInvestorCategory.RETAIL,
      residential_address: json({
        line1: "8, Jalan Bukit Bintang",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Wilayah Persekutuan",
        country: "MY",
      }),
      bank_account_details: json(adminPeopleDemoBankDetails("334455667788")),
      wealth_declaration: json(adminPeopleDemoPersonalWealthDeclaration()),
      document_info: json(adminPeopleDemoDocumentInfo()),
      liveness_check_info: json(adminPeopleDemoLiveness()),
      compliance_declaration: json(adminPeopleDemoCompliance()),
      kyc_response: json(
        adminPeopleDemoKycResponse({
          systemId: "KYC90083",
          requestId: "KYC90083",
          onboardingId: "LD90083",
        })
      ),
    },
  });

  await wipeInvestor(prisma, orgId);

  await upsertCodOnboarding(prisma, {
    userId: linaUserId,
    portal: "investor",
    orgId,
    organizationType: OrganizationType.PERSONAL,
    requestId: ADMIN_PEOPLE_DEMO_COD.personalRequestId,
    referenceId: ADMIN_PEOPLE_DEMO_COD.personalReferenceId,
    onboardingType: "INDIVIDUAL",
  });

  await prisma.user.update({
    where: { user_id: linaUserId },
    data: { investor_account: { set: [orgId] } },
  });
}

export async function seedAdminPeopleDemo(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Admin People demo seed is blocked in production.");
  }

  logger.info("🌱 Seeding Admin People Test organisations...");

  const users = {
    daniel: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.daniel,
      first: "Daniel",
      last: "Wong",
      roles: [UserRole.ISSUER],
      phone: "+60121110001",
    }),
    benjamin: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.benjaminAccount,
      first: "Benjamin",
      last: "Lee",
      roles: [UserRole.ISSUER],
    }),
    chloe: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.chloe,
      first: "Chloe",
      last: "Lim",
      roles: [UserRole.ISSUER],
    }),
    finance: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.finance,
      first: "Finance",
      last: "User",
      roles: [UserRole.ISSUER],
    }),
    operations: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.operations,
      first: "Operations",
      last: "Admin",
      roles: [UserRole.ISSUER],
    }),
    karen: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.karen,
      first: "Karen",
      last: "Ho",
      roles: [UserRole.ISSUER],
    }),
    priya: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.priya,
      first: "Priya",
      last: "Menon",
      roles: [UserRole.INVESTOR],
      phone: "+60123330001",
    }),
    siti: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.siti,
      first: "Siti",
      last: "Rahman",
      roles: [UserRole.INVESTOR],
    }),
    investorOps: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.investorOps,
      first: "Investor",
      last: "Ops",
      roles: [UserRole.INVESTOR],
    }),
    lina: await ensureUser(prisma, {
      email: ADMIN_PEOPLE_DEMO_EMAIL.lina,
      first: "Lina",
      last: "Aziz",
      roles: [UserRole.INVESTOR],
      phone: "+60124440001",
    }),
  };

  await seedIssuer(prisma, users);
  await seedInvestorCompany(prisma, users);
  await seedPersonalInvestor(prisma, users.lina);

  logger.info(
    `✅ Admin People Test seeded: issuer ${ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID}, investor ${ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID}, personal ${ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID}`
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedAdminPeopleDemo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof require !== "undefined" && typeof module !== "undefined" && require.main === module;
if (isDirectRun) {
  main().catch((error) => {
    logger.error(error, "❌ Admin People demo seed failed");
    process.exit(1);
  });
}
