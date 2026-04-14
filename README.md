# Citadel by WorkProof

Citadel is a blockchain-enabled work escrow and payout platform designed to convert verified work into trusted financial reputation.

The platform helps contractors, supervisors, workers, and institutions collaborate with transparent milestone workflows, escrow-backed commitments, payout proofs, compliance controls, and institution-grade underwriting signals.

## Live Deployment

- Frontend (Vercel): https://frontend-six-livid-85.vercel.app
- Backend API: Set `VITE_BACKEND_URL` in Vercel to your deployed backend domain.

## Why Citadel

Gig and informal workers often face three problems:

- Delayed or disputed payments
- No portable, verifiable proof of performance
- Weak credit access due to fragmented work records

Citadel addresses this by combining:

- Escrow-backed milestone workflows
- Wallet-linked worker identity
- INR-oriented payout outcomes
- Verifiable receipts and work credentials
- Consent-based compliance and auditability
- Institution-ready trust and credit indicators

## Core Modules

### 1. Contractor

- Create work contracts
- Add worker and supervisor wallet addresses
- Define milestone-level deliverables and value
- Fund escrow workflow

### 2. Supervisor

- Review milestone completion
- Approve disbursal step-by-step
- Trigger payout state transitions

### 3. Worker

- Register payout details (UPI/bank)
- Receive payout outcomes tied to approved milestones
- Download receipts and certificates
- Build on-chain work reputation

### 4. Institution

- Lookup worker wallet profile
- View verified work history and trust signals
- Evaluate credit support decisions using backend scoring and consent logic

### 5. Compliance

- Consent grant/revoke model
- Purpose-limited data access
- Audit trail for institution access workflows

## End-to-End Workflow

1. Worker registers payout details and maps practical payout identity to wallet-linked profile.
2. Contractor creates contract with worker and supervisor wallet addresses and milestone plan.
3. Escrow flow is funded and milestone state machine becomes active.
4. Supervisor verifies and approves milestones.
5. Payout workflow executes for approved milestones.
6. Receipts and credentials are generated for proof and portability.
7. Institutions consume verified, consent-governed data for underwriting support.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: SQLite (current workspace default)
- Blockchain: Algorand (TestNet development focus)
- Payment Integration: Razorpay integration paths with demo-safe simulation mode where applicable
- PDF/Proof Artifacts: backend-generated document workflows

## Project Structure

- frontend - User interfaces for Contractor, Supervisor, Worker, Institution, Compliance
- backend - APIs, business workflows, integrations, receipts, scoring, consent routes
- projects / sdk / certificates - supporting components and generated assets

## Run Locally

### Prerequisites

- Node.js 18+
- npm

### Backend

1. cd backend
2. npm install
3. npm run dev

### Frontend

1. cd frontend
2. npm install
3. npm run dev

Set environment variables as needed, including backend URL and payment/network configuration.

## Demo Notes

- Some financial rails may run in simulation/demo-safe mode depending on environment configuration.
- Always present simulation vs live behavior transparently during demos.
- Core workflow orchestration, state transitions, proofs, and data pipelines remain functional.

## Current Goal

Build worker-trusted, contractor-safe, compliance-aware, institution-readable financial infrastructure where verified work can become a credible financial passport.

## License

MIT
