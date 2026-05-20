# Citadel - Verifiable Work Contracts on Algorand

> **Bridging Web2 Payments with Web3 Trust for India's Gig Economy**  
> A full-stack blockchain application turning verified work into escrow-backed payments, portable work credentials, and finance-ready trust signals.

---

## 📋 Table of Contents

- [Vision & Problem](#vision--problem)
- [Solution Overview](#solution-overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Smart Contracts Documentation](#smart-contracts-documentation)
- [Setup Guide](#setup-guide)
- [API Documentation](#api-documentation)
- [Deployment Guide](#deployment-guide)
- [Clean Commit Structure](#clean-commit-structure)
- [Contributing](#contributing)

---

## 🎯 Vision & Problem

### The Challenge

India's gig economy employs over **7.7 million workers** but faces critical trust and verification challenges:

| Challenge | Impact |
|-----------|--------|
| **Wage Disputes** | 40% of informal workers face delayed or disputed payments |
| **No Work Verification** | Workers lack tamper-proof proof of completed work |
| **Supervisor Bias** | Arbitrary approval processes lead to unfair rejections |
| **Payment Opacity** | No transparent trail from contractor to worker |
| **No Dispute Resolution** | Lengthy legal processes favor employers |
| **Financial Exclusion** | Lack of verifiable credit history |
| **Data Silos** | No portable credentials across platforms |

### Our Solution

**Citadel** is a decentralized work contract platform that:

✅ **Escrow-Backs Payments** - Smart contracts hold funds until milestones are verified  
✅ **Creates Portable Credentials** - NFT-based proof of work stored on-chain  
✅ **Enables Credit Scoring** - Financial institutions access verified work history  
✅ **Ensures Transparency** - Every transaction recorded immutably on Algorand  
✅ **Supports DeFi Integration** - Workers access microloans and financial services  
✅ **Complies with DPDP 2023** - Consent-based data sharing for institutional access

---

## 💡 Solution Overview

### How It Works

**3-Step Workflow:**

1. **Contract Creation**
   - Contractor defines milestones with amounts
   - System calculates escrow requirements
   - Contractor funds the smart contract

2. **Work Verification**
   - Worker completes milestone
   - Supervisor reviews and approves
   - Smart contract mints NFT credential

3. **Payment & Credit**
   - Funds released from escrow to worker
   - Work history recorded on-chain
   - Credit score automatically calculated
   - Worker becomes eligible for DeFi products

### Key User Journeys

| Role | Capabilities |
|------|--------------|
| **Contractor** | Create contracts, fund escrow, deposit liquidity, access analytics |
| **Supervisor** | Verify deliverables, approve milestones, generate reports |
| **Worker** | Track work history, claim payments, download certificates, build credit |
| **Institution** | Access verified work profiles, underwrite loans, consent-governed access |
| **Compliance** | Grant/revoke data access, audit consent trails, manage permissions |

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** 18+ (backend) and 20+ (frontend)
- **Python** 3.12+ (smart contracts)
- **AlgoKit CLI** 2.0+
- **Docker** (for local Algorand node)
- **Git**

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/zainab-06-p/Citadel.git
cd Citadel

# 2. Access deployed application
# Frontend: https://frontend-six-livid-85.vercel.app ✅ LIVE
# Backend: https://backend-rouge-iota.vercel.app

# 2. Setup Backend
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run db:init
npm run dev

# 3. Setup Frontend (new terminal)
cd ../frontend
npm install
npm run dev

# 4. Setup Smart Contracts (new terminal)
cd ../projects/contracts
poetry install
algokit project bootstrap all
algokit localnet start
algokit project run build
algokit project deploy localnet

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
```

---

## 📁 Project Structure

```
Citadel/
├── backend/                          Express API Server
│   ├── src/
│   │   ├── server.js                Main entry point
│   │   ├── config/                  Database, Algorand, Razorpay config
│   │   ├── middleware/              Authentication, error handling
│   │   ├── models/                  SQLite data access layer
│   │   ├── routes/                  REST endpoint definitions
│   │   ├── services/                Business logic (blockchain, PDF, payments)
│   │   └── utils/                   Validators, helpers
│   ├── scripts/
│   │   ├── initDatabase.js          Bootstrap SQLite database
│   │   └── startWatcher.js          Blockchain event watcher
│   ├── tests/                       Jest unit & integration tests
│   ├── docs/                        Comprehensive documentation
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── frontend/                         React + TypeScript + Vite UI
│   ├── src/
│   │   ├── main.tsx                 Application entry
│   │   ├── Home.tsx                 Main router component
│   │   ├── components/              Reusable UI components
│   │   │   ├── ContractorDashboard/
│   │   │   ├── SupervisorDashboard/
│   │   │   ├── WorkerDashboard/
│   │   │   ├── InstitutionPortal/
│   │   │   ├── CompliancePortal/
│   │   │   ├── MicroLendDashboard/
│   │   │   └── InvoiceGuardDashboard/
│   │   ├── contracts/               Generated frontend SDK clients
│   │   ├── interfaces/              Shared TypeScript types
│   │   ├── styles/                  Tailwind + DaisyUI styling
│   │   ├── utils/                   Network config, Pinata helpers
│   │   └── assets/                  Branding & media
│   ├── public/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.cjs
│   ├── package.json
│   └── playwright.config.ts
│
├── projects/contracts/              AlgoPy Smart Contracts
│   ├── smart_contracts/
│   │   ├── workproof/              Main escrow + credential contract
│   │   ├── credit_oracle/          Credit score calculation
│   │   ├── microlend/              Lending pool contract
│   │   ├── invoice_guard/          Invoice tokenization (RWA)
│   │   ├── bank/                   Example BoxMap contract
│   │   └── artifacts/              Generated ARC56 specs, TEAL, clients
│   ├── tests/                      Python contract tests
│   ├── deploy_config.py            Deployment configuration
│   ├── pyproject.toml
│   └── README.md
│
├── sdk/                             TypeScript SDK Package
│   ├── src/
│   │   └── index.ts                Exported types & utilities
│   ├── contracts/
│   │   └── ConsentRegistry-spec.md  ABI specification
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── CITADEL_ROUND3_TECHNICAL_DOCS.md    DeFi Extension Specs
├── SUPABASE_SCHEMA.sql                 Historical schema reference
├── README.md                           Original project README
└── OnChain-Counter.code-workspace      VS Code workspace config
```

---

## 🏗 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                         │
├──────────────┬──────────────┬────────────┬──────────┬────────┤
│  Contractor  │  Supervisor  │   Worker   │Institution│Compliance│
│  Dashboard   │  Dashboard   │ Dashboard  │  Portal  │ Portal  │
└──────────────┴──────────────┴────────────┴──────────┴────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         FRONTEND (React + TypeScript + Vite)                 │
│  - Wallet integration (Pera, Defly, Lute Connect)          │
│  - Contract transaction signing                             │
│  - Real-time status updates                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│       BACKEND API (Express.js on Node.js)                    │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ REST Routes  │ Services     │ Models       │ Middleware     │
│ - Contracts  │ - Blockchain │ - Payment    │ - Auth         │
│ - Workers    │ - PDF Gen    │ - Contract   │ - Error Handle │
│ - Consent    │ - Watcher    │ - Milestone  │ - CORS         │
│ - Razorpay   │ - Credit     │ - Consent    │ - Rate Limit   │
└──────────────┴──────────────┴──────────────┴────────────────┘
                    │                    │
         ┌──────────▼─────────┐  ┌───────▼──────────┐
         │   SQLite Database  │  │  External APIs   │
         │  - Contracts       │  │  - Razorpay      │
         │  - Workers         │  │  - Algorand      │
         │  - Payments        │  │  - Indexer       │
         │  - Consent Log     │  │  - Pinata        │
         └────────────────────┘  └──────────────────┘
                                           │
                              ┌────────────▼──────────────┐
                              │  Algorand Blockchain      │
                              │  (TestNet)                │
                  ┌───────────┼───────────┬──────────┐
                  ▼           ▼           ▼          ▼
            ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐
            │WorkProof │ │  Credit  │ │Microlend│ │Invoice │
            │ Contract │ │  Oracle  │ │  Pool  │ │Guard  │
            │          │ │          │ │        │ │       │
            │ App ID   │ │ App ID   │ │App ID  │ │App ID │
            │761438103 │ │761438104 │ │761438105│ │761438115│
            └──────────┘ └──────────┘ └────────┘ └────────┘
```

### Runtime Data Flow

**Contract Creation & Funding:**
```
Contractor → signs contract TXN → Backend → creates contract on-chain
         → funds escrow ALGO → Smart Contract holds funds in escrow
```

**Milestone Approval:**
```
Worker → completes work → Supervisor reviews → signs approval TXN
     → Backend validates → Smart Contract mints NFT credential
     → Updates worker's credit profile → Emits event
```

**Payment Release:**
```
Backend watcher detects approval event
     → Triggers payment TXN from escrow
     → Worker receives ALGO + certificate
     → Credit oracle updates financial profile
```

---

## 📊 Smart Contracts Documentation

### Contract Overview

| Contract | Purpose | Status | App ID |
|----------|---------|--------|--------|
| **WorkProof** | Core escrow + credential issuance | ✅ Deployed | `761438103` |
| **CreditOracle** | Worker credit score calculation | ✅ Deployed | `761438104` |
| **MicroLend** | Algorithmic lending pool | ✅ Deployed | `761438105` |
| **InvoiceGuard** | RWA invoice tokenization | ✅ Deployed | `761438115` |

### 1. WorkProof Contract (`App ID: 761438103`)

**Purpose:** Main escrow contract managing milestone payments and NFT credential issuance

**Key Features:**
- Escrow holds contractor funds until milestone approval
- Mints NFT credentials on milestone completion
- Tracks payment history
- Emits events for off-chain indexing

**Storage Model:**
- **Global State:** Contract metadata, supervisor registry
- **Local State:** Worker payment history
- **Boxes:** Flexible storage for credential metadata

**Core Methods:**
```python
create_contract(milestone_count, amounts, supervisor)
  → Initializes contract with milestones

approve_milestone(milestone_index)
  → Verifies supervisor signature
  → Mints NFT for worker
  → Updates payment status

claim_payment(milestone_index)
  → Validates milestone approval
  → Transfers ALGO from escrow to worker
  → Records on-chain transaction
```

### 2. CreditOracle Contract (`App ID: 761438104`)

**Purpose:** Calculates worker credit scores based on verified work history

**Storage Design:**
```
BoxMap Structure (33-byte keys: 1-byte prefix + 32-byte account):

Prefix | Field Name           | Type    | Description
-------|----------------------|---------|----------------------------------
'i'    | total_verified_income| UInt64  | Sum of all milestone amounts (microALGO)
'c'    | milestone_count      | UInt64  | Total credentials registered
'f'    | first_work_round     | UInt64  | Algorand round of first credential
'w'    | last_work_round      | UInt64  | Algorand round of most recent work
's'    | consistency_score    | UInt64  | 0-100 score based on work regularity
'l'    | credit_limit         | UInt64  | Maximum borrowable amount (microALGO)
'd'    | active_loan_id       | UInt64  | Current loan ID (0 = no active loan)
```

**Credit Score Algorithm:**
```
consistency_score = min(100, milestone_count × 10)
credit_limit = total_income × 30% (conservative lending ratio)
interest_tier:
  - score ≥ 75: 500 bps (5.00% per annum)
  - score ≥ 50: 750 bps (7.50% per annum)
  - score < 50: 1000 bps (10.00% per annum)
```

**Core Methods:**
```python
register_credential(credential_asset_id, income_amount)
  → Verifies caller holds credential NFT
  → Updates income and milestone counts
  → Recalculates credit limit
  → Returns new credit limit

set_active_loan(borrower, loan_id)
  → Admin-only (called by MicroLend)
  → Records active loan ID

improve_score_on_repayment(borrower)
  → Admin-only (called by MicroLend on repayment)
  → Bumps consistency score by 5 points
```

### 3. MicroLendPool Contract (`App ID: 761438105`)

**Purpose:** Algorithmic lending pool gated by credit scores

**Storage Design:**
```
BoxMap Structure (per borrower/lender):

Prefix | Field Name       | Type    | Description
-------|------------------|---------|----------------------------------
'D'    | deposit          | UInt64  | Liquidity deposited by address
'A'    | loan_amount      | UInt64  | Active loan principal
'R'    | repaid_amount    | UInt64  | Amount already repaid
'S'    | loan_status      | UInt64  | 0=none 1=active 2=repaid 3=defaulted
'B'    | disbursed_round  | UInt64  | Round when loan was issued
'I'    | interest_rate_bps| UInt64  | Interest rate in basis points
```

**Core Methods:**
```python
deposit_liquidity(payment)
  → Grouped: PaymentTxn (wallet → app) + AppCallTxn
  → Records deposit in BoxMap
  → Updates pool balance

request_loan(amount, consistency_score, credit_limit, oracle_app)
  → Reads credit limit from CreditOracle via cross-app read
  → Validates: amount ≤ credit_limit
  → Verifies pool has liquidity
  → Issues inner PaymentTxn (app → borrower)
  → Records loan with interest rate based on score

repay_loan(payment)
  → Grouped: PaymentTxn (borrower → app) + AppCallTxn
  → Calculates interest owed
  → Validates repayment amount
  → Marks loan as repaid
  → Calls CreditOracle to improve borrower's score

flag_default(borrower)
  → Admin-only
  → Marks loan as defaulted after grace period
```

### 4. InvoiceGuard Contract (`App ID: 761438115`)

**Purpose:** Tokenizes GST invoices as RWA (Real World Assets)

**Storage Design:**
```
BoxMap Structure (10-byte keys: 2-byte prefix + 8-byte ASA ID):

Prefix | Field Name       | Type    | Description
-------|------------------|---------|----------------------------------
'IA'   | invoice_amount   | UInt64  | Invoice value in paise (₹ × 100)
'ID'   | due_date         | UInt64  | Unix timestamp of payment due
'IP'   | pledged_to_app   | UInt64  | App ID if pledged as collateral
'IS'   | settled          | UInt64  | 0=outstanding 1=settled
```

**Core Methods:**
```python
tokenize_invoice(name, amount_paise, due_date, metadata_url)
  → Issues inner AssetCreateTxn:
    - Creates 1 frozen NFT
    - Sets manager = app address
    - Manager can clawback for settlement
  → Records invoice metadata in BoxMap
  → Returns new ASA ID

pledge_invoice(asa_id, lending_app_id)
  → Marks invoice as collateral
  → Links to lending contract

settle_invoice(asa_id, settlement_amount)
  → Verifies payment received
  → Marks invoice as settled
  → Claws back NFT from holder
```

### Smart Contract Deployment Details

**Deployer Account:**
```
Address: 4ESLGM2JUKHDVGDGTJHWKMNWKVSQC3TSEBGFWFNVUH7EU7AVHOMEOQB7T4
Network: Algorand TestNet
All contracts deployed by this account maintain admin privileges
```

**Key Constraints (Puya 4.7 Compilation):**
- No Python built-in `min()`/`max()` - use ternary operators
- No wildcard variables `_` - explicit naming required
- All free functions require `@subroutine` decorator
- Type annotations mandatory with `disallow_any_expr = true`
- Box keys use consistent prefixing scheme for collision avoidance

---

## 🚀 Setup Guide

### Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# Edit .env with:
# - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
# - ALGOD_SERVER, INDEXER_SERVER (default to AlgoNode)
# - PORT (default 3000)
# - NODE_ENV (development or production)

# 3. Initialize database
npm run db:init

# 4. Start development server
npm run dev

# Or production:
npm start

# 5. Start blockchain watcher (separate terminal)
npm run watcher
```

**Environment Variables Reference:**

```bash
# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx

# Algorand TestNet
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_PORT=
ALGOD_TOKEN=
INDEXER_SERVER=https://testnet-idx.algonode.cloud
INDEXER_PORT=

# Server
PORT=3000
NODE_ENV=development

# Redis (Optional for caching)
REDIS_URL=redis://localhost:6379

# Railway (Production)
RAILWAY_STATIC_URL=https://your-railway-app.up.railway.app
```

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Generate contract clients
npm run generate:app-clients

# 3. Start development server
npm run dev

# Frontend will be available at http://localhost:5173

# 4. Build for production
npm run build

# 5. Run tests
npm test
```

### Smart Contracts Setup

```bash
cd projects/contracts

# 1. Install Poetry
# macOS: brew install poetry
# Windows: (Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
# Linux: curl -sSL https://install.python-poetry.org | python3 -

# 2. Bootstrap project
algokit project bootstrap all

# 3. Generate environment files
algokit generate env-file -a target_network localnet

# 4. Start local Algorand network (first time)
algokit localnet start

# 5. Build contracts
algokit project run build

# 6. Deploy to local network
algokit project deploy localnet

# 7. Deploy to TestNet (requires funded account)
algokit project deploy testnet
```

---

## 📡 API Documentation

### Base URL
```
Development: http://localhost:3000
Production: https://citadel-api.railway.app (or your deployed URL)
```

### Authentication
- No authentication required for public endpoints
- Webhook endpoints verified using HMAC-SHA256

### Key Endpoints

#### Contracts API
```
POST   /api/contracts/create           Create new work contract
GET    /api/contracts/:appId           Get contract details
GET    /api/contracts/:appId/status    Get contract status
POST   /api/contracts/:appId/approve   Approve milestone
```

#### Workers API
```
GET    /api/workers/:address           Get worker profile
GET    /api/workers/:address/history   Get work history
GET    /api/workers/:address/certificates   List all certificates
GET    /api/certificates/:appId/:milestoneIndex   Download PDF
```

#### Credit API
```
GET    /api/credit/:address            Get credit score
GET    /api/credit/:address/eligible   Check loan eligibility
```

#### Razorpay API
```
POST   /api/razorpay/create-order      Create payment order
POST   /api/razorpay/webhook           Webhook handler
```

#### Consent API
```
POST   /api/consent/grant              Grant data consent
POST   /api/consent/revoke             Revoke consent
GET    /api/consent/:address/log       Get consent audit log
```

#### Health Check
```
GET    /health                         API health status
```

### Response Format
```json
{
  "success": true,
  "data": { /* response payload */ },
  "error": null,
  "timestamp": "2026-05-20T10:30:00Z"
}
```

---

## 🌐 Deployment Guide

### Railway.app Deployment (Recommended)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Link project
railway link

# 4. Set environment variables
railway variables set RAZORPAY_KEY_ID=xxxxx
railway variables set RAZORPAY_KEY_SECRET=xxxxx
railway variables set RAZORPAY_WEBHOOK_SECRET=xxxxx

# 5. Deploy
railway up
```

### Vercel Deployment (Frontend)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Configure environment variables in Vercel dashboard
# - VITE_API_URL=https://citadel-api.railway.app

# 4. Redeploy after changes
vercel --prod
```

### Docker Deployment

```bash
# Build Docker image
docker build -t citadel-backend .

# Run container
docker run -p 3000:3000 --env-file .env citadel-backend

# Push to Docker Hub
docker push your-username/citadel-backend
```

---

## 📝 Clean Commit Structure

### Commit Strategy

Commits should follow these patterns:

```
feat: [module] Description of new feature
fix: [module] Description of bug fix
docs: [module] Update documentation
style: [module] Code formatting changes
refactor: [module] Code restructuring
test: [module] Add or update tests
chore: [module] Dependency or tool updates
```

### Example Commits

```bash
git commit -m "feat: backend - Add Razorpay payment webhook handler"
git commit -m "fix: contracts - Correct credit score calculation formula"
git commit -m "docs: README - Add deployment section"
git commit -m "feat: frontend - Implement worker dashboard with charts"
git commit -m "refactor: backend - Extract validation logic to utils"
git commit -m "test: contracts - Add unit tests for loan calculation"
```

### Feature Branch Workflow

```bash
# Create feature branch
git checkout -b feat/worker-dashboard

# Make changes and commit
git add .
git commit -m "feat: frontend - Add worker dashboard component"
git commit -m "feat: frontend - Implement payment history table"
git commit -m "feat: frontend - Add certificate download button"

# Create pull request
git push origin feat/worker-dashboard

# After review, merge to main
git checkout main
git merge feat/worker-dashboard
git push origin main
```

### Deployment Commits

```bash
# After successful deployment to production
git tag -a v1.2.0 -m "Release version 1.2.0 - Stable"
git push origin v1.2.0
```

---

## 🔧 Development Tools

### Tech Stack

**Backend:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** SQLite3
- **Smart Contract Interaction:** algosdk
- **Payments:** Razorpay SDK
- **Testing:** Jest
- **Code Quality:** ESLint, Prettier

**Frontend:**
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + DaisyUI
- **Wallet Integration:** use-wallet
- **HTTP Client:** Axios
- **State Management:** React Hooks + Context
- **Testing:** Playwright, Jest

**Smart Contracts:**
- **Language:** Algorand Python (Puya)
- **Framework:** AlgoKit
- **Testing:** pytest + algorand-python-testing
- **Deployment:** AlgoKit Deploy

### Development Commands

```bash
# Backend
npm run dev          # Start development server
npm run test         # Run tests
npm run lint         # Lint code
npm run db:init      # Initialize database
npm run watcher      # Start blockchain watcher

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run test         # Run tests
npm run playwright:test  # Run E2E tests
npm run lint         # Lint code

# Contracts
algokit project run build      # Build contracts
algokit project deploy localnet # Deploy to LocalNet
algokit project test          # Run contract tests
```

---

## 🤝 Contributing

### Code Standards

1. **TypeScript:** Strict mode enabled, no `any` types
2. **Python:** PEP 8 with Black formatting
3. **Commits:** Conventional commits (feat, fix, docs, etc.)
4. **Tests:** Minimum 80% code coverage
5. **Documentation:** JSDoc comments for functions

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with clean commits
3. Add/update tests
4. Update documentation
5. Create pull request with detailed description
6. Request review from 2+ maintainers
7. Address feedback
8. Merge after approval

### Issue Reporting

Include:
- Clear description of issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable
- System information

---

## 📞 Support & Resources

### Documentation
- [Backend Docs](./backend/docs/) - Comprehensive backend documentation
- [Smart Contract Specs](./CITADEL_ROUND3_TECHNICAL_DOCS.md) - DeFi extension specs
- [API Reference](./backend/docs/04-API-Specification.md) - REST API docs

### External Resources
- [Algorand Developer Docs](https://developer.algorand.org/)
- [AlgoKit CLI Documentation](https://github.com/algorandfoundation/algokit-cli)
- [AlgoSDK JavaScript](https://github.com/algorandfoundation/js-algorand-sdk)
- [Razorpay API Docs](https://razorpay.com/docs/)

### Community
- GitHub Issues: Report bugs and feature requests
- Discussions: Technical questions and feedback

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 👥 Team

**Citadel** is built by a dedicated team focused on financial inclusion through blockchain technology.

- **Vision:** Transforming informal work into formal economic opportunity
- **Focus:** Web3 + Web2 bridge for emerging economies
- **Goal:** Enable 10M+ workers with verifiable financial identity

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | May 2026 | InvoiceGuard RWA tokenization, enhanced credit oracle |
| 1.1.0 | April 2026 | MicroLend pool, credit scoring system |
| 1.0.0 | March 2026 | Initial WorkProof contract, payment processing |

---

**Last Updated:** May 20, 2026  
**Status:** Production Ready ✅  
**Maintainers:** WorkProof Team
