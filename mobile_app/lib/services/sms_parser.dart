import '../utils/whitelist.dart';

class ParsedSms {
  final bool isWhitelisted;
  final String sender;
  final double? amount;
  final String? referenceId;
  final DateTime timestamp;
  final String rawMessage;

  ParsedSms({
    required this.isWhitelisted,
    required this.sender,
    this.amount,
    this.referenceId,
    required this.timestamp,
    required this.rawMessage,
  });
}

class SmsParser {
  static String normalizeNumerals(String text) {
    const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    String result = text;
    for (int i = 0; i < eastern.length; i++) {
      result = result.replaceAll(eastern[i], i.toString());
    }
    return result;
  }

  static double? extractAmount(String text) {
    final normalized = normalizeNumerals(text);

    // Arabic pattern: مبلغ 200.00 جنيه or استلام 200
    final arabicReg = RegExp(
      r'(?:مبلغ|استلام|تحويل|إيداع|تم إضافة|بقيمة|تم تحويل)\s*(?:مبلغ\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:جنيه|جم|ج\.م|ج|EGP|LE)?',
      caseSensitive: false,
    );
    final match1 = arabicReg.firstMatch(normalized);
    if (match1 != null && match1.group(1) != null) {
      final val = double.tryParse(match1.group(1)!);
      if (val != null && val > 0) return val;
    }

    // English pattern: EGP 200.00 or 200.00 EGP
    final englishReg = RegExp(
      r'(?:EGP|LE)\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:EGP|LE)',
      caseSensitive: false,
    );
    final match2 = englishReg.firstMatch(normalized);
    if (match2 != null) {
      final str = match2.group(1) ?? match2.group(2);
      if (str != null) {
        final val = double.tryParse(str);
        if (val != null && val > 0) return val;
      }
    }

    return null;
  }

  static String? extractReferenceId(String text) {
    final normalized = normalizeNumerals(text);

    final patterns = [
      RegExp(r'(?:رقم العملية|رقم المعاملة|مرجع المعاملة|رقم المرجع|كود العملية|المرجع|كود التحويل)\s*[:#\-]?\s*([A-Za-z0-9\-_]{6,30})', caseSensitive: false),
      RegExp(r'(?:Transaction\s*(?:ID|No|Num|#)?|Txn\s*(?:ID|No|#)?|Ref\s*(?:ID|No|Num|#)?|Reference\s*(?:ID|No|Num|#)?)\s*[:#\-]?\s*([A-Za-z0-9\-_]{6,30})', caseSensitive: false),
      RegExp(r'رقم العملية\s*[:\s]+([0-9]+)', caseSensitive: false),
      RegExp(r'(?:مرجع|Ref)\s*[:\s]+([A-Za-z0-9]+)', caseSensitive: false),
    ];

    for (final pattern in patterns) {
      final match = pattern.firstMatch(normalized);
      if (match != null && match.group(1) != null) {
        final ref = match.group(1)!.trim();
        if (ref.length >= 6) return ref;
      }
    }

    return null;
  }

  static ParsedSms parse(String sender, String rawMessage, {DateTime? receivedAt}) {
    final isWhitelisted = SmsWhitelist.isAuthorized(sender);
    final amount = extractAmount(rawMessage);
    final ref = extractReferenceId(rawMessage);
    final timestamp = receivedAt ?? DateTime.now();

    return ParsedSms(
      isWhitelisted: isWhitelisted,
      sender: sender,
      amount: amount,
      referenceId: ref,
      timestamp: timestamp,
      rawMessage: rawMessage,
    );
  }
}
