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

const getAllCommodities = async (req, res) => {
  try {
    const cacheKey = 'commodities:all';
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const commodities = await Commodity.find();
    await setCache(cacheKey, commodities);
    res.status(200).json(commodities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCommodityByCode = async (req, res) => {
  try {
    const cacheKey = `commodity:${req.params.code}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const commodity = await Commodity.findOne({ code: req.params.code });
    if (!commodity) {
      return res.status(404).json({ message: 'Commodity not found' });
    }
    await setCache(cacheKey, commodity);
    res.status(200).json(commodity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCommodity = async (req, res) => {
  try {
    const existingCommodity = await Commodity.findOne({ code: req.body.code });
    if (existingCommodity) {
      return res
        .status(400)
        .json({ message: 'Commodity with this code already exists' });
    }
    const commodity = await Commodity.create(req.body);
    await deleteCacheByPattern('commodities:*');
    res.status(201).json(commodity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCommodity = async (req, res) => {
  try {
    const commodity = await Commodity.findOneAndUpdate(
      { code: req.params.code },
      req.body,
      { new: true, runValidators: true }
    );
    if (!commodity) {
      return res.status(404).json({ message: 'Commodity not found' });
    }
    await deleteCacheByPattern('commodities:*');
    await deleteCacheByPattern(`commodity:${req.params.code}`);
    res.status(200).json(commodity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCommodity = async (req, res) => {
  try {
    const commodity = await Commodity.findOneAndDelete({
      code: req.params.code,
    });
    if (!commodity) {
      return res.status(404).json({ message: 'Commodity not found' });
    }
    await deleteCacheByPattern('commodities:*');
    await deleteCacheByPattern(`commodity:${req.params.code}`);
    res.status(200).json({ message: 'Commodity deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllCommodities,
  getCommodityByCode,
  createCommodity,
  updateCommodity,
  deleteCommodity,
};
