import { NotificationService } from '../src/modules/notification/service';
import { prisma } from '../src/lib/prisma';
import { NotificationPriority } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const userId = args[0];
  const typeId = args[1] || 'system_announcement';
  
  if (!userId) {
    console.error('Usage: npx tsx scripts/send-test-notification.ts <userId> [typeId]');
    console.log('\nAvailable users:');
    const users = await prisma.user.findMany({ take: 5, select: { user_id: true, email: true, first_name: true } });
    users.forEach(u => console.log(`- ${u.user_id} (${u.email}) - ${u.first_name}`));
    
    console.log('\nAvailable types:');
    const types = await prisma.notificationType.findMany({ select: { id: true, name: true } });
    types.forEach(t => console.log(`- ${t.id} (${t.name})`));
    return;
  }

  const notificationService = new NotificationService();

  console.log(`Sending test notification to user ${userId} of type ${typeId}...`);

  try {
    const notification = await notificationService.create({
      userId,
      typeId,
      title: 'Test Notification',
      message: `This is a test notification sent at ${new Date().toLocaleString()}.`,
      priority: NotificationPriority.INFO,
      linkPath: '/',
      metadata: { test: true },
    });

    console.log('✅ Notification created successfully:');
    console.log(JSON.stringify(notification, null, 2));
  } catch (error) {
    console.error('❌ Failed to create notification:', error instanceof Error ? error.message : error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
