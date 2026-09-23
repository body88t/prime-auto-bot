export interface Order {
  id: string;
  wuiltOrderId: string;
  customerName: string;
  customerPhone: string;
  orderTotal: number;
  depositPaid: number;
  remainingTotal: number;
  status: 'PENDING_PAYMENT' | 'PARTIAL_DEPOSIT' | 'CONFIRMED' | 'CANCELLED' | 'FAILED_VERIFICATION';
  shippingAddress?: string;
  itemsJson?: string;
  waybillUrl?: string;
  waybillPdfUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  receiptScans?: ReceiptScan[];
  consumedSms?: IncomingSms[];
}

export interface ReceiptScan {
  id: string;
  orderId?: string;
  imageUrl: string;
  detectedAmount: number;
  detectedRefId?: string;
  detectedDate?: string;
  detectedWallet?: string;
  confidenceScore: number;
  status: 'MATCHED' | 'FAILED_VERIFICATION' | 'LOW_DEPOSIT' | 'PENDING';
  rawVisionResponse?: string;
  matchedSmsId?: string;
  createdAt: string;
}

export interface IncomingSms {
  id: string;
  sender: string;
  rawMessage: string;
  amount: number;
  referenceId?: string;
  receivedAt: string;
  isConsumed: boolean;
  consumedByOrderId?: string;
  consumedByOrder?: {
    id: string;
    wuiltOrderId: string;
    customerName: string;
  };
  createdAt: string;
}

export interface SystemLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  metadata?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalOrders: number;
  confirmedOrders: number;
  partialOrders: number;
  pendingOrders: number;
  failedOrders: number;
  totalSms: number;
  unconsumedSms: number;
  totalDepositsCollected: number;
  totalOrderRevenue: number;
  thresholdEgp: number;
  targetDepositEgp: number;
}
