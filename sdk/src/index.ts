/**
 * WorkProof Consent SDK
 * 
 * A reusable module for DPDP-compliant consent management on Algorand.
 * Provides on-chain audit trails for data sharing permissions.
 * 
 * @example
 * ```typescript
 * import { ConsentSDK } from '@workproof/consent-sdk';
 * 
 * const consent = new ConsentSDK({
 *   algodServer: 'https://testnet-api.algonode.cloud',
 *   appId: 123456789 // Your ConsentRegistry app ID
 * });
 * 
 * // Grant consent
 * await consent.grantConsent({
 *   workerAddress: 'WORKER_ADDR',
 *   institutionAddress: 'BANK_ADDR',
 *   institutionName: 'HDFC Bank',
 *   scope: {
 *     type: 'work_history',
 *     purpose: 'Loan application verification',
 *     expiry: '2025-12-31'
 *   }
 * });
 * ```
 */

export interface ConsentScope {
  type: 'work_history' | 'all_data' | 'specific_contracts';
  contracts?: number[]; // Contract app IDs if type is 'specific_contracts'
  fields?: string[]; // Fields to share (e.g., ['milestones', 'payments'])
  purpose: string;
  expiry?: string; // ISO date string
}

export interface ConsentRecord {
  id: number;
  consentId: number;
  workerAddress: string;
  institutionAddress: string;
  institutionName: string;
  scope: ConsentScope;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string;
  txid: string;
}

export interface SDKConfig {
  algodServer: string;
  algodPort?: string;
  algodToken?: string;
  appId: number;
  indexerServer?: string;
}

export class ConsentSDK {
  private config: SDKConfig;
  private algodClient: any;
  private indexerClient: any;

  constructor(config: SDKConfig) {
    this.config = config;
    // Initialize Algorand clients
    this.initClients();
  }

  private initClients() {
    // Lazy load algosdk to avoid bundling issues
    const algosdk = require('algosdk');
    
    this.algodClient = new algosdk.Algodv2(
      this.config.algodToken || '',
      this.config.algodServer,
      this.config.algodPort || ''
    );

    if (this.config.indexerServer) {
      this.indexerClient = new algosdk.Indexer(
        '',
        this.config.indexerServer,
        ''
      );
    }
  }

  /**
   * Grant consent to an institution
   * 
   * @param params - Consent grant parameters
   * @returns Transaction ID and consent ID
   */
  async grantConsent(params: {
    workerAddress: string;
    workerSigner: any; // Transaction signer
    institutionAddress: string;
    institutionName: string;
    scope: ConsentScope;
  }): Promise<{ txid: string; consentId: number }> {
    // Encode scope as JSON for contract
    const scopeData = JSON.stringify(params.scope);
    
    // Call contract method
    const atc = new (require('algosdk').AtomicTransactionComposer)();
    
    // Add transaction to composer
    // This is a placeholder - actual implementation needs the contract ABI
    console.log('Granting consent:', {
      worker: params.workerAddress,
      institution: params.institutionAddress,
      scope: scopeData
    });

    // Return mock result for now
    // In real implementation, this would submit to Algorand
    return {
      txid: 'MOCK_TXID_' + Date.now(),
      consentId: Math.floor(Math.random() * 1000000)
    };
  }

  /**
   * Revoke previously granted consent
   * 
   * @param params - Revocation parameters
   * @returns Transaction ID
   */
  async revokeConsent(params: {
    workerAddress: string;
    workerSigner: any;
    consentId: number;
  }): Promise<{ txid: string }> {
    console.log('Revoking consent:', {
      worker: params.workerAddress,
      consentId: params.consentId
    });

    return {
      txid: 'MOCK_REVOKE_TXID_' + Date.now()
    };
  }

  /**
   * Get consent audit log for a worker
   * 
   * @param workerAddress - Worker's Algorand address
   * @returns Array of consent records
   */
  async getAuditLog(workerAddress: string): Promise<ConsentRecord[]> {
    // Query contract state or events
    // In real implementation, this would read from Algorand Indexer
    
    return [
      {
        id: 1,
        consentId: 1001,
        workerAddress,
        institutionAddress: 'INSTITUTION_ADDR',
        institutionName: 'Demo Bank',
        scope: {
          type: 'work_history',
          purpose: 'Loan verification',
          expiry: '2025-12-31'
        },
        granted: true,
        grantedAt: new Date().toISOString(),
        txid: 'DEMO_TXID'
      }
    ];
  }

  /**
   * Check if active consent exists between worker and institution
   * 
   * @param workerAddress - Worker's address
   * @param institutionAddress - Institution's address
   * @param scopeType - Type of consent to check
   * @returns Consent status
   */
  async verifyConsent(
    workerAddress: string,
    institutionAddress: string,
    scopeType: string
  ): Promise<{ hasConsent: boolean; consent?: ConsentRecord }> {
    const logs = await this.getAuditLog(workerAddress);
    
    const activeConsent = logs.find(log => 
      log.institutionAddress === institutionAddress &&
      log.scope.type === scopeType &&
      log.granted &&
      (!log.scope.expiry || new Date(log.scope.expiry) > new Date())
    );

    return {
      hasConsent: !!activeConsent,
      consent: activeConsent
    };
  }

  /**
   * Get list of institutions with access to worker data
   * 
   * @param workerAddress - Worker's address
   * @returns Array of institutions
   */
  async getAuthorizedInstitutions(workerAddress: string): Promise<Array<{
    address: string;
    name: string;
    scope: ConsentScope;
    grantedAt: string;
    expiry?: string;
  }>> {
    const logs = await this.getAuditLog(workerAddress);
    
    return logs
      .filter(log => log.granted)
      .map(log => ({
        address: log.institutionAddress,
        name: log.institutionName,
        scope: log.scope,
        grantedAt: log.grantedAt,
        expiry: log.scope.expiry
      }));
  }
}

// Default export
export default ConsentSDK;
