const db = require('../config/database');

const Contract = {
  /**
   * Create a new contract record
   */
  async create({ 
    appId, 
    contractorAddress, 
    supervisorAddress, 
    workerAddress, 
    milestoneCount, 
    totalEscrow,
    status = 'active' 
  }) {
    const result = await db.run(
      `INSERT INTO contracts (app_id, contractor_address, supervisor_address, worker_address, 
        milestone_count, total_escrow, status, deployed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appId, contractorAddress, supervisorAddress, workerAddress, 
       milestoneCount, totalEscrow, status, new Date().toISOString()]
    );
    
    return {
      id: result.lastID,
      appId,
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestoneCount,
      totalEscrow,
      status
    };
  },

  /**
   * Find contract by app ID
   */
  async findByAppId(appId) {
    return await db.get(
      'SELECT * FROM contracts WHERE app_id = ?',
      [appId]
    );
  },

  /**
   * Find contract by ID
   */
  async findById(id) {
    return await db.get(
      'SELECT * FROM contracts WHERE id = ?',
      [id]
    );
  },

  /**
   * Find contracts by worker address
   */
  async findByWorker(workerAddress) {
    return await db.all(
      'SELECT * FROM contracts WHERE worker_address = ? ORDER BY created_at DESC',
      [workerAddress]
    );
  },

  /**
   * Find contracts by contractor address
   */
  async findByContractor(contractorAddress) {
    return await db.all(
      'SELECT * FROM contracts WHERE contractor_address = ? ORDER BY created_at DESC',
      [contractorAddress]
    );
  },

  /**
   * Find contracts by supervisor address
   */
  async findBySupervisor(supervisorAddress) {
    return await db.all(
      'SELECT * FROM contracts WHERE supervisor_address = ? ORDER BY created_at DESC',
      [supervisorAddress]
    );
  },

  /**
   * Update contract status
   */
  async updateStatus(id, status) {
    await db.run(
      'UPDATE contracts SET status = ? WHERE id = ?',
      [status, id]
    );
    
    return { id, status };
  },

  /**
   * Get contract with milestones (SINGLE QUERY - OPTIMIZED)
   * Uses JOIN to fetch all data in one query, eliminating N+1 problem
   * @param {string} appId - Contract app ID
   * @returns {Promise<Object>} Contract with milestones array
   */
  async getWithMilestonesOptimized(appId) {
    const rows = await db.all(`
      SELECT 
        c.*,
        m.id as m_id,
        m.milestone_index,
        m.amount as m_amount,
        m.description as m_description,
        m.paid,
        m.txid,
        m.asset_id,
        m.paid_at,
        m.certificate_generated
      FROM contracts c
      LEFT JOIN milestones m ON m.contract_id = c.id
      WHERE c.app_id = ?
      ORDER BY m.milestone_index
    `, [appId]);

    if (rows.length === 0) return null;

    // First row has contract data
    const contract = {
      id: rows[0].id,
      appId: rows[0].app_id,
      contractorAddress: rows[0].contractor_address,
      supervisorAddress: rows[0].supervisor_address,
      workerAddress: rows[0].worker_address,
      milestoneCount: rows[0].milestone_count,
      totalEscrow: rows[0].total_escrow,
      status: rows[0].status,
      deployedAt: rows[0].deployed_at,
      createdAt: rows[0].created_at
    };

    // Extract milestones from rows (filter out null milestones from LEFT JOIN)
    const milestones = rows
      .filter(r => r.m_id !== null)
      .map(r => ({
        id: r.m_id,
        milestoneIndex: r.milestone_index,
        amount: r.m_amount,
        description: r.m_description,
        paid: r.paid === 1,
        txid: r.txid,
        assetId: r.asset_id,
        paidAt: r.paid_at,
        certificateGenerated: r.certificate_generated === 1
      }));

    return {
      ...contract,
      milestones
    };
  },

  /**
   * Get worker's complete profile with all contracts and milestones (SINGLE QUERY)
   * Most efficient method for credit scoring - eliminates all N+1 queries
   * @param {string} workerAddress - Worker's Algorand address
   * @returns {Promise<Object>} Worker profile with contracts and milestones
   */
  async getWorkerProfileOptimized(workerAddress) {
    const rows = await db.all(`
      SELECT 
        c.*,
        m.id as m_id,
        m.milestone_index,
        m.amount as m_amount,
        m.paid as m_paid,
        m.paid_at as m_paid_at,
        cert.id as cert_id,
        cert.certificate_hash
      FROM contracts c
      LEFT JOIN milestones m ON m.contract_id = c.id
      LEFT JOIN certificates cert ON cert.contract_id = c.id
      WHERE c.worker_address = ?
      ORDER BY c.created_at DESC, m.milestone_index
    `, [workerAddress]);

    if (rows.length === 0) return { contracts: [], totalEarnings: 0 };

    // Group by contract using Map for O(n) efficiency
    const contractMap = new Map();
    let totalEarnings = 0;

    rows.forEach(row => {
      if (!contractMap.has(row.id)) {
        contractMap.set(row.id, {
          id: row.id,
          appId: row.app_id,
          status: row.status,
          totalEscrow: row.total_escrow,
          milestoneCount: row.milestone_count,
          deployedAt: row.deployed_at,
          milestones: [],
          certificates: new Set()
        });
      }

      const contract = contractMap.get(row.id);

      // Add milestone if present and not already added
      if (row.m_id && !contract.milestones.find(m => m.id === row.m_id)) {
        contract.milestones.push({
          id: row.m_id,
          milestoneIndex: row.milestone_index,
          amount: row.m_amount,
          paid: row.m_paid === 1,
          paidAt: row.m_paid_at
        });
      }

      // Add certificate hash to set for uniqueness
      if (row.cert_id) {
        contract.certificates.add(row.certificate_hash);
      }

      // Count earnings from paid milestones
      if (row.m_paid === 1 && row.m_amount) {
        totalEarnings += row.m_amount;
      }
    });

    const contracts = Array.from(contractMap.values()).map(c => ({
      ...c,
      certificates: Array.from(c.certificates)
    }));

    return {
      contracts,
      totalEarnings,
      contractCount: contracts.length,
      completedContracts: contracts.filter(c => c.status === 'completed').length
    };
  },

  /**
   * Get contract with milestones by app ID
   * Alias for getWithMilestonesOptimized for backward compatibility
   * @param {number} appId - Contract app ID
   * @returns {Promise<Object>} Contract with milestones array
   */
  async getWithMilestones(appId) {
    return this.getWithMilestonesOptimized(appId);
  },
};

module.exports = { Contract };
