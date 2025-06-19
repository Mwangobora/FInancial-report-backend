const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const statementController = require('../controllers/statementController');

const router = express.Router();

// Financial statement routes
router.get('/entity/:entity_uuid/ledgers/:ledger_name/balance-sheet/', authenticateToken, statementController.getBalanceSheet);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/income-statement/', authenticateToken, statementController.getIncomeStatement);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/cash-flow-statement/', authenticateToken, statementController.getCashFlowStatement);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/trial-balance/', authenticateToken, statementController.getTrialBalance);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/general-ledger/', authenticateToken, statementController.getGeneralLedger);

module.exports = router;