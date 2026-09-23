class SmsWhitelist {
  static const List<String> authorizedSenders = [
    // Mobile Wallets
    'VF-Cash',
    'VF-CASH',
    'VodafoneCash',
    'Vodafone',
    'VODAFONE',
    'InstaPay',
    'INSTAPAY',
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
    'NBE',
    'ALAHLY',
    'QNB',
    'QNB ALAHLI',
    'AAIB',
    'AlexBank',
  ];

  static bool isAuthorized(String sender) {
    if (sender.isEmpty) return false;
    final cleanSender = sender.trim().toLowerCase();
    return authorizedSenders.any((element) {
      final cleanElement = element.trim().toLowerCase();
      return cleanSender == cleanElement ||
          cleanSender.contains(cleanElement) ||
          cleanElement.contains(cleanSender);
    });
  }
}
