import { PrismaClient, NotificationCategory, NotificationPriority } from '@prisma/client';

const prisma = new PrismaClient();

const initialTypes = [
  // Authentication (always enabled, not user configurable)
  {
    id: "password_changed",
    name: "Password Changed",
    description: "Sent when your account password has been successfully changed.",
    category: NotificationCategory.AUTHENTICATION,
    default_priority: NotificationPriority.CRITICAL,
    user_configurable: false,
    enabled_platform: true,
    enabled_email: true,
  },
  {
    id: "login_new_device",
    name: "Login from New Device",
    description: "Sent when a login is detected from a device or location we don't recognize.",
    category: NotificationCategory.AUTHENTICATION,
    default_priority: NotificationPriority.WARNING,
    user_configurable: true,
    enabled_platform: true,
    enabled_email: true,
  },

  // System / Onboarding
  {
    id: "kyc_approved",
    name: "KYC Approved",
    description: "Sent when your identity verification has been approved.",
    category: NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.INFO,
    user_configurable: false,
    enabled_platform: true,
    enabled_email: true,
  },
  {
    id: "kyc_rejected",
    name: "KYC Rejected",
    description: "Sent when your identity verification has been rejected.",
    category: NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.WARNING,
    user_configurable: false,
    enabled_platform: true,
    enabled_email: true,
  },
  {
    id: "onboarding_approved",
    name: "Onboarding Approved",
    description: "Sent when your onboarding application has been approved.",
    category: NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.INFO,
    user_configurable: false,
    enabled_platform: true,
    enabled_email: true,
  },
  {
    id: "onboarding_rejected",
    name: "Onboarding Rejected",
    description: "Sent when your onboarding application has been rejected.",
    category: NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.WARNING,
    user_configurable: false,
    enabled_platform: true,
    enabled_email: true,
  },

  // Announcement
  {
    id: "system_announcement",
    name: "System Announcement",
    description: "General announcements about platform updates and maintenance.",
    category: NotificationCategory.ANNOUNCEMENT,
    default_priority: NotificationPriority.INFO,
    user_configurable: true,
    enabled_platform: true,
    enabled_email: true,
  },

  // Marketing
  {
    id: "new_product_alert",
    name: "New Product Alert",
    description: "Be the first to know about new investment opportunities and products.",
    category: NotificationCategory.MARKETING,
    default_priority: NotificationPriority.INFO,
    user_configurable: true,
    enabled_platform: true,
    enabled_email: true,
  },
];

async function main() {
  console.log('Seeding notification types...');

  for (const type of initialTypes) {
    await prisma.notificationType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  console.log('Notification types seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
