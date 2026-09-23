---
title: Prime Auto Bot
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# PRIME AUTO BOT
### Autonomous End-to-End E-Commerce Automation & Payment Verification System

An enterprise-grade, fault-tolerant e-commerce automation ecosystem integrating the **Wuilt API**, an automated **WhatsApp Cloud Bot**, an **Android SMS Ingestion Background Worker (APK)**, an **Operational Desktop Control Center (.exe via Electron)**, and a **Dual-Layer Payment Verification Engine**.

Designed specifically for the Egyptian e-commerce market to automate cash deposit verification (Vodafone Cash, InstaPay, Orange Cash, Etisalat Cash, CIB, and Egyptian banking wallets).

---

## 🏗️ Architecture Overview

```
                                  ┌─────────────────────────────────────────┐
                                  │           Wuilt E-Commerce              │
                                  └────────────────────┬────────────────────┘
                                                       │ Webhooks (order.created, cart.abandoned)
                                                       ▼
┌─────────────────────────┐      HTTPS POST      ┌─────────────────────────────────────────┐
│   Android SMS Worker    ├─────────────────────►│          PRIME AUTO BOT BACKEND         │
│ (Vodafone/InstaPay SMS) │   (x-api-key auth)   │ (Node.js, TypeScript, Express, Prisma)  │
└─────────────────────────┘                      └─────┬──────────────┬──────────────┬─────┘
                                                       │              │              │
                    Dual-Verification Matching ◄───────┘              │              │
               (Receipt Image vs Unconsumed Bank SMS)                 ▼              ▼
                                                               ┌─────────────┐ ┌─────────────┐
                                                               │  Vision AI  │ │  Puppeteer  │
                                                               │(OpenAI/Gem) │ │ Waybill Gen │
                                                               └─────────────┘ └─────────────┘
                                                                      │              │
                                                                      ▼              ▼
                                                       ┌─────────────────────────────────────────┐
                                                       │            WhatsApp Cloud Bot           │
                                                       │  • Instructions to Customer             │
                                                       │  • Partial Deposit Warning (<190 EGP)   │
                                                       │  • Confirmed Waybill Image & Details    │
                                                       │  • PDF Waybill to Branch Store Group    │
                                                       └─────────────────────────────────────────┘
                                                                      ▲
                                                                      │ Real-time SSE / REST
                                                       ┌──────────────┴──────────────────────────┐
                                                       │        Desktop Control Center           │
                                                       │   (Electron + React + Tailwind CSS)     │
                                                       │  • Live Orders & Telemetry              │
                                                       │  • Manual Verification Fallback         │
                                                       │  • Real-time SMS Feed & Audit Logs      │
                                                       └─────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
PRIME AUTO BOT/
├── SPEC.md                      # System engineering specifications
├── package.json                 # Top-level workspace orchestration
├── .env.example                 # Master environment variable configuration
├── backend/                     # Component A: Core Backend Service
│   ├── src/
│   │   ├── config/              # Typed environment config
│   │   ├── controllers/         # Webhooks (Wuilt, WhatsApp), SMS, Dashboard APIs
│   │   ├── middlewares/         # API key auth & central error handling
│   │   ├── prisma/              # Prisma client & database seed
│   │   ├── routes/              # Express API router
│   │   ├── services/            # MatchingEngine, Waybill, Vision, WhatsApp, Wuilt, Queue
│   │   ├── utils/               # Arabic & English SMS parser, Whitelist constants
│   │   └── server.ts            # Server entrypoint
│   ├── prisma/schema.prisma     # SQLite / PostgreSQL schema
│   └── tests/                   # Jest test suites (SMS parsing, Financial rules, Matching)
├── mobile_app/                  # Component B: Android SMS Listener (Flutter / Native APK)
│   ├── android/                 # Native Android manifest, BroadcastReceiver, BootReceiver
│   └── lib/                     # Flutter UI, SMS parser sandbox, settings, and sync worker
├── desktop_dashboard/           # Component C: Operational Desktop Control Center
│   ├── electron/                # Electron main & preload process
│   └── src/                     # React + Vite + Tailwind CSS dashboard
└── scripts/                     # Automation & run scripts (build-all, start-system)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20.18.0)
- **Java / Flutter**: Flutter 3.x with OpenJDK 17+ (for mobile app compilation)

### 2. Install & Seed
```bash
# Setup Backend
cd backend
npm install
npx prisma db push
npm run seed
npm test

# Setup Desktop Dashboard
cd ../desktop_dashboard
npm install
```

### 3. Launch System
```bash
# Option A: One-click script (Windows)
scripts/start-system.bat

# Option B: Run independently
# Terminal 1 - Backend:
cd backend && npm run dev

# Terminal 2 - Desktop Dashboard:
cd desktop_dashboard && npm run dev
```
- Backend runs on: `http://localhost:3000`
- Desktop Dashboard runs on: `http://localhost:5173`

---

## 📱 Android SMS Ingestion Background Worker

1. Open `mobile_app` in Android Studio or VS Code.
2. Configure your server URL in the Settings screen (e.g. `http://10.0.2.2:3000` for Android Emulator, or your local LAN IP for physical device).
3. The app's native `SmsReceiver.kt` listens to `android.provider.Telephony.SMS_RECEIVED` with priority 999.
4. **Security Whitelist:** Personal messages are discarded locally. Only messages from:
   - `VF-Cash`, `VodafoneCash`
   - `InstaPay`, `IPN`
   - `OrangeCash`, `EtisalatCash`
   - `CIB`, `Banque Misr`, `NBE`, `QNB`
   are parsed and forwarded via HTTPS POST to `/api/v1/sms/incoming` with header `x-api-key`.
5. Build APK:
   ```bash
   cd mobile_app
   flutter build apk
   ```

---

## ⚖️ Financial Rules & Matching Logic

| Condition | Action Taken |
|---|---|
| **Verified Deposit < 190 EGP** | Order status set to `PARTIAL_DEPOSIT`. WhatsApp alert sent: *"تم استلام مبلغ {amount} ج. يُرجى العلم أن الأوردر لا يتم تأكيده إلا بسداد العربون كاملاً (200 ج)..."* **HALT PIPELINE**: No waybill generated, no Wuilt confirm, no branch group alert. |
| **Verified Deposit >= 190 EGP** | Matching SMS marked `isConsumed = true` (bound to order ID). Order confirmed on Wuilt. Puppeteer renders official shipping waybill (PNG + PDF). WhatsApp confirmation sent to customer with waybill screenshot. PDF + items sent to WhatsApp Branch Group. |
| **Discrepancy / No SMS match** | Order flagged as `FAILED_VERIFICATION`. Appears in Dashboard with alert. Operator can review receipt and use **Manual Verification Fallback** to approve. |

---

## 🧪 Automated Testing

Run the comprehensive unit test suite:
```bash
cd backend
npm test
```
Verifies:
- **SMS Parser & Whitelisting**: Arabic & English messages, Eastern Arabic numeral normalization, amount and reference extraction.
- **Dual-Verification Matching**: Exact reference ID match, fuzzy amount + 30-minute timestamp window, and prevention of double-spending.
- **Financial Thresholds**: Partial deposit classification, exact message templates, and full confirmation triggers.
