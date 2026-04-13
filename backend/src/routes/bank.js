const express = require('express');
const router = express.Router();
const { isValidAlgorandAddress } = require('../utils/validators');
const FinancialCreditService = require('../services/aiCreditService');
const { Certificate } = require('../models/Certificate');
const { Contract } = require('../models/Contract');
const { ConsentLog } = require('../models/ConsentLog');
const { WorkerBankDetail } = require('../models/WorkerBankDetail');

/**
 * Bank Portal API Routes
 * Provides data for the Bank Portal demo component
 */

/**
 * GET /api/bank/worker-profile/:address
 * Get comprehensive worker profile for bank loan review
 */
router.get('/worker-profile/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { institutionAddress, scopeType = 'loan_assessment' } = req.query;
    
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }
    
    if (institutionAddress && !isValidAlgorandAddress(institutionAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid institution address format'
      });
    }

    // Get credit score
    const creditScore = await FinancialCreditService.calculateCreditScore(address);
    
    // Get all contracts
    const contracts = await Contract.findByWorker(address);

    // Get worker profile details if registered
    const bankDetails = await WorkerBankDetail.findByWorker(address);
    
    // Get certificates
    const certificates = await Certificate.findByWorker(address);
    
    // Get consent status (real active consent verification)
    let hasActiveConsent = false;
    let consentDetails = null;
    if (institutionAddress) {
      const consentCheck = await ConsentLog.verifyActive(address, institutionAddress, scopeType);
      hasActiveConsent = !!consentCheck?.hasConsent;
      consentDetails = consentCheck?.consent || null;
    } else {
      const institutions = await ConsentLog.getInstitutions(address);
      hasActiveConsent = (institutions || []).length > 0;
    }
    
    // Build comprehensive profile
    const profile = {
      worker: {
        address: address,
        name: bankDetails?.account_holder_name || `Worker-${address.substring(0, 8)}`,
        phone: null,
        role: contracts.filter(c => c.status === 'active').length > 0 ? 'Active Gig Worker' : 'Gig Worker',
        platform: 'WorkProof'
      },
      credit: {
        score: creditScore.score,
        maxScore: 100,
        riskCategory: creditScore.riskCategory,
        riskColor: creditScore.riskColor,
        eligible: creditScore.score >= 40,
        maxLoanAmount: creditScore.loanEligibility.maxAmount,
        interestRate: creditScore.loanEligibility.interestRate,
        tenure: creditScore.loanEligibility.tenure,
        emi: creditScore.loanEligibility.emi
      },
      workHistory: {
        totalContracts: contracts.length,
        completedContracts: contracts.filter(c => c.status === 'completed').length,
        activeContracts: contracts.filter(c => c.status === 'active').length,
        totalEarnings: contracts.reduce((sum, c) => sum + (c.total_escrow || 0), 0),
        averageContractValue: contracts.length > 0 
          ? Math.round(contracts.reduce((sum, c) => sum + (c.total_escrow || 0), 0) / contracts.length)
          : 0,
        platformJoinDate: contracts.length > 0 
          ? new Date(Math.min(...contracts.map(c => new Date(c.deployed_at).getTime()))).toISOString()
          : null,
        onTimeCompletionRate: creditScore.factors?.onTimeCompletionRate?.value || '0%',
        paymentReliability: creditScore.factors?.paymentReliability?.value || '0%'
      },
      credentials: {
        totalCertificates: certificates.length,
        certificates: certificates.slice(0, 5).map(cert => ({
          contractId: cert.contract_id,
          milestoneIndex: cert.milestone_index,
          issuedAt: cert.generated_at,
          assetId: cert.asset_id,
          txid: cert.txid
        }))
      },
      consent: {
        dpdpCompliant: hasActiveConsent,
        consentGranted: hasActiveConsent,
        verifiedForInstitution: !!institutionAddress,
        institutionAddress: institutionAddress || null,
        scopeType,
        consentId: consentDetails?.consentId || null,
        lastConsentDate: consentDetails?.grantedAt || null,
        expiry: consentDetails?.expiry || null
      },
      verification: {
        workproofVerified: true,
        blockchainVerified: contracts.length > 0,
        identityVerified: creditScore.score > 0,
        kycStatus: creditScore.score > 60 ? 'Verified' : 'Pending'
      }
    };
    
    res.json({
      success: true,
      data: profile
    });
    
  } catch (error) {
    console.error('Get bank worker profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bank/workers
 * Get list of workers with credit scores (for bank dashboard)
 */
router.get('/workers', async (req, res) => {
  try {
    const { minScore = 0, maxScore = 100, riskCategory, limit = 50 } = req.query;
    
    // Get all workers with contracts
    const query = `
      SELECT DISTINCT c.worker_address,
             COUNT(c.id) as contract_count,
             SUM(c.total_escrow) as total_earnings
      FROM contracts c
      GROUP BY c.worker_address
      HAVING contract_count > 0
      LIMIT ?
    `;
    
    const workers = await require('../config/database').all(query, [parseInt(limit)]);
    
    // Get credit score for each worker
    const workersWithScores = await Promise.all(
      workers.map(async (worker) => {
        const creditScore = await FinancialCreditService.calculateCreditScore(worker.worker_address);
        return {
          address: worker.worker_address,
          contracts: worker.contract_count,
          earnings: worker.total_earnings,
          creditScore: creditScore.score,
          riskCategory: creditScore.riskCategory,
          eligible: creditScore.score >= 40,
          maxLoanAmount: creditScore.loanEligibility.maxAmount,
          interestRate: creditScore.loanEligibility.interestRate
        };
      })
    );
    
    // Filter by score range
    const filtered = workersWithScores.filter(w => {
      const scoreMatch = w.creditScore >= parseInt(minScore) && w.creditScore <= parseInt(maxScore);
      const riskMatch = !riskCategory || w.riskCategory.toLowerCase().includes(riskCategory.toLowerCase());
      return scoreMatch && riskMatch;
    });
    
    res.json({
      success: true,
      data: {
        count: filtered.length,
        total: workersWithScores.length,
        workers: filtered.sort((a, b) => b.creditScore - a.creditScore)
      }
    });
    
  } catch (error) {
    console.error('Get bank workers list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bank/stats
 * Get aggregate statistics for bank dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const db = require('../config/database');
    
    // Get all contracts
    const totalContracts = await db.get('SELECT COUNT(*) as count FROM contracts');
    const totalWorkers = await db.get('SELECT COUNT(DISTINCT worker_address) as count FROM contracts');
    const totalValue = await db.get('SELECT SUM(total_escrow) as value FROM contracts');
    
    // Get credit score distribution
    const scoreDistribution = await db.all(`
      SELECT 
        CASE 
          WHEN score_value >= 80 THEN 'Excellent (80-100)'
          WHEN score_value >= 60 THEN 'Good (60-79)'
          WHEN score_value >= 40 THEN 'Fair (40-59)'
          ELSE 'Poor (0-39)'
        END as category,
        COUNT(*) as count
      FROM credit_scores
      GROUP BY category
    `);
    
    // Get top workers
    const topWorkers = await FinancialCreditService.getTopPerformers(5);
    
    // Calculate total potential loan book
    const eligibleWorkers = await db.get(`
      SELECT SUM(max_loan_amount) as total
      FROM credit_scores
      WHERE score_value >= 40
    `);
    
    res.json({
      success: true,
      data: {
        platform: {
          totalContracts: totalContracts?.count || 0,
          totalWorkers: totalWorkers?.count || 0,
          totalValueLocked: totalValue?.value || 0,
          averageContractValue: totalContracts?.count > 0 
            ? Math.round((totalValue?.value || 0) / totalContracts.count)
            : 0
        },
        creditDistribution: scoreDistribution,
        loanPotential: {
          eligibleWorkers: topWorkers.length,
          totalLoanCapacity: eligibleWorkers?.total || 0,
          averageLoanSize: topWorkers.length > 0 
            ? Math.round((eligibleWorkers?.total || 0) / topWorkers.length)
            : 0
        },
        topPerformers: topWorkers
      }
    });
    
  } catch (error) {
    console.error('Get bank stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bank/simulate-loan-approval
 * Simulate loan approval for demo purposes
 */
router.post('/simulate-loan-approval', async (req, res) => {
  try {
    const {
      workerAddress,
      loanAmount,
      tenure,
      institutionAddress,
      scopeType = 'loan_assessment'
    } = req.body;
    
    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address'
      });
    }

    if (institutionAddress && !isValidAlgorandAddress(institutionAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid institution address'
      });
    }

    // Real compliance check for institutions
    if (institutionAddress) {
      const consentCheck = await ConsentLog.verifyActive(workerAddress, institutionAddress, scopeType);
      if (!consentCheck.hasConsent) {
        return res.status(403).json({
          success: false,
          error: 'No active consent found for this institution and scope',
          code: 'CONSENT_REQUIRED',
          data: {
            workerAddress,
            institutionAddress,
            scopeType
          }
        });
      }
    }
    
    // Get credit score
    const creditScore = await FinancialCreditService.calculateCreditScore(workerAddress);
    
    // Validate loan request
    if (creditScore.score < 40) {
      return res.json({
        success: true,
        approved: false,
        reason: 'Credit score below minimum threshold (40)',
        creditScore: creditScore.score
      });
    }
    
    if (loanAmount > creditScore.loanEligibility.maxAmount) {
      return res.json({
        success: true,
        approved: false,
        reason: `Loan amount exceeds eligible limit of ₹${creditScore.loanEligibility.maxAmount}`,
        creditScore: creditScore.score,
        maxEligible: creditScore.loanEligibility.maxAmount
      });
    }
    
    // Calculate EMI
    const principal = parseInt(loanAmount);
    const rate = creditScore.loanEligibility.interestRate / 12 / 100;
    const months = parseInt(tenure) || creditScore.loanEligibility.tenure;
    const emi = Math.round(
      (principal * rate * Math.pow(1 + rate, months)) / 
      (Math.pow(1 + rate, months) - 1)
    );
    
    // Generate mock loan ID
    const loanId = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    res.json({
      success: true,
      approved: true,
      loan: {
        loanId,
        workerAddress,
        amount: principal,
        interestRate: creditScore.loanEligibility.interestRate,
        tenure: months,
        emi: emi || Math.round(principal / months),
        totalRepayment: (emi || Math.round(principal / months)) * months,
        creditScore: creditScore.score,
        riskCategory: creditScore.riskCategory,
        approvedAt: new Date().toISOString(),
        institutionAddress: institutionAddress || null,
        scopeType,
        decisionSource: 'REAL_CREDIT_SCORE_AND_CONSENT'
      }
    });
    
  } catch (error) {
    console.error('Simulate loan approval error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bank/loan-decision
 * Consent-aware underwriting endpoint (production-style alias)
 */
router.post('/loan-decision', async (req, res) => {
  try {
    const {
      workerAddress,
      loanAmount,
      tenure,
      institutionAddress,
      scopeType = 'loan_assessment'
    } = req.body;

    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address'
      });
    }

    if (institutionAddress && !isValidAlgorandAddress(institutionAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid institution address'
      });
    }

    if (institutionAddress) {
      const consentCheck = await ConsentLog.verifyActive(workerAddress, institutionAddress, scopeType);
      if (!consentCheck.hasConsent) {
        return res.status(403).json({
          success: false,
          error: 'No active consent found for this institution and scope',
          code: 'CONSENT_REQUIRED',
          data: {
            workerAddress,
            institutionAddress,
            scopeType
          }
        });
      }
    }

    const creditScore = await FinancialCreditService.calculateCreditScore(workerAddress);

    if (creditScore.score < 40) {
      return res.json({
        success: true,
        approved: false,
        reason: 'Credit score below minimum threshold (40)',
        creditScore: creditScore.score
      });
    }

    if (loanAmount > creditScore.loanEligibility.maxAmount) {
      return res.json({
        success: true,
        approved: false,
        reason: `Loan amount exceeds eligible limit of ₹${creditScore.loanEligibility.maxAmount}`,
        creditScore: creditScore.score,
        maxEligible: creditScore.loanEligibility.maxAmount
      });
    }

    const principal = parseInt(loanAmount);
    const rate = creditScore.loanEligibility.interestRate / 12 / 100;
    const months = parseInt(tenure) || creditScore.loanEligibility.tenure;
    const emi = Math.round(
      (principal * rate * Math.pow(1 + rate, months)) /
      (Math.pow(1 + rate, months) - 1)
    );

    const loanId = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    return res.json({
      success: true,
      approved: true,
      loan: {
        loanId,
        workerAddress,
        amount: principal,
        interestRate: creditScore.loanEligibility.interestRate,
        tenure: months,
        emi: emi || Math.round(principal / months),
        totalRepayment: (emi || Math.round(principal / months)) * months,
        creditScore: creditScore.score,
        riskCategory: creditScore.riskCategory,
        approvedAt: new Date().toISOString(),
        institutionAddress: institutionAddress || null,
        scopeType,
        decisionSource: 'REAL_CREDIT_SCORE_AND_CONSENT'
      }
    });
  } catch (error) {
    console.error('Loan decision error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
