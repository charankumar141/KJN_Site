// ─────────────────────────────────────────────────────────────────────────────
// backend/src/modules/upload/upload.routes.js
//
// POST /api/upload/product-image     → single product image (base64)
// POST /api/upload/product-images    → multiple product images (base64)
// POST /api/upload/banner            → banner image (base64)
// POST /api/upload/brand-logo        → brand logo (base64)
// POST /api/upload/category-image    → category image (base64)
// POST /api/upload/blog-cover        → blog cover image (base64)
// POST /api/upload/avatar            → user avatar (base64)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const multer = require('multer');
const { processWithPreset, validateBase64Image } = require('../../utils/imageBase64');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max upload
});

// All upload routes require admin/staff
router.use(protect, restrictTo('ADMIN', 'STAFF'));

// ── Single product image ──────────────────────────────────────
router.post('/product-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Main = await processWithPreset(req.file.buffer, 'product', 'main');
    const base64Thumb = await processWithPreset(req.file.buffer, 'product', 'thumbnail');
    
    const validation = validateBase64Image(base64Main);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }
    
    res.json({ 
      success: true, 
      data: {
        image: base64Main,
        thumbnail: base64Thumb,
        size: validation.size,
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Multiple product images (max 6 per product) ────────────────────────
router.post('/product-images', upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    if (req.files.length > 6)
      return res.status(400).json({ success: false, message: 'Maximum 6 images allowed per product' });

    const results = await Promise.all(
      req.files.map(async (file) => ({
        image: await processWithPreset(file.buffer, 'product', 'gallery'),
        thumbnail: await processWithPreset(file.buffer, 'product', 'thumbnail'),
      }))
    );
    
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Banner image ──────────────────────────────────────────────
router.post('/banner', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Desktop = await processWithPreset(req.file.buffer, 'banner', 'desktop');
    const base64Mobile  = await processWithPreset(req.file.buffer, 'banner', 'mobile');

    res.json({
      success: true,
      data: {
        image:   base64Desktop,   // primary field read by ImageUploader
        desktop: base64Desktop,   // kept for any direct consumers
        mobile:  base64Mobile,
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Brand logo ────────────────────────────────────────────────
router.post('/brand-logo', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Logo = await processWithPreset(req.file.buffer, 'brand', 'logo');
    
    res.json({ success: true, data: { image: base64Logo } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Category image ────────────────────────────────────────────
router.post('/category-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Image = await processWithPreset(req.file.buffer, 'category', 'main');
    
    res.json({ success: true, data: { image: base64Image } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Blog cover ────────────────────────────────────────────────
router.post('/blog-cover', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Cover = await processWithPreset(req.file.buffer, 'blog', 'cover');
    
    res.json({ success: true, data: { image: base64Cover } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Avatar upload ────────────────────────────────────────────
router.post('/avatar', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    
    const base64Avatar = await processWithPreset(req.file.buffer, 'avatar', 'main');
    
    res.json({ success: true, data: { image: base64Avatar } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;