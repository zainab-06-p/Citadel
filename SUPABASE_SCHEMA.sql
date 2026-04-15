-- WorkProof Gig Worker Platform - Supabase SQL Schema
-- PostgreSQL for Supabase
-- Focus: Future of Finance track - Work credentials as financial passport

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Workers table (Gig workers - Swiggy, Zomato, Ola, Uber)
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorand_address TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    full_name TEXT,
    platform_type TEXT CHECK (platform_type IN ('swiggy', 'zomato', 'ola', 'uber', 'other')),
    platform_id TEXT,
    city TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_verified_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Employers/Platforms table (Gig platforms, restaurants, fleet operators)
CREATE TABLE employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorand_address TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    business_type TEXT CHECK (business_type IN ('gig_platform', 'restaurant', 'fleet_operator', 'contractor')),
    email TEXT UNIQUE,
    phone TEXT,
    gst_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reputation_score INTEGER DEFAULT 0 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    total_contracts_created INTEGER DEFAULT 0,
    payment_reliability REAL DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- PAYMENT & CONTRACT TABLES
-- ============================================================

-- Razorpay payments tracking
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_order_id TEXT UNIQUE NOT NULL,
    razorpay_payment_id TEXT UNIQUE,
    employer_id UUID REFERENCES employers(id),
    amount_inr INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    captured_at TIMESTAMPTZ,
    failure_reason TEXT
);

-- Smart contracts on Algorand
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id BIGINT UNIQUE,
    employer_id UUID REFERENCES employers(id),
    worker_id UUID REFERENCES workers(id),
    payment_id UUID REFERENCES payments(id),
    total_escrow INTEGER NOT NULL,
    milestone_count INTEGER NOT NULL,
    platform_type TEXT DEFAULT 'gig',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'disputed', 'cancelled')),
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    contract_type TEXT DEFAULT 'gig' CHECK (contract_type IN ('gig', 'delivery', 'ride', 'task')),
    metadata JSONB
);

-- Milestones for each contract
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    milestone_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount_inr INTEGER NOT NULL,
    delivery_count INTEGER, -- For delivery-based milestones (e.g., 100 deliveries)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'paid')),
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    algorand_txid TEXT,
    asset_id BIGINT,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    UNIQUE(contract_id, milestone_index)
);

-- ============================================================
-- CREDENTIALS TABLE
-- ============================================================

-- Certificates/NFTs for completed milestones
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id),
    milestone_id UUID REFERENCES milestones(id),
    worker_id UUID REFERENCES workers(id),
    asset_id BIGINT,
    algorand_txid TEXT,
    ipfs_hash TEXT,
    pdf_url TEXT,
    metadata JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCIAL CREDIT SCORING (Future of Finance Core)
-- ============================================================

-- Credit scores table - Financial passport for workers
CREATE TABLE credit_scores (
    worker_id UUID PRIMARY KEY REFERENCES workers(id),
    score_value INTEGER NOT NULL CHECK (score_value >= 0 AND score_value <= 100),
    risk_category TEXT NOT NULL CHECK (risk_category IN ('Excellent', 'Good', 'Fair', 'Poor', 'No History')),
    factors_json JSONB NOT NULL,
    
    -- Loan eligibility (calculated from score)
    max_loan_amount_inr INTEGER DEFAULT 0,
    interest_rate REAL DEFAULT 0,
    tenure_months INTEGER DEFAULT 0,
    emi_inr INTEGER DEFAULT 0,
    
    -- Financial metrics
    total_earnings_lifetime INTEGER DEFAULT 0,
    total_contracts_completed INTEGER DEFAULT 0,
    avg_monthly_income INTEGER DEFAULT 0,
    payment_reliability_percent INTEGER DEFAULT 0,
    on_time_completion_percent INTEGER DEFAULT 0,
    
    -- Scoring metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    refresh_at TIMESTAMPTZ NOT NULL,
    
    -- Version control
    score_version INTEGER DEFAULT 1
);

-- Credit score history (for tracking improvement)
CREATE TABLE credit_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES workers(id),
    score_value INTEGER NOT NULL,
    risk_category TEXT NOT NULL,
    change_reason TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BANK & NBFC INTEGRATION (Future of Finance)
-- ============================================================

-- Loan applications from banks/NBFCs
CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES workers(id),
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    
    -- Loan details
    requested_amount_inr INTEGER NOT NULL,
    approved_amount_inr INTEGER,
    interest_rate REAL,
    tenure_months INTEGER,
    emi_inr INTEGER,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'closed')),
    
    -- WorkProof verification data
    credit_score_at_application INTEGER,
    total_earnings_verified INTEGER,
    total_contracts_verified INTEGER,
    
    -- Bank officer info
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Timestamps
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ
);

-- Bank/NBFC partners
CREATE TABLE bank_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    type TEXT CHECK (type IN ('bank', 'nbfc', 'fintech')),
    
    -- API integration
    api_endpoint TEXT,
    api_key_encrypted TEXT,
    webhook_url TEXT,
    
    -- Lending criteria
    min_credit_score INTEGER DEFAULT 40,
    max_loan_amount_inr INTEGER DEFAULT 100000,
    interest_rate_range JSONB, -- {min: 12, max: 24}
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSENT MANAGEMENT (DPDP Compliance)
-- ============================================================

-- Consent logs for data sharing
CREATE TABLE consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES workers(id),
    institution_id UUID REFERENCES bank_partners(id),
    institution_name TEXT,
    
    -- Consent scope
    purpose TEXT NOT NULL,
    scope_fields JSONB, -- ['credit_score', 'earnings', 'contracts']
    expiry_date DATE,
    
    -- Status
    granted BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    -- Blockchain proof
    algorand_txid TEXT,
    consent_id_on_chain BIGINT,
    
    -- IP for audit
    ip_address TEXT,
    user_agent TEXT
);

-- ============================================================
-- BLOCKCHAIN WATCHER
-- ============================================================

-- Watch cursor for polling Algorand
CREATE TABLE watch_cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_round BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker payout details (UPI/bank) used for INR disbursement routing
CREATE TABLE worker_bank_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_address TEXT UNIQUE NOT NULL,
    upi_id TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    account_holder_name TEXT,
    payment_mode TEXT DEFAULT 'UPI' CHECK (payment_mode IN ('UPI', 'IMPS', 'NEFT')),
    fund_account_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_worker_bank_details_address ON worker_bank_details(worker_address);

-- Blockchain transaction log
CREATE TABLE blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    txid TEXT UNIQUE NOT NULL,
    contract_id UUID REFERENCES contracts(id),
    milestone_id UUID REFERENCES milestones(id),
    tx_type TEXT CHECK (tx_type IN ('contract_creation', 'milestone_approval', 'payment_release', 'nft_mint')),
    round BIGINT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDICES & OPTIMIZATIONS
-- ============================================================

-- Worker indices
CREATE INDEX idx_workers_platform ON workers(platform_type);
CREATE INDEX idx_workers_city ON workers(city);
CREATE INDEX idx_workers_kyc ON workers(kyc_status);

-- Payment indices
CREATE INDEX idx_payments_employer ON payments(employer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- Contract indices
CREATE INDEX idx_contracts_employer ON contracts(employer_id);
CREATE INDEX idx_contracts_worker ON contracts(worker_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- Milestone indices
CREATE INDEX idx_milestones_contract ON milestones(contract_id);
CREATE INDEX idx_milestones_status ON milestones(status);

-- Credit score indices
CREATE INDEX idx_credit_scores_value ON credit_scores(score_value);
CREATE INDEX idx_credit_scores_risk ON credit_scores(risk_category);

-- Consent indices
CREATE INDEX idx_consent_worker ON consent_logs(worker_id);
CREATE INDEX idx_consent_institution ON consent_logs(institution_id);
CREATE INDEX idx_consent_active ON consent_logs(worker_id, institution_id) WHERE granted = TRUE AND revoked_at IS NULL;

-- Loan application indices
CREATE INDEX idx_loans_worker ON loan_applications(worker_id);
CREATE INDEX idx_loans_status ON loan_applications(status);
CREATE INDEX idx_loans_bank ON loan_applications(bank_name);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Workers can view their own data
CREATE POLICY workers_own_data ON workers
    FOR SELECT USING (auth.uid()::text = algorand_address);

-- Workers can view their own credit score
CREATE POLICY credit_scores_own ON credit_scores
    FOR SELECT USING (worker_id IN (SELECT id FROM workers WHERE algorand_address = auth.uid()::text));

-- Workers can view their own loans
CREATE POLICY loans_own ON loan_applications
    FOR SELECT USING (worker_id IN (SELECT id FROM workers WHERE algorand_address = auth.uid()::text));

-- Workers can view their own consent logs
CREATE POLICY consent_own ON consent_logs
    FOR SELECT USING (worker_id IN (SELECT id FROM workers WHERE algorand_address = auth.uid()::text));

-- Employers can view their own data
CREATE POLICY employers_own_data ON employers
    FOR SELECT USING (auth.uid()::text = algorand_address);

-- Employers can view contracts they created
CREATE POLICY contracts_employer ON contracts
    FOR SELECT USING (employer_id IN (SELECT id FROM employers WHERE algorand_address = auth.uid()::text));

-- Public read access for some tables (for bank verification)
CREATE POLICY credit_scores_public_read ON credit_scores
    FOR SELECT USING (true); -- Banks need to verify scores

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate credit score on contract completion
CREATE OR REPLACE FUNCTION trigger_credit_score_calculation()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into queue for async processing
    -- Actual calculation done by backend service
    INSERT INTO credit_score_history (worker_id, score_value, risk_category, change_reason)
    VALUES (
        NEW.worker_id,
        (SELECT score_value FROM credit_scores WHERE worker_id = NEW.worker_id),
        (SELECT risk_category FROM credit_scores WHERE worker_id = NEW.worker_id),
        'Contract ' || NEW.status
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_score_on_contract_complete
    AFTER UPDATE OF status ON contracts
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION trigger_credit_score_calculation();

-- ============================================================
-- VIEWS FOR ANALYTICS
-- ============================================================

-- Worker performance summary
CREATE VIEW worker_performance_summary AS
SELECT 
    w.id,
    w.algorand_address,
    w.full_name,
    w.platform_type,
    COUNT(c.id) as total_contracts,
    SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_contracts,
    COALESCE(cs.score_value, 0) as credit_score,
    COALESCE(cs.risk_category, 'No History') as risk_category,
    COALESCE(cs.max_loan_amount_inr, 0) as max_loan_eligible
FROM workers w
LEFT JOIN contracts c ON c.worker_id = w.id
LEFT JOIN credit_scores cs ON cs.worker_id = w.id
WHERE w.is_active = TRUE
GROUP BY w.id, w.algorand_address, w.full_name, w.platform_type, cs.score_value, cs.risk_category, cs.max_loan_amount_inr;

-- Platform earnings summary
CREATE VIEW platform_earnings_summary AS
SELECT 
    platform_type,
    COUNT(*) as total_workers,
    SUM(cs.total_earnings_lifetime) as total_lifetime_earnings,
    AVG(cs.score_value) as avg_credit_score,
    SUM(CASE WHEN cs.score_value >= 60 THEN 1 ELSE 0 END) as creditworthy_workers
FROM workers w
LEFT JOIN credit_scores cs ON cs.worker_id = w.id
WHERE w.is_active = TRUE
GROUP BY platform_type;

-- Bank-ready workers (eligible for loans)
CREATE VIEW bank_eligible_workers AS
SELECT 
    w.*,
    cs.score_value,
    cs.risk_category,
    cs.max_loan_amount_inr,
    cs.interest_rate,
    cs.tenure_months,
    cs.emi_inr,
    cs.total_contracts_completed,
    cs.payment_reliability_percent
FROM workers w
JOIN credit_scores cs ON cs.worker_id = w.id
WHERE cs.score_value >= 40
  AND w.kyc_status = 'verified'
  AND w.is_active = TRUE;

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================

-- Insert sample worker
INSERT INTO workers (algorand_address, phone, full_name, platform_type, city, kyc_status)
VALUES 
    ('0x1234567890abcdef', '+91-98765-43210', 'Ramesh Kumar', 'swiggy', 'Bangalore', 'verified'),
    ('0xabcdef1234567890', '+91-98765-43211', 'Suresh Patel', 'zomato', 'Mumbai', 'verified'),
    ('0x7890abcdef123456', '+91-98765-43212', 'Mahesh Singh', 'ola', 'Delhi', 'verified');

-- Insert sample employer
INSERT INTO employers (algorand_address, business_name, business_type, is_verified)
VALUES 
    ('0xfedcba0987654321', 'Swiggy Bangalore Hub', 'gig_platform', TRUE),
    ('0x6543210fedcba098', 'Zomato Mumbai Fleet', 'gig_platform', TRUE);

-- Insert sample bank partner
INSERT INTO bank_partners (name, code, type, min_credit_score, max_loan_amount_inr, interest_rate_range)
VALUES 
    ('Rural Finance Bank', 'RFB', 'bank', 40, 100000, '{"min": 12, "max": 18}'),
    ('MicroCredit NBFC Ltd', 'MCN', 'nbfc', 50, 50000, '{"min": 15, "max": 22}');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
