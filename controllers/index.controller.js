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

const createIndex = async (req, res) => {
  try {
    const indexData = req.body;
    if (
      !indexData.code ||
      !indexData.symbol ||
      !indexData.name ||
      !indexData.currentPrice
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingIndex = await Index.findOne({ code: indexData.code });
    if (existingIndex) {
      return res
        .status(400)
        .json({ message: 'Index with this code already exists' });
    }

    indexData.price_history = indexData.price_history || [];
    indexData.price_history.push({
      date: new Date(),
      price: indexData.currentPrice,
    });

    const newIndex = await Index.create(indexData);
    await deleteCacheByPattern('index:*');
    res.status(201).json(newIndex);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateIndex = async (req, res) => {
  try {
    const { code } = req.params;
    const updateData = req.body;

    if (updateData.currentPrice) {
      updateData.$push = {
        price_history: {
          date: new Date(),
          price: updateData.currentPrice,
        },
      };
    }

    const updatedIndex = await Index.findOneAndUpdate({ code }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedIndex) {
      return res.status(404).json({ message: 'Index not found' });
    }

    await deleteCacheByPattern('index:*');
    await deleteCacheByPattern(`index:${code}`);
    res.json(updatedIndex);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllIndices = async (req, res) => {
  try {
    const { sortBy = 'code', limit } = req.query;
    const cacheKey = `index:all:${sortBy}:${limit || 'all'}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    let query = Index.find();

    if (sortBy) {
      query = query.sort(sortBy);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const indices = await query.exec();
    await setCache(cacheKey, indices);
    res.json(indices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getIndexByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const cacheKey = `index:${code}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const index = await Index.findOne({ code });

    if (!index) {
      return res.status(404).json({ message: 'Index not found' });
    }

    await setCache(cacheKey, index);
    res.json(index);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteIndex = async (req, res) => {
  try {
    const { code } = req.params;
    const deletedIndex = await Index.findOneAndDelete({ code });

    if (!deletedIndex) {
      return res.status(404).json({ message: 'Index not found' });
    }

    await deleteCacheByPattern('index:*');
    res.json({ message: 'Index deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createIndex,
  updateIndex,
  getAllIndices,
  getIndexByCode,
  deleteIndex,
};
