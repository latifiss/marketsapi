const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const priceHistorySchema = new Schema(
  {
    date: { type: Date, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const goldbodSchema = new Schema({
  code: { type: String, required: true, unique: true, default: 'goldbod' },
  name: { type: String, required: true, default: 'Goldbod' },
  unit: { type: String, required: true, default: 'pounds' },
  currentPrice: { type: Number, required: true },
  percentage_change: { type: Number, required: true },
  price_history: [priceHistorySchema],
  last_updated: { type: Date, default: Date.now },
});

const Goldbod = mongoose.model('Goldbod', goldbodSchema);

module.exports = Goldbod;
