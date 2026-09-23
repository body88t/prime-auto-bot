import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('--- Cleaning Prime Auto Bot Database ---');

  // 1. Delete dependent records first
  const deletedReceipts = await prisma.receiptScan.deleteMany({});
  console.log(`Deleted ${deletedReceipts.count} receipt scans.`);

  // 2. Delete incoming SMS
  const deletedSms = await prisma.incomingSms.deleteMany({});
  console.log(`Deleted ${deletedSms.count} incoming SMS messages.`);

  // 3. Delete Orders
  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`Deleted ${deletedOrders.count} orders.`);

  // 4. Delete Abandoned Carts
  const deletedCarts = await prisma.abandonedCart.deleteMany({});
  console.log(`Deleted ${deletedCarts.count} abandoned carts.`);

  // 5. Delete Webhook Events
  const deletedEvents = await prisma.webhookEvent.deleteMany({});
  console.log(`Deleted ${deletedEvents.count} webhook events.`);

  // 6. Delete System Logs
  const deletedLogs = await prisma.systemLog.deleteMany({});
  console.log(`Deleted ${deletedLogs.count} system logs.`);

  console.log('--- Database is now 100% clean and reset! ---');
}

cleanDatabase()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
