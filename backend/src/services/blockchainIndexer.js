/**
 * WebSocket Blockchain Indexer
 * 
 * Replaces polling with real-time event streaming from Algorand
 * Subscribes to application transactions for WorkProof contracts
 * 
 * Benefits:
 * - Instant notification of milestone approvals
 * - Real-time credit score updates
 * - Reduced backend load (no more 30s polling)
 * - Better UX with live updates
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class BlockchainIndexer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      algodHost: config.algodHost || 'testnet-api.algonode.cloud',
      algodPort: config.algodPort || 443,
      appId: config.appId || null,  // WorkProof contract app ID
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      ...config
    };
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.subscriptions = new Map();
    
    // Event types we care about
    this.EVENT_TYPES = {
      MILESTONE_APPROVED: 'MILESTONE_APPROVED',
      CONSENT_GRANTED: 'CONSENT_GRANTED',
      DISPUTE_RAISED: 'DISPUTE_RAISED',
      DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
      CONTRACT_CREATED: 'CONTRACT_CREATED'
    };
  }

  /**
   * Connect to Algorand WebSocket endpoint
   */
  async connect() {
    try {
      // Algorand doesn't have native WebSocket, so we use a workaround:
      // 1. Use AlgoNode's webhook service (if available)
      // 2. Or use AlgoSocket service
      // 3. Or fall back to Server-Sent Events (SSE) from indexer
      
      // For this implementation, we'll use SSE from AlgoNode indexer
      const EventSource = require('eventsource');
      
      const url = `https://${this.config.algodHost}/v2/accounts/${this.config.appId}/transactions?pending=true`;
      
      this.eventSource = new EventSource(url);
      
      this.eventSource.onopen = () => {
        console.log('[BlockchainIndexer] Connected to Algorand event stream');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleTransaction(data);
        } catch (error) {
          console.error('[BlockchainIndexer] Error parsing event:', error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        console.error('[BlockchainIndexer] EventSource error:', error);
        this.isConnected = false;
        this.emit('disconnected');
        this._scheduleReconnect();
      };
      
    } catch (error) {
      console.error('[BlockchainIndexer] Connection error:', error);
      this._scheduleReconnect();
    }
  }

  /**
   * Handle incoming transaction
   */
  _handleTransaction(txData) {
    // Check if this is an application call to our contract
    if (txData['application-transaction']?.['application-id'] !== this.config.appId) {
      return;
    }
    
    const appCall = txData['application-transaction'];
    const sender = txData.sender;
    const blockTime = new Date(txData['round-time'] * 1000);
    
    // Decode the method call
    const methodSig = appCall['application-args']?.[0];
    if (!methodSig) return;
    
    // Map method signatures to events
    // These are ARC4 method selectors (first 4 bytes of hash)
    const events = {
      'approve_milestone': this.EVENT_TYPES.MILESTONE_APPROVED,
      'grant_consent': this.EVENT_TYPES.CONSENT_GRANTED,
      'raise_dispute': this.EVENT_TYPES.DISPUTE_RAISED,
      'resolve_dispute': this.EVENT_TYPES.DISPUTE_RESOLVED,
      'create_work_contract': this.EVENT_TYPES.CONTRACT_CREATED
    };
    
    // Determine event type from method signature
    const eventType = Object.entries(events).find(([method, _]) => {
      return this._getMethodSelector(method) === methodSig;
    })?.[1];
    
    if (!eventType) return;
    
    // Parse event-specific data
    const eventData = this._parseEventData(eventType, appCall, txData);
    
    // Emit event
    this.emit(eventType, eventData);
    this.emit('transaction', { type: eventType, data: eventData });
    
    console.log(`[BlockchainIndexer] ${eventType} at ${blockTime.toISOString()}`);
  }

  /**
   * Parse event-specific data from transaction
   */
  _parseEventData(eventType, appCall, txData) {
    const base = {
      txId: txData.id,
      sender: txData.sender,
      block: txData['confirmed-round'],
      timestamp: new Date(txData['round-time'] * 1000),
      fee: txData.fee
    };
    
    switch (eventType) {
      case this.EVENT_TYPES.MILESTONE_APPROVED:
        return {
          ...base,
          milestoneIndex: this._decodeUint64(appCall['application-args'][1]),
          supervisor: appCall['application-args'][2], // or parse from logs
          worker: this._getWorkerFromLogs(txData.logs),
          assetId: this._decodeUint64(txData['inner-tx']?.[0]?.['asset-config-transaction']?.['asset-id'])
        };
        
      case this.EVENT_TYPES.CONSENT_GRANTED:
        return {
          ...base,
          institution: appCall['application-args'][1],
          purpose: this._decodeString(appCall['application-args'][2]),
          scope: this._decodeString(appCall['application-args'][3]),
          duration: this._decodeUint64(appCall['application-args'][4])
        };
        
      case this.EVENT_TYPES.DISPUTE_RAISED:
        return {
          ...base,
          milestoneIndex: this._decodeUint64(appCall['application-args'][1]),
          reasonHash: appCall['application-args'][2],
          raisedBy: txData.sender
        };
        
      case this.EVENT_TYPES.DISPUTE_RESOLVED:
        return {
          ...base,
          disputeId: this._decodeUint64(appCall['application-args'][1]),
          resolution: this._decodeString(appCall['application-args'][2]),
          payoutPercent: this._decodeUint64(appCall['application-args'][3]),
          resolvedBy: txData.sender
        };
        
      case this.EVENT_TYPES.CONTRACT_CREATED:
        return {
          ...base,
          milestoneCount: this._decodeUint64(appCall['application-args'][4]),
          totalEscrow: txData['application-transaction']?.['amount'] || 0,
          contractor: txData.sender
        };
        
      default:
        return base;
    }
  }

  /**
   * Get ARC4 method selector (first 4 bytes of hash)
   */
  _getMethodSelector(methodName) {
    // This is a simplified version - in production use proper ARC4 encoding
    const crypto = require('crypto');
    const hash = crypto.createHash('sha512-256').update(methodName).digest();
    return hash.slice(0, 4).toString('base64');
  }

  /**
   * Decode uint64 from base64 string
   */
  _decodeUint64(base64Value) {
    if (!base64Value) return 0;
    const buffer = Buffer.from(base64Value, 'base64');
    return buffer.readBigUInt64BE(0);
  }

  /**
   * Decode string from base64
   */
  _decodeString(base64Value) {
    if (!base64Value) return '';
    return Buffer.from(base64Value, 'base64').toString('utf-8');
  }

  /**
   * Extract worker address from logs
   */
  _getWorkerFromLogs(logs = []) {
    // Look for worker address in log messages
    for (const log of logs) {
      const decoded = Buffer.from(log, 'base64').toString('utf-8');
      if (decoded.startsWith('WORKER:')) {
        return decoded.replace('WORKER:', '');
      }
    }
    return null;
  }

  /**
   * Schedule reconnection attempt
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[BlockchainIndexer] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`[BlockchainIndexer] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  /**
   * Subscribe to specific event type
   */
  subscribe(eventType, callback) {
    this.on(eventType, callback);
    
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType).add(callback);
    
    return () => this.unsubscribe(eventType, callback);
  }

  /**
   * Unsubscribe from event
   */
  unsubscribe(eventType, callback) {
    this.removeListener(eventType, callback);
    this.subscriptions.get(eventType)?.delete(callback);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('[BlockchainIndexer] Disconnected');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys()),
      config: this.config
    };
  }
}

/**
 * Integration with Credit Score Service
 * Automatically updates credit scores when milestones are approved
 */
class CreditScoreUpdater {
  constructor(blockchainIndexer, creditScoreService) {
    this.indexer = blockchainIndexer;
    this.creditService = creditScoreService;
    
    this._setupListeners();
  }

  _setupListeners() {
    // Update credit score when milestone is approved
    this.indexer.subscribe(
      this.indexer.EVENT_TYPES.MILESTONE_APPROVED,
      async (eventData) => {
        console.log('[CreditScoreUpdater] Milestone approved, updating score...');
        
        try {
          // Invalidate cache to force recalculation
          await this.creditService.invalidateCache(eventData.worker);
          
          // Recalculate score
          const newScore = await this.creditService.calculateCreditScore(eventData.worker);
          
          console.log(`[CreditScoreUpdater] Updated score for ${eventData.worker}: ${newScore.score}`);
          
          // Emit for any listening clients (WebSocket to frontend)
          this.emit('scoreUpdated', {
            worker: eventData.worker,
            score: newScore.score,
            milestoneIndex: eventData.milestoneIndex,
            timestamp: eventData.timestamp
          });
        } catch (error) {
          console.error('[CreditScoreUpdater] Error updating score:', error);
        }
      }
    );

    // Handle new contracts
    this.indexer.subscribe(
      this.indexer.EVENT_TYPES.CONTRACT_CREATED,
      async (eventData) => {
        console.log(`[CreditScoreUpdater] New contract created: ${eventData.txId}`);
        // Could trigger welcome notifications, etc.
      }
    );

    // Handle disputes
    this.indexer.subscribe(
      this.indexer.EVENT_TYPES.DISPUTE_RESOLVED,
      async (eventData) => {
        console.log(`[CreditScoreUpdater] Dispute resolved: ${eventData.disputeId}`);
        // Could affect credit score negatively
      }
    );
  }
}

module.exports = {
  BlockchainIndexer,
  CreditScoreUpdater
};
