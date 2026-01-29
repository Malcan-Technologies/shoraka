import { PrismaClient } from '@prisma/client';
import { initialNotificationTypes } from '../src/modules/notification/seed-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding notification types...');

  for (const type of initialNotificationTypes) {
    const existing = await prisma.notificationType.findUnique({
      where: { id: type.id },
    });

    if (!existing) {
      await prisma.notificationType.create({
        data: type,
      });
      console.log(`Created notification type: ${type.id}`);
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
