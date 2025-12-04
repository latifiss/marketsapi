const mongoose = require('mongoose');
const Commodity = require('../models/commodity.model');
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
  await deleteCacheByPattern('commodities:*');
  if (code) {
    await deleteCacheByPattern(`commodity:code:${code}`);
  }
};

const getAllCommodities = async (req, res) => {
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

    const cacheKey = 'commodities:all';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const commodities = await Commodity.find();
    await setCache(cacheKey, commodities);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: commodities,
    });
  } catch (error) {
    console.error('Get all commodities error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodities',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getCommodityByCode = async (req, res) => {
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

    const cacheKey = `commodity:code:${code}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
    }

    await setCache(cacheKey, commodity);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: commodity,
    });
  } catch (error) {
    console.error('Get commodity error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const createCommodity = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    const { code, name, unit, category, currentPrice, percentage_change } =
      req.body;

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

    const requiredFields = ['code', 'name', 'unit', 'category', 'currentPrice'];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields',
        details: { missingFields },
      });
    }

    const existingCommodity = await Commodity.findOne({ code });
    if (existingCommodity) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Commodity with this code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: code,
        },
      });
    }

    const commodity = await Commodity.create({
      code,
      name,
      unit,
      category,
      currentPrice,
      percentage_change: percentage_change || 0,
      price_history: [],
      last_updated: new Date(),
    });

    await invalidateCache(code);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Commodity created successfully',
      data: commodity,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Commodity code already exists',
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

    console.error('Create commodity error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateCommodity = async (req, res) => {
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
    }

    const updateOperations = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    if (currentPrice !== undefined && currentPrice !== commodity.currentPrice) {
      const percentage_change =
        ((currentPrice - commodity.currentPrice) / commodity.currentPrice) *
        100;

      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4)
      );

      updateOperations.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: commodity.currentPrice,
            },
          ],
          $position: 0,
        },
      };
    }

    const updatedCommodity = await Commodity.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true, runValidators: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity updated successfully',
      data: updatedCommodity,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Commodity code already exists',
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

    console.error('Update commodity error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteCommodity = async (req, res) => {
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

    const deletedCommodity = await Commodity.findOneAndDelete({ code });
    if (!deletedCommodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity deleted successfully',
      data: {
        code: deletedCommodity.code,
        name: deletedCommodity.name,
      },
    });
  } catch (error) {
    console.error('Delete commodity error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getCommodityHistory = async (req, res) => {
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

    const cacheKey = `commodity:code:${code}:history`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const commodity = await Commodity.findOne({ code }).select(
      'code price_history'
    );
    if (!commodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
    }

    const result = {
      code: commodity.code,
      price_history: commodity.price_history,
    };

    await setCache(cacheKey, result);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error) {
    console.error('Get commodity history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodity history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const addCommodityHistory = async (req, res) => {
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

    const updatedCommodity = await Commodity.findOneAndUpdate(
      { code },
      {
        $push: { price_history: newPriceEntry },
        $set: { last_updated: new Date() },
      },
      { new: true }
    );

    if (!updatedCommodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history added successfully',
      data: {
        code: updatedCommodity.code,
        new_price_entry: newPriceEntry,
        total_history_entries: updatedCommodity.price_history.length,
      },
    });
  } catch (error) {
    console.error('Add commodity history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateCommodityPrice = async (req, res) => {
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
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
              price: commodity.currentPrice,
            },
          ],
          $position: 0,
        },
      },
    };

    if (currentPrice !== commodity.currentPrice) {
      const percentage_change =
        ((currentPrice - commodity.currentPrice) / commodity.currentPrice) *
        100;
      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4)
      );
    }

    const updatedCommodity = await Commodity.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity price updated successfully',
      data: updatedCommodity,
    });
  } catch (error) {
    console.error('Update commodity price error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating commodity price',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

module.exports = {
  getAllCommodities,
  getCommodityByCode,
  createCommodity,
  updateCommodity,
  deleteCommodity,
  getCommodityHistory,
  addCommodityHistory,
  updateCommodityPrice,
  setCache,
  getCache,
  deleteCacheByPattern,
  invalidateCache,
};
