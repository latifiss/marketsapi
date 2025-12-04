const express = require('express');
const router = express.Router();
const {
  createForex,
  getAllForex,
  getForex,
  updateForex,
  deleteForex,
  getForexHistory,
  addForexHistory,
  updateForexPrice,
} = require('../controllers/forex.controller');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyRateLimit } = require('../middleware/rateLimit');

router.post('/forex', authenticateApiKey, createForex);
router.put('/forex/:code', authenticateApiKey, updateForex);
router.delete('/forex/:code', authenticateApiKey, deleteForex);
router.post('/forex/:code/price', authenticateApiKey, updateForexPrice);

router.get('/forex', apiKeyRateLimit, getAllForex);
router.get('/forex/:code', apiKeyRateLimit, getForex);
router.get('/forex/:code/history', apiKeyRateLimit, getForexHistory);

router.post('/forex/:code/history', authenticateApiKey, addForexHistory);

module.exports = router;
