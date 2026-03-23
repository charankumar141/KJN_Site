const prisma = require('../../config/db');

// ─────────────────────────────────────────────
// GET ALL PRODUCTS with filters, search, pagination
// GET /api/products
// ─────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      sort = 'createdAt',
      order = 'desc',
      featured,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filters
    const where = { isActive: true };

    if (category) {
      const cat = await prisma.category.findUnique({ where: { slug: category } });
      if (cat) where.categoryId = cat.id;
    }

    if (brand) {
      const br = await prisma.brand.findUnique({ where: { slug: brand } });
      if (br) where.brandId = br.id;
    }

    if (minPrice || maxPrice) {
      where.sellingPrice = {};
      if (minPrice) where.sellingPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.sellingPrice.lte = parseFloat(maxPrice);
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (featured === 'true') where.isFeatured = true;

    // Sort options
    const sortOptions = {
      price_asc: { sellingPrice: 'asc' },
      price_desc: { sellingPrice: 'desc' },
      newest: { createdAt: 'desc' },
      discount: { mrp: 'desc' },
      name: { name: 'asc' },
    };

    const orderBy = sortOptions[sort] || { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          reviews: { select: { rating: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Format products
    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      mrp: parseFloat(p.mrp),
      sellingPrice: parseFloat(p.sellingPrice),
      discountPercent: Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100),
      image: p.images[0]?.image || p.image || null,
      category: p.category,
      brand: p.brand,
      stockQuantity: p.stockQuantity,
      averageRating:
        p.reviews.length > 0
          ? (p.reviews.reduce((a, b) => a + b.rating, 0) / p.reviews.length).toFixed(1)
          : null,
      totalReviews: p.reviews.length,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getProducts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET SINGLE PRODUCT by slug
// GET /api/products/:slug
// ─────────────────────────────────────────────
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: true,
        category: true,
        brand: true,
        reviews: {
          where: { isApproved: true },
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const formatted = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      shortDescription: product.shortDescription,
      specifications: product.specifications,
      mrp: parseFloat(product.mrp),
      sellingPrice: parseFloat(product.sellingPrice),
      discountPercent: Math.round(
        ((product.mrp - product.sellingPrice) / product.mrp) * 100
      ),
      gstPercent: parseFloat(product.gstPercent),
      cessPercent: parseFloat(product.cessPercent || 0),
      allowedPaymentMethods: product.allowedPaymentMethods || ['COD', 'ONLINE'],
      codAdvancePercent: parseFloat(product.codAdvancePercent || 0),
      stockQuantity: product.stockQuantity,
      inStock: product.stockQuantity > 0,
      isFeatured: product.isFeatured,
      googleMerchantCentre: product.googleMerchantCentre || false,
      gstType: product.gstType || 'IGST',
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      images: product.images,
      image: product.image,
      variants: product.variants,
      category: product.category,
      brand: product.brand,
      tags: product.tags,
      averageRating:
        product.reviews.length > 0
          ? (
              product.reviews.reduce((a, b) => a + b.rating, 0) /
              product.reviews.length
            ).toFixed(1)
          : null,
      totalReviews: product.reviews.length,
      reviews: product.reviews,
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('getProductBySlug error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// SEARCH PRODUCTS
// GET /api/products/search?q=sprayer
// ─────────────────────────────────────────────
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query too short' });
    }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { shortDescription: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
        ],
      },
      take: 10,
        include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
        category: { select: { name: true, slug: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sellingPrice: parseFloat(p.sellingPrice),
        mrp: parseFloat(p.mrp),
        image: p.images[0]?.image || p.image || null,
        category: p.category,
      })),
    });
  } catch (error) {
    console.error('searchProducts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Auto-increment SKU: SKU-1, SKU-2, ...
async function getNextSku() {
  const list = await prisma.product.findMany({ where: { sku: { not: null } }, select: { sku: true } });
  let max = 0;
  list.forEach((p) => {
    const m = (p.sku || '').match(/^SKU-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `SKU-${max + 1}`;
}

// ─────────────────────────────────────────────
// ADMIN — CREATE PRODUCT
// POST /api/admin/products (max 6 images, auto SKU, GST+CESS, payment options, Google Merchant)
// ─────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const {
      name, slug, sku, description, shortDescription, image,
      categoryId, brandId, mrp, sellingPrice, gstPercent, cessPercent,
      stockQuantity, isFeatured, isActive, weightGrams, tags,
      specifications, metaTitle, metaDescription,
      images, variants,
      allowedPaymentMethods, codAdvancePercent, googleMerchantCentre,
      gstType,
    } = req.body;

    if (!name || !mrp || !sellingPrice) {
      return res.status(400).json({ success: false, message: 'Name, MRP and selling price are required' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const imageList = Array.isArray(images) ? images : [];
    if (imageList.length > 6) {
      return res.status(400).json({ success: false, message: 'Maximum 6 product images allowed' });
    }
    const firstGalleryImage = imageList[0]
      ? (typeof imageList[0] === 'object' && imageList[0] != null
          ? (imageList[0].url ?? imageList[0].image)
          : imageList[0])
      : null;

    const finalSku = sku && String(sku).trim() ? String(sku).trim() : await getNextSku();
    const slugFinal = slug && String(slug).trim() ? String(slug).trim() : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const paymentMethods = Array.isArray(allowedPaymentMethods) && allowedPaymentMethods.length > 0
      ? allowedPaymentMethods
      : ['COD', 'ONLINE'];

    const product = await prisma.product.create({
      data: {
        name,
        slug: slugFinal,
        sku: finalSku,
        description: description || null,
        shortDescription: shortDescription || null,
        // We keep `image` for compatibility, but main image comes from first gallery image.
        image: image || firstGalleryImage || null,
        categoryId: categoryId || null,
        brandId: brandId || null,
        mrp: parseFloat(mrp),
        sellingPrice: parseFloat(sellingPrice),
        gstType: gstType || 'IGST',
        gstPercent: parseFloat(gstPercent || 18),
        cessPercent: parseFloat(cessPercent || 0),
        stockQuantity: parseInt(stockQuantity || 0),
        isFeatured: !!isFeatured,
        isActive: isActive !== undefined ? isActive : true,
        weightGrams: weightGrams ? parseInt(weightGrams) : null,
        tags: tags || [],
        specifications: specifications || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        allowedPaymentMethods: paymentMethods,
        codAdvancePercent: parseFloat(codAdvancePercent || 0),
        googleMerchantCentre: !!googleMerchantCentre,
      },
      include: { category: true, brand: true },
    });

    if (imageList.length > 0) {
      await prisma.productImage.createMany({
        data: imageList.slice(0, 6).map((img, i) => ({
          productId: product.id,
          image:
            typeof img === 'object' && img != null
              ? (img.url ?? img.image ?? '')
              : String(img),
          sortOrder: i,
          isPrimary: i === 0,
        })),
      });
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, brand: true, images: true },
    });

    return res.status(201).json({ success: true, message: 'Product created', data: created });
  } catch (error) {
    console.error('createProduct error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Product slug or SKU already exists' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ─────────────────────────────────────────────
// ADMIN — UPDATE PRODUCT (max 6 images, allowed payment, COD advance %, GST+CESS, Google Merchant)
// PUT /api/admin/products/:id
// ─────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const images = Array.isArray(updateData.images) ? updateData.images : null;

    if (images !== null && images.length > 6) {
      return res.status(400).json({ success: false, message: 'Maximum 6 product images allowed' });
    }

    delete updateData.images;

    const data = {
      ...updateData,
      mrp: updateData.mrp != null ? parseFloat(updateData.mrp) : undefined,
      sellingPrice: updateData.sellingPrice != null ? parseFloat(updateData.sellingPrice) : undefined,
      gstType: updateData.gstType != null ? String(updateData.gstType) : undefined,
      gstPercent: updateData.gstPercent != null ? parseFloat(updateData.gstPercent) : undefined,
      cessPercent: updateData.cessPercent != null ? parseFloat(updateData.cessPercent) : undefined,
      codAdvancePercent: updateData.codAdvancePercent != null ? parseFloat(updateData.codAdvancePercent) : undefined,
      googleMerchantCentre: updateData.googleMerchantCentre !== undefined ? !!updateData.googleMerchantCentre : undefined,
      allowedPaymentMethods: Array.isArray(updateData.allowedPaymentMethods) ? updateData.allowedPaymentMethods : undefined,
      updatedAt: new Date(),
    };

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    if (images !== null) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        const first = images[0]
          ? (typeof images[0] === 'object' && images[0] != null
              ? (images[0].url ?? images[0].image)
              : images[0])
          : null;
        await prisma.product.update({ where: { id }, data: { image: first } });
        await prisma.productImage.createMany({
          data: images.slice(0, 6).map((img, i) => ({
            productId: id,
            image:
              typeof img === 'object' && img != null
                ? (img.url ?? img.image ?? '')
                : String(img),
            sortOrder: i,
            isPrimary: i === 0,
          })),
        });
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id },
      include: { category: true, brand: true, images: true },
    });

    return res.status(200).json({ success: true, message: 'Product updated', data: updated });
  } catch (error) {
    console.error('updateProduct error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// ADMIN — DELETE PRODUCT
// DELETE /api/admin/products/:id
// ─────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await prisma.product.update({ where: { id }, data: { isActive: false } });

    return res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// ADMIN — AI generate product description (template-based; can be replaced with OpenAI)
// POST /api/products/generate-description
// ─────────────────────────────────────────────
const generateDescription = async (req, res) => {
  try {
    const { name, shortDescription, specifications, categoryName, brandName } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Product name required' });

    const specStr = specifications && typeof specifications === 'object'
      ? Object.entries(specifications).map(([k, v]) => `${k}: ${v}`).join('. ')
      : '';
    const cat = categoryName || 'product';
    const brand = brandName ? ` from ${brandName}` : '';

    const generated = [
      `${name} is a quality ${cat}${brand} designed for reliability and performance.`,
      shortDescription ? `${shortDescription}` : '',
      specStr ? `Specifications: ${specStr}.` : '',
      'Ideal for both personal and professional use. Order now for fast delivery and genuine product guarantee.',
    ].filter(Boolean).join(' ');

    return res.status(200).json({ success: true, data: { description: generated } });
  } catch (error) {
    console.error('generateDescription error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PUBLIC — Google Merchant Centre feed (products with googleMerchantCentre = true)
// GET /api/products/feed/google
// ─────────────────────────────────────────────
const getGoogleMerchantFeed = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.shopatkjn.com';
    const products = await prisma.product.findMany({
      where: { isActive: true, googleMerchantCentre: true },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
    });

    const items = products.map((p) => ({
      id: p.id,
      title: p.name,
      description: p.shortDescription || p.description || p.name,
      link: `${baseUrl}/products/${p.slug}`,
      image_link: p.images[0]?.image || p.image || '',
      price: `${parseFloat(p.sellingPrice).toFixed(2)} INR`,
      sale_price: `${parseFloat(p.sellingPrice).toFixed(2)} INR`,
      brand: p.brand?.name || '',
      product_type: p.category?.name || '',
      availability: p.stockQuantity > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
    }));

    return res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    console.error('getGoogleMerchantFeed error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// ADMIN — DUPLICATE PRODUCT (copy images + variants, new slug + SKU)
// POST /api/products/:id/duplicate
// ─────────────────────────────────────────────
const duplicateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const src = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ sortOrder: 'asc' }] },
        variants: true,
      },
    });
    if (!src) return res.status(404).json({ success: false, message: 'Product not found' });

    const newSku = await getNextSku();
    let baseSlug = `${src.slug}-copy`;
    let slug = baseSlug;
    let n = 2;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }

    const { id: _id, createdAt: _c, updatedAt: _u, images, variants, ...rest } = src;
    const product = await prisma.product.create({
      data: {
        ...rest,
        name: `${src.name} (Copy)`,
        slug,
        sku: newSku,
        isFlashSale: false,
        flashSaleEndDate: null,
      },
    });

    if (images.length > 0) {
      await prisma.productImage.createMany({
        data: images.map((img, i) => ({
          productId: product.id,
          image: img.image,
          altText: img.altText,
          sortOrder: img.sortOrder ?? i,
          isPrimary: img.isPrimary,
        })),
      });
      const first = images.find((x) => x.isPrimary)?.image || images[0]?.image;
      if (first) {
        await prisma.product.update({ where: { id: product.id }, data: { image: first } });
      }
    } else if (src.image) {
      await prisma.product.update({ where: { id: product.id }, data: { image: src.image } });
    }

    for (const v of variants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          variantName: v.variantName,
          variantValue: v.variantValue,
          additionalPrice: v.additionalPrice,
          stockQuantity: v.stockQuantity,
          skuSuffix: v.skuSuffix,
        },
      });
    }

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, brand: true, images: true, variants: true },
    });

    return res.status(201).json({ success: true, message: 'Product duplicated', data: full });
  } catch (error) {
    console.error('duplicateProduct error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Slug or SKU conflict' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  generateDescription,
  getGoogleMerchantFeed,
};