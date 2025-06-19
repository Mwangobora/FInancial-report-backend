const pool = require('../config/database');

const transactionController = {
  // Helper functions
  verifyEntityOwnership: async (entity_uuid, user_id) => {
    const result = await pool.query(
      'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
      [entity_uuid, user_id]
    );
    return result.rows.length > 0;
  },

  getLedgerUuid: async (entity_uuid, ledger_name) => {
    const result = await pool.query(
      'SELECT uuid FROM ledgers WHERE entity_uuid = $1 AND ledger_name = $2',
      [entity_uuid, ledger_name]
    );
    return result.rows.length > 0 ? result.rows[0].uuid : null;
  },

  updateAccountBalance: async (account_uuid, amount, tx_type, client) => {
    const balanceChange = tx_type === 'dr' ? amount : -amount;
    
    await client.query(
      'UPDATE accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE uuid = $2',
      [balanceChange, account_uuid]
    );
  },

  // Create new transaction
  createTransaction: async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { account_uuid, amount, description, tx_type, entity_unit_uuid, corresponding_account_uuid } = req.body;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      await client.query('BEGIN');

      // Verify accounts exist and belong to the ledger
      const accountCheck = await client.query(
        'SELECT uuid FROM accounts WHERE uuid IN ($1, $2) AND ledger_uuid = $3',
        [account_uuid, corresponding_account_uuid, ledger_uuid]
      );

      if (accountCheck.rows.length !== 2) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One or both accounts not found in this ledger' });
      }

      // Create the transaction
      const transactionResult = await client.query(
        `INSERT INTO transactions (account_uuid, amount, description, tx_type, entity_unit_uuid, corresponding_account_uuid)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [account_uuid, amount, description, tx_type, entity_unit_uuid, corresponding_account_uuid]
      );

      // Update account balances
      await transactionController.updateAccountBalance(account_uuid, amount, tx_type, client);
      
      // Update corresponding account with opposite transaction type
      const oppositeType = tx_type === 'dr' ? 'cr' : 'dr';
      await transactionController.updateAccountBalance(corresponding_account_uuid, amount, oppositeType, client);

      await client.query('COMMIT');

      res.status(201).json(transactionResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  },

  // Get all transactions for a ledger
  getTransactions: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { page = 1, limit = 50, account_uuid, tx_type, start_date, end_date } = req.query;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      // Build query with filters
      let query = `
        SELECT t.uuid, t.account_uuid, t.amount, t.description, t.tx_type,
               t.entity_unit_uuid, t.corresponding_account_uuid, t.timestamp
        FROM transactions t
        JOIN accounts a ON t.account_uuid = a.uuid
        WHERE a.ledger_uuid = $1
      `;
      
      const queryParams = [ledger_uuid];
      let paramCount = 1;

      // Add filters
      if (account_uuid) {
        paramCount++;
        query += ` AND (t.account_uuid = $${paramCount} OR t.corresponding_account_uuid = $${paramCount})`;
        queryParams.push(account_uuid);
      }

      if (tx_type) {
        paramCount++;
        query += ` AND t.tx_type = $${paramCount}`;
        queryParams.push(tx_type);
      }

      if (start_date) {
        paramCount++;
        query += ` AND t.timestamp >= $${paramCount}`;
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND t.timestamp <= $${paramCount}`;
        queryParams.push(end_date);
      }

      query += ` ORDER BY t.timestamp DESC`;

      // Add pagination
      const offset = (page - 1) * limit;
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      queryParams.push(limit);
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      queryParams.push(offset);

      const result = await pool.query(query, queryParams);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM transactions t
        JOIN accounts a ON t.account_uuid = a.uuid
        WHERE a.ledger_uuid = $1
      `;
      
      const countParams = [ledger_uuid];
      let countParamCount = 1;

      if (account_uuid) {
        countParamCount++;
        countQuery += ` AND (t.account_uuid = $${countParamCount} OR t.corresponding_account_uuid = $${countParamCount})`;
        countParams.push(account_uuid);
      }

      if (tx_type) {
        countParamCount++;
        countQuery += ` AND t.tx_type = $${countParamCount}`;
        countParams.push(tx_type);
      }

      if (start_date) {
        countParamCount++;
        countQuery += ` AND t.timestamp >= $${countParamCount}`;
        countParams.push(start_date);
      }

      if (end_date) {
        countParamCount++;
        countQuery += ` AND t.timestamp <= $${countParamCount}`;
        countParams.push(end_date);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        transactions: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get specific transaction
  getTransaction: async (req, res) => {
    try {
      const { entity_uuid, ledger_name, transaction_uuid } = req.params;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `SELECT t.uuid, t.account_uuid, t.amount, t.description, t.tx_type,
                t.entity_unit_uuid, t.corresponding_account_uuid, t.timestamp,
                a1.account_name as account_name, a1.account_code as account_code,
                a2.account_name as corresponding_account_name, a2.account_code as corresponding_account_code
         FROM transactions t
         JOIN accounts a1 ON t.account_uuid = a1.uuid
         JOIN accounts a2 ON t.corresponding_account_uuid = a2.uuid
         WHERE t.uuid = $1 AND a1.ledger_uuid = $2`,
        [transaction_uuid, ledger_uuid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update transaction (limited fields)
  updateTransaction: async (req, res) => {
    try {
      const { entity_uuid, ledger_name, transaction_uuid } = req.params;
      const { description } = req.body;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      const result = await pool.query(
        `UPDATE transactions SET description = $1
         WHERE uuid = $2 AND account_uuid IN (
           SELECT uuid FROM accounts WHERE ledger_uuid = $3
         )
         RETURNING *`,
        [description, transaction_uuid, ledger_uuid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete transaction (reverses account balances)
  deleteTransaction: async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { entity_uuid, ledger_name, transaction_uuid } = req.params;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      await client.query('BEGIN');

      // Get transaction details
      const transactionResult = await client.query(
        `SELECT t.* FROM transactions t
         JOIN accounts a ON t.account_uuid = a.uuid
         WHERE t.uuid = $1 AND a.ledger_uuid = $2`,
        [transaction_uuid, ledger_uuid]
      );

      if (transactionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const transaction = transactionResult.rows[0];

      // Reverse the account balance changes
      const reverseType = transaction.tx_type === 'dr' ? 'cr' : 'dr';
      await transactionController.updateAccountBalance(
        transaction.account_uuid, 
        transaction.amount, 
        reverseType, 
        client
      );

      const reverseCorrespondingType = transaction.tx_type === 'dr' ? 'dr' : 'cr';
      await transactionController.updateAccountBalance(
        transaction.corresponding_account_uuid, 
        transaction.amount, 
        reverseCorrespondingType, 
        client
      );

      // Delete the transaction
      await client.query(
        'DELETE FROM transactions WHERE uuid = $1',
        [transaction_uuid]
      );

      await client.query('COMMIT');

      res.json({ 
        message: 'Transaction deleted successfully', 
        uuid: transaction_uuid 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  },

  // Get transaction summary
  getTransactionSummary: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { start_date, end_date } = req.query;

      // Verify entity ownership
      if (!(await transactionController.verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await transactionController.getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      let query = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN tx_type = 'dr' THEN 1 END) as debit_count,
          COUNT(CASE WHEN tx_type = 'cr' THEN 1 END) as credit_count,
          SUM(CASE WHEN tx_type = 'dr' THEN amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN tx_type = 'cr' THEN amount ELSE 0 END) as total_credits
        FROM transactions t
        JOIN accounts a ON t.account_uuid = a.uuid
        WHERE a.ledger_uuid = $1
      `;

      const queryParams = [ledger_uuid];
      let paramCount = 1;

      if (start_date) {
        paramCount++;
        query += ` AND t.timestamp >= $${paramCount}`;
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND t.timestamp <= $${paramCount}`;
        queryParams.push(end_date);
      }

      const result = await pool.query(query, queryParams);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get transaction summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = transactionController;