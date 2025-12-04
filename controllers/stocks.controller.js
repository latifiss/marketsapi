const mongoose = require('mongoose');
const {
  Profile,
  Statistics,
  Dividends,
  Earnings,
  Financial,
  Holders,
} = require('../models/stocks.model');
const { getRedisClient } = require('../lib/redis');

const setCache = async (key, data, expirationInSeconds = 3600) => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.set === 'function') {
      await client.set(key, JSON.stringify(data), { EX: expirationInSeconds });
    }
  } catch (error) {
    console.error('Error setting cache:', error.message);
  }
};

const getCache = async (key) => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.get === 'function') {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting cache:', error.message);
    return null;
  }
};

const deleteCacheByPattern = async (pattern) => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.scanIterator === 'function') {
      for await (const key of client.scanIterator({ MATCH: pattern })) {
        await client.del(key);
      }
    }
  } catch (error) {
    console.error('Error deleting cache by pattern:', error.message);
  }
};

const invalidateCompanyCache = async (companyId, ticker) => {
  await deleteCacheByPattern(`equity:*`);
  if (companyId) await deleteCacheByPattern(`equity:company:${companyId}:*`);
  if (ticker) await deleteCacheByPattern(`equity:ticker:${ticker}:*`);
};

// ===== PROFILE CONTROLLERS =====
const createProfile = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingProfile = await Profile.findOne({ company_id });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Profile already exists for this company',
        details: { company_id },
      });
    }

    const profile = await Profile.create(req.body);
    await invalidateCompanyCache(company_id, req.body.about?.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Profile created successfully',
      data: profile,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create profile error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getProfileByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:profile:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const profile = await Profile.findOne({ company_id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, profile);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: profile,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const profile = await Profile.findOneAndUpdate({ company_id }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, profile.about?.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const profile = await Profile.findOneAndDelete({ company_id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, profile.about?.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Profile deleted successfully',
      data: {
        company_id: profile.company_id,
        company_name: profile.about?.company_name,
      },
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== STATISTICS CONTROLLERS =====
const createStatistics = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingStats = await Statistics.findOne({ company_id });
    if (existingStats) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Statistics already exist for this company',
        details: { company_id },
      });
    }

    const statistics = await Statistics.create(req.body);
    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Statistics created successfully',
      data: statistics,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create statistics error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getStatisticsByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:statistics:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const statistics = await Statistics.findOne({ company_id });
    if (!statistics) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, statistics);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: statistics,
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateStatistics = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const statistics = await Statistics.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!statistics) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, statistics.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Statistics updated successfully',
      data: statistics,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update statistics error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteStatistics = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const statistics = await Statistics.findOneAndDelete({ company_id });
    if (!statistics) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, statistics.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Statistics deleted successfully',
      data: {
        company_id: statistics.company_id,
        company_name: statistics.company_name,
      },
    });
  } catch (error) {
    console.error('Delete statistics error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== DIVIDENDS CONTROLLERS =====
const createDividends = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingDividends = await Dividends.findOne({ company_id });
    if (existingDividends) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Dividends data already exists for this company',
        details: { company_id },
      });
    }

    const dividends = await Dividends.create(req.body);
    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Dividends data created successfully',
      data: dividends,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create dividends error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getDividendsByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:dividends:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const dividends = await Dividends.findOne({ company_id });
    if (!dividends) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, dividends);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: dividends,
    });
  } catch (error) {
    console.error('Get dividends error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateDividends = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const dividends = await Dividends.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!dividends) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, dividends.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Dividends data updated successfully',
      data: dividends,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update dividends error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteDividends = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const dividends = await Dividends.findOneAndDelete({ company_id });
    if (!dividends) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, dividends.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Dividends data deleted successfully',
      data: {
        company_id: dividends.company_id,
        company_name: dividends.company_name,
      },
    });
  } catch (error) {
    console.error('Delete dividends error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== EARNINGS CONTROLLERS =====
const createEarnings = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingEarnings = await Earnings.findOne({ company_id });
    if (existingEarnings) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Earnings data already exists for this company',
        details: { company_id },
      });
    }

    const earnings = await Earnings.create(req.body);
    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Earnings data created successfully',
      data: earnings,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create earnings error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getEarningsByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:earnings:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const earnings = await Earnings.findOne({ company_id });
    if (!earnings) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, earnings);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: earnings,
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateEarnings = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const earnings = await Earnings.findOneAndUpdate({ company_id }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!earnings) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, earnings.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Earnings data updated successfully',
      data: earnings,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update earnings error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteEarnings = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const earnings = await Earnings.findOneAndDelete({ company_id });
    if (!earnings) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, earnings.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Earnings data deleted successfully',
      data: {
        company_id: earnings.company_id,
        company_name: earnings.company_name,
      },
    });
  } catch (error) {
    console.error('Delete earnings error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== FINANCIAL CONTROLLERS =====
const createFinancial = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingFinancial = await Financial.findOne({ company_id });
    if (existingFinancial) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Financial data already exists for this company',
        details: { company_id },
      });
    }

    const financial = await Financial.create(req.body);
    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Financial data created successfully',
      data: financial,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create financial error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getFinancialByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:financial:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const financial = await Financial.findOne({ company_id });
    if (!financial) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, financial);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: financial,
    });
  } catch (error) {
    console.error('Get financial error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateFinancial = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const financial = await Financial.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!financial) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, financial.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Financial data updated successfully',
      data: financial,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update financial error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteFinancial = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const financial = await Financial.findOneAndDelete({ company_id });
    if (!financial) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, financial.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Financial data deleted successfully',
      data: {
        company_id: financial.company_id,
        company_name: financial.company_name,
      },
    });
  } catch (error) {
    console.error('Delete financial error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== HOLDERS CONTROLLERS =====
const createHolders = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
    }

    const existingHolders = await Holders.findOne({ company_id });
    if (existingHolders) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Holders data already exists for this company',
        details: { company_id },
      });
    }

    const holders = await Holders.create(req.body);
    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Holders data created successfully',
      data: holders,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Create holders error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getHoldersByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:holders:company:${company_id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const holders = await Holders.findOne({ company_id });
    if (!holders) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
    }

    await setCache(cacheKey, holders);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: holders,
    });
  } catch (error) {
    console.error('Get holders error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateHolders = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const holders = await Holders.findOneAndUpdate({ company_id }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!holders) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, holders.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Holders data updated successfully',
      data: holders,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed',
        details: { errors },
      });
    }

    console.error('Update holders error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteHolders = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const holders = await Holders.findOneAndDelete({ company_id });
    if (!holders) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
    }

    await invalidateCompanyCache(company_id, holders.ticker_symbol);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Holders data deleted successfully',
      data: {
        company_id: holders.company_id,
        company_name: holders.company_name,
      },
    });
  } catch (error) {
    console.error('Delete holders error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

// ===== COMPREHENSIVE COMPANY DATA =====
const getCompanyAllData = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (req.rateLimit && req.rateLimit.remaining === 0) {
      return res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: req.rateLimit.limit,
          resetIn: req.rateLimit.resetIn,
        },
      });
    }

    const cacheKey = `equity:company:${company_id}:all`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const [profile, statistics, dividends, earnings, financial, holders] =
      await Promise.all([
        Profile.findOne({ company_id }),
        Statistics.findOne({ company_id }),
        Dividends.findOne({ company_id }),
        Earnings.findOne({ company_id }),
        Financial.findOne({ company_id }),
        Holders.findOne({ company_id }),
      ]);

    const companyData = {
      profile: profile || null,
      statistics: statistics || null,
      dividends: dividends || null,
      earnings: earnings || null,
      financial: financial || null,
      holders: holders || null,
    };

    await setCache(cacheKey, companyData, 600);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: companyData,
    });
  } catch (error) {
    console.error('Get company all data error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching company data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

module.exports = {
  setCache,
  getCache,
  deleteCacheByPattern,
  invalidateCompanyCache,

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
};
