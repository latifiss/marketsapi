const express = require('express');
const router = express.Router();
const {
  getAllGoldbod,
  getGoldbodByCode,
  createGoldbod,
  updateGoldbod,
  deleteGoldbod,
} = require('../controllers/goldbod.controller');

router.route('/').get(getAllGoldbod).post(createGoldbod);

router
  .route('/:code')
  .get(getGoldbodByCode)
  .put(updateGoldbod)
  .delete(deleteGoldbod);

module.exports = router;
