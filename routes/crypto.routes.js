const express = require('express');
const router = express.Router();
const {
  createCrypto,
  updateCrypto,
  getAllCrypto,
  getCryptoById,
  deleteCrypto,
} = require('../controllers/crypto.controller');

router.post('/', createCrypto);
router.put('/:id', updateCrypto);
router.get('/', getAllCrypto);
router.get('/:id', getCryptoById);
router.delete('/:id', deleteCrypto);

module.exports = router;
