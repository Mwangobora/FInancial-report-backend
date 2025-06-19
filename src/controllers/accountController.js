const pool = require('../config/database');

// Helper functions
const verifyEntityOwnership = async (entity_uuid, user_id) => {
  const result = await pool.query(
    'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
    [entity_uuid, user_id]
  );
  return result.rows.length > 0;
};

const getLedgerUuid = async (entity_uuid, ledger_name) => {
  const result = await pool.query(
    'SELECT uuid FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2',
    [entity_uuid, ledger_name]
  );
  return result.rows.length > 0 ? result.rows[0].uuid : null;
};

const accountController = {
  // Get chart of accounts for a ledger
  getChartOfAccounts: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `SELECT uuid, account_name, account_code, account_type, initial_balance, 
                current_balance, description, parent_account_uuid, status, meta
         FROM accounts WHERE ledger_uuid = $1 ORDER BY account_code`,
        [ledger_uuid]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get chart of accounts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all accounts across all entities for a user
  getAllAccounts: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT a.uuid, a.account_name, a.account_code, a.account_type, 
                a.initial_balance, a.current_balance, a.description, 
                a.parent_account_uuid, a.status, a.meta,
                l.ledger_name, e.name as entity_name
         FROM accounts a
         JOIN ledgers l ON a.ledger_uuid = l.uuid
         JOIN entities e ON l.entity_uuid = e.uuid
         WHERE e.user_id = $1
         ORDER BY e.name, l.ledger_name, a.account_code`,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get all accounts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get accounts for a specific ledger
  getAccounts: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `SELECT uuid, account_name, account_code, account_type, initial_balance, 
                current_balance, description, parent_account_uuid, status, meta
         FROM accounts WHERE ledger_uuid = $1 ORDER BY account_code`,
        [ledger_uuid]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get accounts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get account balances grouped by type
  getAccountBalances: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, 
                current_balance as balance, account_type
         FROM accounts WHERE ledger_uuid = $1 ORDER BY account_code`,
        [ledger_uuid]
      );

      // Group accounts by type
      const groupedAccounts = {
        assets: [],
        liabilities: [],
        equity: [],
        revenues: [],
        cogs: [],
        expenses: []
      };

      result.rows.forEach(account => {
        const accountData = {
          uuid: account.uuid,
          code: account.code,
          name: account.name,
          balance: account.balance
        };

        switch (account.account_type) {
          case 'Asset':
            groupedAccounts.assets.push(accountData);
            break;
          case 'Liability':
            groupedAccounts.liabilities.push(accountData);
            break;
          case 'Equity':
            groupedAccounts.equity.push(accountData);
            break;
          case 'Revenue':
            groupedAccounts.revenues.push(accountData);
            break;
          case 'COGS':
            groupedAccounts.cogs.push(accountData);
            break;
          case 'Expense':
            groupedAccounts.expenses.push(accountData);
            break;
        }
      });

      res.json(groupedAccounts);
    } catch (error) {
      console.error('Get account balances error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get specific account details
  getAccount: async (req, res) => {
    try {
      const { entity_uuid, ledger_name, account_uuid } = req.params;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `SELECT uuid, account_name, account_code, account_type, initial_balance, 
                current_balance, description, parent_account_uuid, status, meta,
                created_at, updated_at
         FROM accounts WHERE uuid = $1 AND ledger_uuid = $2`,
        [account_uuid, ledger_uuid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get account error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Create new account
  createAccount: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { 
        account_name, account_code, account_type, initial_balance, 
        description, parent_account_uuid, status, meta 
      } = req.body;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `INSERT INTO accounts (
          account_name, account_code, account_type, ledger_uuid, 
          initial_balance, current_balance, description, parent_account_uuid, 
          status, meta
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          account_name, account_code, account_type, ledger_uuid,
          initial_balance || 0, initial_balance || 0, description,
          parent_account_uuid, status || 'Active', JSON.stringify(meta || {})
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create account error:', error);
      if (error.code === '23505') {
        res.status(400).json({ error: 'Account with this code already exists in this ledger' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  // Update account
  updateAccount: async (req, res) => {
    try {
      const { entity_uuid, ledger_name, account_uuid } = req.params;
      const { 
        account_name, account_code, account_type, description, 
        parent_account_uuid, status, meta 
      } = req.body;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `UPDATE accounts SET 
          account_name = $1, account_code = $2, account_type = $3,
          description = $4, parent_account_uuid = $5, status = $6, 
          meta = $7, updated_at = CURRENT_TIMESTAMP
         WHERE uuid = $8 AND ledger_uuid = $9
         RETURNING *`,
        [
          account_name, account_code, account_type, description,
          parent_account_uuid, status, JSON.stringify(meta || {}),
          account_uuid, ledger_uuid
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update account error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete account
  deleteAccount: async (req, res) => {
    try {
      const { entity_uuid, ledger_name, account_uuid } = req.params;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      // Check if account has transactions
      const transactionCheck = await pool.query(
        'SELECT COUNT(*) as count FROM transactions WHERE account_uuid = $1 OR corresponding_account_uuid = $1',
        [account_uuid]
      );

      if (parseInt(transactionCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete account with existing transactions. Consider marking it as inactive instead.' 
        });
      }

      const result = await pool.query(
        'DELETE FROM accounts WHERE uuid = $1 AND ledger_uuid = $2 RETURNING uuid, account_name',
        [account_uuid, ledger_uuid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({ 
        message: 'Account deleted successfully', 
        uuid: result.rows[0].uuid,
        account_name: result.rows[0].account_name
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = accountController;