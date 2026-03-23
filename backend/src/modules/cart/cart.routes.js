const express = require('express');
const router = express.Router();
const { getCart, addToCart, updateCartItem, removeCartItem, applyCoupon, removeCoupon, applyCoins, removeCoins, mergeCart, updateCheckoutSnapshot } = require('./cart.controller');
const { protect, optionalProtect } = require('../../middleware/auth.middleware');

router.get('/',                optionalProtect, getCart);
router.post('/items',          optionalProtect, addToCart);
router.put('/items/:id',       optionalProtect, updateCartItem);
router.delete('/items/:id',    optionalProtect, removeCartItem);
router.put('/checkout-snapshot',optionalProtect, updateCheckoutSnapshot);
router.post('/coupon',         protect, applyCoupon);
router.delete('/coupon',       protect, removeCoupon);
router.post('/coins',          protect, applyCoins);
router.delete('/coins',        protect, removeCoins);
router.post('/merge',          protect, mergeCart);

module.exports = router;