#!/usr/bin/env tsx
/**
 * Seeds a completed personal investor org for an existing user so FPX name-match
 * testing works without RegTank/onboarding APIs.
 *
 * Expected name for name check: Kau Khai Kit (first + middle + last on org).
 *
 * Usage (from repo root):
 *   pnpm --filter @cashsouk/api seed-investor-rgvyz-name-match
 *
 * Optional env:
 *   SEED_USER_ID=RGVYZ   — defaults to RGVYZ
 */
import { OrganizationType, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_USER_ID = (process.env.SEED_USER_ID ?? "RGVYZ").trim().toUpperCase();
const DISPLAY_NAME = "Kau Khai Kit";
const FIRST_NAME = "Kau";
const MIDDLE_NAME = "Khai";
const LAST_NAME = "Kit";

const PERSONAL_INVESTOR_JSON = {
  nationality: "MY",
  country: "MY",
  id_issuing_country: "MY",
  gender: "UNSPECIFIED",
  address: "BU 4/5, Bandar Utama, 47800 Petaling Jaya, Selangor",
  document_type: "IDENTITY",
  document_number: "900101011234",
  phone_number: "+60123456789",
  kyc_id: "KYC_RGVYZ_SEED",
  onboarding_approved: true,
  aml_approved: true,
  tnc_accepted: true,
  ssm_approved: false,
  deposit_received: false,
  is_sophisticated_investor: false,
  onboarding_status: "COMPLETED" as const,
  onboarded_at: new Date(),
  admin_approved_at: new Date(),
  bank_account_details: {
    content: [
      {
        cn: false,
        fieldName: "Bank",
        fieldType: "picklist",
        fieldValue: "Maybank / Malayan Banking Berhad",
      },
      {
        cn: false,
        fieldName: "Bank account number",
        fieldType: "number",
        fieldValue: "123456789",
      },
      {
        cn: false,
        fieldName: "Account type",
        fieldType: "picklist",
        fieldValue: "Savings",
      },
    ],
    displayArea: "Bank Account Details",
  },
  wealth_declaration: {
    content: [
      {
        cn: false,
        fieldName: "Employment status",
        fieldType: "picklist",
        fieldValue: "Employed",
      },
      { cn: false, fieldName: "Employer", fieldType: "text", fieldValue: "CashSouk QA" },
      {
        cn: false,
        fieldName: "Industry",
        fieldType: "picklist",
        fieldValue: "Information & Communication Technology (ICT)",
      },
      { cn: false, fieldName: "If others", fieldType: "text", fieldValue: "" },
      { cn: false, fieldName: "Job title", fieldType: "text", fieldValue: "QA Engineer" },
      {
        cn: false,
        fieldName: "Annual income range",
        fieldType: "picklist",
        fieldValue: "Above RM500,001",
      },
      {
        cn: false,
        fieldName: "Source of funds",
        fieldType: "multi-checkbox",
        fieldValue: ["Employment Income"],
      },
    ],
    displayArea: "Wealth Declaration",
  },
  compliance_declaration: {
    content: [
      { cn: false, fieldName: "Asset and Income", fieldType: "header", fieldValue: "" },
      {
        cn: false,
        alias: "Do you meet either of the following criteria:",
        fieldName: "Do you meet either of the following criteria: (Net Assets)",
        fieldType: "picklist",
        fieldValue: "No",
      },
      {
        cn: false,
        alias: "In the preceding twelve months, have you:",
        fieldName: "In the preceding twelve months, have you: (Annual Income)",
        fieldType: "picklist",
        fieldValue: "No",
      },
      {
        cn: false,
        fieldName:
          "Do you have a total net personal investment portfolio,or a total net joint investment portfolio held with your spouse or child in capital market products, with an aggregate value exceeding RM1,000,000 (or its equivalent in foreign currencies)?",
        fieldType: "picklist",
        fieldValue: "No",
      },
      { cn: false, fieldName: " ", fieldType: "header", fieldValue: "" },
      {
        cn: false,
        fieldName: "Professional Qualification / Experience Categories",
        fieldType: "header",
        fieldValue: "",
      },
      {
        cn: false,
        alias: "Do any of the descriptions below apply to you?",
        fieldName: "Do any of the descriptions below apply to you? (Experience Categories)",
        fieldType: "picklist",
        fieldValue: "No",
      },
      {
        cn: false,
        alias: "Do any of the descriptions below apply to you?",
        fieldName:
          "Do any of the descriptions below apply to you? (Professional Qualification)",
        fieldType: "picklist",
        fieldValue: "No",
      },
      {
        cn: false,
        fieldName: "Are you a tax resident of Malaysia?",
        fieldType: "picklist",
        fieldValue: "Yes",
      },
      { cn: false, fieldName: "  ", fieldType: "header", fieldValue: "" },
      {
        cn: false,
        fieldName: "Poltically Exposed Person (PEP) Status",
        fieldType: "header",
        fieldValue: "",
      },
      {
        cn: false,
        fieldName: "Do you belong to any of these groups of PEP (Politically Exposed Person)",
        fieldType: "multi-checkbox",
        fieldValue: ["Not a PEP"],
      },
      { cn: false, fieldName: "   ", fieldType: "header", fieldValue: "" },
      {
        cn: false,
        alias: "Do you belong to any of these groups of people?",
        fieldName:
          "Do you belong to any of these groups of people? (Relative Close Associate (RCA) Declaration)",
        fieldType: "picklist",
        fieldValue: "No",
      },
      {
        cn: false,
        fieldName:
          "I certify that the information I have provided is accurate and complete, and I acknowledge that providing false or misleading information may result in legal consequences.",
        fieldType: "checkbox",
        fieldValue: true,
      },
    ],
    displayArea: "Compliance Declarations",
  },
  document_info: {
    countryCode: "MY",
    documentType: "Identity",
    backDocumentUrl: "https://example.com/seed/rgvyz/back.png",
    frontDocumentUrl: "https://example.com/seed/rgvyz/front.jpeg",
  },
  liveness_check_info: {
    selfieUrl: "https://example.com/seed/rgvyz/selfie.jpeg",
    confidence: 85.3,
    documentUrl: "https://example.com/seed/rgvyz/front.jpeg",
    verifyStatus: "LIVENESS_PASSED",
    selfieVideoUrl: "https://example.com/seed/rgvyz/selfie.mp4",
  },
  kyc_response: {
    tags: [],
    status: "Approved",
    assignee: "",
    systemId: "KYC_RGVYZ_SEED",
    requestId: "KYC_RGVYZ_SEED",
    riskLevel: "Low Risk",
    riskScore: "1.0",
    timestamp: new Date().toISOString(),
    referenceId: "",
    onboardingId: "SEED-RGVYZ",
    messageStatus: "DONE",
    possibleMatchCount: 0,
    blacklistedMatchCount: 0,
  },
};

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { user_id: TARGET_USER_ID } });
  if (!user) {
    throw new Error(
      `User ${TARGET_USER_ID} not found. Set SEED_USER_ID if your id differs.`
    );
  }

  const roles = new Set(user.roles);
  roles.add(UserRole.INVESTOR);

  await prisma.user.update({
    where: { user_id: user.user_id },
    data: {
      first_name: FIRST_NAME,
      last_name: `${MIDDLE_NAME} ${LAST_NAME}`,
      roles: [...roles],
      investor_account:
        user.investor_account.length > 0 ? user.investor_account : ["seed-personal"],
    },
  });

  let org = await prisma.investorOrganization.findFirst({
    where: { owner_user_id: user.user_id, type: OrganizationType.PERSONAL },
    orderBy: { created_at: "asc" },
  });

  const orgPayload = {
    type: OrganizationType.PERSONAL,
    name: DISPLAY_NAME,
    legal_name_on_id: DISPLAY_NAME,
    first_name: FIRST_NAME,
    middle_name: MIDDLE_NAME,
    last_name: LAST_NAME,
    ...PERSONAL_INVESTOR_JSON,
  };

  if (org) {
    org = await prisma.investorOrganization.update({
      where: { id: org.id },
      data: orgPayload,
    });
    console.log(`Updated personal investor org ${org.id}`);
  } else {
    org = await prisma.investorOrganization.create({
      data: {
        owner_user_id: user.user_id,
        ...orgPayload,
      },
    });
    console.log(`Created personal investor org ${org.id}`);
  }

  const expectedName = [FIRST_NAME, MIDDLE_NAME, LAST_NAME].join(" ");
  console.log("");
  console.log("Done.");
  console.log(`  user_id:        ${user.user_id}`);
  console.log(`  email:          ${user.email}`);
  console.log(`  org_id:         ${org.id}`);
  console.log(`  expected name:  ${expectedName}`);
  console.log("");
  console.log("Pay via live FPX using an account registered as Kau Khai Kit to test PASS.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
