import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

export const generateApiKey = (userId) => {
  const apiKey = `forex_${crypto.randomBytes(32).toString('hex')}`;
  return apiKey;
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: 'API key required',
      details: {
        header: 'x-api-key',
        expected: 'Valid API key',
      },
    });
  }

  const isValidApiKey = validateApiKey(apiKey);

  if (!isValidApiKey) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: 'Invalid API key',
      details: {
        providedKey: apiKey.slice(0, 10) + '...',
      },
    });
  }

  req.apiKey = apiKey;
  next();
};

const validateApiKey = (apiKey) => {
  const apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  return apiKeys.includes(apiKey);
};

export default {
  generateToken,
  generateApiKey,
  authenticateToken,
  authenticateApiKey,
};
