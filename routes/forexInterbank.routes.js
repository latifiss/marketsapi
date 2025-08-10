const express = require('express');
const router = express.Router();
const {
  createForexInterbank,
  getAllForexInterbank,
  getForexInterbank,
  updateForexInterbank,
  deleteForexInterbank,
} = require('../controllers/forexInterbank.controller');

router.post('/', createForexInterbank);
router.get('/', getAllForexInterbank);
router.get('/:code', getForexInterbank);
router.put('/:code', updateForexInterbank);
router.delete('/:code', deleteForexInterbank);

module.exports = router;
