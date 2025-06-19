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

const statementController = {
  // Generate Balance Sheet
  getBalanceSheet: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { as_of_date } = req.query;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      // Get assets
      const assetsResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'Asset'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Get liabilities
      const liabilitiesResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'Liability'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Get equity
      const equityResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'Equity'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Calculate totals
      const totalAssets = assetsResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const totalLiabilities = liabilitiesResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const totalEquity = equityResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);

      const balanceSheet = {
        as_of_date: as_of_date || new Date().toISOString().split('T')[0],
        assets: assetsResult.rows,
        total_assets: totalAssets.toFixed(2),
        liabilities: liabilitiesResult.rows,
        total_liabilities: totalLiabilities.toFixed(2),
        equity: equityResult.rows,
        total_equity: totalEquity.toFixed(2),
        total_liabilities_and_equity: (totalLiabilities + totalEquity).toFixed(2),
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      };

      res.json(balanceSheet);
    } catch (error) {
      console.error('Get balance sheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Generate Income Statement
  getIncomeStatement: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { start_date, end_date } = req.query;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      // Get revenues
      const revenuesResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'Revenue'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Get COGS
      const cogsResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'COGS'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Get expenses
      const expensesResult = await pool.query(
        `SELECT uuid, account_code as code, account_name as name, current_balance as balance
         FROM accounts WHERE ledger_uuid = $1 AND account_type = 'Expense'
         ORDER BY account_code`,
        [ledger_uuid]
      );

      // Calculate totals
      const totalRevenues = revenuesResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const totalCogs = cogsResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const totalExpenses = expensesResult.rows.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const grossProfit = totalRevenues - totalCogs;
      const netIncome = grossProfit - totalExpenses;

      const incomeStatement = {
        period: {
          start_date: start_date || null,
          end_date: end_date || new Date().toISOString().split('T')[0]
        },
        revenues: revenuesResult.rows,
        total_revenues: totalRevenues.toFixed(2),
        cogs: cogsResult.rows,
        total_cogs: totalCogs.toFixed(2),
        gross_profit: grossProfit.toFixed(2),
        gross_profit_margin: totalRevenues > 0 ? ((grossProfit / totalRevenues) * 100).toFixed(2) + '%' : '0%',
        expenses: expensesResult.rows,
        total_expenses: totalExpenses.toFixed(2),
        net_income: netIncome.toFixed(2),
        net_profit_margin: totalRevenues > 0 ? ((netIncome / totalRevenues) * 100).toFixed(2) + '%' : '0%'
      };

      res.json(incomeStatement);
    } catch (error) {
      console.error('Get income statement error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Generate Cash Flow Statement
  getCashFlowStatement: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { start_date, end_date } = req.query;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      // Get cash account (assuming account code 1000 is cash)
      const cashAccountResult = await pool.query(
        `SELECT current_balance, initial_balance FROM accounts 
         WHERE ledger_uuid = $1 AND account_code = '1000'`,
        [ledger_uuid]
      );

      const currentCashBalance = cashAccountResult.rows.length > 0 
        ? parseFloat(cashAccountResult.rows[0].current_balance) 
        : 0;
      
      const initialCashBalance = cashAccountResult.rows.length > 0 
        ? parseFloat(cashAccountResult.rows[0].initial_balance) 
        : 0;

      // Get net income from income statement calculation
      const revenuesResult = await pool.query(
        `SELECT SUM(current_balance) as total FROM accounts 
         WHERE ledger_uuid = $1 AND account_type = 'Revenue'`,
        [ledger_uuid]
      );

      const expensesResult = await pool.query(
        `SELECT SUM(current_balance) as total FROM accounts 
         WHERE ledger_uuid = $1 AND account_type IN ('Expense', 'COGS')`,
        [ledger_uuid]
      );

      const totalRevenues = parseFloat(revenuesResult.rows[0].total) || 0;
      const totalExpenses = parseFloat(expensesResult.rows[0].total) || 0;
      const netIncome = totalRevenues - totalExpenses;

      // Get changes in working capital (simplified)
      const receivablesResult = await pool.query(
        `SELECT current_balance - initial_balance as change FROM accounts 
         WHERE ledger_uuid = $1 AND account_name ILIKE '%receivable%'`,
        [ledger_uuid]
      );

      const payablesResult = await pool.query(
        `SELECT current_balance - initial_balance as change FROM accounts 
         WHERE ledger_uuid = $1 AND account_name ILIKE '%payable%'`,
        [ledger_uuid]
      );

      const receivablesChange = receivablesResult.rows.length > 0 
        ? parseFloat(receivablesResult.rows[0].change) || 0 
        : 0;
      
      const payablesChange = payablesResult.rows.length > 0 
        ? parseFloat(payablesResult.rows[0].change) || 0 
        : 0;

      // Calculate operating activities
      const operatingActivities = netIncome - receivablesChange + payablesChange;
      
      // For simplified cash flow, assume no investing or financing activities
      const investingActivities = 0;
      const financingActivities = 0;
      
      const netCashFlow = operatingActivities + investingActivities + financingActivities;
      const beginningCash = currentCashBalance - netCashFlow;

      const cashFlowStatement = {
        period: {
          start_date: start_date || null,
          end_date: end_date || new Date().toISOString().split('T')[0]
        },
        cash_from_operating_activities: operatingActivities.toFixed(2),
        cash_from_investing_activities: investingActivities.toFixed(2),
        cash_from_financing_activities: financingActivities.toFixed(2),
        net_increase_in_cash: netCashFlow.toFixed(2),
        beginning_cash_balance: beginningCash.toFixed(2),
        ending_cash_balance: currentCashBalance.toFixed(2),
        operating_activities_details: [
          { item: 'Net Income', amount: netIncome.toFixed(2) },
          { item: 'Changes in Accounts Receivable', amount: (-receivablesChange).toFixed(2) },
          { item: 'Changes in Accounts Payable', amount: payablesChange.toFixed(2) }
        ],
        investing_activities_details: [
          { item: 'No investing activities recorded', amount: '0.00' }
        ],
        financing_activities_details: [
          { item: 'No financing activities recorded', amount: '0.00' }
        ]
      };

      res.json(cashFlowStatement);
    } catch (error) {
      console.error('Get cash flow statement error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Generate Trial Balance
  getTrialBalance: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { as_of_date } = req.query;

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
        `SELECT uuid, account_code, account_name, account_type, current_balance
         FROM accounts WHERE ledger_uuid = $1 AND current_balance != 0
         ORDER BY account_code`,
        [ledger_uuid]
      );

      let totalDebits = 0;
      let totalCredits = 0;

      const accounts = result.rows.map(account => {
        const balance = parseFloat(account.current_balance);
        const isDebitBalance = ['Asset', 'Expense', 'COGS'].includes(account.account_type);
        
        const debitAmount = (isDebitBalance && balance > 0) || (!isDebitBalance && balance < 0) 
          ? Math.abs(balance) : 0;
        const creditAmount = (!isDebitBalance && balance > 0) || (isDebitBalance && balance < 0) 
          ? Math.abs(balance) : 0;

        totalDebits += debitAmount;
        totalCredits += creditAmount;

        return {
          uuid: account.uuid,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          debit_amount: debitAmount.toFixed(2),
          credit_amount: creditAmount.toFixed(2)
        };
      });

      const trialBalance = {
        as_of_date: as_of_date || new Date().toISOString().split('T')[0],
        accounts,
        total_debits: totalDebits.toFixed(2),
        total_credits: totalCredits.toFixed(2),
        difference: (totalDebits - totalCredits).toFixed(2),
        balanced: Math.abs(totalDebits - totalCredits) < 0.01
      };

      res.json(trialBalance);
    } catch (error) {
      console.error('Get trial balance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Generate General Ledger Report
  getGeneralLedger: async (req, res) => {
    try {
      const { entity_uuid, ledger_name } = req.params;
      const { account_uuid, start_date, end_date } = req.query;

      // Verify entity ownership
      if (!(await verifyEntityOwnership(entity_uuid, req.user.id))) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger UUID
      const ledger_uuid = await getLedgerUuid(entity_uuid, ledger_name);
      if (!ledger_uuid) {
        return res.status(404).json({ error: 'Ledger not found' });
      }

      let query = `
        SELECT 
          a.uuid as account_uuid, a.account_code, a.account_name, a.account_type,
          t.uuid as transaction_uuid, t.amount, t.description, t.tx_type, 
          t.timestamp, t.corresponding_account_uuid,
          ca.account_name as corresponding_account_name, ca.account_code as corresponding_account_code
        FROM accounts a
        LEFT JOIN transactions t ON (a.uuid = t.account_uuid OR a.uuid = t.corresponding_account_uuid)
        LEFT JOIN accounts ca ON (
          CASE 
            WHEN a.uuid = t.account_uuid THEN t.corresponding_account_uuid
            ELSE t.account_uuid
          END = ca.uuid
        )
        WHERE a.ledger_uuid = $1
      `;

      const queryParams = [ledger_uuid];
      let paramCount = 1;

      if (account_uuid) {
        paramCount++;
        query += ` AND a.uuid = $${paramCount}`;
        queryParams.push(account_uuid);
      }

      if (start_date) {
        paramCount++;
        query += ` AND (t.timestamp IS NULL OR t.timestamp >= $${paramCount})`;
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND (t.timestamp IS NULL OR t.timestamp <= $${paramCount})`;
        queryParams.push(end_date);
      }

      query += ` ORDER BY a.account_code, t.timestamp`;

      const result = await pool.query(query, queryParams);

      // Group transactions by account
      const accountsMap = new Map();

      result.rows.forEach(row => {
        if (!accountsMap.has(row.account_uuid)) {
          accountsMap.set(row.account_uuid, {
            uuid: row.account_uuid,
            account_code: row.account_code,
            account_name: row.account_name,
            account_type: row.account_type,
            transactions: []
          });
        }

        if (row.transaction_uuid) {
          const account = accountsMap.get(row.account_uuid);
          const isMainAccount = row.account_uuid === row.account_uuid;
          
          account.transactions.push({
            uuid: row.transaction_uuid,
            amount: row.amount,
            description: row.description,
            tx_type: isMainAccount ? row.tx_type : (row.tx_type === 'dr' ? 'cr' : 'dr'),
            timestamp: row.timestamp,
            corresponding_account: {
              uuid: row.corresponding_account_uuid,
              name: row.corresponding_account_name,
              code: row.corresponding_account_code
            }
          });
        }
      });

      const generalLedger = {
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        },
        accounts: Array.from(accountsMap.values())
      };

      res.json(generalLedger);
    } catch (error) {
      console.error('Get general ledger error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = statementController;