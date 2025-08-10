const express = require('express');
const router = express.Router();
const {
  createIndex,
  updateIndex,
  getAllIndices,
  getIndexByCode,
  deleteIndex,
} = require('../controllers/index.controller');

router.post('/', createIndex);
router.put('/:code', updateIndex);
router.get('/', getAllIndices);
router.get('/:code', getIndexByCode);
router.delete('/:code', deleteIndex);

module.exports = router;
