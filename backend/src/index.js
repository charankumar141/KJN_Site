const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { notFound, errorHandler } = require('./middleware/error.middleware');
const { generalLimiter } = require('./middleware/rateLimiter.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Behind nginx / reverse proxy: correct client IP for rate limiting
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// Ensure public/uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsers - Increased limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Rate limiting
app.use('/api', generalLimiter);

// Upload routes (must be after app creation)
const uploadRoutes = require('./modules/upload/upload.routes');
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'KJN Shop API Running ...by kiran',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth',        require('./modules/auth/auth.routes'));
app.use('/api/products',    require('./modules/products/product.routes'));
app.use('/api/categories',  require('./modules/categories/category.routes'));
app.use('/api/brands',      require('./modules/brands/brand.routes'));
app.use('/api/cart',        require('./modules/cart/cart.routes'));
app.use('/api/orders',      require('./modules/orders/order.routes'));
app.use('/api/payments',    require('./modules/payments/payment.routes'));
app.use('/api/reviews',     require('./modules/reviews/review.routes'));
app.use('/api/user',        require('./modules/users/user.routes'));
app.use('/api/banners',     require('./modules/banners/banner.routes'));
app.use('/api/collections', require('./modules/collections/collection.routes'));
app.use('/api/blogs',       require('./modules/blogs/blog.routes'));
app.use('/api/shipping',    require('./modules/shipping/shipping.routes'));
app.use('/api/coupons',     require('./modules/coupons/coupon.routes'));
app.use('/api/admin',       require('./modules/admin/admin.routes'));
app.use('/api/flash-sales', require('./modules/admin/flashSale.routes'));
app.use('/api/contact',     require('./modules/contact/contact.routes'));
app.use('/api/shipmozo',    require('./modules/shipmozo/shipmozo.routes'));

// Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📦 API: http://localhost:${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`📅 ${new Date().toLocaleString()}\n`);
});