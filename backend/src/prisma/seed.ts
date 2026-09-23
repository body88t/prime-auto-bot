import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data for Prime Auto Bot...');

  // 1. Create a sample pending order
  const sampleOrder1 = await prisma.order.upsert({
    where: { wuiltOrderId: 'EG-9041' },
    update: {},
    create: {
      wuiltOrderId: 'EG-9041',
      customerName: 'محمود حسن',
      customerPhone: '201012345678',
      orderTotal: 1450.0,
      depositPaid: 0.0,
      remainingTotal: 1450.0,
      status: 'PENDING_PAYMENT',
      shippingAddress: 'شارع الهرم - الجيزة',
      itemsJson: JSON.stringify([
        { name: 'حذاء كاجوال جلد طبيعي', quantity: 1, price: 950 },
        { name: 'حزام جلد فاخر', quantity: 1, price: 500 },
      ]),
    },
  });

  // 2. Create an already confirmed order with waybill
  const sampleOrder2 = await prisma.order.upsert({
    where: { wuiltOrderId: 'EG-8820' },
    update: {},
    create: {
      wuiltOrderId: 'EG-8820',
      customerName: 'سارة إبراهيم',
      customerPhone: '201198765432',
      orderTotal: 850.0,
      depositPaid: 200.0,
      remainingTotal: 650.0,
      status: 'CONFIRMED',
      shippingAddress: 'مدينة نصر - القاهرة',
      itemsJson: JSON.stringify([
        { name: 'فستان شيفون مطرز', quantity: 1, price: 850 },
      ]),
      waybillUrl: 'http://localhost:3000/storage/waybills/sample_waybill.png',
      waybillPdfUrl: 'http://localhost:3000/storage/waybills/sample_waybill.pdf',
    },
  });

  // 3. Create a partial deposit order
  const sampleOrder3 = await prisma.order.upsert({
    where: { wuiltOrderId: 'EG-7712' },
    update: {},
    create: {
      wuiltOrderId: 'EG-7712',
      customerName: 'طارق عبد الله',
      customerPhone: '201233445566',
      orderTotal: 1200.0,
      depositPaid: 100.0,
      remainingTotal: 1100.0,
      status: 'PARTIAL_DEPOSIT',
      shippingAddress: 'سيدي بشر - الإسكندرية',
      itemsJson: JSON.stringify([
        { name: 'ساعة يد كلاسيكية', quantity: 1, price: 1200 },
      ]),
    },
  });

  // 4. Create an unconsumed bank SMS in the pool
  await prisma.incomingSms.create({
    data: {
      sender: 'VF-Cash',
      amount: 200.0,
      referenceId: 'TXN88392019',
      rawMessage: 'تم استلام مبلغ 200.00 جنيه من 01012345678. مصاريف الخدمة 0.00 جنيه. رصيدك الحالي هو 2100.00 جنيه. رقم العملية: TXN88392019',
      isConsumed: false,
      receivedAt: new Date(),
    },
  });

  // 5. Create initial audit log
  await prisma.systemLog.create({
    data: {
      level: 'INFO',
      category: 'DATABASE_SEED',
      message: 'Initial development database seeded with demo orders and unconsumed SMS records.',
    },
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
