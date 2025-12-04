const express = require('express');
const router = express.Router();
const {
  createIndex,
  updateIndex,
  getAllIndices,
  getIndexByCode,
  deleteIndex,
  getIndexHistory,
  addIndexHistory,
  updateIndexPrice,
} = require('../controllers/index.controller');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyRateLimit } = require('../middleware/rateLimit');

router.post('/indices', authenticateApiKey, createIndex);
router.put('/indices/:code', authenticateApiKey, updateIndex);
router.delete('/indices/:code', authenticateApiKey, deleteIndex);
router.post('/indices/:code/price', authenticateApiKey, updateIndexPrice);

router.get('/indices', apiKeyRateLimit, getAllIndices);
router.get('/indices/:code', apiKeyRateLimit, getIndexByCode);
router.get('/indices/:code/history', apiKeyRateLimit, getIndexHistory);

router.post('/indices/:code/history', authenticateApiKey, addIndexHistory);

module.exports = router;
