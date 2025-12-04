const mongoose = require('mongoose');
const Index = require('../models/indice.model');
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
  await deleteCacheByPattern('index:*');
  if (code) {
    await deleteCacheByPattern(`index:code:${code}`);
  }
};

const createIndex = async (req, res) => {
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

    const indexData = req.body;
    const requiredFields = ['code', 'symbol', 'name', 'currentPrice'];
    const missingFields = requiredFields.filter((field) => !indexData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields',
        details: { missingFields },
      });
    }

    const existingIndex = await Index.findOne({ code: indexData.code });
    if (existingIndex) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Index with this code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: indexData.code,
        },
      });
    }

    indexData.price_history = indexData.price_history || [];
    indexData.price_history.push({
      date: new Date(),
      price: indexData.currentPrice,
    });

    const newIndex = await Index.create(indexData);
    await invalidateCache(indexData.code);

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Index created successfully',
      data: newIndex,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Index code already exists',
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

    console.error('Create index error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating index',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateIndex = async (req, res) => {
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

    const index = await Index.findOne({ code });
    if (!index) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    const updateOperations = { $set: { ...updateData } };

    if (
      updateData.currentPrice !== undefined &&
      updateData.currentPrice !== index.currentPrice
    ) {
      updateOperations.$set.last_updated = new Date();

      updateOperations.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: updateData.currentPrice,
            },
          ],
          $position: 0,
        },
      };
    }

    const updatedIndex = await Index.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true, runValidators: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Index updated successfully',
      data: updatedIndex,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Index code already exists',
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

    console.error('Update index error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating index',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getAllIndices = async (req, res) => {
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

    const { sortBy = 'code', limit } = req.query;
    const cacheKey = `index:all:${sortBy}:${limit || 'all'}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    let query = Index.find();

    if (sortBy) {
      query = query.sort(sortBy);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const indices = await query.exec();
    await setCache(cacheKey, indices);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: indices,
    });
  } catch (error) {
    console.error('Get all indices error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching indices',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getIndexByCode = async (req, res) => {
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

    const cacheKey = `index:code:${code}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const index = await Index.findOne({ code });
    if (!index) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    await setCache(cacheKey, index);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: index,
    });
  } catch (error) {
    console.error('Get index error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching index',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const deleteIndex = async (req, res) => {
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

    const deletedIndex = await Index.findOneAndDelete({ code });
    if (!deletedIndex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Index deleted successfully',
      data: {
        code: deletedIndex.code,
        name: deletedIndex.name,
      },
    });
  } catch (error) {
    console.error('Delete index error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting index',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const getIndexHistory = async (req, res) => {
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

    const cacheKey = `index:code:${code}:history`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const index = await Index.findOne({ code }).select(
      'code name price_history'
    );
    if (!index) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    const result = {
      code: index.code,
      name: index.name,
      price_history: index.price_history,
    };

    await setCache(cacheKey, result);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error) {
    console.error('Get index history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching index history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const addIndexHistory = async (req, res) => {
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
        details: { required: ['price'] },
      });
    }

    const newPriceEntry = {
      date: date || new Date(),
      price,
    };

    const updatedIndex = await Index.findOneAndUpdate(
      { code },
      {
        $push: { price_history: newPriceEntry },
        $set: { last_updated: new Date() },
      },
      { new: true }
    );

    if (!updatedIndex) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history added successfully',
      data: {
        code: updatedIndex.code,
        new_price_entry: newPriceEntry,
        total_history_entries: updatedIndex.price_history.length,
      },
    });
  } catch (error) {
    console.error('Add index history error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const updateIndexPrice = async (req, res) => {
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
    const { currentPrice, value_change, percentage_change } = req.body;

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
        details: { required: ['currentPrice'] },
      });
    }

    const index = await Index.findOne({ code });
    if (!index) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Index not found',
        details: { code },
      });
    }

    const updateOperations = {
      $set: {
        last_updated: new Date(),
        currentPrice,
      },
      $push: {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: index.currentPrice,
            },
          ],
          $position: 0,
        },
      },
    };

    if (value_change !== undefined) {
      updateOperations.$set.value_change = value_change;
    }

    if (percentage_change !== undefined) {
      updateOperations.$set.percentage_change = percentage_change;
    }

    const updatedIndex = await Index.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true }
    );

    await invalidateCache(code);

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Index price updated successfully',
      data: updatedIndex,
    });
  } catch (error) {
    console.error('Update index price error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating index price',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

module.exports = {
  createIndex,
  updateIndex,
  getAllIndices,
  getIndexByCode,
  deleteIndex,
  getIndexHistory,
  addIndexHistory,
  updateIndexPrice,
  setCache,
  getCache,
  deleteCacheByPattern,
  invalidateCache,
};
