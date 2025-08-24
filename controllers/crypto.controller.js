const Crypto = require('../models/crypto.model');
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

const createCrypto = async (req, res) => {
  try {
    const cryptoData = req.body;

    if (
      !cryptoData.id ||
      !cryptoData.symbol ||
      !cryptoData.name ||
      !cryptoData.current_price
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingCrypto = await Crypto.findOne({ id: cryptoData.id });
    if (existingCrypto) {
      return res
        .status(400)
        .json({ message: 'Crypto with this ID already exists' });
    }

    cryptoData.price_history = cryptoData.price_history || [];
    cryptoData.price_history.push({
      date: new Date(),
      price: cryptoData.current_price,
    });

    const newCrypto = await Crypto.create(cryptoData);
    await deleteCacheByPattern('crypto:*');
    res.status(201).json(newCrypto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCrypto = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.current_price) {
      updateData.$push = {
        price_history: {
          date: new Date(),
          price: updateData.current_price,
        },
      };
    }

    const updatedCrypto = await Crypto.findOneAndUpdate({ id }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCrypto) {
      return res.status(404).json({ message: 'Crypto not found' });
    }

    await deleteCacheByPattern('crypto:*');
    await deleteCacheByPattern(`crypto:${id}`);
    res.json(updatedCrypto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCrypto = async (req, res) => {
  try {
    const { sortBy = 'market_cap_rank', limit } = req.query;
    const cacheKey = `crypto:all:${sortBy}:${limit || 'all'}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    let query = Crypto.find();

    if (sortBy) {
      query = query.sort(sortBy);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const cryptos = await query.exec();
    await setCache(cacheKey, cryptos);
    res.json(cryptos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCryptoById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `crypto:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const crypto = await Crypto.findOne({ id });

    if (!crypto) {
      return res.status(404).json({ message: 'Crypto not found' });
    }

    await setCache(cacheKey, crypto);
    res.json(crypto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCrypto = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCrypto = await Crypto.findOneAndDelete({ id });

    if (!deletedCrypto) {
      return res.status(404).json({ message: 'Crypto not found' });
    }

    await deleteCacheByPattern('crypto:*');
    res.json({ message: 'Crypto deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCrypto,
  updateCrypto,
  getAllCrypto,
  getCryptoById,
  deleteCrypto,
};
