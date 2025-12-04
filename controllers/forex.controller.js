const mongoose = require('mongoose');
const Forex = require('../models/forex.model');
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

const invalidateCache = async (code = null) => {
  await deleteCacheByPattern('forex:*');
  if (code) {
    await deleteCacheByPattern(`forex:code:${code}`);
  }
};

const createForex = async (req, res) => {
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
      code,
      name,
      from_currency,
      from_code,
      to_currency,
      to_code,
      currentPrice,
      percentage_change,
      monthly_change,
      yearly_change,
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
      'code',
      'name',
      'from_currency',
      'from_code',
      'to_currency',
      'to_code',
      'currentPrice',
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

    const newForex = new Forex({
      code,
      name,
      from_currency,
      from_code: from_code.toUpperCase(),
      to_currency,
      to_code: to_code.toUpperCase(),
      currentPrice,
      percentage_change: percentage_change || 0,
      monthly_change: monthly_change || 0,
      yearly_change: yearly_change || 0,
      price_history: [],
      last_updated: new Date(),
    });

    const savedForex = await newForex.save();
    await invalidateCache(code);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Forex pair created successfully',
      data: savedForex,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Forex code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: error.keyValue.code,
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
      message: 'Internal server error creating Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getAllForex = async (req, res) => {
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

    const cacheKey = 'forex:all';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const forexPairs = await Forex.find();
    await setCache(cacheKey, forexPairs);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: forexPairs,
    });
  } catch (error) {
    console.error('Get all error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex pairs',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getForex = async (req, res) => {
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

    const cacheKey = `forex:code:${code}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const forex = await Forex.findOne({ code });
    if (!forex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
    }

    await setCache(cacheKey, forex);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: forex,
    });
  } catch (error) {
    console.error('Get by code error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateForex = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { code } = req.params;
    const { currentPrice, ...updateData } = req.body;

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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
    }

    const updateOperations = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    if (currentPrice !== undefined && currentPrice !== forex.currentPrice) {
      const percentage_change =
        ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;

      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4)
      );

      updateOperations.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: forex.currentPrice,
            },
          ],
          $position: 0,
        },
      };
    }

    const updatedForex = await Forex.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex pair updated successfully',
      data: updatedForex,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Forex code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: error.keyValue.code,
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
      message: 'Internal server error updating Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteForex = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

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

    const deletedForex = await Forex.findOneAndDelete({ code });
    if (!deletedForex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex pair deleted successfully',
      data: {
        code: deletedForex.code,
        name: deletedForex.name,
      },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getForexHistory = async (req, res) => {
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

    const cacheKey = `forex:code:${code}:history`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const forex = await Forex.findOne({ code }).select('code price_history');
    if (!forex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
    }

    const result = {
      code: forex.code,
      price_history: forex.price_history,
    };

    await setCache(cacheKey, result);

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

const addForexHistory = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { code } = req.params;
    const { date, price } = req.body;

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

    if (!price) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Price is required',
        details: {
          required: ['price'],
        },
      });
    }

    const newPriceEntry = {
      date: date || new Date(),
      price,
    };

    const updatedForex = await Forex.findOneAndUpdate(
      { code },
      {
        $push: { price_history: newPriceEntry },
        $set: { last_updated: new Date() },
      },
      { new: true }
    );

    if (!updatedForex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history added successfully',
      data: {
        code: updatedForex.code,
        new_price_entry: newPriceEntry,
        total_history_entries: updatedForex.price_history.length,
      },
    });
  } catch (error) {
    console.error('Add history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateForexPrice = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { code } = req.params;
    const { currentPrice } = req.body;

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

    if (!currentPrice) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Current price is required',
        details: {
          required: ['currentPrice'],
        },
      });
    }

    const forex = await Forex.findOne({ code });
    if (!forex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
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
              price: forex.currentPrice,
            },
          ],
          $position: 0,
        },
      },
    };

    if (currentPrice !== forex.currentPrice) {
      const percentage_change =
        ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4)
      );
    }

    const updatedForex = await Forex.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex price updated successfully',
      data: updatedForex,
    });
  } catch (error) {
    console.error('Update price error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating Forex price',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

module.exports = {
  createForex,
  getAllForex,
  getForex,
  updateForex,
  deleteForex,
  getForexHistory,
  addForexHistory,
  updateForexPrice,
  setCache,
  getCache,
  deleteCacheByPattern,
  invalidateCache,
};
