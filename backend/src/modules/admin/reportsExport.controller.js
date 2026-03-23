const prisma = require('../../config/db');

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getDateRange(from, to) {
  const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
  const toDate = to ? new Date(to) : new Date();
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    // fallback: default last 30 days
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    return { fromDate: start, toDate: end };
  }
  return { fromDate, toDate };
}

/** GET /admin/reports/export/sales?from=&to= */
const exportSalesCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        paymentStatus: 'PAID',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        shippingAddress: true,
        items: true,
      },
    });

    const headers = [
      'orderNumber', 'createdAt', 'status', 'paymentStatus', 'paymentMethod',
      'customerName', 'customerEmail', 'customerPhone',
      'shippingName', 'shippingPhone', 'line1', 'city', 'state', 'pincode',
      'subtotal', 'discountAmount', 'gstAmount', 'cessAmount', 'shippingCharge', 'totalAmount',
      'itemCount',
    ];
    const rows = [headers.join(',')];

    for (const o of orders) {
      const addr = o.shippingAddress;
      rows.push([
        csvEscape(o.orderNumber),
        csvEscape(o.createdAt.toISOString()),
        csvEscape(o.status),
        csvEscape(o.paymentStatus),
        csvEscape(o.paymentMethod || ''),
        csvEscape(o.user?.name || ''),
        csvEscape(o.user?.email || ''),
        csvEscape(o.user?.phone || ''),
        csvEscape(addr?.name || ''),
        csvEscape(addr?.phone || ''),
        csvEscape(addr?.line1 || ''),
        csvEscape(addr?.city || ''),
        csvEscape(addr?.state || ''),
        csvEscape(addr?.pincode || ''),
        csvEscape(String(o.subtotal)),
        csvEscape(String(o.discountAmount)),
        csvEscape(String(o.gstAmount)),
        csvEscape(String(o.cessAmount ?? 0)),
        csvEscape(String(o.shippingCharge)),
        csvEscape(String(o.totalAmount)),
        csvEscape(o.items?.length || 0),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportSalesCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/stock */
const exportStockCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
      },
    });

    const headers = [
      'name', 'slug', 'sku', 'category', 'brand', 'mrp', 'sellingPrice',
      'stockQuantity', 'isActive', 'weightGrams',
    ];
    const rows = [headers.join(',')];

    for (const p of products) {
      rows.push([
        csvEscape(p.name),
        csvEscape(p.slug),
        csvEscape(p.sku || ''),
        csvEscape(p.category?.name || ''),
        csvEscape(p.brand?.name || ''),
        csvEscape(String(p.mrp)),
        csvEscape(String(p.sellingPrice)),
        csvEscape(p.stockQuantity),
        csvEscape(p.isActive ? '1' : '0'),
        csvEscape(p.weightGrams ?? ''),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stock-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportStockCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/abandoned-carts */
const exportAbandonedCartsCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const updatedAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) updatedAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) updatedAt.lte = d;
    }

    const where = { items: { some: {} } };
    if (Object.keys(updatedAt).length) where.updatedAt = updatedAt;

    const carts = await prisma.cart.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true, slug: true, sku: true } },
          },
        },
      },
    });

    const headers = [
      'cartId', 'userId', 'sessionId', 'userName', 'userEmail', 'userPhone',
      'checkoutName', 'checkoutPhone', 'line1', 'line2', 'city', 'state', 'pincode',
      'subtotal', 'totalItems', 'updatedAt',
      'productsSummary',
    ];
    const rows = [headers.join(',')];

    for (const c of carts) {
      const snap = c.checkoutSnapshot && typeof c.checkoutSnapshot === 'object' ? c.checkoutSnapshot : {};
      const subtotal = c.items.reduce((s, it) => s + parseFloat(it.priceAtAdd) * it.quantity, 0);
      const totalItems = c.items.reduce((s, it) => s + it.quantity, 0);
      const productsSummary = c.items
        .map((it) => `${it.product?.name || it.productId} x${it.quantity}`)
        .join('; ');

      rows.push([
        csvEscape(c.id),
        csvEscape(c.userId || ''),
        csvEscape(c.sessionId || ''),
        csvEscape(c.user?.name || snap.name || ''),
        csvEscape(c.user?.email || ''),
        csvEscape(c.user?.phone || snap.phone || ''),
        csvEscape(snap.name || ''),
        csvEscape(snap.phone || ''),
        csvEscape(snap.line1 || ''),
        csvEscape(snap.line2 || ''),
        csvEscape(snap.city || ''),
        csvEscape(snap.state || ''),
        csvEscape(snap.pincode || ''),
        csvEscape(subtotal.toFixed(2)),
        csvEscape(totalItems),
        csvEscape(c.updatedAt.toISOString()),
        csvEscape(productsSummary),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="abandoned-carts-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportAbandonedCartsCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/orders?from=&to= — all orders (paid + pending + failed + refunded) */
const exportOrdersReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        shippingAddress: true,
        items: true,
      },
    });

    const headers = [
      'orderNumber',
      'createdAt',
      'status',
      'paymentStatus',
      'paymentMethod',
      'customerName',
      'customerEmail',
      'customerPhone',
      'shippingName',
      'shippingPhone',
      'line1',
      'city',
      'state',
      'pincode',
      'subtotal',
      'discountAmount',
      'gstAmount',
      'cessAmount',
      'shippingCharge',
      'totalAmount',
      'advanceAmount',
      'itemCount',
    ];
    const rows = [headers.join(',')];

    for (const o of orders) {
      const addr = o.shippingAddress;
      rows.push([
        csvEscape(o.orderNumber),
        csvEscape(o.createdAt.toISOString()),
        csvEscape(o.status),
        csvEscape(o.paymentStatus),
        csvEscape(o.paymentMethod || ''),
        csvEscape(o.user?.name || ''),
        csvEscape(o.user?.email || ''),
        csvEscape(o.user?.phone || ''),
        csvEscape(addr?.name || ''),
        csvEscape(addr?.phone || ''),
        csvEscape(addr?.line1 || ''),
        csvEscape(addr?.city || ''),
        csvEscape(addr?.state || ''),
        csvEscape(addr?.pincode || ''),
        csvEscape(String(o.subtotal)),
        csvEscape(String(o.discountAmount)),
        csvEscape(String(o.gstAmount)),
        csvEscape(String(o.cessAmount ?? 0)),
        csvEscape(String(o.shippingCharge)),
        csvEscape(String(o.totalAmount)),
        csvEscape(String(o.advanceAmount ?? 0)),
        csvEscape(o.items?.length || 0),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportOrdersReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/customers?from=&to= */
const exportCustomerReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const groups = await prisma.order.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: fromDate, lte: toDate } },
      _sum: { totalAmount: true, gstAmount: true, cessAmount: true, discountAmount: true },
      _count: { userId: true },
      _max: { createdAt: true },
    });

    const userIds = groups.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userById = Object.fromEntries(users.map((u) => [u.id, u]));

    const headers = [
      'userId',
      'name',
      'email',
      'phone',
      'orderCount',
      'totalAmount',
      'discountAmount',
      'gstAmount',
      'cessAmount',
      'lastOrderAt',
    ];
    const rows = [headers.join(',')];

    for (const g of groups) {
      const u = userById[g.userId];
      rows.push([
        csvEscape(g.userId),
        csvEscape(u?.name || ''),
        csvEscape(u?.email || ''),
        csvEscape(u?.phone || ''),
        csvEscape(g._count?.userId || 0),
        csvEscape(String(g._sum?.totalAmount ?? 0)),
        csvEscape(String(g._sum?.discountAmount ?? 0)),
        csvEscape(String(g._sum?.gstAmount ?? 0)),
        csvEscape(String(g._sum?.cessAmount ?? 0)),
        csvEscape(g._max?.createdAt ? g._max.createdAt.toISOString() : ''),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customers-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportCustomerReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/order-items?from=&to= */
const exportOrderItemsReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const orderItems = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: fromDate, lte: toDate } } },
      include: {
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            user: { select: { name: true, email: true, phone: true } },
            shippingAddress: { select: { name: true, phone: true, line1: true, city: true, state: true, pincode: true } },
          },
        },
      },
    });

    const headers = [
      'orderNumber',
      'orderCreatedAt',
      'orderStatus',
      'paymentStatus',
      'paymentMethod',
      'customerName',
      'customerEmail',
      'customerPhone',
      'shipName',
      'shipPhone',
      'line1',
      'city',
      'state',
      'pincode',
      'productName',
      'variantInfo',
      'quantity',
      'unitPrice',
      'mrp',
      'gstType',
      'gstPercent',
      'cessPercent',
      'totalPrice',
      'advanceAmount',
    ];
    const rows = [headers.join(',')];

    for (const it of orderItems) {
      const addr = it.order?.shippingAddress;
      const u = it.order?.user;
      rows.push([
        csvEscape(it.order?.orderNumber || ''),
        csvEscape(it.order?.createdAt ? it.order.createdAt.toISOString() : ''),
        csvEscape(it.order?.status || ''),
        csvEscape(it.order?.paymentStatus || ''),
        csvEscape(it.order?.paymentMethod || ''),
        csvEscape(u?.name || ''),
        csvEscape(u?.email || ''),
        csvEscape(u?.phone || ''),
        csvEscape(addr?.name || ''),
        csvEscape(addr?.phone || ''),
        csvEscape(addr?.line1 || ''),
        csvEscape(addr?.city || ''),
        csvEscape(addr?.state || ''),
        csvEscape(addr?.pincode || ''),
        csvEscape(it.productName),
        csvEscape(it.variantInfo || ''),
        csvEscape(it.quantity),
        csvEscape(String(it.unitPrice)),
        csvEscape(String(it.mrp)),
        csvEscape(it.gstType || 'IGST'),
        csvEscape(String(it.gstPercent)),
        csvEscape(String(it.cessPercent ?? 0)),
        csvEscape(String(it.totalPrice)),
        csvEscape(String(it.advanceAmount ?? 0)),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="order-items-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportOrderItemsReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/payments?from=&to= */
const exportPaymentReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const groups = await prisma.order.groupBy({
      by: ['paymentMethod', 'paymentStatus'],
      where: { createdAt: { gte: fromDate, lte: toDate } },
      _sum: { totalAmount: true, advanceAmount: true },
      _count: { id: true },
    });

    const headers = [
      'paymentMethod',
      'paymentStatus',
      'orderCount',
      'totalAmount',
      'advanceAmountSum',
    ];
    const rows = [headers.join(',')];

    for (const g of groups) {
      rows.push([
        csvEscape(g.paymentMethod || ''),
        csvEscape(g.paymentStatus || ''),
        csvEscape(g._count?.id || 0),
        csvEscape(String(g._sum?.totalAmount ?? 0)),
        csvEscape(String(g._sum?.advanceAmount ?? 0)),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payment-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportPaymentReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/wallet?from=&to= — "wallet" not present in schema; exporting COD advance as advanceAmount */
const exportWalletReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        paymentMethod: 'COD',
      },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });

    const headers = [
      'orderNumber',
      'createdAt',
      'customerName',
      'customerEmail',
      'customerPhone',
      'paymentMethod',
      'advanceAmount',
      'totalAmount',
      'paymentStatus',
      'status',
    ];
    const rows = [headers.join(',')];

    for (const o of orders) {
      rows.push([
        csvEscape(o.orderNumber),
        csvEscape(o.createdAt.toISOString()),
        csvEscape(o.user?.name || ''),
        csvEscape(o.user?.email || ''),
        csvEscape(o.user?.phone || ''),
        csvEscape(o.paymentMethod || ''),
        csvEscape(String(o.advanceAmount ?? 0)),
        csvEscape(String(o.totalAmount)),
        csvEscape(o.paymentStatus || ''),
        csvEscape(o.status || ''),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wallet-advance-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportWalletReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/gst-sales?from=&to= */
const exportGstSalesReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const items = await prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: fromDate, lte: toDate }, paymentStatus: 'PAID' },
      },
      select: { gstType: true, gstPercent: true, cessPercent: true, totalPrice: true },
    });

    // Group by gstType + gstPercent + cessPercent
    const byKey = {};
    for (const it of items) {
      const gstPercent = parseFloat(it.gstPercent);
      const cessPercent = parseFloat(it.cessPercent ?? 0);
      const key = `${it.gstType || 'IGST'}|${gstPercent}|${cessPercent}`;
      if (!byKey[key]) byKey[key] = { gstType: it.gstType || 'IGST', gstPercent, cessPercent, inclusiveSum: 0 };
      byKey[key].inclusiveSum += parseFloat(it.totalPrice);
    }

    const headers = [
      'gstType',
      'gstPercent',
      'cessPercent',
      'taxableValue',
      'gstValue',
      'cessValue',
      'inclusiveValue',
    ];
    const rows = [headers.join(',')];

    for (const k of Object.keys(byKey)) {
      const g = byKey[k];
      const inclusive = g.inclusiveSum;
      const gstPercent = g.gstPercent;
      const cessPercent = g.cessPercent;
      const taxableValue = inclusive / (1 + (gstPercent + cessPercent) / 100);
      const gstValue = (inclusive * gstPercent) / (100 + gstPercent);
      const cessValue = (taxableValue * cessPercent) / 100;

      rows.push([
        csvEscape(g.gstType),
        csvEscape(g.gstPercent),
        csvEscape(g.cessPercent),
        csvEscape(taxableValue.toFixed(2)),
        csvEscape(gstValue.toFixed(2)),
        csvEscape(cessValue.toFixed(2)),
        csvEscape(inclusive.toFixed(2)),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gst-sales-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportGstSalesReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/gstr1?from=&to= — simplified (tax-rate + state) */
const exportGstr1ReportCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const items = await prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: fromDate, lte: toDate }, paymentStatus: 'PAID' },
      },
      select: {
        gstType: true,
        gstPercent: true,
        cessPercent: true,
        totalPrice: true,
        order: {
          select: {
            orderNumber: true,
            shippingAddress: { select: { state: true } },
          },
        },
      },
    });

    const byKey = {};
    for (const it of items) {
      const state = it.order?.shippingAddress?.state || '';
      const gstPercent = parseFloat(it.gstPercent);
      const cessPercent = parseFloat(it.cessPercent ?? 0);
      const key = `${state}|${it.gstType || 'IGST'}|${gstPercent}|${cessPercent}`;
      if (!byKey[key]) {
        byKey[key] = {
          state,
          gstType: it.gstType || 'IGST',
          gstPercent,
          cessPercent,
          inclusiveSum: 0,
          orderSet: new Set(),
        };
      }
      byKey[key].inclusiveSum += parseFloat(it.totalPrice);
      if (it.order?.orderNumber) byKey[key].orderSet.add(it.order.orderNumber);
    }

    const headers = [
      'state',
      'gstType',
      'gstPercent',
      'cessPercent',
      'taxableValue',
      'gstValue',
      'cessValue',
      'inclusiveValue',
      'invoiceCount',
    ];
    const rows = [headers.join(',')];

    for (const key of Object.keys(byKey)) {
      const g = byKey[key];
      const inclusive = g.inclusiveSum;
      const taxableValue = inclusive / (1 + (g.gstPercent + g.cessPercent) / 100);
      const gstValue = (inclusive * g.gstPercent) / (100 + g.gstPercent);
      const cessValue = (taxableValue * g.cessPercent) / 100;

      rows.push([
        csvEscape(g.state),
        csvEscape(g.gstType),
        csvEscape(g.gstPercent),
        csvEscape(g.cessPercent),
        csvEscape(taxableValue.toFixed(2)),
        csvEscape(gstValue.toFixed(2)),
        csvEscape(cessValue.toFixed(2)),
        csvEscape(inclusive.toFixed(2)),
        csvEscape(g.orderSet.size),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gstr1-report-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportGstr1ReportCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/** GET /admin/reports/export/daily-sales?from=&to= */
const exportDailySalesSummaryCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = getDateRange(from, to);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate }, paymentStatus: 'PAID' },
      select: {
        createdAt: true,
        subtotal: true,
        discountAmount: true,
        gstAmount: true,
        cessAmount: true,
        shippingCharge: true,
        totalAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = {};
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (!byDate[key]) {
        byDate[key] = {
          orderCount: 0,
          subtotal: 0,
          discountAmount: 0,
          gstAmount: 0,
          cessAmount: 0,
          shippingCharge: 0,
          totalAmount: 0,
        };
      }
      byDate[key].orderCount += 1;
      byDate[key].subtotal += parseFloat(o.subtotal);
      byDate[key].discountAmount += parseFloat(o.discountAmount);
      byDate[key].gstAmount += parseFloat(o.gstAmount);
      byDate[key].cessAmount += parseFloat(o.cessAmount ?? 0);
      byDate[key].shippingCharge += parseFloat(o.shippingCharge);
      byDate[key].totalAmount += parseFloat(o.totalAmount);
    }

    const headers = [
      'date',
      'orderCount',
      'subtotal',
      'discountAmount',
      'gstAmount',
      'cessAmount',
      'shippingCharge',
      'totalAmount',
    ];
    const rows = [headers.join(',')];

    for (const date of Object.keys(byDate).sort()) {
      const d = byDate[date];
      rows.push([
        csvEscape(date),
        csvEscape(d.orderCount),
        csvEscape(d.subtotal.toFixed(2)),
        csvEscape(d.discountAmount.toFixed(2)),
        csvEscape(d.gstAmount.toFixed(2)),
        csvEscape(d.cessAmount.toFixed(2)),
        csvEscape(d.shippingCharge.toFixed(2)),
        csvEscape(d.totalAmount.toFixed(2)),
      ].join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily-sales-summary-${Date.now()}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (e) {
    console.error('exportDailySalesSummaryCsv', e);
    return res.status(500).json({ success: false, message: 'Export failed' });
  }
};

module.exports = {
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
};
