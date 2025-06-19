const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const accountController = require('../controllers/accountController');

const router = express.Router();

// Account routes
router.get('/entity/:entity_uuid/ledgers/:ledger_name/chart-of-accounts/', authenticateToken, accountController.getChartOfAccounts);
router.get('/all-accounts/', authenticateToken, accountController.getAllAccounts);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/accounts/', authenticateToken, accountController.getAccounts);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/balance-for-accounts/', authenticateToken, accountController.getAccountBalances);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/accounts/:account_uuid/', authenticateToken, accountController.getAccount);
router.post('/entity/:entity_uuid/ledgers/:ledger_name/accounts/', authenticateToken, accountController.createAccount);
router.put('/entity/:entity_uuid/ledgers/:ledger_name/accounts/:account_uuid/', authenticateToken, accountController.updateAccount);
router.delete('/entity/:entity_uuid/ledgers/:ledger_name/accounts/:account_uuid/', authenticateToken, accountController.deleteAccount);

module.exports = router;