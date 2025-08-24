const express = require('express');
const router = express.Router();
const {
  getAllCommodities,
  getCommodityByCode,
  createCommodity,
  updateCommodity,
  deleteCommodity,
} = require('../controllers/commodities.controller');

router.route('/').get(getAllCommodities).post(createCommodity);

router
  .route('/:code')
  .get(getCommodityByCode)
  .put(updateCommodity)
  .delete(deleteCommodity);

module.exports = router;
