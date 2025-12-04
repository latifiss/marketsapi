const express = require('express');
const router = express.Router();
const {
  createInterbankPair,
  updateInterbankPair,
  deleteInterbankPair,
  getAllInterbankPairs,
  getInterbankPair,
  getInterbankPairHistory,
  addPriceHistory,
  getInterbankPairByCode,
} = require('../controllers/forexInterbank.controller');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyRateLimit } = require('../middleware/rateLimit');

router.post('/interbank-pairs', authenticateApiKey, createInterbankPair);
router.put('/interbank-pairs/:id', authenticateApiKey, updateInterbankPair);
router.delete('/interbank-pairs/:id', authenticateApiKey, deleteInterbankPair);

router.get('/interbank-pairs', apiKeyRateLimit, getAllInterbankPairs);
router.get('/interbank-pairs/:id', apiKeyRateLimit, getInterbankPair);
router.get(
  '/interbank-pairs/:id/history',
  apiKeyRateLimit,
  getInterbankPairHistory
);
router.get(
  '/interbank-pairs/code/:code',
  apiKeyRateLimit,
  getInterbankPairByCode
);

router.post(
  '/interbank-pairs/:id/history',
  authenticateApiKey,
  addPriceHistory
);

module.exports = router;
