const { parse } = require('csv-parse/sync');
const prisma = require('../../config/db');

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const PRODUCT_EXPORT_HEADERS = [
  'name', 'slug', 'sku', 'mrp', 'sellingPrice', 'categorySlug', 'brandSlug',
  'gstType', 'gstPercent', 'cessPercent', 'stockQuantity', 'weightGrams',
  'shortDescription', 'description', 'isActive', 'isFeatured',
  'metaTitle', 'metaDescription', 'codAdvancePercent', 'googleMerchantCentre',
  'allowedPaymentMethods',
];

/** GET /admin/products/export/csv */
const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { slug: true } }, brand: { select: { slug: true } } },
    });
    const rows = [PRODUCT_EXPORT_HEADERS.join(',')];
    for (const p of products) {
      const line = [
        csvEscape(p.name),
        csvEscape(p.slug),
        csvEscape(p.sku || ''),
        csvEscape(p.mrp),
        csvEscape(p.sellingPrice),
        csvEscape(p.category?.slug || ''),
        csvEscape(p.brand?.slug || ''),
        csvEscape(p.gstType || 'IGST'),
        csvEscape(p.gstPercent),
        csvEscape(p.cessPercent),
        csvEscape(p.stockQuantity),
        csvEscape(p.weightGrams ?? ''),
        csvEscape(p.shortDescription || ''),
        csvEscape(p.description || ''),
        csvEscape(p.isActive ? '1' : '0'),
        csvEscape(p.isFeatured ? '1' : '0'),
        csvEscape(p.metaTitle || ''),
        csvEscape(p.metaDescription || ''),
        csvEscape(p.codAdvancePercent),
        csvEscape(p.googleMerchantCentre ? '1' : '0'),
        csvEscape((p.allowedPaymentMethods || []).join('|')),
      ].join(',');
      rows.push(line);
    }
    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-export-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportProductsCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/products/csv-template */
const downloadCsvTemplate = async (req, res) => {
  const sample = [
    PRODUCT_EXPORT_HEADERS.join(','),
    [
      'Sample Product', 'sample-product-slug', '', '1999', '1499', 'farm-tools', 'agrimate',
      'IGST', '18', '0', '10', '500',
      'Short text', 'Full description', '1', '0',
      'SEO Title', 'SEO description', '0', '0',
      'COD|ONLINE',
    ].map((c) => csvEscape(c)).join(','),
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"');
  return res.send('\uFEFF' + sample);
};

async function getStartingSkuNumber() {
  const list = await prisma.product.findMany({ where: { sku: { not: null } }, select: { sku: true } });
  let max = 0;
  list.forEach((p) => {
    const m = (p.sku || '').match(/^SKU-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}

/** POST /admin/products/import/csv — multipart field "file" */
const importProductsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Upload a CSV file (field: file)' });
    }
    const text = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    let records;
    try {
      records = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid CSV: ' + err.message });
    }
    if (!records.length) return res.status(400).json({ success: false, message: 'CSV has no data rows' });

    const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
    const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
    const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
    const brandBySlug = Object.fromEntries(brands.map((b) => [b.slug, b.id]));

    let created = 0;
    let updated = 0;
    const errors = [];
    let skuSeq = await getStartingSkuNumber();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const name = (row.name || '').trim();
      if (!name || name.toLowerCase() === 'sample product') continue;

      const categorySlug = (row.categorySlug || '').trim();
      const categoryId = catBySlug[categorySlug];
      if (!categoryId) {
        errors.push({ row: i + 2, message: `Unknown categorySlug: ${categorySlug}` });
        continue;
      }

      const mrp = parseFloat(row.mrp);
      const sp = parseFloat(row.sellingPrice);
      if (!Number.isFinite(mrp) || !Number.isFinite(sp)) {
        errors.push({ row: i + 2, message: 'Invalid mrp or sellingPrice' });
        continue;
      }

      let slug = (row.slug || '').trim();
      if (!slug) slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const brandSlug = (row.brandSlug || '').trim();
      const brandId = brandSlug ? brandBySlug[brandSlug] || null : null;
      if (brandSlug && !brandId) {
        errors.push({ row: i + 2, message: `Unknown brandSlug: ${brandSlug}` });
        continue;
      }

      const sku = (row.sku || '').trim() || `SKU-${skuSeq++}`;
      const gstType = (row.gstType || 'IGST').trim() || 'IGST';
      const gstPercent = parseFloat(row.gstPercent ?? 18);
      const cessPercent = parseFloat(row.cessPercent ?? 0);
      const stockQuantity = parseInt(row.stockQuantity ?? 0, 10) || 0;
      const weightGrams = row.weightGrams !== undefined && row.weightGrams !== '' ? parseInt(row.weightGrams, 10) : null;
      const isActive = ['1', 'true', 'yes'].includes(String(row.isActive || '1').toLowerCase());
      const isFeatured = ['1', 'true', 'yes'].includes(String(row.isFeatured || '').toLowerCase());
      const codAdvancePercent = parseFloat(row.codAdvancePercent ?? 0);
      const googleMerchantCentre = ['1', 'true', 'yes'].includes(String(row.googleMerchantCentre || '').toLowerCase());
      const allowedRaw = (row.allowedPaymentMethods || 'COD|ONLINE').trim();
      const allowedPaymentMethods = allowedRaw.split(/[|,]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      const apm = allowedPaymentMethods.length ? allowedPaymentMethods : ['COD', 'ONLINE'];

      const data = {
        name,
        slug,
        sku,
        mrp,
        sellingPrice: sp,
        categoryId,
        brandId,
        gstType,
        gstPercent,
        cessPercent,
        stockQuantity,
        weightGrams: Number.isFinite(weightGrams) ? weightGrams : null,
        shortDescription: (row.shortDescription || '').trim() || null,
        description: (row.description || '').trim() || null,
        isActive,
        isFeatured,
        metaTitle: (row.metaTitle || '').trim() || null,
        metaDescription: (row.metaDescription || '').trim() || null,
        codAdvancePercent,
        googleMerchantCentre,
        allowedPaymentMethods: apm,
        tags: [],
        specifications: null,
      };

      const existing = await prisma.product.findUnique({ where: { slug } });
      try {
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await prisma.product.create({ data });
          created += 1;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: e.message || String(e) });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Import finished: ${created} created, ${updated} updated`,
      data: { created, updated, errors },
    });
  } catch (e) {
    console.error('importProductsCsv', e);
    return res.status(500).json({ success: false, message: e.message || 'Import failed' });
  }
};

module.exports = { exportProductsCsv, downloadCsvTemplate, importProductsCsv, PRODUCT_EXPORT_HEADERS };
