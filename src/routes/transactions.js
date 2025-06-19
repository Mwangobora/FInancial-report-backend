const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateCreateTransaction } = require('../middleware/validation');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

// Transaction routes
router.post('/entity/:entity_uuid/ledgers/:ledger_name/create-transaction/', authenticateToken, validateCreateTransaction, transactionController.createTransaction);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/transactions/', authenticateToken, transactionController.getTransactions);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/transactions/:transaction_uuid/', authenticateToken, transactionController.getTransaction);
router.put('/entity/:entity_uuid/ledgers/:ledger_name/transactions/:transaction_uuid/', authenticateToken, transactionController.updateTransaction);
router.delete('/entity/:entity_uuid/ledgers/:ledger_name/transactions/:transaction_uuid/', authenticateToken, transactionController.deleteTransaction);
router.get('/entity/:entity_uuid/ledgers/:ledger_name/transactions/summary/', authenticateToken, transactionController.getTransactionSummary);

module.exports = router;