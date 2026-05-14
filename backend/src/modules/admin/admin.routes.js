const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getUserDetail,
  getLowStockProducts,
  updateStock,
  getRevenueReport,
  getAdminProducts,
  getRevenueReportByCategory,
  getAbandonedCarts,
  sendAbandonedCartReminder,
} = require('./admin.controller');
const { getFlashSales, createFlashSale, updateFlashSale, deleteFlashSale } = require('./flashSale.controller');
const { getContactMessages, updateContactMessage, deleteContactMessage } = require('../contact/contact.controller');
const pincodeDeliveryRoutes = require('../pincode-delivery/pincodeDelivery.routes');
const { exportProductsCsv, downloadCsvTemplate, importProductsCsv } = require('./productCsv.controller');
const {
  exportSalesCsv,
  exportStockCsv,
  exportAbandonedCartsCsv,
  exportOrdersReportCsv,
  exportCustomerReportCsv,
  exportOrderItemsReportCsv,
  exportPaymentReportCsv,
  exportWalletReportCsv,
  exportGstSalesReportCsv,
  exportGstr1ReportCsv,
  exportDailySalesSummaryCsv,
} = require('./reportsExport.controller');
const { protect, adminOnly } = require('../../middleware/auth.middleware');
const { adminLimiter } = require('../../middleware/rateLimiter.middleware');
const coinsController = require('./coins.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

// Apply authentication/authorization first, then a generous rate limiter
router.use(protect, adminOnly, adminLimiter);

router.get('/dashboard', getDashboardStats);
router.get('/products', getAdminProducts);
router.get('/products/export/csv', exportProductsCsv);
router.get('/products/csv-template', downloadCsvTemplate);
router.post('/products/import/csv', upload.single('file'), importProductsCsv);

router.get('/reports/export/sales', exportSalesCsv);
router.get('/reports/export/stock', exportStockCsv);
router.get('/reports/export/abandoned-carts', exportAbandonedCartsCsv);
router.get('/reports/export/orders', exportOrdersReportCsv);
router.get('/reports/export/customers', exportCustomerReportCsv);
router.get('/reports/export/order-items', exportOrderItemsReportCsv);
router.get('/reports/export/payments', exportPaymentReportCsv);
router.get('/reports/export/wallet', exportWalletReportCsv);
router.get('/reports/export/gst-sales', exportGstSalesReportCsv);
router.get('/reports/export/gstr1', exportGstr1ReportCsv);
router.get('/reports/export/daily-sales', exportDailySalesSummaryCsv);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetail);
router.get('/low-stock', getLowStockProducts);
router.put('/products/:id/stock', updateStock);
router.get('/revenue-report', getRevenueReport);
router.get('/revenue-report/category', getRevenueReportByCategory);
router.get('/abandoned-carts', getAbandonedCarts);
router.post('/abandoned-carts/:cartId/send-reminder', sendAbandonedCartReminder);
router.use('/pincode-delivery', pincodeDeliveryRoutes);

// Coins (KJN Coins) - admin only
router.get('/coins/settings', coinsController.getCoinSettings);
router.put('/coins/settings', coinsController.updateCoinSettings);
router.get('/coins/festivals', coinsController.listFestivalPromos);
router.post('/coins/festivals', coinsController.createFestivalPromo);
router.put('/coins/festivals/:id', coinsController.setFestivalPromoActive);
router.post('/coins/grant', coinsController.grantCoins);
router.post('/coins/grant-all', coinsController.grantCoinsAllCustomers);
router.get('/coins/balance', coinsController.getCoinBalance);

// Flash Sales
router.get('/flash-sales', getFlashSales);
router.post('/flash-sales', createFlashSale);
router.put('/flash-sales/:id', updateFlashSale);
router.delete('/flash-sales/:id', deleteFlashSale);

// Contact Messages
router.get('/contact-messages', getContactMessages);
router.patch('/contact-messages/:id', updateContactMessage);
router.delete('/contact-messages/:id', deleteContactMessage);

module.exports = router;