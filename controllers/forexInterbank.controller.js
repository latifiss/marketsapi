const mongoose = require('mongoose');
const ForexInterbank = require('../models/ForexInterbank');
const { getRedisClient } = require('../lib/redis');

const setCache = async (key, data, expirationInSeconds = 86400) => {
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

const invalidateCache = async (code = null, id = null) => {
  await deleteCacheByPattern('forexinterbank:*');
  if (code) {
    await deleteCacheByPattern(`forexinterbank:code:${code}`);
  }
  if (id) {
    await deleteCacheByPattern(`forexinterbank:id:${id}`);
  }
};

const createInterbankPair = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const {
      bankName,
      bankCode,
      code,
      name,
      from_currency,
      from_code,
      to_currency,
      to_code,
      current_buying_price,
      buying_percentage_change,
      current_selling_price,
      selling_percentage_change,
      current_midrate_price,
      midrate_percentage_change,
      price_history,
    } = req.body;

    if (
      !from_code ||
      from_code.length !== 3 ||
      !to_code ||
      to_code.length !== 3
    ) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Currency codes must be exactly 3 characters',
        details: {
          from_code: from_code || 'missing',
          to_code: to_code || 'missing',
          expected: '3 characters',
        },
      });
    }

    const requiredFields = [
      'bankName',
      'bankCode',
      'code',
      'name',
      'from_currency',
      'from_code',
      'to_currency',
      'to_code',
      'current_buying_price',
      'current_selling_price',
      'current_midrate_price',
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields',
        details: { missingFields },
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

    const newPair = new ForexInterbank({
      bankName,
      bankCode,
      code,
      name,
      from_currency,
      from_code: from_code.toUpperCase(),
      to_currency,
      to_code: to_code.toUpperCase(),
      current_buying_price,
      buying_percentage_change: buying_percentage_change || 0,
      current_selling_price,
      selling_percentage_change: selling_percentage_change || 0,
      current_midrate_price,
      midrate_percentage_change: midrate_percentage_change || 0,
      price_history: price_history || [],
      last_updated: new Date(),
    });

    const savedPair = await newPair.save();
    await invalidateCache(code, savedPair._id.toString());

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Forex Interbank pair created successfully',
      data: savedPair,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Bank code or code already exists',
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

    console.error('Create error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating Forex Interbank pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateInterbankPair = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
      });
    }

    const updateData = req.body;

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

    if (updateData.from_code && updateData.from_code.length !== 3) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'From currency code must be exactly 3 characters',
        details: {
          from_code: updateData.from_code,
          expected: '3 characters',
        },
      });
    }

    if (updateData.to_code && updateData.to_code.length !== 3) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'To currency code must be exactly 3 characters',
        details: {
          to_code: updateData.to_code,
          expected: '3 characters',
        },
      });
    }

    if (updateData.from_code)
      updateData.from_code = updateData.from_code.toUpperCase();
    if (updateData.to_code)
      updateData.to_code = updateData.to_code.toUpperCase();

    updateData.last_updated = new Date();

    const updatedPair = await ForexInterbank.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedPair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    await invalidateCache(updatedPair.code, id);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex Interbank pair updated successfully',
      data: updatedPair,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Bank code or code already exists',
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

    console.error('Update error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating Forex Interbank pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteInterbankPair = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
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

    const pair = await ForexInterbank.findById(id);
    if (!pair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    await ForexInterbank.findByIdAndDelete(id);
    await invalidateCache(pair.code, id);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex Interbank pair deleted successfully',
      data: {
        id: pair._id,
        code: pair.code,
        bankName: pair.bankName,
      },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting Forex Interbank pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getAllInterbankPairs = async (req, res) => {
  try {
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

    const cacheKey = 'forexinterbank:all:nohistory';
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        count: cached.length,
        data: cached,
      });
    }

    const pairs = await ForexInterbank.find().select('-price_history');
    await setCache(cacheKey, pairs, 300);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      count: pairs.length,
      data: pairs,
    });
  } catch (error) {
    console.error('Get all error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex Interbank pairs',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getInterbankPair = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
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

    const cacheKey = `forexinterbank:id:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const pair = await ForexInterbank.findById(id);
    if (!pair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    await setCache(cacheKey, pair, 300);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: pair,
    });
  } catch (error) {
    console.error('Get by ID error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex Interbank pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getInterbankPairHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
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

    const cacheKey = `forexinterbank:id:${id}:history`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const pair = await ForexInterbank.findById(id).select('code price_history');
    if (!pair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    const result = {
      code: pair.code,
      price_history: pair.price_history,
    };

    await setCache(cacheKey, result, 300);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const addPriceHistory = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
      });
    }

    const { date, buying_price, selling_price, midrate_price } = req.body;

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

    if (!buying_price || !selling_price || !midrate_price) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing price fields',
        details: {
          required: ['buying_price', 'selling_price', 'midrate_price'],
        },
      });
    }

    const newPriceEntry = {
      date: date || new Date(),
      buying_price,
      selling_price,
      midrate_price,
    };

    const updatedPair = await ForexInterbank.findByIdAndUpdate(
      id,
      {
        $push: { price_history: newPriceEntry },
        $set: { last_updated: new Date() },
      },
      { new: true, runValidators: true }
    );

    if (!updatedPair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    await invalidateCache(updatedPair.code, id);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history added successfully',
      data: {
        code: updatedPair.code,
        new_price_entry: newPriceEntry,
        total_history_entries: updatedPair.price_history.length,
      },
    });
  } catch (error) {
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

    console.error('Add history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getInterbankPairByCode = async (req, res) => {
  try {
    const { code } = req.params;

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

    const cacheKey = `forexinterbank:code:${code}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const pair = await ForexInterbank.findOne({ code });
    if (!pair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { code },
      });
    }

    await setCache(cacheKey, pair, 300);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: pair,
    });
  } catch (error) {
    console.error('Get by code error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex Interbank pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updatePrices = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid ID format',
        details: {
          id,
          expected: 'Valid MongoDB ObjectId',
        },
      });
    }

    const {
      current_buying_price,
      current_selling_price,
      current_midrate_price,
    } = req.body;

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

    const pair = await ForexInterbank.findById(id);
    if (!pair) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex Interbank pair not found',
        details: { id },
      });
    }

    const updateOperations = {
      $set: {
        last_updated: new Date(),
      },
      $push: {
        price_history: {
          $each: [
            {
              date: new Date(),
              buying_price: pair.current_buying_price,
              selling_price: pair.current_selling_price,
              midrate_price: pair.current_midrate_price,
            },
          ],
          $position: 0,
        },
      },
    };

    if (
      current_buying_price !== undefined &&
      current_buying_price !== pair.current_buying_price
    ) {
      const buyingPercentageChange =
        ((current_buying_price - pair.current_buying_price) /
          pair.current_buying_price) *
        100;
      updateOperations.$set.current_buying_price = current_buying_price;
      updateOperations.$set.buying_percentage_change = parseFloat(
        buyingPercentageChange.toFixed(4)
      );
    }

    if (
      current_selling_price !== undefined &&
      current_selling_price !== pair.current_selling_price
    ) {
      const sellingPercentageChange =
        ((current_selling_price - pair.current_selling_price) /
          pair.current_selling_price) *
        100;
      updateOperations.$set.current_selling_price = current_selling_price;
      updateOperations.$set.selling_percentage_change = parseFloat(
        sellingPercentageChange.toFixed(4)
      );
    }

    if (
      current_midrate_price !== undefined &&
      current_midrate_price !== pair.current_midrate_price
    ) {
      const midratePercentageChange =
        ((current_midrate_price - pair.current_midrate_price) /
          pair.current_midrate_price) *
        100;
      updateOperations.$set.current_midrate_price = current_midrate_price;
      updateOperations.$set.midrate_percentage_change = parseFloat(
        midratePercentageChange.toFixed(4)
      );
    }

    const updatedPair = await ForexInterbank.findByIdAndUpdate(
      id,
      updateOperations,
      { new: true }
    );

    await invalidateCache(updatedPair.code, id);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Prices updated successfully',
      data: updatedPair,
    });
  } catch (error) {
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

    console.error('Update prices error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating prices',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

module.exports = {
  createInterbankPair,
  updateInterbankPair,
  deleteInterbankPair,
  getAllInterbankPairs,
  getInterbankPair,
  getInterbankPairHistory,
  addPriceHistory,
  getInterbankPairByCode,
  updatePrices,
  setCache,
  getCache,
  deleteCacheByPattern,
  invalidateCache,
};
