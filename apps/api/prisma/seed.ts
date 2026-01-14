import { PrismaClient, UserRole, AdminRole } from "@prisma/client";
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

  logger.info("🌱 Seeding audit log data for activity feed...");

  // Seed Security Logs
  await prisma.securityLog.createMany({
    data: [
      {
        user_id: adminUser.user_id,
        event_type: "PASSWORD_CHANGED",
        metadata: { success: true, reason: "USER_INITIATED" },
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        event_type: "ROLE_SWITCHED",
        metadata: { newRole: "ADMIN" },
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Seed Onboarding Logs
  await prisma.onboardingLog.createMany({
    data: [
      {
        user_id: adminUser.user_id,
        event_type: "ONBOARDING_STARTED",
        role: UserRole.INVESTOR,
        metadata: { portal: "investor" },
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        event_type: "KYC_SUBMITTED",
        role: UserRole.INVESTOR,
        metadata: { status: "PENDING_APPROVAL" },
        created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        event_type: "USER_COMPLETED",
        role: UserRole.INVESTOR,
        metadata: { status: "COMPLETED" },
        created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Seed Document Logs
  await prisma.documentLog.createMany({
    data: [
      {
        user_id: adminUser.user_id,
        event_type: "DOCUMENT_CREATED",
        metadata: { fileName: "contract_v1.pdf", type: "PLATFORM_AGREEMENT" },
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: adminUser.user_id,
        event_type: "DOCUMENT_CREATED",
        metadata: { fileName: "privacy_policy.pdf", type: "PRIVACY_POLICY" },
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });

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
