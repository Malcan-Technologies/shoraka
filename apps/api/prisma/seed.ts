import { PrismaClient, UserRole, AdminRole, OrganizationType } from "@prisma/client";
import { logger } from "../src/lib/logger";
import { generateUniqueUserId } from "../src/lib/user-id-generator";

const prisma = new PrismaClient();

async function main() {
  logger.info("🌱 Starting database seed...");

  // Admin user - use environment variable for cognito_sub if provided
  const adminCognitoSub = process.env.ADMIN_COGNITO_SUB || `seed_admin_${Date.now()}`;
  const adminCognitoUsername = "khai.kit@malcan.io";
  const adminEmail = "khai.kit@malcan.io";

  // Check if user already exists by email or cognito_sub
  let existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    existingUser = await prisma.user.findUnique({
      where: { cognito_sub: adminCognitoSub },
    });
  }

  // Generate user_id only if user doesn't exist
  const userId = existingUser?.user_id || (await generateUniqueUserId());

  // Create or update admin user
  let adminUser: typeof existingUser;
  if (existingUser) {
    // Update existing user
    adminUser = await prisma.user.update({
      where: { user_id: existingUser.user_id },
      data: {
        // Ensure ADMIN role is always present
        roles: {
          set: [UserRole.ADMIN],
        },
        // Ensure user_id exists if it was missing
        ...(existingUser.user_id ? {} : { user_id: userId }),
        // Update cognito_sub if it changed
        ...(existingUser.cognito_sub !== adminCognitoSub && { cognito_sub: adminCognitoSub }),
      },
    });
  } else {
    // Create new user
    adminUser = await prisma.user.create({
      data: {
        user_id: userId,
        email: adminEmail,
        cognito_sub: adminCognitoSub,
        cognito_username: adminCognitoUsername,
        roles: [UserRole.ADMIN],
        first_name: "Khai",
        last_name: "Kit",
        phone: "+60165584792",
        investor_account: [],
        issuer_account: [],
      },
    });
  }

  logger.info(`✅ Admin user created/updated: ${adminUser.email}`);

  // Create or update Admin record with SUPER_ADMIN role
  const adminRecord = await prisma.admin.upsert({
    where: { user_id: adminUser.user_id },
    create: {
      user_id: adminUser.user_id,
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
      updated_at: new Date(),
    },
    update: {
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
      updated_at: new Date(),
    },
  });

  logger.info(`✅ Admin record created/updated: ${adminRecord.role_description} for ${adminUser.email}`);

  // Create access logs for admin user
  const now = new Date();
  const accessLogs = [];

  // Admin user logs
  accessLogs.push({
    user_id: adminUser.user_id,
    event_type: "LOGIN",
    portal: "admin",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    device_info: "Linux Desktop",
    device_type: "Linux Desktop",
    success: true,
    metadata: { auth_method: "mfa", active_role: "ADMIN" },
    created_at: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
  });

  accessLogs.push({
    user_id: adminUser.user_id,
    event_type: "LOGOUT",
    portal: "admin",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36",
    device_info: "Linux Desktop",
    device_type: "Linux Desktop",
    success: true,
    metadata: { session_duration: "3h 20m", active_role: "ADMIN" },
    created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
  });

  accessLogs.push({
    user_id: adminUser.user_id,
    event_type: "KYC_STATUS_UPDATED",
    portal: "admin",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36",
    device_info: "Linux Desktop",
    device_type: "Linux Desktop",
    success: true,
    metadata: { old_status: "PENDING", new_status: "APPROVED" },
    created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
  });

  // Insert access logs
  for (const log of accessLogs) {
    await prisma.accessLog.create({
      data: {
        user_id: log.user_id,
        event_type: log.event_type,
        portal: log.portal,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        device_info: log.device_info,
        device_type: log.device_type,
        success: log.success,
        metadata: log.metadata,
        created_at: log.created_at,
      },
    });
  }

  logger.info(`✅ Created ${accessLogs.length} access log entries`);

  logger.info("🌱 Seeding organization data...");

  // Create Investor Organization for admin
  const investorOrg = await prisma.investorOrganization.create({
    data: {
      owner_user_id: adminUser.user_id,
      type: OrganizationType.COMPANY,
      name: "Malcan Ventures Sdn Bhd",
      registration_number: "202401012345",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      is_sophisticated_investor: true,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
    },
  });

  // Create Issuer Organization for admin
  const issuerOrg = await prisma.issuerOrganization.create({
    data: {
      owner_user_id: adminUser.user_id,
      type: OrganizationType.COMPANY,
      name: "Malcan Issuers Sdn Bhd",
      registration_number: "202401054321",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
    },
  });

  logger.info(`✅ Organizations created: ${investorOrg.name} and ${issuerOrg.name}`);

  // Seed Product
  logger.info("🌱 Seeding product data...");
  const product = await prisma.product.create({
    data: {
      version: 1,
      workflow: [
        { id: "financing_type_1", name: "Financing Type" },
        { id: "financing_structure_1", name: "Financing Structure" },
        { id: "contract_details_1", name: "Contract Details" },
        { id: "invoice_details_1", name: "Invoice Details" },
        { id: "company_details_1", name: "Company Details" },
        { id: "business_details_1", name: "Business Details" },
        { id: "supporting_documents_1", name: "Supporting Documents" },
        { id: "declarations_1", name: "Declarations" },
        { id: "review_and_submit_1", name: "Review and Submit" },
      ],
    },
  });
  logger.info(`✅ Product created: ${product.id}`);

  // Seed Application for the issuer organization
  logger.info("🌱 Seeding application data...");
  const application = await prisma.application.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      product_version: product.version,
      status: "DRAFT",
      last_completed_step: 1,
      financing_type: {
        product_id: product.id,
      },
    },
  });
  logger.info(`✅ Application created: ${application.id}`);

  logger.info("🌱 Seeding audit log data for activity feed...");

  // Seed Onboarding Logs
  await prisma.onboardingLog.createMany({
    data: [
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_STARTED",
        role: UserRole.INVESTOR,
        metadata: { portal: "investor" },
        created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_RESUMED",
        role: UserRole.INVESTOR,
        metadata: { step: "IDENTITY_VERIFICATION" },
        created_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_CANCELLED",
        role: UserRole.INVESTOR,
        metadata: { reason: "User requested deletion" },
        created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        issuer_organization_id: issuerOrg.id,
        organization_name: issuerOrg.name,
        event_type: "ONBOARDING_STARTED",
        role: UserRole.ISSUER,
        metadata: { portal: "issuer" },
        created_at: new Date(now.getTime() - 11.5 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_REJECTED",
        role: UserRole.INVESTOR,
        metadata: { reason: "Invalid documents" },
        created_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_STATUS_UPDATED",
        role: UserRole.INVESTOR,
        metadata: { old_status: "PENDING", new_status: "IN_PROGRESS" },
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "FORM_FILLED",
        role: UserRole.INVESTOR,
        metadata: { form_name: "personal_details" },
        created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        issuer_organization_id: issuerOrg.id,
        organization_name: issuerOrg.name,
        event_type: "ONBOARDING_APPROVED",
        role: UserRole.ISSUER,
        metadata: { approved_by: "system" },
        created_at: new Date(now.getTime() - 8.5 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "ONBOARDING_APPROVED",
        role: UserRole.INVESTOR,
        metadata: { approved_by: "system" },
        created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "AML_APPROVED",
        role: UserRole.INVESTOR,
        metadata: { risk_level: "LOW" },
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "TNC_APPROVED",
        role: UserRole.INVESTOR,
        metadata: { version: "1.0" },
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "TNC_ACCEPTED",
        role: UserRole.INVESTOR,
        metadata: { version: "1.0" },
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "SSM_APPROVED",
        role: UserRole.INVESTOR,
        metadata: { registration_verified: true },
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "FINAL_APPROVAL_COMPLETED",
        role: UserRole.INVESTOR,
        metadata: { final_status: "COMPLETED" },
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "SOPHISTICATED_STATUS_UPDATED",
        role: UserRole.INVESTOR,
        metadata: { is_sophisticated: true },
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        investor_organization_id: investorOrg.id,
        organization_name: investorOrg.name,
        event_type: "KYC_SUBMITTED",
        role: UserRole.INVESTOR,
        metadata: { status: "PENDING_APPROVAL" },
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Seed onboarding approval queue data with varying statuses
  // ---------------------------------------------------------------------------
  logger.info("🌱 Seeding onboarding approval queue data...");

  const onboardingSeedUsers = [
    { first: "Ahmad",    last: "Rahman",     email: "ahmad.rahman@example.com"   },
    { first: "Siti",     last: "Noor",       email: "siti.noor@example.com"      },
    { first: "Wei",      last: "Chen",       email: "wei.chen@example.com"       },
    { first: "Raj",      last: "Patel",      email: "raj.patel@example.com"      },
    { first: "Aisha",    last: "Hassan",     email: "aisha.hassan@example.com"   },
    { first: "David",    last: "Tan",        email: "david.tan@example.com"      },
    { first: "Fatimah",  last: "Ali",        email: "fatimah.ali@example.com"    },
    { first: "James",    last: "Wong",       email: "james.wong@example.com"     },
    { first: "Nurul",    last: "Ibrahim",    email: "nurul.ibrahim@example.com"  },
    { first: "Kumar",    last: "Singh",      email: "kumar.singh@example.com"    },
    { first: "Mei",      last: "Ling",       email: "mei.ling@example.com"       },
    { first: "Hakim",    last: "Yusuf",      email: "hakim.yusuf@example.com"    },
  ];

  interface OnboardingScenario {
    portal: "investor" | "issuer";
    orgType: "PERSONAL" | "COMPANY";
    orgName: string | null;
    regNum: string | null;
    regtankStatus: string;
    orgOnboardingStatus: string;
    onboardingApproved: boolean;
    amlApproved: boolean;
    tncAccepted: boolean;
    ssmFlag: boolean;
    isSophisticated?: boolean;
    onboardedAt?: Date;
    daysAgo: number;
  }

  const scenarios: OnboardingScenario[] = [
    // 1. Investor personal — still completing onboarding (in-progress)
    {
      portal: "investor", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "FORM_FILLING", orgOnboardingStatus: "IN_PROGRESS",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 1,
    },
    // 2. Investor personal — pending approval (liveness passed, waiting admin)
    {
      portal: "investor", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "PENDING_APPROVAL",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 3,
    },
    // 3. Investor company — pending AML
    {
      portal: "investor", orgType: "COMPANY", orgName: "Bright Capital Sdn Bhd", regNum: "202301045678",
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "PENDING_AML",
      onboardingApproved: true, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 5,
    },
    // 4. Issuer company — pending SSM review
    {
      portal: "issuer", orgType: "COMPANY", orgName: "TradeFlow Solutions Sdn Bhd", regNum: "202201098765",
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "PENDING_SSM_REVIEW",
      onboardingApproved: true, amlApproved: true, tncAccepted: true, ssmFlag: false,
      daysAgo: 7,
    },
    // 5. Investor company — pending final approval
    {
      portal: "investor", orgType: "COMPANY", orgName: "Green Ventures Bhd", regNum: "202401011111",
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "PENDING_FINAL_APPROVAL",
      onboardingApproved: true, amlApproved: true, tncAccepted: true, ssmFlag: true,
      isSophisticated: true, daysAgo: 10,
    },
    // 6. Issuer personal — completed
    {
      portal: "issuer", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "COMPLETED",
      onboardingApproved: true, amlApproved: true, tncAccepted: true, ssmFlag: true,
      onboardedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), daysAgo: 14,
    },
    // 7. Investor personal — rejected
    {
      portal: "investor", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "REJECTED", orgOnboardingStatus: "REJECTED",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 20,
    },
    // 8. Issuer company — expired
    {
      portal: "issuer", orgType: "COMPANY", orgName: "Legacy Trade Co", regNum: "201901054321",
      regtankStatus: "EXPIRED", orgOnboardingStatus: "PENDING",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 30,
    },
    // 9. Investor personal — cancelled
    {
      portal: "investor", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "CANCELLED", orgOnboardingStatus: "PENDING",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 25,
    },
    // 10. Issuer company — pending approval
    {
      portal: "issuer", orgType: "COMPANY", orgName: "Swift Finance Sdn Bhd", regNum: "202301077777",
      regtankStatus: "LIVENESS_PASSED", orgOnboardingStatus: "PENDING_APPROVAL",
      onboardingApproved: false, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 2,
    },
    // 11. Investor company — completed (sophisticated)
    {
      portal: "investor", orgType: "COMPANY", orgName: "Alpha Wealth Partners Bhd", regNum: "202001033333",
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "COMPLETED",
      onboardingApproved: true, amlApproved: true, tncAccepted: true, ssmFlag: true,
      isSophisticated: true,
      onboardedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), daysAgo: 12,
    },
    // 12. Issuer personal — pending AML
    {
      portal: "issuer", orgType: "PERSONAL", orgName: null, regNum: null,
      regtankStatus: "WAIT_FOR_APPROVAL", orgOnboardingStatus: "PENDING_AML",
      onboardingApproved: true, amlApproved: false, tncAccepted: false, ssmFlag: false,
      daysAgo: 4,
    },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const u = onboardingSeedUsers[i];
    const seedUserId = await generateUniqueUserId();
    const cognitoSub = `seed_onboarding_${i}_${Date.now()}`;

    // Skip if user already seeded (by email)
    const existingSeedUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (existingSeedUser) {
      logger.info(`⏭️  Skipping onboarding seed for ${u.email} (already exists)`);
      continue;
    }

    // Create user
    const seedUser = await prisma.user.create({
      data: {
        user_id: seedUserId,
        first_name: u.first,
        last_name: u.last,
        email: u.email,
        cognito_sub: cognitoSub,
        cognito_username: u.email,
        roles: s.portal === "investor" ? [UserRole.INVESTOR] : [UserRole.ISSUER],
        investor_account: [],
        issuer_account: [],
      },
    });

    const createdAt = new Date(now.getTime() - s.daysAgo * 24 * 60 * 60 * 1000);
    const orgType = s.orgType as OrganizationType;
    const isInvestor = s.portal === "investor";

    // Create organization
    let investorOrgId: string | null = null;
    let issuerOrgId: string | null = null;

    if (isInvestor) {
      const org = await prisma.investorOrganization.create({
        data: {
          owner_user_id: seedUser.user_id,
          type: orgType,
          name: s.orgName ?? `${u.first} ${u.last}`,
          registration_number: s.regNum,
          onboarding_status: s.orgOnboardingStatus as never,
          onboarded_at: s.onboardedAt ?? null,
          first_name: u.first,
          last_name: u.last,
          nationality: "MY",
          country: "MY",
          onboarding_approved: s.onboardingApproved,
          aml_approved: s.amlApproved,
          tnc_accepted: s.tncAccepted,
          ssm_approved: s.ssmFlag,
          is_sophisticated_investor: s.isSophisticated ?? false,
          created_at: createdAt,
        },
      });
      investorOrgId = org.id;
    } else {
      const org = await prisma.issuerOrganization.create({
        data: {
          owner_user_id: seedUser.user_id,
          type: orgType,
          name: s.orgName ?? `${u.first} ${u.last}`,
          registration_number: s.regNum,
          onboarding_status: s.orgOnboardingStatus as never,
          onboarded_at: s.onboardedAt ?? null,
          first_name: u.first,
          last_name: u.last,
          nationality: "MY",
          country: "MY",
          onboarding_approved: s.onboardingApproved,
          aml_approved: s.amlApproved,
          tnc_accepted: s.tncAccepted,
          ssm_checked: s.ssmFlag,
          created_at: createdAt,
        },
      });
      issuerOrgId = org.id;
    }

    // Create RegTank onboarding record
    const requestId = `REQ${String(100 + i).padStart(5, "0")}`;
    const referenceId = `REF${String(200 + i).padStart(5, "0")}`;
    const onboardingType = s.orgType === "COMPANY" ? "CORPORATE" : "INDIVIDUAL";

    await prisma.regTankOnboarding.create({
      data: {
        user_id: seedUser.user_id,
        investor_organization_id: investorOrgId,
        issuer_organization_id: issuerOrgId,
        organization_type: orgType,
        portal_type: s.portal,
        request_id: requestId,
        reference_id: referenceId,
        onboarding_type: onboardingType,
        status: s.regtankStatus,
        created_at: createdAt,
        submitted_at: createdAt,
      },
    });

    logger.info(
      `✅ Onboarding seed [${i + 1}/${scenarios.length}]: ${u.first} ${u.last} — ${s.portal}/${s.orgType} — status derives to ${s.regtankStatus}/${s.orgOnboardingStatus}`
    );
  }

  logger.info("✅ Onboarding approval queue seeded with 12 records across all statuses");

  // ---------------------------------------------------------------------------
  // Seed a fully-populated issuer company (Ray Ban Sdn Bhd) with JSON fields
  // ---------------------------------------------------------------------------
  logger.info("🌱 Seeding fully-populated company organization (Ray Ban Sdn Bhd)...");

  const rayBanEmail = "yang_lim@hotmail.com";
  let rayBanUser = await prisma.user.findUnique({ where: { email: rayBanEmail } });

  if (!rayBanUser) {
    const rayBanUserId = await generateUniqueUserId();
    rayBanUser = await prisma.user.create({
      data: {
        user_id: rayBanUserId,
        first_name: "Yang",
        last_name: "Lim",
        email: rayBanEmail,
        cognito_sub: `seed_rayban_${Date.now()}`,
        cognito_username: rayBanEmail,
        roles: [UserRole.ISSUER],
        investor_account: [],
        issuer_account: [],
      },
    });
  }

  const existingRayBanOrg = await prisma.issuerOrganization.findFirst({
    where: { name: "Ray Ban Sdn Bhd" },
  });

  if (!existingRayBanOrg) {
    const rayBanOrg = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: rayBanUser.user_id,
        type: OrganizationType.COMPANY,
        name: "Ray Ban Sdn Bhd",
        registration_number: "555555555555",
        onboarding_status: "COMPLETED",
        onboarded_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        first_name: "Yang",
        last_name: "Lim",
        nationality: "MY",
        country: "MY",
        phone_number: "+60123456789",
        onboarding_approved: true,
        aml_approved: true,
        tnc_accepted: true,
        ssm_checked: true,
        corporate_onboarding_data: {
          basicInfo: {
            ssmRegisterNumber: "555555555555",
            tinNumber: "555",
            industry: "Agriculture, Forestry, Fishing",
            entityType: "Private Limited Company (Sdn Bhd)",
            businessName: "Ray Ban Sdn Bhd",
            numberOfEmployees: 5,
          },
          addresses: {
            business: {
              line1: "rthrthr",
              line2: "rthrth",
              city: null,
              postalCode: "12345",
              state: "Kedah",
              country: "MY",
            },
            registered: {
              line1: "rthrthr",
              line2: "rthrth",
              city: null,
              postalCode: "12345",
              state: "Kedah",
              country: "MY",
            },
          },
        },
        bank_account_details: {
          content: [
            { fieldName: "Bank", fieldType: "picklist", fieldValue: "Affin Bank Berhad", alias: "Bank" },
            { fieldName: "bankAccountNumber", fieldType: "text", fieldValue: "46565", alias: "Bank account number" },
            { fieldName: "accountType", fieldType: "picklist", fieldValue: "Savings", alias: "Account type" },
          ],
          displayArea: "bank_account_details",
        },
        wealth_declaration: {
          content: [
            { fieldName: "NetAssetValue", fieldType: "text", fieldValue: "5645", alias: "Net Asset Value" },
            { fieldName: "SourceOfFunds", fieldType: "multi-checkbox", fieldValue: ["Deposits from members"], alias: "Source of Funds" },
            { fieldName: "SourceOfFundsOther", fieldType: "text", fieldValue: "-", alias: "Source of Funds (Other)" },
          ],
          displayArea: "wealth_declaration",
        },
        compliance_declaration: {
          content: [
            { fieldName: "PepStatus", fieldType: "multi-checkbox", fieldValue: ["- Not a PEP"], alias: "PEP Status" },
            { fieldName: "BelongsToGroups", fieldType: "multi-checkbox", fieldValue: ["- Not a PEP"], alias: "Belongs to Groups" },
          ],
          displayArea: "compliance_declaration",
        },
        kyc_response: {
          status: "Approved",
          riskLevel: "Low Risk",
          riskScore: "1.0",
          systemId: "KYC00127",
          requestId: "KYC00127",
          onboardingId: "EOD04938",
          messageStatus: "DONE",
          timestamp: new Date(2026, 1, 3, 16, 20, 4).toISOString(),
          possibleMatchCount: 0,
          blacklistedMatchCount: 0,
          tags: [],
        },
      },
    });

    // Create onboarding logs for Ray Ban org
    await prisma.onboardingLog.createMany({
      data: [
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "ONBOARDING_STARTED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { portalType: "issuer", organizationType: "COMPANY" },
          created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "FORM_FILLED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { section: "Basic Information" },
          created_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "FORM_FILLED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { section: "Bank Account Details" },
          created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "FORM_FILLED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Mobile",
          metadata: { section: "Wealth Declaration" },
          created_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "FORM_FILLED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { section: "Compliance Declaration" },
          created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "TNC_ACCEPTED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { version: "2.0" },
          created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "ONBOARDING_STATUS_UPDATED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { previousStatus: "IN_PROGRESS", newStatus: "PENDING_APPROVAL", trigger: "USER_COMPLETED" },
          created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 3600000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "KYC_APPROVED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { isCorporateOnboarding: true, riskLevel: "Low Risk", riskScore: "1.0" },
          created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "AML_APPROVED",
          role: UserRole.ISSUER,
          portal: "issuer",
          ip_address: "103.56.78.12",
          device_type: "Desktop",
          metadata: { isCorporateOnboarding: true, riskLevel: "Low Risk" },
          created_at: new Date(now.getTime() - 7.5 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "SSM_APPROVED",
          role: UserRole.ISSUER,
          portal: "issuer",
          metadata: { registration_verified: true, approvedBy: adminUser.user_id },
          created_at: new Date(now.getTime() - 7.2 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "ONBOARDING_APPROVED",
          role: UserRole.ISSUER,
          portal: "issuer",
          metadata: { approvedBy: adminUser.user_id },
          created_at: new Date(now.getTime() - 7.1 * 24 * 60 * 60 * 1000),
        },
        {
          user_id: rayBanUser.user_id,
          issuer_organization_id: rayBanOrg.id,
          organization_name: "Ray Ban Sdn Bhd",
          event_type: "FINAL_APPROVAL_COMPLETED",
          role: UserRole.ISSUER,
          portal: "issuer",
          metadata: { final_status: "COMPLETED", approvedBy: adminUser.user_id },
          created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    logger.info("✅ Ray Ban Sdn Bhd organization seeded with full JSON data and onboarding logs");
  } else {
    logger.info("⏭️  Skipping Ray Ban Sdn Bhd (already exists)");
  }

  // ---------------------------------------------------------------------------
  // Seed a fully-populated personal investor (Yuen Zheng Chng)
  // ---------------------------------------------------------------------------
  logger.info("🌱 Seeding fully-populated personal investor (Yuen Zheng Chng)...");

  const yzEmail = "yuenzheng.chng@example.com";
  let yzUser = await prisma.user.findUnique({ where: { email: yzEmail } });

  if (!yzUser) {
    const yzUserId = await generateUniqueUserId();
    yzUser = await prisma.user.create({
      data: {
        user_id: yzUserId,
        first_name: "Yuen Zheng",
        last_name: "Chng",
        email: yzEmail,
        cognito_sub: `seed_yz_${Date.now()}`,
        cognito_username: yzEmail,
        roles: [UserRole.INVESTOR],
        investor_account: [],
        issuer_account: [],
      },
    });
  }

  const existingYzOrg = await prisma.investorOrganization.findFirst({
    where: { owner_user_id: yzUser.user_id, type: OrganizationType.PERSONAL, name: "Yuen Zheng Chng" },
  });

  if (!existingYzOrg) {
    const yzOrg = await prisma.investorOrganization.create({
      data: {
        owner_user_id: yzUser.user_id,
        type: OrganizationType.PERSONAL,
        name: "Yuen Zheng Chng",
        onboarding_status: "COMPLETED",
        onboarded_at: new Date(2026, 0, 12, 9, 2, 50, 950),
        first_name: "Yuen Zheng",
        last_name: "Chng",
        nationality: "MY",
        country: "MY",
        id_issuing_country: "MY",
        gender: "UNSPECIFIED",
        address: "BU 4/5, Bandar Utama, 47800 Petaling Jaya, Selangor",
        document_type: "IDENTITY",
        document_number: "021116101341",
        phone_number: "+60123456789",
        kyc_id: "KYC00086",
        onboarding_approved: true,
        aml_approved: true,
        tnc_accepted: true,
        ssm_approved: false,
        deposit_received: false,
        is_sophisticated_investor: false,
        admin_approved_at: new Date(2026, 0, 12, 9, 2, 50, 950),
        bank_account_details: {
          content: [
            { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "Maybank / Malayan Banking Berhad" },
            { cn: false, fieldName: "Bank account number", fieldType: "number", fieldValue: "123456789" },
            { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: "Savings" },
          ],
          displayArea: "Bank Account Details",
        },
        wealth_declaration: {
          content: [
            { cn: false, fieldName: "Employment status", fieldType: "picklist", fieldValue: "Employed" },
            { cn: false, fieldName: "Employer", fieldType: "text", fieldValue: "Ivan" },
            { cn: false, fieldName: "Industry", fieldType: "picklist", fieldValue: "Information & Communication Technology (ICT)" },
            { cn: false, fieldName: "If others", fieldType: "text", fieldValue: "" },
            { cn: false, fieldName: "Job title", fieldType: "text", fieldValue: "Full Stack Developer" },
            { cn: false, fieldName: "Annual income range", fieldType: "picklist", fieldValue: "Above RM500,001" },
            { cn: false, fieldName: "Source of funds", fieldType: "multi-checkbox", fieldValue: ["Employment Income"] },
          ],
          displayArea: "Wealth Declaration",
        },
        compliance_declaration: {
          content: [
            { cn: false, fieldName: "Asset and Income", fieldType: "header", fieldValue: "" },
            { cn: false, alias: "Do you meet either of the following criteria:", fieldName: "Do you meet either of the following criteria: (Net Assets)", fieldType: "picklist", fieldValue: "No" },
            { cn: false, alias: "In the preceding twelve months, have you:", fieldName: "In the preceding twelve months, have you: (Annual Income)", fieldType: "picklist", fieldValue: "No" },
            { cn: false, fieldName: "Do you have a total net personal investment portfolio,or a total net joint investment portfolio held with your spouse or child in capital market products, with an aggregate value exceeding RM1,000,000 (or its equivalent in foreign currencies)?", fieldType: "picklist", fieldValue: "No" },
            { cn: false, fieldName: " ", fieldType: "header", fieldValue: "" },
            { cn: false, fieldName: "Professional Qualification / Experience Categories", fieldType: "header", fieldValue: "" },
            { cn: false, alias: "Do any of the descriptions below apply to you?", fieldName: "Do any of the descriptions below apply to you? (Experience Categories)", fieldType: "picklist", fieldValue: "No" },
            { cn: false, alias: "Do any of the descriptions below apply to you?", fieldName: "Do any of the descriptions below apply to you? (Professional Qualification)", fieldType: "picklist", fieldValue: "No" },
            { cn: false, fieldName: "Are you a tax resident of Malaysia?", fieldType: "picklist", fieldValue: "Yes" },
            { cn: false, fieldName: "  ", fieldType: "header", fieldValue: "" },
            { cn: false, fieldName: "Poltically Exposed Person (PEP) Status", fieldType: "header", fieldValue: "" },
            { cn: false, fieldName: "Do you belong to any of these groups of PEP (Politically Exposed Person)", fieldType: "multi-checkbox", fieldValue: ["Not a PEP"] },
            { cn: false, fieldName: "   ", fieldType: "header", fieldValue: "" },
            { cn: false, alias: "Do you belong to any of these groups of people?", fieldName: "Do you belong to any of these groups of people? (Relative Close Associate (RCA) Declaration)", fieldType: "picklist", fieldValue: "No" },
            { cn: false, fieldName: "    ", fieldType: "header", fieldValue: "" },
            { cn: false, fieldName: "I certify that the information I have provided is accurate and complete, and I acknowledge that providing false or misleading information may result in legal consequences.", fieldType: "checkbox", fieldValue: true },
          ],
          displayArea: "Compliance Declarations",
        },
        document_info: {
          countryCode: "SG",
          documentType: "Identity",
          backDocumentUrl: "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/back/e69e0210-2d14-48f2-84c4-ad5ead3a11fb.png",
          frontDocumentUrl: "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/front/2c083615-6483-449a-8cb7-61cb042c48c6.jpeg",
        },
        liveness_check_info: {
          selfieUrl: "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/live-face/99e37a95-e3bc-4211-bd73-dcfa8de9a515.jpeg",
          confidence: 85.3,
          documentUrl: "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/profile/front/2c083615-6483-449a-8cb7-61cb042c48c6.jpeg",
          verifyStatus: "LIVENESS_PASSED",
          selfieVideoUrl: "https://media-onboarding.regtank.com/prod/userportal/Client-00391/LD72411-R02/live-face/c1a63023-cd7f-452f-8296-4a46563b53d7.mp4",
        },
        kyc_response: {
          tags: [],
          status: "Approved",
          assignee: "",
          systemId: "KYC00086",
          requestId: "KYC00086",
          riskLevel: "Low Risk",
          riskScore: "1.0",
          timestamp: "2026-01-12T08:59:34.958+00:00",
          referenceId: "",
          onboardingId: "LD72411-R02",
          messageStatus: "DONE",
          possibleMatchCount: 0,
          blacklistedMatchCount: 0,
        },
        created_at: new Date(2026, 0, 12, 8, 54, 20, 205),
      },
    });

    await prisma.onboardingLog.createMany({
      data: [
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "ONBOARDING_STARTED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { portalType: "investor", organizationType: "PERSONAL" },
          created_at: new Date(2026, 0, 12, 8, 54, 20),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "FORM_FILLED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { section: "Bank Account Details" },
          created_at: new Date(2026, 0, 12, 8, 55, 10),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "FORM_FILLED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { section: "Wealth Declaration" },
          created_at: new Date(2026, 0, 12, 8, 56, 30),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "FORM_FILLED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { section: "Compliance Declarations" },
          created_at: new Date(2026, 0, 12, 8, 57, 45),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "TNC_ACCEPTED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { version: "2.0" },
          created_at: new Date(2026, 0, 12, 8, 58, 0),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "ONBOARDING_STATUS_UPDATED",
          role: UserRole.INVESTOR,
          portal: "investor",
          ip_address: "175.139.42.88",
          device_type: "Desktop",
          metadata: { previousStatus: "IN_PROGRESS", newStatus: "PENDING_APPROVAL", trigger: "USER_COMPLETED" },
          created_at: new Date(2026, 0, 12, 8, 58, 30),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "KYC_APPROVED",
          role: UserRole.INVESTOR,
          portal: "investor",
          metadata: { riskLevel: "Low Risk", riskScore: "1.0" },
          created_at: new Date(2026, 0, 12, 8, 59, 35),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "AML_APPROVED",
          role: UserRole.INVESTOR,
          portal: "investor",
          metadata: { riskLevel: "Low Risk" },
          created_at: new Date(2026, 0, 12, 9, 0, 10),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "ONBOARDING_APPROVED",
          role: UserRole.INVESTOR,
          portal: "investor",
          metadata: { approvedBy: adminUser.user_id },
          created_at: new Date(2026, 0, 12, 9, 1, 30),
        },
        {
          user_id: yzUser.user_id,
          investor_organization_id: yzOrg.id,
          organization_name: "Yuen Zheng Chng",
          event_type: "FINAL_APPROVAL_COMPLETED",
          role: UserRole.INVESTOR,
          portal: "investor",
          metadata: { final_status: "COMPLETED", approvedBy: adminUser.user_id },
          created_at: new Date(2026, 0, 12, 9, 2, 50),
        },
      ],
    });

    logger.info("✅ Yuen Zheng Chng personal investor seeded with full JSON data and onboarding logs");
  } else {
    logger.info("⏭️  Skipping Yuen Zheng Chng (already exists)");
  }

  logger.info("🎉 Database seed completed successfully!");
}

main()
  .catch((e) => {
    logger.error(e, "❌ Error seeding database");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
