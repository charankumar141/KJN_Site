const prisma = require('../../config/db');
const { sendAbandonedCartReminderEmail } = require('../../utils/email');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [
      totalOrders, todayOrders, monthOrders,
      totalRevenue, monthRevenue, lastMonthRevenue,
      totalUsers, newUsersToday,
      pendingOrders, processingOrders,
      totalProducts, lowStockProducts,
      recentOrders, topProducts,
      abandonedCarts,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),

      prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalAmount: true },
      }),

      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),

      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),

      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, stockQuantity: { lte: 5 } } }),

      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, phone: true } } },
      }),

      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),

      prisma.cart.count({ where: { items: { some: {} } } }),
    ]);

    // Get top product names
    const topProductDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, slug: true, sellingPrice: true },
        });
        return { ...product, totalSold: item._sum.quantity };
      })
    );

    const currentMonthRevenue = parseFloat(monthRevenue._sum.totalAmount || 0);
    const previousMonthRevenue = parseFloat(lastMonthRevenue._sum.totalAmount || 0);
    const revenueGrowth = previousMonthRevenue > 0
      ? (((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1)
      : 100;

    return res.status(200).json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          today: todayOrders,
          thisMonth: monthOrders,
          pending: pendingOrders,
          processing: processingOrders,
        },
        revenue: {
          total: parseFloat(totalRevenue._sum.totalAmount || 0),
          thisMonth: currentMonthRevenue,
          lastMonth: previousMonthRevenue,
          growthPercent: revenueGrowth,
        },
        users: {
          total: totalUsers,
          newToday: newUsersToday,
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts,
        },
        carts: {
          abandoned: abandonedCarts,
        },
        recentOrders,
        topProducts: topProductDetails,
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all users list for admin
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { role: 'CUSTOMER' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orders: true } },
          orders: {
            select: { totalAmount: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      _count: u._count,
      totalSpent: u.orders.reduce(
        (sum, order) => sum + parseFloat(order.totalAmount),
        0
      ),
    }));

    return res.status(200).json({
      success: true, data: formattedUsers,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Low stock alert
const getLowStockProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, stockQuantity: { lte: 10 } },
      orderBy: { stockQuantity: 'asc' },
      include: { category: { select: { name: true } } },
      select: {
        id: true, name: true, sku: true,
        stockQuantity: true, sellingPrice: true,
        category: true,
      },
    });
    return res.status(200).json({ success: true, data: products });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update stock
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stockQuantity } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: { stockQuantity: parseInt(stockQuantity) },
    });
    return res.status(200).json({ success: true, message: 'Stock updated', data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Revenue report by date range
const getRevenueReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate = to ? new Date(to) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        orderNumber: true, totalAmount: true,
        createdAt: true, paymentMethod: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRevenue = orders.reduce((a, b) => a + parseFloat(b.totalAmount), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Daily revenue grouping
    const dailyMap = {};
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!dailyMap[date]) dailyMap[date] = 0;
      dailyMap[date] += parseFloat(order.totalAmount);
    });

    // Monthly revenue grouping
    const monthlyMap = {};
    orders.forEach((order) => {
      const month = order.createdAt.getFullYear() + '-' + String(order.createdAt.getMonth() + 1).padStart(2, '0');
      if (!monthlyMap[month]) monthlyMap[month] = 0;
      monthlyMap[month] += parseFloat(order.totalAmount);
    });

    return res.status(200).json({
      success: true,
      data: {
        orders,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        dailyRevenue: Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue })),
        monthlyRevenue: Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue })),
        from: fromDate,
        to: toDate,
      },
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get single user detail (orders + cart) for admin
const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, isVerified: true, createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, orderNumber: true, totalAmount: true, status: true,
            paymentStatus: true, paymentMethod: true, createdAt: true,
            items: {
              select: {
                quantity: true, unitPrice: true, totalPrice: true,
                productName: true, productImage: true,
                product: {
                  select: {
                    name: true,
                    slug: true,
                    image: true,
                    images: { where: { isPrimary: true }, take: 1, select: { image: true } }
                  }
                },
              },
            },
          },
        },
        cart: {
          select: {
            items: {
              select: {
                id: true, quantity: true,
                product: {
                  select: {
                    id: true, name: true, slug: true, sellingPrice: true, mrp: true,
                    images: { where: { isPrimary: true }, take: 1, select: { image: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getUserDetail error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all products for admin (includes inactive)
const getAdminProducts = async (req, res) => {
  try {
    const { page = 1, limit = 100, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      mrp: parseFloat(p.mrp),
      sellingPrice: parseFloat(p.sellingPrice),
      image: p.image,
      category: p.category,
      brand: p.brand,
      stockQuantity: p.stockQuantity,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      categoryId: p.categoryId,
      brandId: p.brandId,
      gstPercent: parseFloat(p.gstPercent),
      cessPercent: parseFloat(p.cessPercent || 0),
      gstType: p.gstType || 'IGST',
      allowedPaymentMethods: p.allowedPaymentMethods || ['COD', 'ONLINE'],
      codAdvancePercent: parseFloat(p.codAdvancePercent || 0),
      googleMerchantCentre: !!p.googleMerchantCentre,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      description: p.description,
      shortDescription: p.shortDescription,
      specifications: p.specifications,
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
    console.error('getAdminProducts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Revenue report by category (for admin reports)
const getRevenueReportByCategory = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate = to ? new Date(to) : new Date();

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { notIn: ['CANCELLED'] },
          createdAt: { gte: fromDate, lte: toDate },
        },
      },
      include: {
        product: { include: { category: { select: { id: true, name: true, slug: true } } } },
        order: { select: { createdAt: true, totalAmount: true } },
      },
    });

    const byCategory = {};
    orderItems.forEach((oi) => {
      const cat = oi.product?.category;
      const key = cat?.id || 'uncategorized';
      const name = cat?.name || 'Uncategorized';
      const slug = cat?.slug || 'uncategorized';
      if (!byCategory[key]) {
        byCategory[key] = { categoryId: key, categoryName: name, categorySlug: slug, revenue: 0, quantity: 0, orderCount: new Set() };
      }
      byCategory[key].revenue += parseFloat(oi.totalPrice);
      byCategory[key].quantity += oi.quantity;
      byCategory[key].orderCount.add(oi.orderId);
    });

    const data = Object.values(byCategory).map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      categorySlug: c.categorySlug,
      revenue: parseFloat(c.revenue.toFixed(2)),
      quantity: c.quantity,
      orderCount: c.orderCount.size,
    })).sort((a, b) => b.revenue - a.revenue);

    return res.status(200).json({
      success: true,
      data,
      from: fromDate,
      to: toDate,
    });
  } catch (error) {
    console.error('getRevenueReportByCategory error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Abandoned carts: users who added to cart but did not place order (with user + product + address details)
const getAbandonedCarts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await prisma.cart.findMany({
      where: { items: { some: {} } },
      skip,
      take: parseInt(limit),
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                sellingPrice: true,
                mrp: true,
                image: true,
                images: { take: 1, select: { image: true } },
              },
            },
            variant: true,
          },
        },
      },
    });

    const data = carts.map((cart) => ({
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      user: cart.user
        ? {
            name: cart.user.name,
            email: cart.user.email,
            phone: cart.user.phone,
          }
        : null,
      checkoutSnapshot: cart.checkoutSnapshot,
      items: cart.items.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        slug: i.product.slug,
        sku: i.product.sku,
        quantity: i.quantity,
        priceAtAdd: parseFloat(i.priceAtAdd),
        sellingPrice: parseFloat(i.product.sellingPrice),
        image: i.product.images?.[0]?.image || i.product.image,
        variant: i.variant ? `${i.variant.variantName}: ${i.variant.variantValue}` : null,
      })),
      subtotal: cart.items.reduce((s, i) => s + parseFloat(i.priceAtAdd) * i.quantity, 0),
      totalItems: cart.items.reduce((s, i) => s + i.quantity, 0),
      updatedAt: cart.updatedAt,
      createdAt: cart.createdAt,
    }));

    const total = await prisma.cart.count({ where: { items: { some: {} } } });

    return res.status(200).json({
      success: true,
      data,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('getAbandonedCarts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** POST /admin/abandoned-carts/:cartId/send-reminder — email logged-in user only */
const sendAbandonedCartReminder = async (req, res) => {
  try {
    const { cartId } = req.params;
    const baseUrl = process.env.FRONTEND_URL || 'https://www.shopatkjn.com';
    const waDigits = (process.env.WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919440658294').replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent('Hi, I need help with my cart on KJN Shop')}`;

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true, slug: true } },
          },
        },
      },
    });

    if (!cart || !cart.items?.length) {
      return res.status(404).json({ success: false, message: 'Cart not found or empty' });
    }
    const email = cart.user?.email?.trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'No email on file for this cart (guest carts cannot receive email reminders)',
      });
    }

    const items = cart.items.map((i) => {
      const line = parseFloat(i.priceAtAdd) * i.quantity;
      return {
        name: i.product?.name || 'Product',
        qty: i.quantity,
        lineTotal: line.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      };
    });

    const cartUrl = `${baseUrl}/cart`;
    await sendAbandonedCartReminderEmail(email, {
      userName: cart.user?.name,
      items,
      cartUrl,
      whatsappUrl,
    });

    return res.status(200).json({ success: true, message: 'Reminder email sent' });
  } catch (error) {
    console.error('sendAbandonedCartReminder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send email' });
  }
};

module.exports = {
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
};