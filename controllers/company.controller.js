const Company = require('../models/company.model');

// Create a new company
exports.createCompany = async (req, res) => {
  try {
    const newCompany = await Company.create(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        company: newCompany,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Update a company
exports.updateCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'Company not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        company,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get a single company by ID
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'Company not found',
      });
    }
    res.status(200).json({
      status: 'success',
      data: {
        company,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get all companies
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find();
    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get companies from a specific country
exports.getCompaniesFromCountry = async (req, res) => {
  try {
    const companies = await Company.find({
      'about.country': req.params.country,
    });
    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get companies from a specific exchange
exports.getCompaniesFromExchange = async (req, res) => {
  try {
    const companies = await Company.find({
      'shares.exchange_listed_name': req.params.exchangeName,
    });
    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get companies from a specific industry
exports.getCompaniesFromIndustry = async (req, res) => {
  try {
    const companies = await Company.find({
      'about.industry': req.params.industry,
    });
    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get companies from a specific industry in a particular country
exports.getCompaniesFromIndustryInCountry = async (req, res) => {
  try {
    const companies = await Company.find({
      'about.industry': req.params.industry,
      'about.country': req.params.country,
    });
    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get all companies grouped by industry
exports.getGroupCompaniesByIndustry = async (req, res) => {
  try {
    const companies = await Company.aggregate([
      {
        $group: {
          _id: '$about.industry',
          companies: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get companies from a specific industry in a particular exchange
exports.getCompaniesFromIndustryInExchange = async (req, res) => {
  try {
    const companies = await Company.find({
      'about.industry': req.params.industry,
      'shares.exchange_listed_name': req.params.exchangeName,
    });

    res.status(200).json({
      status: 'success',
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

exports.getIndustryPerformanceInExchange = async (req, res) => {
  try {
    const exchangeName = req.params.exchangeName;

    // Aggregate to calculate weighted performance
    const industryPerformance = await Company.aggregate([
      {
        $match: { 'shares.exchange_listed_name': exchangeName },
      },
      {
        $group: {
          _id: '$about.industry',
          totalMarketCap: { $sum: '$key_statistics.market_capitalization' },
          weightedPerformance: {
            $sum: {
              $multiply: [
                '$key_statistics.market_capitalization',
                '$key_statistics.percentage_change',
              ],
            },
          },
          companies: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          industry: '$_id',
          performance: {
            $divide: ['$weightedPerformance', '$totalMarketCap'],
          },
          companyCount: { $size: '$companies' },
        },
      },
      {
        $sort: { performance: -1 }, // Sort by best-performing first
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        exchange: exchangeName,
        industryPerformance,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Get all companies grouped by industry in a specific exchange
exports.getGroupCompaniesByIndustryInExchange = async (req, res) => {
  try {
    const exchangeName = req.params.exchangeName;

    const companiesByIndustry = await Company.aggregate([
      {
        $match: {
          'shares.exchange_listed_name': exchangeName,
        },
      },
      {
        $group: {
          _id: '$about.industry',
          companies: { $push: '$$ROOT' },
          count: { $sum: 1 },
          totalMarketCap: { $sum: '$key_statistics.market_capitalization' },
        },
      },
      {
        $project: {
          industry: '$_id',
          companyCount: '$count',
          totalMarketCap: 1,
          companies: 1,
          _id: 0,
        },
      },
      {
        $sort: { totalMarketCap: -1 },
      },
    ]);

    if (companiesByIndustry.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message:
          'No companies found for this exchange or industries not defined',
      });
    }

    res.status(200).json({
      status: 'success',
      results: companiesByIndustry.length,
      data: {
        exchange: exchangeName,
        industries: companiesByIndustry,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};
