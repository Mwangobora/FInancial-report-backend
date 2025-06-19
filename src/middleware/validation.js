const Joi = require("joi")

// Validation schemas
const schemas = {
  // User registration validation
  registerUser: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
    first_name: Joi.string().min(2).max(50).required().messages({
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name cannot exceed 50 characters",
      "any.required": "First name is required",
    }),
    last_name: Joi.string().min(2).max(50).required().messages({
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name cannot exceed 50 characters",
      "any.required": "Last name is required",
    }),
  }),

  // User login validation
  loginUser: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
  }),

  // Entity creation validation
  createEntity: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Entity name must be at least 2 characters long",
      "string.max": "Entity name cannot exceed 100 characters",
      "any.required": "Entity name is required",
    }),
    address_1: Joi.string().max(200).allow("").optional(),
    address_2: Joi.string().max(200).allow("").optional(),
    path: Joi.string().required().messages({
      "any.required": "Path is required",
    }),
    depth: Joi.number().integer().min(0).default(0),
    admin: Joi.number().integer().min(0).default(1),
    city: Joi.string().max(100).allow("").optional(),
    state: Joi.string().max(100).allow("").optional(),
    zip_code: Joi.string().max(20).allow("").optional(),
    country: Joi.string().max(100).allow("").optional(),
    email: Joi.string().email().allow("").optional(),
    website: Joi.string().uri().allow("").optional(),
    phone: Joi.string().max(20).allow("").optional(),
    hidden: Joi.boolean().default(false),
    accrual_method: Joi.boolean().default(true),
    fy_start_month: Joi.number().integer().min(1).max(12).default(1),
    last_closing_date: Joi.date().iso().optional(),
    meta: Joi.object().default({}),
    managers: Joi.array().default([]),
  }),

  // Ledger creation validation
  createLedger: Joi.object({
    ledger_name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Ledger name must be at least 2 characters long",
      "string.max": "Ledger name cannot exceed 100 characters",
      "any.required": "Ledger name is required",
    }),
    posted: Joi.boolean().default(false),
    locked: Joi.boolean().default(false),
    hidden: Joi.boolean().default(false),
    additional_info: Joi.object().default({}),
  }),

  // Account creation validation
  createAccount: Joi.object({
    account_name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Account name must be at least 2 characters long",
      "string.max": "Account name cannot exceed 100 characters",
      "any.required": "Account name is required",
    }),
    account_code: Joi.string().min(1).max(20).required().messages({
      "string.min": "Account code must be at least 1 character long",
      "string.max": "Account code cannot exceed 20 characters",
      "any.required": "Account code is required",
    }),
    account_type: Joi.string().valid("Asset", "Liability", "Equity", "Revenue", "Expense", "COGS").required().messages({
      "any.only": "Account type must be one of: Asset, Liability, Equity, Revenue, Expense, COGS",
      "any.required": "Account type is required",
    }),
    initial_balance: Joi.number().precision(2).default(0),
    description: Joi.string().max(500).allow("").optional(),
    parent_account: Joi.string().uuid().allow(null).optional(),
    status: Joi.string().valid("active", "inactive", "closed").default("active"),
    meta: Joi.object().default({}),
  }),

  // Transaction creation validation
  createTransaction: Joi.object({
    account_uuid: Joi.string().uuid().required().messages({
      "string.guid": "Account UUID must be a valid UUID",
      "any.required": "Account UUID is required",
    }),
    amount: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Amount must be a positive number",
      "any.required": "Amount is required",
    }),
    description: Joi.string().max(500).allow("").optional(),
    tx_type: Joi.string().valid("dr", "cr").required().messages({
      "any.only": 'Transaction type must be either "dr" (debit) or "cr" (credit)',
      "any.required": "Transaction type is required",
    }),
    entity_unit_uuid: Joi.string().uuid().required().messages({
      "string.guid": "Entity unit UUID must be a valid UUID",
      "any.required": "Entity unit UUID is required",
    }),
    corresponding_account_uuid: Joi.string().uuid().required().messages({
      "string.guid": "Corresponding account UUID must be a valid UUID",
      "any.required": "Corresponding account UUID is required",
    }),
  }),

  // UUID parameter validation
  uuidParam: Joi.object({
    uuid: Joi.string().uuid().required().messages({
      "string.guid": "Invalid UUID format",
      "any.required": "UUID is required",
    }),
  }),

  // Ledger name parameter validation
  ledgerNameParam: Joi.object({
    ledgerName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Ledger name must be at least 2 characters long",
      "string.max": "Ledger name cannot exceed 100 characters",
      "any.required": "Ledger name is required",
    }),
  }),

  // Chart of accounts creation validation
  createChartOfAccounts: Joi.object({
    ledger_name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Ledger name must be at least 2 characters long",
      "string.max": "Ledger name cannot exceed 100 characters",
      "any.required": "Ledger name is required",
    }),
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort_by: Joi.string().max(50).optional(),
    sort_order: Joi.string().valid("asc", "desc").default("asc"),
  }),
}

// Validation middleware factory
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const dataToValidate = req[property]

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true, // Convert types when possible
    })

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }))

      return res.status(400).json({
        error: "Validation failed",
        details: errorDetails,
        timestamp: new Date().toISOString(),
      })
    }

    // Replace the original data with validated and sanitized data
    req[property] = value
    next()
  }
}

// Specific validation middleware functions
const validateRegisterUser = validate(schemas.registerUser)
const validateLoginUser = validate(schemas.loginUser)
const validateCreateEntity = validate(schemas.createEntity)
const validateCreateLedger = validate(schemas.createLedger)
const validateCreateAccount = validate(schemas.createAccount)
const validateCreateTransaction = validate(schemas.createTransaction)
const validateCreateChartOfAccounts = validate(schemas.createChartOfAccounts)
const validateUuidParam = validate(schemas.uuidParam, "params")
const validateLedgerNameParam = validate(schemas.ledgerNameParam, "params")
const validatePagination = validate(schemas.pagination, "query")

// Combined validation for routes that need both params and body validation
const validateEntityAndLedger = [validate(schemas.uuidParam, "params"), validate(schemas.ledgerNameParam, "params")]

// Custom validation functions
const validateAccountType = (req, res, next) => {
  const validTypes = ["Asset", "Liability", "Equity", "Revenue", "Expense", "COGS"]
  const { account_type } = req.body

  if (account_type && !validTypes.includes(account_type)) {
    return res.status(400).json({
      error: "Invalid account type",
      message: `Account type must be one of: ${validTypes.join(", ")}`,
      provided: account_type,
    })
  }

  next()
}

const validateTransactionBalance = (req, res, next) => {
  const { amount, tx_type } = req.body

  if (amount <= 0) {
    return res.status(400).json({
      error: "Invalid transaction amount",
      message: "Transaction amount must be greater than zero",
      provided: amount,
    })
  }

  if (!["dr", "cr"].includes(tx_type)) {
    return res.status(400).json({
      error: "Invalid transaction type",
      message: 'Transaction type must be either "dr" (debit) or "cr" (credit)',
      provided: tx_type,
    })
  }

  next()
}

// Sanitization helpers
const sanitizeString = (str) => {
  if (typeof str !== "string") return str
  return str.trim().replace(/[<>]/g, "") // Basic XSS prevention
}

const sanitizeObject = (obj) => {
  if (typeof obj !== "object" || obj === null) return obj

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }
  if (req.params) {
    req.params = sanitizeObject(req.params)
  }
  next()
}

module.exports = {
  // Schema exports
  schemas,

  // General validation function
  validate,

  // Specific validation middleware
  validateRegisterUser,
  validateLoginUser,
  validateCreateEntity,
  validateCreateLedger,
  validateCreateAccount,
  validateCreateTransaction,
  validateCreateChartOfAccounts,
  validateUuidParam,
  validateLedgerNameParam,
  validatePagination,
  validateEntityAndLedger,

  // Custom validation functions
  validateAccountType,
  validateTransactionBalance,

  // Sanitization
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
}
