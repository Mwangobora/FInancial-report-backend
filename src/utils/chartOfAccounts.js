const pool = require('../config/database');

const defaultAccounts = [
  // Assets
  { code: '1000', name: 'Cash', type: 'Asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset' },
  { code: '1200', name: 'Inventory', type: 'Asset' },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset' },
  { code: '1500', name: 'Equipment', type: 'Asset' },
  { code: '1600', name: 'Accumulated Depreciation - Equipment', type: 'Asset' },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability' },
  { code: '2100', name: 'Accrued Liabilities', type: 'Liability' },
  { code: '2200', name: 'Notes Payable', type: 'Liability' },
  { code: '2300', name: 'Unearned Revenue', type: 'Liability' },
  
  // Equity
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'Equity' },
  { code: '3200', name: 'Common Stock', type: 'Equity' },
  
  // Revenue
  { code: '4000', name: 'Sales Revenue', type: 'Revenue' },
  { code: '4100', name: 'Service Revenue', type: 'Revenue' },
  { code: '4200', name: 'Interest Income', type: 'Revenue' },
  
  // Cost of Goods Sold
  { code: '5000', name: 'Cost of Goods Sold', type: 'COGS' },
  { code: '5100', name: 'Purchase Discounts', type: 'COGS' },
  
  // Expenses
  { code: '6000', name: 'Salaries Expense', type: 'Expense' },
  { code: '6100', name: 'Rent Expense', type: 'Expense' },
  { code: '6200', name: 'Utilities Expense', type: 'Expense' },
  { code: '6300', name: 'Office Supplies Expense', type: 'Expense' },
  { code: '6400', name: 'Depreciation Expense', type: 'Expense' },
  { code: '6500', name: 'Insurance Expense', type: 'Expense' },
  { code: '6600', name: 'Marketing Expense', type: 'Expense' },
  { code: '6700', name: 'Professional Fees', type: 'Expense' },
  { code: '6800', name: 'Travel Expense', type: 'Expense' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'Expense' }
];

const createDefaultChartOfAccounts = async (ledger_uuid) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const createdAccounts = [];
    
    for (const account of defaultAccounts) {
      const result = await client.query(
        `INSERT INTO accounts (account_name, account_code, account_type, ledger_uuid, description, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          account.name,
          account.code,
          account.type,
          ledger_uuid,
          `Default ${account.type} account`,
          'Active'
        ]
      );
      
      createdAccounts.push({
        uuid: result.rows[0].uuid,
        code: result.rows[0].account_code,
        name: result.rows[0].account_name,
        type: result.rows[0].account_type
      });
    }
    
    await client.query('COMMIT');
    return createdAccounts;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { createDefaultChartOfAccounts };