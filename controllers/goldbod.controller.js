const Goldbod = require('../models/golbod.model');
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

const getAllGoldbod = async (req, res) => {
  try {
    const cacheKey = 'goldbod:all';
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const goldbod = await Goldbod.find();
    await setCache(cacheKey, goldbod);
    res.status(200).json(goldbod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGoldbodByCode = async (req, res) => {
  try {
    const cacheKey = `goldbod:${req.params.code}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);
    const goldbod = await Goldbod.findOne({ code: req.params.code });
    if (!goldbod) {
      return res.status(404).json({ message: 'Goldbod not found' });
    }
    await setCache(cacheKey, goldbod);
    res.status(200).json(goldbod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createGoldbod = async (req, res) => {
  try {
    const existingGoldbod = await Goldbod.findOne({ code: 'goldbod' });
    if (existingGoldbod) {
      return res.status(400).json({ message: 'Goldbod already exists' });
    }

    const goldbod = new Goldbod({
      code: 'goldbod',
      name: 'Goldbod',
      unit: 'pounds',
      currentPrice: req.body.currentPrice,
      percentage_change: 0,
      price_history: [],
      last_updated: new Date(),
    });

    await goldbod.save();
    await deleteCacheByPattern('goldbod:*');
    res.status(201).json(goldbod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateGoldbod = async (req, res) => {
  try {
    const goldbod = await Goldbod.findOne({ code: 'goldbod' });
    if (!goldbod) {
      return res.status(404).json({ message: 'Goldbod not found' });
    }

    const oldPrice = goldbod.currentPrice;
    const newPrice = req.body.currentPrice;
    const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;

    const updatedGoldbod = await Goldbod.findOneAndUpdate(
      { code: 'goldbod' },
      {
        $set: {
          currentPrice: newPrice,
          percentage_change: percentageChange,
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [{ date: new Date(), price: oldPrice }],
            $position: 0,
          },
        },
      },
      { new: true }
    );

    await deleteCacheByPattern('goldbod:*');
    res.status(200).json(updatedGoldbod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteGoldbod = async (req, res) => {
  try {
    const goldbod = await Goldbod.findOneAndDelete({ code: 'goldbod' });
    if (!goldbod) {
      return res.status(404).json({ message: 'Goldbod not found' });
    }
    await deleteCacheByPattern('goldbod:*');
    res.status(200).json({ message: 'Goldbod deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllGoldbod,
  getGoldbodByCode,
  createGoldbod,
  updateGoldbod,
  deleteGoldbod,
};
