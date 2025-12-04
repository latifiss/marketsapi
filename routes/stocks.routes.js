const express = require('express');
const router = express.Router();
const {
  createProfile,
  getProfileByCompanyId,
  updateProfile,
  deleteProfile,
  createStatistics,
  getStatisticsByCompanyId,
  updateStatistics,
  deleteStatistics,
  createDividends,
  getDividendsByCompanyId,
  updateDividends,
  deleteDividends,
  createEarnings,
  getEarningsByCompanyId,
  updateEarnings,
  deleteEarnings,
  createFinancial,
  getFinancialByCompanyId,
  updateFinancial,
  deleteFinancial,
  createHolders,
  getHoldersByCompanyId,
  updateHolders,
  deleteHolders,
  getCompanyAllData,
} = require('../controllers/stocks.controller');
const { authenticateApiKey } = require('../middleware/auth');
const { apiKeyRateLimit } = require('../middleware/rateLimit');

// Profile routes
router.post('/equity/profiles', authenticateApiKey, createProfile);
router.get(
  '/equity/profiles/:company_id',
  apiKeyRateLimit,
  getProfileByCompanyId
);
router.put('/equity/profiles/:company_id', authenticateApiKey, updateProfile);
router.delete(
  '/equity/profiles/:company_id',
  authenticateApiKey,
  deleteProfile
);

// Statistics routes
router.post('/equity/statistics', authenticateApiKey, createStatistics);
router.get(
  '/equity/statistics/:company_id',
  apiKeyRateLimit,
  getStatisticsByCompanyId
);
router.put(
  '/equity/statistics/:company_id',
  authenticateApiKey,
  updateStatistics
);
router.delete(
  '/equity/statistics/:company_id',
  authenticateApiKey,
  deleteStatistics
);

// Dividends routes
router.post('/equity/dividends', authenticateApiKey, createDividends);
router.get(
  '/equity/dividends/:company_id',
  apiKeyRateLimit,
  getDividendsByCompanyId
);
router.put(
  '/equity/dividends/:company_id',
  authenticateApiKey,
  updateDividends
);
router.delete(
  '/equity/dividends/:company_id',
  authenticateApiKey,
  deleteDividends
);

// Earnings routes
router.post('/equity/earnings', authenticateApiKey, createEarnings);
router.get(
  '/equity/earnings/:company_id',
  apiKeyRateLimit,
  getEarningsByCompanyId
);
router.put('/equity/earnings/:company_id', authenticateApiKey, updateEarnings);
router.delete(
  '/equity/earnings/:company_id',
  authenticateApiKey,
  deleteEarnings
);

// Financial routes
router.post('/equity/financial', authenticateApiKey, createFinancial);
router.get(
  '/equity/financial/:company_id',
  apiKeyRateLimit,
  getFinancialByCompanyId
);
router.put(
  '/equity/financial/:company_id',
  authenticateApiKey,
  updateFinancial
);
router.delete(
  '/equity/financial/:company_id',
  authenticateApiKey,
  deleteFinancial
);

// Holders routes
router.post('/equity/holders', authenticateApiKey, createHolders);
router.get(
  '/equity/holders/:company_id',
  apiKeyRateLimit,
  getHoldersByCompanyId
);
router.put('/equity/holders/:company_id', authenticateApiKey, updateHolders);
router.delete('/equity/holders/:company_id', authenticateApiKey, deleteHolders);

// Comprehensive company data
router.get(
  '/equity/company/:company_id/all',
  apiKeyRateLimit,
  getCompanyAllData
);

module.exports = router;
