import { WHITELISTED_SMS_SENDERS } from './constants';

export interface ParsedSmsResult {
  isValidSender: boolean;
  sender: string;
  amount: number | null;
  referenceId: string | null;
  timestamp: Date;
  rawMessage: string;
  confidence: number;
}

/**
 * Normalizes Eastern Arabic digits (٠-٩) into standard ASCII digits (0-9).
 */
export function normalizeDigits(input: string): string {
  const easternArabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return input.replace(/[٠-٩]/g, (w) => {
    return easternArabicDigits.indexOf(w).toString();
  });
}

/**
 * Checks if a sender name is in the whitelisted list of banks / telecom wallets.
 */
export function isSenderWhitelisted(sender: string): boolean {
  if (!sender) return false;
  const cleanSender = sender.trim().toLowerCase();
  return WHITELISTED_SMS_SENDERS.some((w) => {
    const cleanW = w.trim().toLowerCase();
    return cleanSender === cleanW || cleanSender.includes(cleanW) || cleanW.includes(cleanSender);
  });
}

/**
 * Extracts amount (in EGP) from SMS text.
 */
export function extractAmount(text: string): number | null {
  const normalized = normalizeDigits(text);

  // Pattern 1: Arabic "مبلغ [0-9.]+ (جنيه|جم|ج.م|ج)" or "تم استلام [0-9.]+"
  const arabicPattern1 = /(?:مبلغ|استلام|تحويل|إيداع|تم إضافة|بقيمة|تم تحويل)\s*(?:مبلغ\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:جنيه|جم|ج\.م|ج|EGP|LE)?/i;
  const match1 = normalized.match(arabicPattern1);
  if (match1 && match1[1]) {
    const val = parseFloat(match1[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 2: English "EGP 200.00" or "200.00 EGP" or "credited with EGP 200.00"
  const englishPattern = /(?:EGP|LE)\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:EGP|LE)/i;
  const match2 = normalized.match(englishPattern);
  if (match2) {
    const valStr = match2[1] || match2[2];
    if (valStr) {
      const val = parseFloat(valStr);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Pattern 3: General "received [0-9.]+" or "transfer [0-9.]+"
  const generalPattern = /(?:received|credited|transfer(?:red)?|amount(?: of)?)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i;
  const match3 = normalized.match(generalPattern);
  if (match3 && match3[1]) {
    const val = parseFloat(match3[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Extracts reference or transaction ID from SMS text.
 */
export function extractReferenceId(text: string): string | null {
  const normalized = normalizeDigits(text);

  // Patterns for Reference ID / Transaction ID
  const refPatterns = [
    // Arabic patterns
    /(?:رقم العملية|رقم المعاملة|مرجع المعاملة|رقم المرجع|كود العملية|المرجع|العملية رقم|كود التحويل)\s*[:#\-]?\s*([A-Za-z0-9\-_]{6,30})/i,
    // English patterns
    /(?:Transaction\s*(?:ID|No|Num|#)?|Txn\s*(?:ID|No|#)?|Ref\s*(?:ID|No|Num|#)?|Reference\s*(?:ID|No|Num|#)?|Ref)\s*[:#\-]?\s*([A-Za-z0-9\-_]{6,30})/i,
    // Vodafone Cash format e.g. "رقم العملية: 123456789"
    /رقم العملية\s*[:\s]+([0-9]+)/i,
    // InstaPay Ref pattern e.g. "مرجع: 123456789" or "Ref: 123456789"
    /(?:مرجع|Ref)\s*[:\s]+([A-Za-z0-9]+)/i,
  ];

  for (const pattern of refPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const ref = match[1].trim();
      // Avoid false positive matching phone numbers like 010... or generic words
      if (ref.length >= 6) {
        return ref;
      }
    }
  }

  return null;
}

/**
 * Full parser function for incoming bank SMS.
 */
export function parseIncomingBankSms(sender: string, rawMessage: string, receivedAt?: Date): ParsedSmsResult {
  const isValidSender = isSenderWhitelisted(sender);
  const amount = extractAmount(rawMessage);
  const referenceId = extractReferenceId(rawMessage);
  const timestamp = receivedAt || new Date();

  let confidence = 0;
  if (isValidSender) confidence += 0.4;
  if (amount !== null && amount > 0) confidence += 0.3;
  if (referenceId !== null) confidence += 0.3;

  return {
    isValidSender,
    sender,
    amount,
    referenceId,
    timestamp,
    rawMessage,
    confidence: Math.round(confidence * 100) / 100,
  };
}
