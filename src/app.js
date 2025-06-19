// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const entityRoutes = require('./routes/entities');
const ledgerRoutes = require('./routes/ledgers');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const statementRoutes = require('./routes/statements');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
app.use(rateLimiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Financial Reporting API',
    version: '1.0.0'
  });
});

// API routes with base path
const API_BASE = '/report_microservice/api';

app.use(`${API_BASE}/auth`, authRoutes);
app.use(API_BASE, entityRoutes);
app.use(API_BASE, ledgerRoutes);
app.use(API_BASE, accountRoutes);
app.use(API_BASE, transactionRoutes);
app.use(API_BASE, statementRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;