const pool = require('../config/database');
const { createDefaultChartOfAccounts } = require('../utils/chartOfAccounts');

const ledgerController = {
  // Helper function to verify entity ownership
  verifyEntityOwnership: async (entity_uuid, user_id) => {
    const result = await pool.query(
      'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
      [entity_uuid, user_id]
    );
    return result.rows.length > 0;
  },

  // Get all ledgers for an entity
  getEntityLedgers: async (req, res) => {
    try {
      const { entity_uuid } = req.params;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      const result = await pool.query(
        'SELECT * FROM ledgers WHERE entity_uuid = $1 ORDER BY created_at DESC',
        [entity_uuid]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get ledgers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Create new ledger
  createLedger: async (req, res) => {
    try {
      const { entity_uuid } = req.params;
      const { ledger_name, posted, locked, hidden, additional_info } = req.body;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      const result = await pool.query(
        `INSERT INTO ledgers (ledger_name, entity_uuid, posted, locked, hidden, additional_info)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [ledger_name, entity_uuid, posted, locked, hidden, JSON.stringify(additional_info)]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create ledger error:', error);
      if (error.code === '23505') {
        res.status(400).json({ error: 'Ledger with this name already exists for this entity' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  // Get ledger by name
  getLedger: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      const result = await pool.query(
        'SELECT * FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2',
        [entity_uuid, ledger_name]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get ledger error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update ledger
  updateLedger: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { posted, locked, hidden, additional_info } = req.body;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      const result = await pool.query(
        `UPDATE ledgers SET 
          posted = $1, locked = $2, hidden = $3, additional_info = $4,
          updated_at = CURRENT_TIMESTAMP
         WHERE entity_uuid = $5 AND ledger_name = $6
         RETURNING *`,
        [posted, locked, hidden, JSON.stringify(additional_info), entity_uuid, ledger_name]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update ledger error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete ledger
  deleteLedger: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      const result = await pool.query(
        'DELETE FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2 RETURNING uuid, ledger_name',
        [entity_uuid, ledger_name]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      res.json({ 
        message: 'Ledger deleted successfully', 
        uuid: result.rows[0].uuid,
        ledger_name: result.rows[0].ledger_name
      });
    } catch (error) {
      console.error('Delete ledger error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Create chart of accounts
  createChartOfAccounts: async (req, res) => {
    try {
      const { entity_uuid } = req.params;
      const { ledger_name } = req.body;

      if (!ledger_name) {
        return res.status(400).json({ error: 'ledger_name is required' });
      }

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Verify ledger exists
      const ledgerCheck = await pool.query(
        'SELECT uuid FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2',
        [entity_uuid, ledger_name]
      );

      if (ledgerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const ledger_uuid = ledgerCheck.rows[0].uuid;

      // Check if chart of accounts already exists
      const existingAccounts = await pool.query(
        'SELECT COUNT(*) as count FROM accounts WHERE ledger_uuid = $1',
        [ledger_uuid]
      );

      if (parseInt(existingAccounts.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Chart of accounts already exists for this ledger' });
      }

      // Create default chart of accounts
      const createdAccounts = await createDefaultChartOfAccounts(ledger_uuid);

      res.status(201).json({
        message: `Chart of accounts created successfully for ledger '${ledger_name}'`,
        accounts_created: createdAccounts
      });
    } catch (error) {
      console.error('Create chart of accounts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get ledger statistics
  getLedgerStats: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await ledgerController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledgerResult = await pool.query(
        'SELECT uuid FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2',
        [entity_uuid, ledger_name]
      );

      if (ledgerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const ledger_uuid = ledgerResult.rows[0].uuid;

      // Get account count by type
      const accountStats = await pool.query(
        `SELECT account_type, COUNT(*) as count 
         FROM accounts WHERE ledger_uuid = $1 
         GROUP BY account_type`,
        [ledger_uuid]
      );

      // Get transaction count
      const transactionCount = await pool.query(
        `SELECT COUNT(*) as count FROM transactions t
         JOIN accounts a ON t.account_uuid = a.uuid
         WHERE a.ledger_uuid = $1`,
        [ledger_uuid]
      );

      // Get total balance by account type
      const balanceStats = await pool.query(
        `SELECT account_type, SUM(current_balance) as total_balance
         FROM accounts WHERE ledger_uuid = $1
         GROUP BY account_type`,
        [ledger_uuid]
      );

      res.json({
        ledger_name,
        account_statistics: accountStats.rows,
        transaction_count: parseInt(transactionCount.rows[0].count),
        balance_statistics: balanceStats.rows
      });
    } catch (error) {
      console.error('Get ledger stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = ledgerController;