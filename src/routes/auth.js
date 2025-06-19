const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// Authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;