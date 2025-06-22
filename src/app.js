// src/app.js
require('dotenv').config(); // Make sure to load .env first

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

// Allowed origins (support both dev ports and production)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://finacial-app.vercel.app',
  'https://f55984pk-5173.uks1.devtunnels.ms/'
];

// CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS Blocked Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Security middleware
app.use(helmet());

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

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
