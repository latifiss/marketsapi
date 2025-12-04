const express = require('express');
const router = express.Router();
const {
  getAllCommodities,
  getCommodityByCode,
  createCommodity,
  updateCommodity,
  deleteCommodity,
  getCommodityHistory,
  addCommodityHistory,
  updateCommodityPrice,
} = require('../controllers/commodities.controller');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyRateLimit } = require('../middleware/rateLimit');

router.post('/commodities', authenticateApiKey, createCommodity);
router.put('/commodities/:code', authenticateApiKey, updateCommodity);
router.delete('/commodities/:code', authenticateApiKey, deleteCommodity);
router.post(
  '/commodities/:code/price',
  authenticateApiKey,
  updateCommodityPrice
);

router.get('/commodities', apiKeyRateLimit, getAllCommodities);
router.get('/commodities/:code', apiKeyRateLimit, getCommodityByCode);
router.get('/commodities/:code/history', apiKeyRateLimit, getCommodityHistory);

router.post(
  '/commodities/:code/history',
  authenticateApiKey,
  addCommodityHistory
);

module.exports = router;
