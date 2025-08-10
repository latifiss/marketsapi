const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const priceHistorySchema = new Schema(
  {
    date: { type: Date, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const cryptoSchema = new Schema({
  id: { type: String, required: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  image: String,
  current_price: { type: Number, required: true },
  market_cap: Number,
  market_cap_rank: Number,
  fully_diluted_valuation: Number,
  total_volume: Number,
  high_24h: Number,
  low_24h: Number,
  price_change_24h: Number,
  price_change_percentage_24h: Number,
  market_cap_change_24h: Number,
  market_cap_change_percentage_24h: Number,
  price_history: [priceHistorySchema],
  last_updated: Date,
});

const Forex = mongoose.model('Crypto', cryptoSchema);

module.exports = Forex;
