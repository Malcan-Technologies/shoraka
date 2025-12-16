import { PrismaClient, UserRole, AdminRole } from "@prisma/client";
import { logger } from "../src/lib/logger";

const prisma = new PrismaClient();

async function main() {
  logger.info("🌱 Starting database seed...");

  // Admin user - use environment variable for cognito_sub if provided
  const adminCognitoSub = process.env.ADMIN_COGNITO_SUB || `seed_admin_${Date.now()}`;
  const adminCognitoUsername = "lucas.deng@malcan.io";

  // Create or update admin user
  const adminUser = await prisma.user.upsert({
    where: { cognito_sub: adminCognitoSub },
    create: {
      email: "lucas.deng@malcan.io",
      cognito_sub: adminCognitoSub,
      cognito_username: adminCognitoUsername,
      roles: [UserRole.ADMIN],
      first_name: "Lucas",
      last_name: "Deng",
      phone: "+60165584792",
      email_verified: true,
      kyc_verified: true,
      investor_onboarding_completed: false,
      issuer_onboarding_completed: false,
    },
    update: {
      // Ensure ADMIN role is always present
      roles: {
        set: [UserRole.ADMIN],
      },
      email_verified: true,
      kyc_verified: true,
    },
  });

  logger.info(`✅ Admin user created/updated: ${adminUser.email}`);

  // Create or update Admin record with SUPER_ADMIN role
  const adminRecord = await prisma.admin.upsert({
    where: { user_id: adminUser.id },
    create: {
      user_id: adminUser.id,
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
    user_id: adminUser.id,
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
    user_id: adminUser.id,
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
      data: log,
    });
  }

  logger.info(`✅ Created ${accessLogs.length} access log entries`);

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

