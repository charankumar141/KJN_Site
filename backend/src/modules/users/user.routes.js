const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getAddresses, addAddress, updateAddress, deleteAddress, getWishlist, toggleWishlist, getNotifications, markNotificationsRead, sendEmailChangeOTP, verifyEmailChangeOTP, getMyCoinBalance } = require('./user.controller');
const { protect } = require('../../middleware/auth.middleware');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/addresses', protect, getAddresses);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:id', protect, updateAddress);
router.delete('/addresses/:id', protect, deleteAddress);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:productId', protect, toggleWishlist);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read-all', protect, markNotificationsRead);
router.get('/coins', protect, getMyCoinBalance);
router.post('/email/send-otp', protect, sendEmailChangeOTP);
router.post('/email/verify-otp', protect, verifyEmailChangeOTP);

module.exports = router;