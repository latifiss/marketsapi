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

const createForex = async (req, res) => {
  try {
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

    const newForex = new Forex({
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
      price_history: [],
      last_updated: new Date(),
    });

    const savedForex = await newForex.save();
    await deleteCacheByPattern('forex:*');
    res.status(201).json(savedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllForex = async (req, res) => {
  try {
    const cacheKey = 'forex:all';
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const forexPairs = await Forex.find();
    await setCache(cacheKey, forexPairs);
    res.json(forexPairs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getForex = async (req, res) => {
  try {
    const cacheKey = `forex:${req.params.code}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const forex = await Forex.findOne({ code: req.params.code });
    if (!forex)
      return res.status(404).json({ message: 'Forex pair not found' });
    await setCache(cacheKey, forex);
    res.json(forex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateForex = async (req, res) => {
  try {
    const { code } = req.params;
    const { currentPrice, ...updateData } = req.body;

    const forex = await Forex.findOne({ code });
    if (!forex) {
      return res.status(404).json({ message: 'Forex pair not found' });
    }

    const updateOperations = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    if (currentPrice !== undefined && currentPrice !== forex.currentPrice) {
      updateOperations.$set.currentPrice = currentPrice;
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

    await deleteCacheByPattern('forex:*');
    await deleteCacheByPattern(`forex:${code}`);
    res.json(updatedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteForex = async (req, res) => {
  try {
    const deletedForex = await Forex.findOneAndDelete({
      code: req.params.code,
    });
    if (!deletedForex) {
      return res.status(404).json({ message: 'Forex pair not found' });
    }
    await deleteCacheByPattern('forex:*');
    await deleteCacheByPattern(`forex:${req.params.code}`);
    res.json({ message: 'Forex pair deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createForex,
  getAllForex,
  getForex,
  updateForex,
  deleteForex,
};
