const express = require('express');
const router = express.Router();
const {
  createForex,
  getAllForex,
  getForex,
  updateForex,
  deleteForex,
} = require('../controllers/forex.controller');

router.post('/', createForex);

router.get('/', getAllForex);

router.get('/:code', getForex);

router.put('/:code', updateForex);

router.delete('/:code', deleteForex);

module.exports = router;
