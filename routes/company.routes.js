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

router.get('/group-by-industry', companyController.getGroupCompaniesByIndustry);

router.get(
  '/industry/:industry/exchange/:exchangeName',
  companyController.getCompaniesFromIndustryInExchange
);

router.get(
  '/group-by-industry/exchange/:exchangeName',
  companyController.getGroupCompaniesByIndustryInExchange
);

router.get(
  '/industry-performance/exchange/:exchangeName',
  companyController.getIndustryPerformanceInExchange
);

module.exports = router;
