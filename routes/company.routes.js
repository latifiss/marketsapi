const express = require('express');
const companyController = require('../controllers/company.controller');

const router = express.Router();

router.post('/', companyController.createCompany);

router.patch('/:id', companyController.updateCompany);

router.get('/:id', companyController.getCompany);

router.get('/', companyController.getAllCompanies);

router.get('/country/:country', companyController.getCompaniesFromCountry);

router.get(
  '/exchange/:exchangeName',
  companyController.getCompaniesFromExchange
);

router.get('/industry/:industry', companyController.getCompaniesFromIndustry);

router.get(
  '/industry/:industry/country/:country',
  companyController.getCompaniesFromIndustryInCountry
);

// Get all companies grouped by industry
router.get('/group-by-industry', companyController.getGroupCompaniesByIndustry);

// Get companies from industry in specific exchange
router.get(
  '/industry/:industry/exchange/:exchangeName',
  companyController.getCompaniesFromIndustryInExchange
);

// Get all companies grouped by industry in specific exchange
router.get(
  '/group-by-industry/exchange/:exchangeName',
  companyController.getGroupCompaniesByIndustryInExchange
);

// Get industry performance for a specific exchange
router.get(
  '/industry-performance/exchange/:exchangeName',
  companyController.getIndustryPerformanceInExchange
);

module.exports = router;
