import { PrismaClient, UserRole, AdminRole, ActivityType } from "@prisma/client";
import { logger } from "../src/lib/logger";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { activityService } from "../src/modules/activity/service";

const prisma = new PrismaClient();

async function main() {
  logger.info("🌱 Starting database seed...");

  // Admin user - use environment variable for cognito_sub if provided
  const adminCognitoSub = process.env.ADMIN_COGNITO_SUB || `seed_admin_${Date.now()}`;
  const adminCognitoUsername = "max.chng@malcan.io";
  const adminEmail = "max.chng@malcan.io";

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
        first_name: "Max",
        last_name: "Chng",
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
    },
    update: {
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
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

  // --- ACTIVITY SEEDING ---
  logger.info("🌱 Seeding activity data...");

  // Delete existing activities for this user
  await prisma.activity.deleteMany({
    where: { user_id: adminUser.user_id },
  });

  const activities = [
    {
      activity_type: ActivityType.INVESTMENT,
      metadata: { amount: "1,000", plan: "Fixed Income Plan" },
      description: "You invested RM1,000 in Fixed Income Plan",
      created_at: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
    },
    {
      activity_type: ActivityType.DEPOSIT,
      metadata: { amount: "500", method: "credit card" },
      description: "RM500 added via credit card",
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      activity_type: ActivityType.WITHDRAWAL,
      metadata: { amount: "300" },
      description: "Withdrawal request of RM300 has been submitted.",
      created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
    {
      activity_type: ActivityType.LOGIN,
      metadata: { device: "New device" },
      description: "Logged in from a new device.",
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      activity_type: ActivityType.PROFILE_UPDATED,
      metadata: { fields: ["email", "phone"] },
      description: "Profile information updated",
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      activity_type: ActivityType.SECURITY_ALERT,
      metadata: { type: "New device" },
      description: "Logged in from a new device",
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      activity_type: ActivityType.TRANSACTION_COMPLETED,
      metadata: { status: "success" },
      description: "Transaction completed successfully.",
      created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    },
    {
      activity_type: ActivityType.SETTINGS_CHANGED,
      metadata: { action: "password_change" },
      description: "Password changed successfully.",
      created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      activity_type: ActivityType.WITHDRAWAL,
      metadata: { amount: "300", status: "processed" },
      description: "Withdrawal of RM300 has been successfully processed.",
      created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    },
    {
      activity_type: ActivityType.SECURITY_ALERT,
      metadata: { action: "password_change" },
      description: "Password changed successfully.",
      created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      activity_type: ActivityType.DEPOSIT,
      metadata: { amount: "250", method: "credit card" },
      description: "RM250 added to your wallet using credit card.",
      created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    },
  ];

  for (const act of activities) {
    await prisma.activity.create({
      data: {
        user_id: adminUser.user_id,
        activity_type: act.activity_type,
        title: activityService.buildActivityTitle(act.activity_type, act.metadata),
        description: act.description,
        metadata: act.metadata,
        created_at: act.created_at,
        ip_address: "192.168.1.100",
        user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        device_info: "Desktop",
      },
    });
  }

  logger.info(`✅ Created ${activities.length} activity entries for ${adminUser.email}`);

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

