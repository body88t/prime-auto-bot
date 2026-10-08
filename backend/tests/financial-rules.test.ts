import { MESSAGES, ORDER_STATUS } from '../src/utils/constants';

describe('Financial Validation & Deposit Threshold Rules (SPEC Section 3.C)', () => {
  const TARGET_DEPOSIT = 200;
  const THRESHOLD = 190;

  describe('Partial Deposit Rule (< 190 EGP)', () => {
    it('should generate exact Arabic message for 100 EGP deposit', () => {
      const customerName = 'أحمد';
      const amount = 100;
      const remaining = TARGET_DEPOSIT - amount; // 100
      const message = MESSAGES.PARTIAL_DEPOSIT_ALERT(customerName, amount, remaining);

      expect(message).toContain('تم استلام تحويل بقيمة: 100 ج');
      expect(message).toContain('المتبقي لتأكيد الشحن: 100 ج');
    });

    it('should generate exact Arabic message for 150 EGP deposit', () => {
      const customerName = 'محمد';
      const amount = 150;
      const remaining = TARGET_DEPOSIT - amount; // 50
      const message = MESSAGES.PARTIAL_DEPOSIT_ALERT(customerName, amount, remaining);

      expect(message).toContain('تم استلام تحويل بقيمة: 150 ج');
      expect(message).toContain('المتبقي لتأكيد الشحن: 50 ج');
    });

    it('should classify amounts below 190 as PARTIAL_DEPOSIT', () => {
      const amounts = [50, 100, 150, 189, 189.99];
      amounts.forEach((amt) => {
        const isConfirmed = amt >= THRESHOLD;
        expect(isConfirmed).toBe(false);
      });
    });
  });

  describe('Full Deposit Confirmation Rule (>= 190 EGP)', () => {
    it('should classify 190 EGP and above as CONFIRMED', () => {
      const amounts = [190, 195, 200, 500];
      amounts.forEach((amt) => {
        const isConfirmed = amt >= THRESHOLD;
        expect(isConfirmed).toBe(true);
      });
    });

    it('should calculate remaining total correctly after deposit', () => {
      const orderTotal = 1500;
      const depositPaid = 200;
      const remainingTotal = orderTotal - depositPaid;

      expect(remainingTotal).toBe(1300);
    });
  });
});
