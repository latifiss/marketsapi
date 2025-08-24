const ForexInterbank = require('../models/forexInterbank.model');
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

const createForexInterbank = async (req, res) => {
  try {
    const {
      code,
      name,
      from_currency,
      from_code,
      to_currency,
      to_code,
      currentPrice,
      monthly_change,
      yearly_change,
    } = req.body;

    const newForex = new ForexInterbank({
      code,
      name,
      from_currency,
      from_code,
      to_currency,
      to_code,
      currentPrice,
      percentage_change: 0,
      monthly_change,
      yearly_change,
      price_history: [],
      last_updated: new Date(),
    });

    const savedForex = await newForex.save();
    await deleteCacheByPattern('forexinterbank:*');
    res.status(201).json(savedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllForexInterbank = async (req, res) => {
  try {
    const cacheKey = 'forexinterbank:all';
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const forexPairs = await ForexInterbank.find();
    await setCache(cacheKey, forexPairs);
    res.json(forexPairs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getForexInterbank = async (req, res) => {
  try {
    const cacheKey = `forexinterbank:${req.params.code}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const forex = await ForexInterbank.findOne({ code: req.params.code });
    if (!forex)
      return res.status(404).json({ message: 'Forex pair not found' });
    await setCache(cacheKey, forex);
    res.json(forex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateForexInterbank = async (req, res) => {
  try {
    const { code } = req.params;
    const { currentPrice, ...updateData } = req.body;

    const forex = await ForexInterbank.findOne({ code });
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

    const updatedForex = await ForexInterbank.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true }
    );

    await deleteCacheByPattern('forexinterbank:*');
    await deleteCacheByPattern(`forexinterbank:${code}`);
    res.json(updatedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteForexInterbank = async (req, res) => {
  try {
    const deletedForex = await ForexInterbank.findOneAndDelete({
      code: req.params.code,
    });
    if (!deletedForex) {
      return res.status(404).json({ message: 'Forex pair not found' });
    }
    await deleteCacheByPattern('forexinterbank:*');
    await deleteCacheByPattern(`forexinterbank:${req.params.code}`);
    res.json({ message: 'Forex pair deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createForexInterbank,
  getAllForexInterbank,
  getForexInterbank,
  updateForexInterbank,
  deleteForexInterbank,
};
