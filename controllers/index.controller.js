const Index = require('../models/indice.model');

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

    res.json(updatedIndex);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllIndices = async (req, res) => {
  try {
    const { sortBy = 'code', limit } = req.query;
    let query = Index.find();

    if (sortBy) {
      query = query.sort(sortBy);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const indices = await query.exec();
    res.json(indices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getIndexByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const index = await Index.findOne({ code });

    if (!index) {
      return res.status(404).json({ message: 'Index not found' });
    }

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
