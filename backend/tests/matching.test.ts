import { isSenderWhitelisted } from '../src/utils/sms-parser.util';

describe('Dual-Verification Matching Engine Logic (SPEC Section 3.B)', () => {
  interface MockSms {
    id: string;
    sender: string;
    amount: number;
    referenceId: string;
    receivedAt: Date;
    isConsumed: boolean;
  }

  interface MockVisionScan {
    amount: number;
    reference_id: string;
    transaction_date: string;
    wallet_provider: string;
  }

  function findMatchingSms(
    orderCreatedAt: Date,
    scan: MockVisionScan,
    smsPool: MockSms[],
    windowMinutes = 30
  ): MockSms | null {
    const windowStart = new Date(orderCreatedAt.getTime() - windowMinutes * 60 * 1000);
    const windowEnd = new Date(orderCreatedAt.getTime() + windowMinutes * 60 * 1000);

    for (const sms of smsPool) {
      if (sms.isConsumed) continue;
      if (!isSenderWhitelisted(sms.sender)) continue;

      const hasRefMatch =
        sms.referenceId &&
        scan.reference_id &&
        sms.referenceId.trim().toLowerCase() === scan.reference_id.trim().toLowerCase();

      const hasAmountWindowMatch =
        Math.abs(sms.amount - scan.amount) < 0.01 &&
        sms.receivedAt >= windowStart &&
        sms.receivedAt <= windowEnd;

      if (hasRefMatch || hasAmountWindowMatch) {
        return sms;
      }
    }

    return null;
  }

  const now = new Date();

  it('should match unconsumed SMS with identical reference ID', () => {
    const scan: MockVisionScan = {
      amount: 200,
      reference_id: 'TXN889977',
      transaction_date: now.toISOString(),
      wallet_provider: 'Vodafone Cash',
    };

    const smsPool: MockSms[] = [
      {
        id: 'sms-1',
        sender: 'VF-Cash',
        amount: 200,
        referenceId: 'TXN889977',
        receivedAt: now,
        isConsumed: false,
      },
    ];

    const match = findMatchingSms(now, scan, smsPool);
    expect(match).not.toBeNull();
    expect(match?.id).toBe('sms-1');
  });

  it('should match unconsumed SMS with matching amount within 30 minutes if reference is missing', () => {
    const scan: MockVisionScan = {
      amount: 200,
      reference_id: 'UNKNOWN_REF',
      transaction_date: now.toISOString(),
      wallet_provider: 'InstaPay',
    };

    const smsReceived10MinsAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const smsPool: MockSms[] = [
      {
        id: 'sms-2',
        sender: 'InstaPay',
        amount: 200,
        referenceId: 'DIFFERENT_REF_3920',
        receivedAt: smsReceived10MinsAgo,
        isConsumed: false,
      },
    ];

    const match = findMatchingSms(now, scan, smsPool);
    expect(match).not.toBeNull();
    expect(match?.id).toBe('sms-2');
  });

  it('should REJECT SMS received outside the 30-minute window when reference does not match', () => {
    const scan: MockVisionScan = {
      amount: 200,
      reference_id: 'VISION_REF_ABC',
      transaction_date: now.toISOString(),
      wallet_provider: 'VF-Cash',
    };

    const smsReceived45MinsAgo = new Date(now.getTime() - 45 * 60 * 1000);

    const smsPool: MockSms[] = [
      {
        id: 'sms-expired',
        sender: 'VF-Cash',
        amount: 200,
        referenceId: 'SMS_REF_XYZ',
        receivedAt: smsReceived45MinsAgo,
        isConsumed: false,
      },
    ];

    const match = findMatchingSms(now, scan, smsPool);
    expect(match).toBeNull();
  });

  it('should NEVER match an already consumed SMS (prevents double-spending)', () => {
    const scan: MockVisionScan = {
      amount: 200,
      reference_id: 'TXN_REUSED',
      transaction_date: now.toISOString(),
      wallet_provider: 'VF-Cash',
    };

    const smsPool: MockSms[] = [
      {
        id: 'sms-already-used',
        sender: 'VF-Cash',
        amount: 200,
        referenceId: 'TXN_REUSED',
        receivedAt: now,
        isConsumed: true, // Already consumed by another order
      },
    ];

    const match = findMatchingSms(now, scan, smsPool);
    expect(match).toBeNull();
  });
});
