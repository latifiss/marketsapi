const Forex = require('../models/forex.model');

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
    res.status(201).json(savedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllForex = async (req, res) => {
  try {
    const forexPairs = await Forex.find();
    res.json(forexPairs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getForex = async (req, res) => {
  try {
    const forex = await Forex.findOne({ code: req.params.code });
    if (!forex)
      return res.status(404).json({ message: 'Forex pair not found' });
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
