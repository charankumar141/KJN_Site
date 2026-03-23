const express = require('express');
const router = express.Router();
const { getAll, create, update, remove } = require('./pincodeDelivery.controller');
const { protect, adminOnly } = require('../../middleware/auth.middleware');
const { adminLimiter } = require('../../middleware/rateLimiter.middleware');

router.use(protect, adminOnly, adminLimiter);
router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
