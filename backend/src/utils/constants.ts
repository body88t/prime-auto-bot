export const WHITELISTED_SMS_SENDERS = [
  // Mobile Wallets
  'VF-CASH',
  'VF-Cash',
  'VodafoneCash',
  'Vodafone',
  'VODAFONE',
  'INSTAPAY',
  'InstaPay',
  'IPN',
  'OrangeCash',
  'Orange Cash',
  'Orange',
  'EtisalatCash',
  'Etisalat Cash',
  'Etisalat',
  'e& money',
  'WEPay',
  'WE Pay',

  // Egyptian Banks
  'CIB',
  'CIBEgypt',
  'BM',
  'Banque Misr',
  'BANQUE MISR',
  'NBE',
  'ALAHLY',
  'QNB',
  'QNB ALAHLI',
  'AAIB',
  'AlexBank',
  'FaisalBank',
  'BDC',
  'eg-bank',
];

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PARTIAL_DEPOSIT: 'PARTIAL_DEPOSIT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  FAILED_VERIFICATION: 'FAILED_VERIFICATION',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
} as const;

export const RECEIPT_STATUS = {
  MATCHED: 'MATCHED',
  FAILED_VERIFICATION: 'FAILED_VERIFICATION',
  LOW_DEPOSIT: 'LOW_DEPOSIT',
  PENDING: 'PENDING',
} as const;

export const STORE_CONFIG = {
  STORE_NAME: 'PRIME AUTO',
  CUSTOMER_SERVICE_PHONE: '01019930974',
  WALLET_PHONE: '01019930974',
  BRANCH_GROUP_NAME: 'المحل 🏃‍♂️',
  DEPOSIT_AMOUNT: 200,
  CONFIRMATION_THRESHOLD: 190,
};

export const MESSAGES = {
  /**
   * قالب رسالة إنشاء الطلب الجديد
   */
  ORDER_CREATED_INSTRUCTION: (
    customerName: string,
    orderItemsFormatted: string,
    orderDateTime: string
  ) =>
    `أهلاً ${customerName}! 👋\n\n` +
    `تم حجز طلبك:\n` +
    `${orderItemsFormatted} 📦\n\n` +
    `🚚 يتم الشحن خلال 3 إلى 7 أيام عمل عبر شركة أرامكس.\n\n` +
    `💳 لتأكيد الطلب وبدء التجهيز، يتم دفع عربون 200ج يتم خصمه من إجمالي الفاتورة، والباقي عند الاستلام.\n\n` +
    `طرق الدفع: Instapay – فودافون كاش – فوري – المحافظ الإلكترونية\n` +
    `📱 01019930974\n\n` +
    `🔁 الاستبدال والاسترجاع متاح خلال 10 أيام من استلام الطلب بشرط أن يكون المنتج في حالته الأصلية وغير مستخدم أو مركب.\n` +
    `⚠️ في حالة تركيب المنتج أو استخدامه، يُعتبر خارج سياسة الاستبدال والاسترجاع.\n\n` +
    `📌 بعد تأكيد الطلب يتم البدء في التجهيز والشحن مباشرة، لذلك لا يمكن تعديل البيانات بعد التأكيد.\n` +
    `📞 خدمة العملاء: 01019930974\n\n` +
    `رد بـ *1* للتأكيد ✅  |  رد بـ *2* للإلغاء ❌\n\n` +
    `📅 تاريخ الطلب: ${orderDateTime}\n` +
    `_تنتهي صلاحية الرابط خلال 72 ساعة .\n` +
    `💙 سعداء بخدمتك`,

  /**
   * قالب رسالة التحويل الناقص (< 190 EGP)
   */
  PARTIAL_DEPOSIT_ALERT: (
    customerName: string,
    receivedAmount: number,
    remainingDeposit: number
  ) =>
    `أهلاً ${customerName}! 👋\n\n` +
    `تم استلام تحويل بقيمة: ${receivedAmount} ج 📥\n\n` +
    `⚠️ نود إبلاغك بأن حجز الأوردر وبدء التجهيز يتطلب سداد العربون كاملاً بقيمة 200 ج.\n` +
    `💳 المتبقي لتأكيد الشحن: ${remainingDeposit} ج\n\n` +
    `طرق الدفع: Instapay – فودافون كاش – فوري – المحافظ الإلكترونية\n` +
    `📱 01019930974\n\n` +
    `برجاء تحويل باقي المبلغ وإرسال لقطة الشاشة هنا لتأكيد طلبك فوراً 📦\n` +
    `💙 سعداء بخدمتك`,

  /**
   * قالب رسالة تأكيد الأوردر والبوليصة (>= 190 EGP)
   */
  ORDER_CONFIRMED: () =>
    `تم تاكيد طلبك ، سيتم ارسال صوره البوليصه و المنتج قبل وبعد التغليف في اسرع وقت ممكن ✅💙`,

  /**
   * قالب رسالة السلة المتروكة (Abandoned Cart)
   */
  ABANDONED_CART_RECOVERY: (
    customerName: string,
    cartItemsFormatted: string,
    cartRecoveryUrl: string
  ) =>
    `أهلاً ${customerName}! 👋\n\n` +
    `لاحظنا إنك مكملتش طلبك الأخير:\n` +
    `${cartItemsFormatted} 🛒\n\n` +
    `المنتجات لسه محجوزة لك، وتقدر تكمل طلبك في ثواني من الرابط التالي:\n` +
    `🔗 ${cartRecoveryUrl}\n\n` +
    `🚚 الشحن متاح لجميع المحافظات خلال 3 إلى 7 أيام عمل.\n` +
    `لو واجهتك أي مشكلة أثناء الدفع أو محتاج استفسار، رد علينا هنا مباشرة وهنساعدك فوراً 💬\n` +
    `💙 PRIME AUTO في خدمتك`,

  /**
   * رسالة تأكيد إلغاء الطلب عند الرد بـ 2
   */
  ORDER_CANCELLED_CONFIRMATION: (wuiltOrderId: string) =>
    `تم اللغاء طلبك رقم (#${wuiltOrderId}) بنجاح، لاعاده تفعيل الاوردر أو زيارتنا بالفرع يرجي التواصل معنا ، شكرا لطلبكم من PRIME AUTO 💙 .`,

  /**
   * رسالة استجابة لتأكيد الرغبة بالطلب عند الرد بـ 1
   */
  ORDER_CONFIRM_INTENT_REPLY: () =>
    `✅ بانتظار التحويل لبدايه تاكيد الاوردر الخاص بك , شكرا لاختياركم PRIME AUTO .`,

  /**
   * رسالة طمأنة عند استلام إيصال بمبلغ >= 190 ولكن لا يوجد SMS مطابق بعد
   */
  RECEIPT_UNDER_REVIEW: () =>
    `تم استلام إيصال التحويل، وجاري مراجعة وتأكيد العملية بنكياً لإصدار بوليصة الشحن فوراً ⏳`,
};
