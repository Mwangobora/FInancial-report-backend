// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.timestamp = new Date().toISOString()

    Error.captureStackTrace(this, this.constructor)
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400)
    this.name = "ValidationError"
    this.details = details
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500)
    this.name = "DatabaseError"
    this.originalError = originalError
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401)
    this.name = "AuthenticationError"
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403)
    this.name = "AuthorizationError"
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404)
    this.name = "NotFoundError"
  }
}

class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409)
    this.name = "ConflictError"
  }
}

class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429)
    this.name = "RateLimitError"
  }
}

// Database error handler
const handleDatabaseError = (error) => {
  console.error("Database Error:", error)

  // PostgreSQL specific error codes
  switch (error.code) {
    case "23505": // Unique violation
      return new ConflictError("Resource already exists with this identifier")

    case "23503": // Foreign key violation
      return new ValidationError("Referenced resource does not exist")

    case "23502": // Not null violation
      return new ValidationError("Required field is missing")

    case "23514": // Check violation
      return new ValidationError("Data violates database constraints")

    case "42P01": // Undefined table
      return new DatabaseError("Database table not found")

    case "42703": // Undefined column
      return new DatabaseError("Database column not found")

    case "28P01": // Invalid password
      return new AuthenticationError("Database authentication failed")

    case "3D000": // Invalid database name
      return new DatabaseError("Database not found")

    case "08006": // Connection failure
      return new DatabaseError("Database connection failed")

    case "57P03": // Cannot connect now
      return new DatabaseError("Database is temporarily unavailable")

    default:
      // Generic database error
      if (error.severity === "ERROR") {
        return new DatabaseError("Database operation failed")
      }
      return new DatabaseError("An unexpected database error occurred")
  }
}

// JWT error handler
const handleJWTError = (error) => {
  if (error.name === "JsonWebTokenError") {
    return new AuthenticationError("Invalid authentication token")
  }

  if (error.name === "TokenExpiredError") {
    return new AuthenticationError("Authentication token has expired")
  }

  if (error.name === "NotBeforeError") {
    return new AuthenticationError("Authentication token not yet valid")
  }

  return new AuthenticationError("Authentication token error")
}

// Validation error handler
const handleValidationError = (error) => {
  if (error.isJoi) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
      value: detail.context?.value,
    }))

    return new ValidationError("Validation failed", details)
  }

  return new ValidationError(error.message)
}

// Cast error handler (for invalid UUIDs, etc.)
const handleCastError = (error) => {
  return new ValidationError(`Invalid format for field: ${error.path}`)
}

// Duplicate key error handler
const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyValue)[0]
  return new ConflictError(`${field} already exists`)
}

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: "error",
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: err.timestamp || new Date().toISOString(),
    ...(err.details && { details: err.details }),
    ...(err.originalError && { originalError: err.originalError }),
  })
}

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      status: "error",
      message: err.message,
      timestamp: err.timestamp || new Date().toISOString(),
    }

    // Include details for validation errors
    if (err.details) {
      response.details = err.details
    }

    // Include retry information for rate limit errors
    if (err.name === "RateLimitError" && err.retryAfter) {
      response.retryAfter = err.retryAfter
    }

    res.status(err.statusCode).json(response)
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("UNEXPECTED ERROR:", err)

    res.status(500).json({
      status: "error",
      message: "Something went wrong on our end. Please try again later.",
      timestamp: new Date().toISOString(),
      errorId: generateErrorId(),
    })
  }
}

// Generate unique error ID for tracking
const generateErrorId = () => {
  return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Log error for monitoring
const logError = (error, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    errorId: generateErrorId(),
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id || "anonymous",
    },
  }

  // Log to console (in production, you might want to use a proper logging service)
  if (error.statusCode >= 500) {
    console.error("SERVER ERROR:", JSON.stringify(errorLog, null, 2))
  } else if (error.statusCode >= 400) {
    console.warn("CLIENT ERROR:", JSON.stringify(errorLog, null, 2))
  }

  return errorLog.errorId
}

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  // Set default error properties
  err.statusCode = err.statusCode || 500
  err.status = err.status || "error"

  // Log the error
  const errorId = logError(err, req)

  let error = { ...err }
  error.message = err.message

  // Handle specific error types
  if (err.code && typeof err.code === "string") {
    // Database errors
    error = handleDatabaseError(err)
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
    // JWT errors
    error = handleJWTError(err)
  } else if (err.isJoi || err.name === "ValidationError") {
    // Validation errors
    error = handleValidationError(err)
  } else if (err.name === "CastError") {
    // Cast errors (invalid UUIDs, etc.)
    error = handleCastError(err)
  } else if (err.code === 11000) {
    // Duplicate key errors
    error = handleDuplicateKeyError(err)
  } else if (err.name === "SyntaxError" && err.status === 400 && "body" in err) {
    // JSON parsing errors
    error = new ValidationError("Invalid JSON format in request body")
  }

  // Add error ID to response
  error.errorId = errorId

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res)
  } else {
    sendErrorProd(error, res)
  }
}

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`)
  next(error)
}

// Graceful shutdown handler
const gracefulShutdown = (server) => {
  return (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`)

    server.close((err) => {
      if (err) {
        console.error("Error during server shutdown:", err)
        process.exit(1)
      }

      console.log("Server closed successfully")
      process.exit(0)
    })

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout")
      process.exit(1)
    }, 30000)
  }
}

// Unhandled promise rejection handler
const unhandledRejectionHandler = (err, promise) => {
  console.error("UNHANDLED PROMISE REJECTION:", err)
  console.error("Promise:", promise)

  // Close server gracefully
  process.exit(1)
}

// Uncaught exception handler
const uncaughtExceptionHandler = (err) => {
  console.error("UNCAUGHT EXCEPTION:", err)

  // Close server gracefully
  process.exit(1)
}

// Setup global error handlers
const setupGlobalErrorHandlers = (server) => {
  // Handle unhandled promise rejections
  process.on("unhandledRejection", unhandledRejectionHandler)

  // Handle uncaught exceptions
  process.on("uncaughtException", uncaughtExceptionHandler)

  // Handle graceful shutdown signals
  process.on("SIGTERM", gracefulShutdown(server))
  process.on("SIGINT", gracefulShutdown(server))
}

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,

  // Main error handler
  errorHandler,

  // Utility functions
  asyncHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,

  // Error handling functions
  handleDatabaseError,
  handleJWTError,
  handleValidationError,
  logError,
  generateErrorId,
}
