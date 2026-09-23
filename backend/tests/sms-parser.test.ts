import {
  isSenderWhitelisted,
  extractAmount,
  extractReferenceId,
  normalizeDigits,
  parseIncomingBankSms,
} from '../src/utils/sms-parser.util';

describe('Egyptian Banking SMS Parser Tests', () => {
  describe('Whitelisting Rules', () => {
    it('should accept official Egyptian mobile wallets and banks', () => {
      expect(isSenderWhitelisted('VF-Cash')).toBe(true);
      expect(isSenderWhitelisted('VodafoneCash')).toBe(true);
      expect(isSenderWhitelisted('InstaPay')).toBe(true);
      expect(isSenderWhitelisted('IPN')).toBe(true);
      expect(isSenderWhitelisted('OrangeCash')).toBe(true);
      expect(isSenderWhitelisted('EtisalatCash')).toBe(true);
      expect(isSenderWhitelisted('CIB')).toBe(true);
      expect(isSenderWhitelisted('Banque Misr')).toBe(true);
      expect(isSenderWhitelisted('NBE')).toBe(true);
    });

    it('should strictly reject personal contacts or spam numbers', () => {
      expect(isSenderWhitelisted('01012345678')).toBe(false);
      expect(isSenderWhitelisted('+201122334455')).toBe(false);
      expect(isSenderWhitelisted('Uber')).toBe(false);
      expect(isSenderWhitelisted('Ahmed Mohamed')).toBe(false);
      expect(isSenderWhitelisted('PromoAlert')).toBe(false);
    });
  });

  describe('Digit Normalization', () => {
    it('should convert Eastern Arabic digits to standard ASCII digits', () => {
      expect(normalizeDigits('مبلغ ٢٠٠ جنيه')).toBe('مبلغ 200 جنيه');
      expect(normalizeDigits('رقم العملية: ٨٢٧٣٦١٥٢٤')).toBe('رقم العملية: 827361524');
    });
  });

  describe('Amount Extraction', () => {
    it('should extract amount from standard Vodafone Cash Arabic SMS', () => {
      const sms = 'تم استلام مبلغ 200.00 جنيه من 01012345678. مصاريف الخدمة 0.00 جنيه. رصيدك الحالي 1500.00 جنيه. رقم العملية: 823491823';
      expect(extractAmount(sms)).toBe(200);
    });

    it('should extract amount with Eastern Arabic numerals', () => {
      const sms = 'تم تحويل مبلغ ٢٠٠ ج.م إلى محفظتك بنجاح';
      expect(extractAmount(sms)).toBe(200);
    });

    it('should extract amount from InstaPay Arabic SMS', () => {
      const sms = 'تم استلام تحويل لحظي بمبلغ 200.00 جم من أحمد محمد عبر إنستاباي. مرجع المعاملة: 394829104';
      expect(extractAmount(sms)).toBe(200);
    });

    it('should extract amount from English bank SMS', () => {
      const sms1 = 'You have received EGP 200.00 from 01012345678. Transaction ID: TXN99887766';
      expect(extractAmount(sms1)).toBe(200);

      const sms2 = 'Your account has been credited with EGP 190.50 on 17/09/2026. Ref: 44556677';
      expect(extractAmount(sms2)).toBe(190.5);
    });
  });

  describe('Reference ID Extraction', () => {
    it('should extract reference ID from Arabic Vodafone Cash SMS', () => {
      const sms = 'تم استلام مبلغ 200 جنيه. رقم العملية: 823491823';
      expect(extractReferenceId(sms)).toBe('823491823');
    });

    it('should extract reference ID from InstaPay message', () => {
      const sms = 'تم استلام تحويل لحظي بمبلغ 200 جم. مرجع المعاملة: IPN99283741';
      expect(extractReferenceId(sms)).toBe('IPN99283741');
    });

    it('should extract transaction ID from English SMS', () => {
      const sms = 'Transfer of EGP 200 received. Transaction ID: TXN12345678';
      expect(extractReferenceId(sms)).toBe('TXN12345678');
    });
  });

  describe('Full SMS Parser', () => {
    it('should parse complete incoming SMS successfully with high confidence', () => {
      const raw = 'تم استلام مبلغ 200.00 جنيه من 01012345678. مصاريف الخدمة 0.00 جنيه. رقم العملية: 823491823';
      const result = parseIncomingBankSms('VF-Cash', raw);

      expect(result.isValidSender).toBe(true);
      expect(result.amount).toBe(200);
      expect(result.referenceId).toBe('823491823');
      expect(result.confidence).toBe(1.0);
    });

    it('should mark unknown sender as invalid', () => {
      const result = parseIncomingBankSms('PersonalFriend', 'حولتلك 200 جنيه يا صاحبي');
      expect(result.isValidSender).toBe(false);
    });
  });
});
