\# MISSION: Autonomous End-to-End E-Commerce Automation \& Payment Verification System



You are tasked with engineering a production-grade, fault-tolerant e-commerce automation ecosystem that integrates Wuilt API, an automated WhatsApp Bot, an Android SMS ingestion background worker (APK), an operational desktop control center (.exe), and dual-layer payment verification logic.



\## 1. SYSTEM ARCHITECTURE \& COMPONENTS



\### Component A: Core Backend Service (Node.js / TypeScript)

\- Webhook Ingestion Engine: Listens for Wuilt events and inbound WhatsApp messages.

\- Vision Analysis Pipeline: Leverages OpenAI/Claude Vision API to parse payment receipts into strict JSON schemas.

\- Transaction Reconciliation Engine: Matches incoming SMS records with receipt images.

\- Document \& Shipping Dispatcher: Uses Puppeteer to generate shipping waybills (screenshots + PDFs) and forwards them to WhatsApp targets.

\- Database: SQLite / PostgreSQL managed via Prisma ORM.



\### Component B: Android SMS Listener (Flutter / Native Android APK)

\- Background service using `BroadcastReceiver` listening to `SMS\_RECEIVED`.

\- Regex and Sender Whitelisting: ONLY accepts messages from official banking/wallet channels (e.g., Vodafone Cash, InstaPay, Orange Cash, CIB). Ignores all personal contacts.

\- Safely extracts: Amount, Reference/Transaction ID, Timestamp, Sender Name.

\- Forwards parsed payload immediately via HTTPS POST to `/api/v1/sms/incoming` with API-key authentication.



\### Component C: Desktop Dashboard (.exe via Tauri / Electron)

\- Real-time display of incoming orders, verified payments, pending/partial deposits, and system logs.

\- Manual verification fallback toggle if automated matching detects a discrepancy.

\- Configurable environment keys, phone connection status, and direct order inspection.



\---



\## 2. DATABASE SCHEMA (Prisma Specification)



Implement models for:

1\. `Order`:

&#x20;  - `id`, `wuiltOrderId`, `customerName`, `customerPhone`, `orderTotal`, `depositPaid`, `remainingTotal`, `status` (PENDING\_PAYMENT, PARTIAL\_DEPOSIT, CONFIRMED, CANCELLED), `waybillUrl`, `createdAt`, `updatedAt`.

2\. `IncomingSms`:

&#x20;  - `id`, `sender`, `rawMessage`, `amount`, `referenceId`, `receivedAt`, `isConsumed` (Boolean, default: false), `consumedByOrderId` (nullable).

3\. `ReceiptScan`:

&#x20;  - `id`, `orderId`, `imageUrl`, `detectedAmount`, `detectedRefId`, `confidenceScore`, `status` (MATCHED, FAILED\_VERIFICATION, LOW\_DEPOSIT).

4\. `AbandonedCart`:

&#x20;  - `id`, `cartId`, `customerPhone`, `cartItems`, `abandonedAt`, `reminderSent` (Boolean).



\---



\## 3. STRICT BUSINESS LOGIC \& MATCHING PIPELINE



\### A. Order Ingestion \& Payment Instruction

1\. On Wuilt `order.created` webhook:

&#x20;  - Save order details to database.

&#x20;  - Send formatted WhatsApp message to `customerPhone` detailing total amount, bank/wallet accounts, and instructions to reply with a screenshot of the payment receipt.



\### B. Dual-Verification Matching (Receipt Image vs. Bank SMS)

1\. On incoming WhatsApp media message (Receipt image):

&#x20;  - Send image to Vision model with strict JSON schema:

&#x20;    ```json

&#x20;    {

&#x20;      "amount": number,

&#x20;      "reference\_id": string,

&#x20;      "transaction\_date": string,

&#x20;      "wallet\_provider": string

&#x20;    }

&#x20;    ```

2\. Search database `IncomingSms` where:

&#x20;  - `isConsumed == false`

&#x20;  - `referenceId == detectedRefId` OR (`amount == detectedAmount` AND `receivedAt` is within a 30-minute window of the order timestamp).

&#x20;  - Sender matches an official whitelisted provider.

3\. If no match is found:

&#x20;  - Do NOT confirm the order.

&#x20;  - Flag as `FAILED\_VERIFICATION` and request manual review on the Dashboard.



\### C. Financial Validation \& Deposit Threshold Rule

1\. If the verified amount is \*\*less than 190 EGP\*\*:

&#x20;  - Update order status to `PARTIAL\_DEPOSIT`.

&#x20;  - Log the received amount into `depositPaid`.

&#x20;  - Send WhatsApp notification to customer:

&#x20;    \*"تم استلام مبلغ {amount} ج. يُرجى العلم أن الأوردر لا يتم تأكيده إلا بسداد العربون كاملاً (200 ج). المتبقي لتأكيد شحن طلبك: {200 - amount} ج."\*

&#x20;  - \*\*HALT PIPELINE:\*\* Do NOT generate a shipping waybill, do NOT mark the order as confirmed on Wuilt, and do NOT notify the branch group.

2\. If the verified amount is \*\*>= 190 EGP\*\*:

&#x20;  - Mark matching `IncomingSms` as `isConsumed = true` and bind it to `orderId`.

&#x20;  - Deduct the paid deposit from the Wuilt order total or mark it partially paid / confirmed via Wuilt API.

&#x20;  - Generate shipping waybill via carrier API / Wuilt.

&#x20;  - Render waybill using Puppeteer into a PNG screenshot and a PDF document.

&#x20;  - Send WhatsApp confirmation to the customer with order summary and waybill screenshot.

&#x20;  - Send waybill PDF, customer info, and requested items list to the WhatsApp Branch/Store Group.



\### D. Abandoned Cart Recovery

1\. On Wuilt `cart.abandoned` webhook:

&#x20;  - Queue a job using BullMQ / Agenda to run after 2 hours.

&#x20;  - If cart remains unconverted, dispatch a customized WhatsApp recovery message offering assistance or quick completion.



\---



\## 4. IMPLEMENTATION REQUIREMENTS FOR AGENT



1\. \*\*Modular Code Structure:\*\*

&#x20;  - `/src/controllers` (Webhooks for Wuilt, WhatsApp, SMS)

&#x20;  - `/src/services` (WuiltService, WhatsAppService, VisionService, MatchingEngine, WaybillGenerator)

&#x20;  - `/src/models` (Prisma schema \& migrations)

&#x20;  - `/mobile\_app` (Flutter / Android native project ready for compilation)

&#x20;  - `/desktop\_dashboard` (Frontend + Electron/Tauri build scripts)

2\. \*\*Resilience \& Security:\*\*

&#x20;  - Never mark an SMS as consumed twice.

&#x20;  - Implement idempotent webhook handlers.

&#x20;  - Add `.env.example` containing placeholders for `WUILT\_API\_KEY`, `WUILT\_WEBHOOK\_SECRET`, `WHATSAPP\_ACCESS\_TOKEN`, `WHATSAPP\_PHONE\_NUMBER\_ID`, `BRANCH\_GROUP\_ID`, `OPENAI\_API\_KEY`, `INTERNAL\_SMS\_SYNC\_KEY`.

3\. \*\*Execution Delivery:\*\*

&#x20;  - Write fully functional, clean, documented code without leaving `// TODO` or placeholder stubs.

&#x20;  - Provide automated build and run scripts (`npm run build:all`, `flutter build apk`, `npm run build:exe`).

