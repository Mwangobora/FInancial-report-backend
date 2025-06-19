const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateCreateLedger } = require('../middleware/validation');
const { createDefaultChartOfAccounts } = require('../utils/chartOfAccounts');

const router = express.Router();

// Get Entity Ledgers
router.get('/entity/:entity_uuid/ledgers/', authenticateToken, async (req, res) => {
  try {
    const { entity_uuid } = req.params;

    // Verify entity belongs to user
    const entityCheck = await pool.query(
      'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
      [entity_uuid, req.user.id]
    );

    if (entityCheck.rows.length === 0) {
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
});

// Create Ledger
router.post('/entity/:entity_uuid/create-ledger/', authenticateToken, validateCreateLedger, async (req, res) => {
  try {
    const { entity_uuid } = req.params;
    const { ledger_name, posted, locked, hidden, additional_info } = req.body;

    // Verify entity belongs to user
    const entityCheck = await pool.query(
      'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
      [entity_uuid, req.user.id]
    );

    if (entityCheck.rows.length === 0) {
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
});

// Create Chart of Accounts
router.post('/entity/:entity_uuid/create-chart-of-accounts/', authenticateToken, async (req, res) => {
  try {
    const { entity_uuid } = req.params;
    const { ledger_name } = req.body;

    if (!ledger_name) {
      return res.status(400).json({ error: 'ledger_name is required' });
    }

    // Verify entity belongs to user
    const entityCheck = await pool.query(
      'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
      [entity_uuid, req.user.id]
    );

    if (entityCheck.rows.length === 0) {
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
});

module.exports = router;