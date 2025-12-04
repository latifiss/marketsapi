const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const priceHistorySchema = new Schema(
  {
    date: { type: Date, required: true },
    buying_price: { type: Number, required: true },
    selling_price: { type: Number, required: true },
    midrate_price: { type: Number, required: true },
  },
  { _id: false }
);

const forexInterbankSchema = new Schema({
  bankName: { type: String, required: true },
  bankCode: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  from_currency: { type: String, required: true },
  from_code: { type: String, required: true, uppercase: true, length: 3 },
  to_currency: { type: String, required: true },
  to_code: { type: String, required: true, uppercase: true, length: 3 },
  current_buying_price: { type: Number, required: true },
  buying_percentage_change: { type: Number, required: true },
  current_selling_price: { type: Number, required: true },
  selling_percentage_change: { type: Number, required: true },
  current_midrate_price: { type: Number, required: true },
  midrate_percentage_change: { type: Number, required: true },
  price_history: [priceHistorySchema],
  last_updated: { type: Date, default: Date.now },
});

const ForexInterbank = mongoose.model('ForexInterbank', forexInterbankSchema);

module.exports = ForexInterbank;
