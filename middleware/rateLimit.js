import rateLimit from 'express-rate-limit';

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 429,
      message: 'Too many requests. Rate limit exceeded',
      details: {
        limit: 50,
        window: '1 hour',
        resetIn: '1 hour',
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  generalRateLimit,
  authRateLimit,
  apiKeyRateLimit,
};
