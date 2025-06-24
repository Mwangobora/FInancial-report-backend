const rateLimit = require("express-rate-limit")

// Basic rate limiter for all requests - Very permissive for development
const basicLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // limit each IP to 10000 requests per windowMs
  message: {
    error: "Too many requests",
    message: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil((Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000) / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests",
      message: "Too many requests from this IP, please try again later.",
      retryAfter: Math.ceil((Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000) / 1000),
      timestamp: new Date().toISOString(),
    })
  },
})

// More permissive rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 requests per windowMs for auth endpoints
  message: {
    error: "Too many authentication attempts",
    message: "Too many authentication attempts from this IP, please try again later.",
    retryAfter: 5 * 60, // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for auth endpoint: ${req.ip} - ${req.originalUrl}`)
    res.status(429).json({
      error: "Too many authentication attempts",
      message: "Too many authentication attempts from this IP, please try again later.",
      retryAfter: 5 * 60,
      timestamp: new Date().toISOString(),
    })
  },
})

// Very permissive rate limiter for data creation endpoints
const createLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 create requests per windowMs
  message: {
    error: "Too many creation requests",
    message: "Too many creation requests from this IP, please try again later.",
    retryAfter: 1 * 60, // 1 minute in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for create endpoint: ${req.ip} - ${req.originalUrl}`)
    res.status(429).json({
      error: "Too many creation requests",
      message: "Too many creation requests from this IP, please try again later.",
      retryAfter: 1 * 60,
      timestamp: new Date().toISOString(),
    })
  },
})

// Very lenient rate limiter for read-only endpoints
const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5000, // limit each IP to 5000 read requests per windowMs
  message: {
    error: "Too many read requests",
    message: "Too many read requests from this IP, please try again later.",
    retryAfter: 1 * 60, // 1 minute in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many read requests",
      message: "Too many read requests from this IP, please try again later.",
      retryAfter: 1 * 60,
      timestamp: new Date().toISOString(),
    })
  },
})

// Very strict rate limiter for sensitive operations
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 sensitive requests per hour
  message: {
    error: "Too many sensitive requests",
    message: "Too many sensitive requests from this IP, please try again later.",
    retryAfter: 60 * 60, // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error(`Rate limit exceeded for sensitive endpoint: ${req.ip} - ${req.originalUrl}`)
    res.status(429).json({
      error: "Too many sensitive requests",
      message: "Too many sensitive requests from this IP, please try again later.",
      retryAfter: 60 * 60,
      timestamp: new Date().toISOString(),
    })
  },
})

// Custom rate limiter factory for specific needs
const createCustomLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      error: "Rate limit exceeded",
      message: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }

  return rateLimit({
    ...defaultOptions,
    ...options,
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000) || 900
      res.status(429).json({
        error: options.message?.error || "Rate limit exceeded",
        message: options.message?.message || "Too many requests from this IP, please try again later.",
        retryAfter,
        timestamp: new Date().toISOString(),
      })
    },
  })
}

// Rate limiter for file uploads (if needed in future)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: "Too many upload requests",
    message: "Too many upload requests from this IP, please try again later.",
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many upload requests",
      message: "Too many upload requests from this IP, please try again later.",
      retryAfter: 60 * 60,
      timestamp: new Date().toISOString(),
    })
  },
})

// Skip rate limiting for certain conditions
const skipRateLimit = (req, res) => {
  // Skip rate limiting for health checks
  if (req.path === "/health") {
    return true
  }

  // Skip rate limiting for localhost and common development IPs
  if (process.env.NODE_ENV === "development") {
    const devIPs = ["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]
    if (devIPs.includes(req.ip) || req.ip?.startsWith("192.168.") || req.ip?.startsWith("10.")) {
      return true
    }
  }

  // Skip rate limiting for whitelisted IPs (if configured)
  const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST?.split(",") || []
  if (whitelistedIPs.includes(req.ip)) {
    return true
  }

  return false
}

// Apply skip logic to all limiters
const applySkipLogic = (limiter) => {
  const originalSkip = limiter.skip
  limiter.skip = (req, res) => {
    if (skipRateLimit(req, res)) {
      return true
    }
    return originalSkip ? originalSkip(req, res) : false
  }
  return limiter
}

// Apply skip logic to all exported limiters
module.exports = {
  // Main rate limiter (use this as default)
  default: applySkipLogic(basicLimiter),

  // Specific rate limiters
  basicLimiter: applySkipLogic(basicLimiter),
  authLimiter: applySkipLogic(authLimiter),
  createLimiter: applySkipLogic(createLimiter),
  readLimiter: applySkipLogic(readLimiter),
  sensitiveLimiter: applySkipLogic(sensitiveLimiter),
  uploadLimiter: applySkipLogic(uploadLimiter),

  // Custom limiter factory
  createCustomLimiter,

  // Utility functions
  skipRateLimit,
}

// Export the default limiter as the main export
module.exports = applySkipLogic(basicLimiter)
module.exports.basicLimiter = applySkipLogic(basicLimiter)
module.exports.authLimiter = applySkipLogic(authLimiter)
module.exports.createLimiter = applySkipLogic(createLimiter)
module.exports.readLimiter = applySkipLogic(readLimiter)
module.exports.sensitiveLimiter = applySkipLogic(sensitiveLimiter)
module.exports.uploadLimiter = applySkipLogic(uploadLimiter)
module.exports.createCustomLimiter = createCustomLimiter
module.exports.skipRateLimit = skipRateLimit
