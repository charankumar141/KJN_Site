const prisma = require('../../config/db');
const { generateInvoicePDF, generateInvoiceNumber } = require('./invoice.service');
const { sendOrderEmail } = require('./order.email');

// Generate order number
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `KJN${year}${month}${random}`;
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shippingAddressId, paymentMethod, notes } = req.body;

    if (!shippingAddressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Shipping address and payment method required' });
    }

    // Get user cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Verify address belongs to user
    const address = await prisma.address.findFirst({ where: { id: shippingAddressId, userId } });
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });

    // Verify stock and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      if (item.product.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `${item.product.name} only has ${item.product.stockQuantity} units in stock`,
        });
      }

      const itemTotal = parseFloat(item.priceAtAdd) * item.quantity;
      subtotal += itemTotal;

      const gstP = parseFloat(item.product.gstPercent || 18);
      const cessP = parseFloat(item.product.cessPercent || 0);
      const gstType = item.product.gstType || 'IGST';
      const codAdvanceP = paymentMethod === 'COD' ? parseFloat(item.product.codAdvancePercent || 0) : 0;
      const advanceAmountItem = (itemTotal * codAdvanceP) / 100;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        productName: item.product.name,
        productImage: item.product.images?.[0]?.image || null,
        variantInfo: item.variant ? `${item.variant.variantName}: ${item.variant.variantValue}` : null,
        quantity: item.quantity,
        unitPrice: parseFloat(item.priceAtAdd),
        mrp: parseFloat(item.product.mrp),
        gstType,
        gstPercent: gstP,
        cessPercent: cessP,
        totalPrice: itemTotal,
        advanceAmount: advanceAmountItem,
      });
    }

    // Apply coupon if any
    let discountAmount = 0;
    if (cart.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: cart.couponCode, isActive: true } });
      if (coupon) {
        if (coupon.type === 'PERCENT') {
          discountAmount = (subtotal * parseFloat(coupon.value)) / 100;
          if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
        } else if (coupon.type === 'FLAT') {
          discountAmount = parseFloat(coupon.value);
        }
      }
    }

    // KJN coins redemption (1 coin = 1 rupee)
    const coinsUsedRequested = parseInt(cart.coinsUsed ?? 0, 10) || 0;
    let coinDiscount = 0;
    if (coinsUsedRequested > 0) {
      const wallet = await prisma.userCoinWallet.findUnique({ where: { userId } });
      const coinBalance = parseInt(wallet?.balance ?? 0, 10) || 0;
      const maxEligible = Math.max(0, subtotal - discountAmount);
      coinDiscount = Math.min(coinsUsedRequested, coinBalance, Math.floor(maxEligible));
      if (coinDiscount > 0) discountAmount += coinDiscount;
    }

    const gstAmount = orderItems.reduce((a, b) => a + (b.totalPrice * b.gstPercent) / (100 + b.gstPercent), 0);
    const cessAmount = orderItems.reduce((a, b) => {
      const taxable = b.totalPrice / (1 + (b.gstPercent + b.cessPercent) / 100);
      return a + (taxable * (b.cessPercent || 0)) / 100;
    }, 0);
    const advanceAmount = orderItems.reduce((a, b) => a + (b.advanceAmount || 0), 0);
    const shippingCharge = subtotal >= 500 ? 0 : 99;

    // Prepaid discount (1.5%)
    let prepaidDiscount = 0;
    if (paymentMethod !== 'COD') {
      prepaidDiscount = (subtotal - discountAmount) * 0.015;
      discountAmount += prepaidDiscount;
    }

    const totalAmount = subtotal - discountAmount + shippingCharge;

    const advanceTotal = parseFloat(advanceAmount.toFixed(2));
    const codNeedsOnlineAdvance = paymentMethod === 'COD' && advanceTotal > 0;

    const generatedOrderNumber = generateOrderNumber();

    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generatedOrderNumber,
          userId,
          shippingAddressId,
          paymentMethod,
          notes: notes || null,
          couponCode: cart.couponCode || null,
          subtotal: parseFloat(subtotal.toFixed(2)),
          discountAmount: parseFloat(discountAmount.toFixed(2)),
          gstAmount: parseFloat(gstAmount.toFixed(2)),
          cessAmount: parseFloat(cessAmount.toFixed(2)),
          advanceAmount: advanceTotal,
          shippingCharge: parseFloat(shippingCharge.toFixed(2)),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          // COD with product advance %: stay PENDING until customer pays advance online (same as prepaid flow)
          status: paymentMethod === 'COD' && !codNeedsOnlineAdvance ? 'CONFIRMED' : 'PENDING',
          paymentStatus: 'PENDING',
          items: { create: orderItems },
        },
        include: { items: true, shippingAddress: true },
      });

      // Deduct coins after order creation but before stock decrement (still atomic)
      if (coinDiscount > 0) {
        await tx.userCoinWallet.update({
          where: { userId },
          data: { balance: { decrement: coinDiscount } },
        });
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: -coinDiscount,
            type: 'REDEEM',
            source: 'SYSTEM',
            reason: 'Redeemed at checkout',
            meta: { coinsUsedRequested, orderNumber: generatedOrderNumber },
          },
        });
      }

      // Reduce stock for each product
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // Update coupon usage count
      if (cart.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: cart.couponCode } });
        if (coupon) {
          await tx.coupon.update({ where: { id: coupon.id }, data: { usesCount: { increment: 1 } } });
          await tx.couponUsage.create({ data: { couponId: coupon.id, userId, orderId: newOrder.id } });
        }
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null, coinsUsed: 0 } });

      return newOrder;
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'order_update',
        title: 'Order Placed Successfully!',
        message: `Your order ${order.orderNumber} has been placed. Total: ₹${order.totalAmount}`,
      },
    });

    // Notify all admins about new order
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'NEW_ORDER',
          title: 'New Order Received',
          message: `Order #${order.orderNumber} placed by ${req.user.name}`,
        })),
      });
    }

    // Send order confirmation email (non-blocking)
    const placedUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const placedOrderFull = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, shippingAddress: true },
    });
    sendOrderEmail(placedUser?.email, 'PLACED', { ...placedOrderFull, user: placedUser }, placedUser?.name || req.user.name);

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: parseFloat(order.totalAmount),
        advanceAmount: parseFloat(order.advanceAmount || 0),
        needsOnlineAdvancePayment: codNeedsOnlineAdvance,
        status: order.status,
        paymentMethod: order.paymentMethod,
      },
    });
  } catch (error) {
    console.error('placeOrder error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
                },
              },
            },
          },
          shippingAddress: true,
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                image: true,
                images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        user: { select: { name: true, email: true, phone: true } },
      },
      // shipmozoShipmentId and shipmozoCourier are scalar fields, always returned
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });

      // Restore stock
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
      }
    });

    await prisma.notification.create({
      data: { userId, type: 'order_update', title: 'Order Cancelled', message: `Your order ${order.orderNumber} has been cancelled.` },
    });

    // Send cancellation email (non-blocking)
    const cancelUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    sendOrderEmail(cancelUser?.email, 'CANCELLED', order, cancelUser?.name || 'Customer');

    return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN — Get all orders
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, phone: true, email: true } },
          shippingAddress: true,
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  slug: true,
                  image: true,
                  images: { where: { isPrimary: true }, take: 1, select: { image: true } }
                }
              }
            }
          }
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      success: true, data: orders,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN — Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingId, awbNumber } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(trackingId ? { trackingId } : {}),
        ...(awbNumber ? { awbNumber } : {}),
        // Auto-mark COD orders as PAID when delivered
        ...(status === 'DELIVERED' ? { paymentStatus: 'PAID' } : {}),
      },
      include: { user: true },
    });

    // Send typed notification based on status
    let title = '';
    let message = '';
    let type = '';

    if (status === 'SHIPPED') {
      type = 'ORDER_SHIPPED';
      title = 'Order Shipped';
      message = `Your order #${order.orderNumber} has been shipped.${awbNumber ? ` Tracking: ${awbNumber}` : ''}`;
    } else if (status === 'DELIVERED') {
      type = 'ORDER_DELIVERED';
      title = 'Order Delivered';
      message = `Your order #${order.orderNumber} has been delivered. Thank you for shopping with us!`;
    } else {
      type = 'ORDER_UPDATE';
      title = `Order ${status.replace('_', ' ')}`;
      message = `Your order #${order.orderNumber} is now ${status.toLowerCase().replace('_', ' ')}`;
    }

    await prisma.notification.create({
      data: {
        userId: order.userId,
        type,
        title,
        message,
      },
    });

    // Send status update email (non-blocking)
    const statusUser = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true } });
    const statusOrderFull = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, shippingAddress: true },
    });
    sendOrderEmail(statusUser?.email, status, { ...statusOrderFull, awbNumber: awbNumber || order.awbNumber, trackingId: trackingId || order.trackingId }, statusUser?.name || 'Customer');

    return res.status(200).json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN — Get order counts per status
const getOrderCounts = async (req, res) => {
  try {
    const groups = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const counts = {};
    groups.forEach(g => { counts[g.status] = g._count.status; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return res.status(200).json({ success: true, data: { counts, total } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Public — Happy customers feed (for homepage)
const getHappyCustomers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '8', 10);

    const orders = await prisma.order.findMany({
      where: { status: 'DELIVERED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true } },
        shippingAddress: { select: { city: true, state: true } },
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      name: o.user.name,
      city: o.shippingAddress.city,
      state: o.shippingAddress.state,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── INVOICE GENERATION ───────────────────────
const getOrderInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'STAFF';

    // Find order
    const whereClause = isAdmin ? { id } : { id, userId };
    let order = await prisma.order.findFirst({
      where: whereClause,
      include: {
        items: {
          include: {
            product: { select: { sku: true } },
          },
        },
        shippingAddress: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Only generate invoice for confirmed+ orders
    if (['PENDING', 'CANCELLED'].includes(order.status) && !isAdmin) {
      return res.status(400).json({ success: false, message: 'Invoice not available for this order status' });
    }

    // Generate invoice number if not assigned yet
    if (!order.invoiceNumber) {
      const invoiceNumber = generateInvoiceNumber(order.createdAt);
      order = await prisma.order.update({
        where: { id },
        data: { invoiceNumber },
        include: {
          items: {
            include: {
              product: { select: { sku: true } },
            },
          },
          shippingAddress: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      });
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.invoiceNumber}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('getOrderInvoice error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { placeOrder, getMyOrders, getOrderById, cancelOrder, getAllOrders, updateOrderStatus, getOrderCounts, getHappyCustomers, getOrderInvoice };