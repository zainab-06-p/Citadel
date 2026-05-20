# Citadel — Blockchain-Powered Work Escrow & Financial Reputation Platform

> **Built on Algorand Testnet** · Round 3 Hackathon Submission

Citadel converts **verified work** into **trusted financial reputation**. It is a full-stack dApp that brings together blockchain escrow, DeFi microlending, invoice tokenization, and DPDP-compliant consent management — all designed for India's gig & informal workforce.

---

## Table of Contents

1. [Why Citadel](#why-citadel)
2. [Live Deployments](#live-deployments)
3. [Architecture Overview](#architecture-overview)
4. [Smart Contract Documentation](#smart-contract-documentation)
5. [Project Structure](#project-structure)
6. [Setup & Local Development](#setup--local-development)
7. [Environment Variables Reference](#environment-variables-reference)
8. [API Reference](#api-reference)
9. [End-to-End User Flows](#end-to-end-user-flows)
10. [Tech Stack](#tech-stack)
11. [Deployment Guide](#deployment-guide)
12. [License](#license)

---

## Live Deployment

- **Frontend (Vercel)**: https://frontend-six-livid-85.vercel.app ✅ **LIVE & PRODUCTION**
- **Backend API**: https://citadel-backend-y2ek.onrender.com (Configured in frontend for API routing)
- **Smart Contracts**: Deployed on Algorand TestNet (App IDs: 761438103, 761438104, 761438105, 761438115)

## Why Citadel

India's gig workers — delivery partners, construction labour, freelancers — face three systemic problems:

| Problem | Impact |
|---|---|
| Delayed / disputed payments | Workers lose income without recourse |
| No portable proof of performance | Cannot demonstrate work history to anyone |
| Weak credit access | No formal records → no formal credit |

**Citadel's solution stack:**

- ✅ Escrow-backed milestone workflows on Algorand
- ✅ Wallet-linked worker identity and credential NFTs
- ✅ AI/on-chain credit scoring via `WorkProofCreditOracle`
- ✅ Decentralised microloan pool (`MicroLendPool`)
- ✅ GST invoice tokenisation as frozen ASAs (`InvoiceGuard`)
- ✅ DPDP 2023-compliant consent management
- ✅ INR-oriented payout bridge (Razorpay + UPI)

---

## Live Deployments

| Service | URL |
|---|---|
| **Frontend** (Vercel) | `https://frontend-six-livid-85.vercel.app/` |
| **Backend API** (Render) | `https://citadel-backend-y2ek.onrender.com`  |
| **Algorand Testnet** | [AlgoExplorer](https://testnet.explorer.perawallet.app/) |

### Deployed Smart Contracts (Algorand Testnet)

| Contract | App ID | App Address |
|---|---|---|
| `WorkProofV2` (Escrow + Consent + Dispute) | `758015705` | `6LQAPVQ245HKDISNEX7JRO3CE4MMFAFB7WASDXPNMRQWE3PF3PW2OGVHPM` |
| `WorkProofCreditOracle` | `761895422` | `SMEWVDPQXAME63XNKTVG2RMGR4O5TVVRCT7O2COFQYTWVYZTR6LFOWKJK4` |
| `MicroLendPool` | `761897101` | `P6GBAXVCMJRKBG5Y2SC3WGHRPMVT4XV5NM2XIT2HEF3QO6HZUQVUH5NVRM` |
| `InvoiceGuard` | `761898229` | `DFNM7AOQZELSN2374YEBCXF3ITEPPWF52FJIO6MOKPYM2FSDFXJNPNONLU` |

**Deployer Account:** `4ESLGM2JUKHDVGDGTJHWKMNWKVSQC3TSEBGFWFNVUH7EU7AVHOMEOQB7T4`  
**Deploy Transaction:** `P2OM2NMJNO7GANWYKOU3F3FXCELOVBFLRUUIYBJEJKKV33ZAPH6Q`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                             │
│           React + TypeScript + Vite + Tailwind CSS                  │
│           Wallet: Pera / Defly / Exodus / Lute                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS (REST API)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                     │
│      Hosted on Render · PORT 3000 · SQLite + Supabase (PostgreSQL)  │
│                                                                     │
│  Routes:                                                            │
│    /api/razorpay        — Razorpay payment gateway (INR payouts)    │
│    /api/algo-payment    — Algorand ALGO payment verification        │
│    /api/contracts       — WorkProof contract state & CRUD           │
│    /api/workers         — Worker profile & payout setup             │
│    /api/consent         — DPDP consent management                   │
│    /api/bank            — Institution/bank portal                   │
│    /api/receipts        — PDF receipt & certificate generation      │
│    /api/credit-oracle   — Credit score reads & credential txn build │
│    /api/micro-lend      — Deposit / borrow / repay txn build        │
│    /api/invoice-guard   — Invoice tokenize / pledge txn build       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ algosdk v2.7 (unsigned txns)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ALGORAND TESTNET (AVM 10)                        │
│          Endpoint: https://testnet-api.algonode.cloud               │
│                                                                     │
│  Smart Contracts (Algorand Python / Puya 4.7):                     │
│    WorkProofV2         — Multi-milestone escrow, consent, dispute   │
│    WorkProofCreditOracle — BoxMap-based credit scoring engine       │
│    MicroLendPool       — ALGO microloan pool gated by credit score  │
│    InvoiceGuard        — Frozen ASA invoice tokenisation (RWA)      │
│                                                                     │
│  Database:             — On-chain: BoxMap state for all contracts   │
│  Storage:              — Off-chain: SQLite / Supabase PostgreSQL    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

| Principle | Implementation |
|---|---|
| **Non-custodial** | Backend only builds *unsigned* txns; private keys never leave the user's wallet |
| **Atomic groups** | Deposit/repay use `algosdk.assignGroupID` — AVM rejects partial submissions |
| **BoxMap scaling** | On-chain state uses BoxMap (vs GlobalState) — scales to millions of entries |
| **Cross-app state** | MicroLendPool reads CreditOracle BoxMap directly via cross-app state reads |
| **Inner transactions** | InvoiceGuard mints frozen ASAs programmatically via inner `AssetCreateTransaction` |

---

## Smart Contract Documentation

All contracts are written in **Algorand Python (Puya 4.7)** and compiled to AVM TEAL. Artifacts (`.approval.teal`, `.clear.teal`, `.arc56.json`) are in `projects/contracts/smart_contracts/artifacts/`.

---

### 1. WorkProofV2 — `App ID 758015705`

**File:** `projects/contracts/smart_contracts/workproof/contract_v2.py`

The core escrow contract. Manages multi-milestone work agreements between contractor, supervisor, and worker with on-chain dispute resolution and DPDP-compliant consent management.

#### Global State

| Field | Type | Description |
|---|---|---|
| `contractor` | Account | Contractor (payer) address |
| `supervisor` | Account | Supervisor (approver) address |
| `worker` | Account | Worker (payee) address |
| `arbitrator` | Account | Dispute resolver address |
| `escrow_funded` | bool | Whether escrow has been funded |
| `total_escrow` | UInt64 | Total ALGO locked in escrow (microALGO) |
| `created_at` | UInt64 | Algorand block round of contract creation |
| `cancellation_timeout` | UInt64 | Block height for auto-cancellation eligibility |
| `milestone_count` | UInt64 | Total number of milestones |
| `milestones_completed` | UInt64 | Number of completed milestones |

#### BoxMap Storage

- `consent_registry` — `BoxMap(Bytes, ConsentRecord)`: Consent records keyed by `consent_{worker}_{institution}`
- `disputes` — `BoxMap(Bytes, DisputeRecord)`: Disputes keyed by `dispute_{id}`

#### ABI Methods

```python
create_work_contract(
    contractor, supervisor, worker, arbitrator,
    milestones_data: DynamicArray[MilestoneData],
    cancellation_window: UInt64,
    pay_txn: gtxn.PaymentTransaction
) -> UInt64
```
- Creates contract, locks escrow, initialises milestone state arrays
- `pay_txn.amount` **must** equal the sum of all milestone amounts
- Maximum 20 milestones per contract

```python
approve_milestone(milestone_index, metadata_url, metadata_hash) -> UInt64
```
- Supervisor-only: verifies completion, mints credential ASA (WorkProof NFT), releases ALGO to worker
- Returns the minted credential ASA ID

```python
claim_credential(milestone_index) -> UInt64
```
- Worker claims the credential NFT for a paid milestone (worker must opt-in to ASA first)

```python
grant_consent(institution, purpose, scope, duration_days) -> UInt64
```
- Worker grants DPDP-compliant, time-bound, scoped consent to an institution
- Scope is a comma-separated string: e.g. `"credit_score,earnings,contracts"`

```python
revoke_consent(institution) -> Bool
```
- Worker revokes previously granted consent (cannot be re-granted without a new call)

```python
verify_consent(worker, institution, required_scope) -> Bool
```
- Called by institutions before accessing worker data — checks non-expired, non-revoked consent

```python
raise_dispute(milestone_index, reason, evidence_hash) -> UInt64
```
- Worker, contractor, or supervisor may raise a dispute (evidence_hash = IPFS CID)
- Returns `dispute_id`

```python
resolve_dispute(dispute_id, resolution, payout_percent) -> UInt64
```
- Arbitrator resolves with `"approved"`, `"rejected"`, or `"partial"`
- For partial: `payout_percent` (0–100) portion goes to worker, remainder to contractor

```python
get_milestone_status(milestone_index) -> String
```
- Returns `"active"`, `"completed"`, or `"pending"`

```python
can_cancel_contract() -> Bool
```
- Returns true if cancellation timeout has passed and milestones are incomplete

---

### 2. WorkProofCreditOracle — `App ID 761895422`

**File:** `projects/contracts/smart_contracts/credit_oracle/contract.py`

Converts verified on-chain work history into a portable credit score.

#### BoxMap Storage (33-byte key = 1-byte prefix + 32-byte public key)

| Prefix | Field | Type | Description |
|---|---|---|---|
| `i` | `total_verified_income` | UInt64 | Sum of all milestone incomes (microALGO) |
| `c` | `milestone_count` | UInt64 | Number of registered credentials |
| `f` | `first_work_round` | UInt64 | Algorand round of first credential |
| `w` | `last_work_round` | UInt64 | Algorand round of most recent credential |
| `s` | `consistency_score` | UInt64 | 0–100 score (10 points per milestone, capped at 100) |
| `l` | `credit_limit` | UInt64 | Max borrowable = `total_income × 30 / 100` |
| `d` | `active_loan_id` | UInt64 | ID of current active loan (0 = none) |

#### ABI Methods

```python
register_credential(credential_asset_id: uint64, income_amount: uint64) -> uint64
```
- Verifies caller holds the WorkProof credential ASA via `AssetHoldingGet`
- Updates all 7 BoxMap entries for the caller
- Recalculates: `consistency_score = min(100, milestone_count × 10)`
- Recalculates: `credit_limit = total_income × 30 / 100`
- Returns updated credit limit

```python
set_active_loan(account, loan_id) -> void
```
- **Admin-only** (called by MicroLendPool after disbursement)

```python
improve_score_on_repayment(account) -> void
```
- **Admin-only** — bumps consistency score by 5 on successful loan repayment

---

### 3. MicroLendPool — `App ID 761897101`

**File:** `projects/contracts/smart_contracts/microlend/contract.py`

A decentralised ALGO microloan pool gated by CreditOracle scores.

#### BoxMap Storage (per-address state)

| Prefix | Field | Description |
|---|---|---|
| `D` | `deposit` | Total liquidity deposited by this address |
| `A` | `loan_amount` | Active loan principal |
| `R` | `repaid` | Amount repaid so far |
| `S` | `loan_status` | 0=none, 1=active, 2=repaid, 3=defaulted |
| `B` | `disbursed_round` | Algorand round when loan was disbursed |
| `I` | `interest_rate_bps` | Interest in basis points (1 bps = 0.01%) |

#### Interest Rate Schedule

| Consistency Score | Interest Rate |
|---|---|
| ≥ 75 | **500 bps (5%)** |
| 50–74 | **750 bps (7.5%)** |
| < 50 | **1000 bps (10%)** |

#### ABI Methods

```python
deposit_liquidity(payment: pay) -> void
```
- **Grouped transaction:** `PaymentTxn (wallet → app) + AppCallTxn`
- Adds `payment.amount` to depositor's `D` BoxMap entry

```python
request_loan(amount, consistency_score, credit_limit, oracle_app) -> uint64
```
- Cross-app reads borrower's `credit_limit` from CreditOracle BoxMap
- Verifies: `amount ≤ credit_limit` AND pool has sufficient liquidity
- Executes inner `PaymentTransaction`: app → borrower wallet
- Sets `loan_status = 1`, calculates interest rate based on score
- Returns loan ID

```python
repay_loan(payment: pay) -> bool
```
- **Grouped transaction:** `PaymentTxn (borrower → app) + AppCallTxn`
- Verifies `payment.amount ≥ principal + interest`
- Sets `loan_status = 2 (repaid)`
- Calls CreditOracle `improve_score_on_repayment` via inner AppCall

```python
flag_default(borrower) -> void
```
- **Admin-only** — marks loan as `status = 3 (defaulted)`

---

### 4. InvoiceGuard — `App ID 761898229`

**File:** `projects/contracts/smart_contracts/invoice_guard/contract.py`

Tokenises GST invoices as frozen Algorand Standard Assets (RWA — Real-World Assets).

#### BoxMap Storage (10-byte key = 2-byte prefix + 8-byte big-endian ASA ID)

| Prefix | Field | Description |
|---|---|---|
| `IA` | `invoice_amount` | Invoice value in paise (₹ × 100) |
| `ID` | `due_date` | Unix timestamp of payment due date |
| `IP` | `pledged_to_app` | App ID of contract this is pledged to (0 = free) |
| `IS` | `settled` | 0 = outstanding, 1 = settled |

#### ABI Methods

```python
tokenize_invoice(name, amount_paise, due_date, metadata_url) -> uint64
```
- Creates a frozen ASA via inner `AssetCreateTransaction`:
  - `total = 1` (NFT semantics)
  - `default_frozen = True` (cannot transfer without clawback)
  - `unit_name = "INV"`, `freeze = clawback = manager = app_address`
- Records `IA`, `ID` BoxMap entries for the new ASA ID
- Returns the created ASA ID

```python
pledge_as_collateral(invoice_asset_id, workproof_app_id) -> void
```
- Verifies caller holds the invoice ASA and it is not already pledged or settled
- Sets `IP[invoice_asset_id] = workproof_app_id`

```python
settle_invoice(invoice_asset_id) -> void
```
- **Admin-only** — marks invoice as settled, frees pledge
- Sets `IS = 1`, `IP = 0`

---

## Project Structure

```
Citadel/
├── README.md                          # This file
├── CITADEL_ROUND3_TECHNICAL_DOCS.md   # Deep technical reference
├── SUPABASE_SCHEMA.sql                # PostgreSQL schema for Supabase
├── Deployed Contract details.txt      # On-chain contract addresses
│
├── frontend/                          # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx                    # Wallet provider setup
│   │   ├── Home.tsx                   # Main layout & sidebar navigation
│   │   ├── components/
│   │   │   ├── ContractorDashboard.tsx   # Create & fund work contracts
│   │   │   ├── SupervisorApprove.tsx     # Review & approve milestones
│   │   │   ├── WorkerDashboard.tsx       # Worker milestone & payout view
│   │   │   ├── WorkerBankSetup.tsx       # Register UPI / bank payout details
│   │   │   ├── CreditProfileTab.tsx      # Register credentials, view score (NEW)
│   │   │   ├── MicroLendTab.tsx          # Deposit liquidity, borrow, repay (NEW)
│   │   │   ├── InvoiceGuardTab.tsx       # Tokenise & pledge invoices (NEW)
│   │   │   ├── BankPortal.tsx            # Institution underwriting view
│   │   │   ├── ConsentManager.tsx        # DPDP consent grant/revoke
│   │   │   ├── Bank.tsx                  # Bank dashboard
│   │   │   ├── AICreditScore.tsx         # AI credit score visualiser
│   │   │   └── ...                       # Supporting components
│   │   ├── contracts/                 # algosdk client wrappers
│   │   ├── utils/                     # Network config helpers
│   │   └── styles/                    # CSS / Tailwind overrides
│   ├── .env                           # Local env (gitignored)
│   ├── .env.template                  # Env variable reference
│   └── vite.config.ts
│
├── backend/                           # Node.js + Express API
│   ├── src/
│   │   ├── server.js                  # Express app entry point
│   │   ├── routes/
│   │   │   ├── algoPayment.js         # ALGO payment verification
│   │   │   ├── bank.js                # Institution portal APIs
│   │   │   ├── consent.js             # DPDP consent endpoints
│   │   │   ├── contracts.js           # WorkProof contract CRUD
│   │   │   ├── creditOracle.js        # Credit oracle read + txn build (NEW)
│   │   │   ├── invoiceGuard.js        # Invoice guard txn build (NEW)
│   │   │   ├── microLend.js           # MicroLend txn build (NEW)
│   │   │   ├── razorpay.js            # Razorpay order, webhook, verify
│   │   │   ├── receipts.js            # PDF receipt generation
│   │   │   └── workers.js             # Worker profile APIs
│   │   ├── services/
│   │   │   ├── algorandService.js     # algosdk helpers, BoxMap reads
│   │   │   ├── creditOracleService.js # Build CreditOracle transactions (NEW)
│   │   │   ├── invoiceGuardService.js # Build InvoiceGuard transactions (NEW)
│   │   │   ├── microLendService.js    # Build MicroLend transactions (NEW)
│   │   │   ├── razorpayService.js     # Razorpay SDK wrapper
│   │   │   └── watcherService.js      # Algorand event watcher
│   │   ├── models/                    # SQLite / Supabase data models
│   │   ├── config/                    # Database connection
│   │   └── middleware/                # Auth, error handling, rate limiting
│   ├── .env.example                   # Env variable reference
│   ├── Procfile                       # Render deployment: `web: npm start`
│   └── package.json
│
└── projects/
    └── contracts/                     # Algorand Python smart contracts
        ├── smart_contracts/
        │   ├── workproof/
        │   │   ├── contract.py        # WorkProof V1 (simple escrow)
        │   │   └── contract_v2.py     # WorkProofV2 (milestone, consent, dispute)
        │   ├── credit_oracle/         # WorkProofCreditOracle
        │   ├── microlend/             # MicroLendPool
        │   ├── invoice_guard/         # InvoiceGuard
        │   └── artifacts/             # Compiled TEAL + ARC-56 JSON
        ├── deploy_workproof.py        # Deploy WorkProof contract
        ├── deploy_testnet_bip39.py    # Deploy Round 3 contracts
        └── pyproject.toml             # Python dependencies (Poetry)
```

---

## Setup & Local Development

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18.0.0 | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| npm | ≥ 9.0 | Bundled with Node.js |
| Python | ≥ 3.12 | For smart contract compilation only |
| Poetry | ≥ 1.8 | Python dependency manager |
| Pera Wallet | Latest | Mobile app or browser extension, set to **Testnet** |

### 1. Clone the Repository

```bash
git clone https://github.com/zainab-06-p/Citadel.git
cd Citadel
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — see Environment Variables Reference below

# Initialise the SQLite database (if running locally without Supabase)
npm run db:init

# Start development server (hot reload)
npm run dev
# → Server running at http://localhost:3000
# → Health check: http://localhost:3000/health
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Create .env file with the following minimum configuration:
cat > .env << 'EOF'
VITE_ENVIRONMENT=local
VITE_ALGOD_TOKEN=""
VITE_ALGOD_SERVER="https://testnet-api.algonode.cloud"
VITE_ALGOD_PORT=""
VITE_ALGOD_NETWORK="testnet"
VITE_INDEXER_TOKEN=""
VITE_INDEXER_SERVER="https://testnet-idx.algonode.cloud"
VITE_INDEXER_PORT=""
VITE_BACKEND_URL=http://localhost:3000
VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY
VITE_WORKPROOF_APP_ID=758015705
VITE_WORKPROOF_APP_ADDRESS=6LQAPVQ245HKDISNEX7JRO3CE4MMFAFB7WASDXPNMRQWE3PF3PW2OGVHPM
VITE_CREDIT_ORACLE_APP_ID=761895422
VITE_MICROLEND_APP_ID=761897101
VITE_INVOICE_GUARD_APP_ID=761898229
EOF

# Start development server
npm run dev
# → App running at http://localhost:5173
```

### 4. Smart Contract Setup (Optional — contracts already deployed)

```bash
cd projects/contracts

# Install Python dependencies
poetry install

# Activate virtual environment
poetry shell

# Compile contracts (outputs TEAL + ARC-56 JSON to artifacts/)
algokit compile python smart_contracts/workproof/contract_v2.py --output-arc56
algokit compile python smart_contracts/credit_oracle/contract.py --output-arc56
algokit compile python smart_contracts/microlend/contract.py --output-arc56
algokit compile python smart_contracts/invoice_guard/contract.py --output-arc56

# Deploy to Testnet (requires funded deployer account)
python deploy_testnet_bip39.py
```

### 5. Wallet Setup for Testing

1. Install [Pera Wallet](https://perawallet.app/) on mobile or browser
2. Switch to **Testnet** in Settings
3. Fund your wallet: visit [Algorand Testnet Faucet](https://bank.testnet.algorand.network/)
4. Minimum: **0.5 ALGO** for transaction fees
5. For Credit Oracle testing: you need a WorkProof credential ASA in your wallet (obtain by completing a milestone as a worker)

---

## Environment Variables Reference

### Backend (`backend/.env`)

```env
# Server
PORT=3000
NODE_ENV=development

# CORS — set to your frontend URL in production
FRONTEND_URL=http://localhost:5173

# Supabase (PostgreSQL) — get from https://supabase.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Razorpay — get from https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Algorand (Testnet — no API key needed with Algonode)
ALGORAND_SERVER=https://testnet-api.algonode.cloud
ALGORAND_PORT=443
ALGORAND_TOKEN=
INDEXER_SERVER=https://testnet-idx.algonode.cloud
INDEXER_PORT=443

# WorkProof V2 Contract
WORKPROOF_APP_ID=758015705
WORKPROOF_APP_ADDRESS=6LQAPVQ245HKDISNEX7JRO3CE4MMFAFB7WASDXPNMRQWE3PF3PW2OGVHPM
DEPLOYER_ADDRESS=4ESLGM2JUKHDVGDGTJHWKMNWKVSQC3TSEBGFWFNVUH7EU7AVHOMEOQB7T4

# Round 3 — Citadel DeFi Extension Contracts
CREDIT_ORACLE_APP_ID=761895422
CREDIT_ORACLE_APP_ADDRESS=SMEWVDPQXAME63XNKTVG2RMGR4O5TVVRCT7O2COFQYTWVYZTR6LFOWKJK4
MICROLEND_APP_ID=761897101
MICROLEND_APP_ADDRESS=P6GBAXVCMJRKBG5Y2SC3WGHRPMVT4XV5NM2XIT2HEF3QO6HZUQVUH5NVRM
INVOICE_GUARD_APP_ID=761898229
INVOICE_GUARD_APP_ADDRESS=DFNM7AOQZELSN2374YEBCXF3ITEPPWF52FJIO6MOKPYM2FSDFXJNPNONLU
```

### Frontend (`frontend/.env`)

```env
VITE_ENVIRONMENT=local
VITE_ALGOD_TOKEN=""
VITE_ALGOD_SERVER="https://testnet-api.algonode.cloud"
VITE_ALGOD_PORT=""
VITE_ALGOD_NETWORK="testnet"
VITE_INDEXER_TOKEN=""
VITE_INDEXER_SERVER="https://testnet-idx.algonode.cloud"
VITE_INDEXER_PORT=""

# Production: replace with Render backend URL
VITE_BACKEND_URL=http://localhost:3000

VITE_RAZORPAY_KEY_ID=rzp_test_...

VITE_WORKPROOF_APP_ID=758015705
VITE_WORKPROOF_APP_ADDRESS=6LQAPVQ245HKDISNEX7JRO3CE4MMFAFB7WASDXPNMRQWE3PF3PW2OGVHPM

VITE_CREDIT_ORACLE_APP_ID=761895422
VITE_MICROLEND_APP_ID=761897101
VITE_INVOICE_GUARD_APP_ID=761898229
```

---

## API Reference

All endpoints return `{ success: boolean, data?: any, error?: string }`.

### Credit Oracle

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `GET` | `/api/credit-oracle/profile/:address` | — | Read on-chain credit profile (all 7 BoxMap fields) |
| `POST` | `/api/credit-oracle/register-credential` | `{ workerAddress, credentialAssetId, incomeAmount }` | Build unsigned `register_credential` transaction |

### MicroLend Pool

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `GET` | `/api/micro-lend/state/:address` | — | Read deposit + loan state for address |
| `POST` | `/api/micro-lend/deposit` | `{ depositorAddress, amountMicroAlgo }` | Build unsigned grouped deposit txns (pay + app call) |
| `POST` | `/api/micro-lend/request-loan` | `{ borrowerAddress, amountMicroAlgo }` | Build unsigned loan request txn |
| `POST` | `/api/micro-lend/repay` | `{ borrowerAddress }` | Build unsigned grouped repay txns (pay + app call) |

### InvoiceGuard

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `GET` | `/api/invoice-guard/invoice/:assetId` | — | Read invoice on-chain state |
| `POST` | `/api/invoice-guard/tokenize` | `{ callerAddress, name, amountPaise, dueDate, metadataUrl }` | Build unsigned tokenize txn |
| `POST` | `/api/invoice-guard/pledge` | `{ callerAddress, invoiceAssetId, workproofAppId }` | Build unsigned pledge txn |

### WorkProof Contracts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/contracts` | List all contracts |
| `POST` | `/api/contracts` | Create new contract record |
| `GET` | `/api/contracts/:id` | Get contract details |

### Workers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workers/:address` | Get worker profile |
| `POST` | `/api/workers/register` | Register worker payout details |
| `GET` | `/api/workers/:address/receipts` | Get worker's receipts |

### Payments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/razorpay/create-order` | Create Razorpay INR payment order |
| `POST` | `/api/razorpay/verify` | Verify payment signature |
| `POST` | `/api/razorpay/webhook` | Razorpay webhook handler (HMAC verified) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server + database connectivity check |

---

## End-to-End User Flows

### Flow A — Worker Gets a Microloan

```
1. Worker completes milestone
   → Supervisor calls approve_milestone()
   → WorkProofV2 mints credential ASA to contract
   → Worker calls claim_credential() → gets credential NFT in wallet

2. Worker opens Citadel → Worker → Credit tab
   → Enters credential ASA ID + income amount
   → Clicks "Register Credential"
   → Pera Wallet opens → worker signs
   → Transaction hits CreditOracle (App 761895422)
   → Oracle writes 7 BoxMap entries (income, count, score, limit...)

3. Worker goes to MicroLend → Borrow tab
   → Views credit limit (e.g. 30% of total verified income)
   → Enters loan amount (≤ credit limit)
   → Clicks "Request Loan"
   → Pera opens → signs → hits MicroLendPool (App 761897101)
   → Contract reads credit_limit from CreditOracle via cross-app state
   → Inner PaymentTxn sends ALGO: contract → worker wallet
   → Wallet balance increases

4. Worker repays
   → Pool balance refilled + consistency_score bumps +5
```

### Flow B — Contractor Tokenises Invoice as Collateral

```
1. Contractor opens InvoiceGuard → Tokenize tab
   → Fills: invoice number, amount (₹), due date
   → Clicks "Tokenize Invoice as NFT"
   → Pera opens → signs (fee: 3000 microALGO for inner txn)
   → InvoiceGuard (App 761898229) mints frozen ASA
   → BoxMaps IA, ID recorded with amount and due date

2. UI shows created ASA ID → auto-fills in Pledge tab
   → Contractor clicks "Pledge as Collateral"
   → Pera opens → signs → BoxMap IP updated with MicroLend app ID

3. CreditOracle now reflects invoice as collateral boost
```

### Flow C — Institution Accesses Worker Data

```
1. Worker grants consent via Compliance tab
   → Calls grant_consent(institution, purpose, scope, duration_days)
   → ConsentRecord stored on-chain in WorkProofV2 BoxMap

2. Institution looks up worker via Bank Portal
   → Backend calls verify_consent() on-chain
   → If valid: reads credit profile, work history, earnings
   → Renders trust score for underwriting decision

3. Worker can revoke at any time
   → revoke_consent(institution) sets revoked=True on-chain
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React + TypeScript | 18.x + 5.x |
| **Frontend Bundler** | Vite | 5.x |
| **Frontend Styling** | Tailwind CSS + DaisyUI | 3.3.x + 4.x |
| **Frontend Animations** | Framer Motion | 12.x |
| **Wallet Integration** | @txnlab/use-wallet-react | 4.x |
| **Frontend SDK** | algosdk | 3.5.x |
| **Backend Runtime** | Node.js + Express | 18+ + 4.x |
| **Backend SDK** | algosdk | 2.7.x |
| **Database (off-chain)** | SQLite (local) / Supabase (PostgreSQL) | — |
| **Blockchain** | Algorand Testnet (AVM 10) | — |
| **Smart Contract Lang** | Algorand Python (Puya) | 4.7 |
| **Payment Gateway** | Razorpay | 2.9.x |
| **PDF Generation** | Puppeteer | 21.x |
| **QR Codes** | qrcode | 1.5.x |

---

## Deployment Guide

### Frontend → Vercel

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. **Root Directory:** `frontend`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Add all `VITE_*` environment variables from the Frontend section above
7. Set `VITE_BACKEND_URL` to your Render backend URL (e.g. `https://citadel-backend.onrender.com`)
8. Deploy → Vercel will auto-build on every push to `main`

### Backend → Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. **Root Directory:** `backend`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start` (reads from `Procfile`)
6. **Environment:** Node.js
7. Add all backend environment variables:
   - Set `NODE_ENV=production`
   - Set `FRONTEND_URL` to your Vercel frontend URL (e.g. `https://citadel.vercel.app`)
   - Fill in all Supabase, Razorpay, and Algorand keys
8. Deploy → Render will automatically redeploy on pushes to `main`

### Connecting Frontend ↔ Backend

After both are deployed:

1. Copy the Render backend URL (e.g. `https://citadel-backend.onrender.com`)
2. In Vercel: go to Project Settings → Environment Variables
3. Update `VITE_BACKEND_URL` to the Render URL
4. Redeploy the frontend (Deployments → Redeploy)
5. In Render: update `FRONTEND_URL` to the Vercel URL for CORS
6. Restart the Render service

**Verify connectivity:**
```bash
curl https://citadel-backend.onrender.com/health
# Expected: { "status": "healthy", "services": { "database": "connected", ... } }
```

---

## License

MIT © Citadel / WorkProof Team
