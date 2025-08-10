const ForexInterbank = require('../models/forexInterbank.model');

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
    res.status(201).json(savedForex);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllForexInterbank = async (req, res) => {
  try {
    const forexPairs = await ForexInterbank.find();
    res.json(forexPairs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getForexInterbank = async (req, res) => {
  try {
    const forex = await ForexInterbank.findOne({ code: req.params.code });
    if (!forex)
      return res.status(404).json({ message: 'Forex pair not found' });
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
