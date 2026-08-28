import { PrismaClient } from '@prisma/client';
import { initialNotificationTypes } from '../src/modules/notification/seed-data';

const prisma = new PrismaClient();

const LEGACY_ONBOARDING_APPROVED = 'onboarding_approved';
const ONBOARDING_COMPLETED = 'onboarding_completed';
const CATALOGUE_NAME_REFRESH_IDS = new Set([
  ONBOARDING_COMPLETED,
  'note_payment_received',
  'note_funding_failed_issuer',
  'note_funding_failed_investor',
]);

async function retargetTypeId(fromId: string, toId: string) {
  await prisma.notification.updateMany({
    where: { notification_type_id: fromId },
    data: { notification_type_id: toId },
  });
  await prisma.notificationLog.updateMany({
    where: { notification_type_id: fromId },
    data: { notification_type_id: toId },
  });

  const legacyPrefs = await prisma.userNotificationPreference.findMany({
    where: { notification_type_id: fromId },
  });
  for (const pref of legacyPrefs) {
    const existing = await prisma.userNotificationPreference.findUnique({
      where: {
        user_id_notification_type_id: {
          user_id: pref.user_id,
          notification_type_id: toId,
        },
      },
    });
    if (existing) {
      await prisma.userNotificationPreference.delete({ where: { id: pref.id } });
    } else {
      await prisma.userNotificationPreference.update({
        where: { id: pref.id },
        data: { notification_type_id: toId },
      });
    }
  }
}

async function main() {
  console.log('Seeding notification types...');

  const completed = initialNotificationTypes.find((type) => type.id === ONBOARDING_COMPLETED);
  const legacy = await prisma.notificationType.findUnique({
    where: { id: LEGACY_ONBOARDING_APPROVED },
  });
  if (legacy && completed) {
    await prisma.notificationType.upsert({
      where: { id: ONBOARDING_COMPLETED },
      create: completed,
      update: { name: completed.name, description: completed.description },
    });
    await retargetTypeId(LEGACY_ONBOARDING_APPROVED, ONBOARDING_COMPLETED);
    await prisma.notificationType.delete({ where: { id: LEGACY_ONBOARDING_APPROVED } });
    console.log(`Renamed notification type: ${LEGACY_ONBOARDING_APPROVED} -> ${ONBOARDING_COMPLETED}`);
  }

  for (const type of initialNotificationTypes) {
    const existing = await prisma.notificationType.findUnique({
      where: { id: type.id },
    });

    if (!existing) {
      await prisma.notificationType.create({
        data: type,
      });
      console.log(`Created notification type: ${type.id}`);
    } else if (CATALOGUE_NAME_REFRESH_IDS.has(type.id)) {
      await prisma.notificationType.update({
        where: { id: type.id },
        data: { name: type.name, description: type.description },
      });
      console.log(`Updated catalogue name: ${type.id}`);
    } else {
      console.log(`Skipped existing notification type: ${type.id}`);
    }
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
