const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../../config/db');
const { sendOrderEmail } = require('../orders/order.email');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────
// CREATE RAZORPAY ORDER
// POST /api/payments/create-order
// ─────────────────────────────────────────────
const createPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentStatus === 'PAID') return res.status(400).json({ success: false, message: 'Order already paid' });

    const adv = parseFloat(order.advanceAmount || 0);
    const payRupees =
      order.paymentMethod === 'COD' && adv > 0 ? adv : parseFloat(order.totalAmount);
    const amountPaise = Math.round(payRupees * 100);
    if (amountPaise < 100) {
      return res.status(400).json({ success: false, message: 'Payment amount must be at least ₹1' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order.id, userId, payType: order.paymentMethod === 'COD' && adv > 0 ? 'COD_ADVANCE' : 'FULL' },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { razorpayOrderId: razorpayOrder.id },
    });

    return res.status(200).json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderNumber: order.orderNumber,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('createPaymentOrder error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// VERIFY PAYMENT AFTER SUCCESS
// POST /api/payments/verify
// ─────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        paymentId: razorpay_payment_id,
        status: 'CONFIRMED',
      },
      include: { user: true, items: true, shippingAddress: true },
    });

    const adv = parseFloat(order.advanceAmount || 0);
    const paidLine =
      order.paymentMethod === 'COD' && adv > 0
        ? `COD advance of Rs.${adv} received for order #${order.orderNumber}. Balance is due on delivery.`
        : `Payment of Rs.${order.totalAmount} received for order #${order.orderNumber}. We are processing your order.`;

    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful!',
        message: paidLine,
      },
    });

    // Send confirmed email
    sendOrderEmail(order.user?.email, 'CONFIRMED', order, order.user?.name || 'Customer');

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { orderNumber: order.orderNumber, status: order.status },
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

// ─────────────────────────────────────────────
// RAZORPAY WEBHOOK (automatic payment updates)
// POST /api/payments/webhook
// ─────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  // Always ACK immediately
  res.status(200).json({ received: true });

  try {
    const signature = req.headers['x-razorpay-signature'];
    // req.body is a raw Buffer when express.raw() middleware is applied on this route
    const rawBody = req.body;

    if (!signature || !rawBody) return;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      console.warn('[Razorpay Webhook] Invalid signature — ignoring');
      return;
    }

    const parsed = JSON.parse(rawBody.toString());
    const { event, payload } = parsed;
    console.log(`[Razorpay Webhook] Event: ${event}`);

    if (event === 'payment.captured') {
      const paymentId = payload.payment.entity.id;
      const razorpayOrderId = payload.payment.entity.order_id;
      const order = await prisma.order.findFirst({ where: { razorpayOrderId } });
      if (order && order.paymentStatus !== 'PAID') {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID', paymentId, status: 'CONFIRMED' },
        });
        await prisma.notification.create({
          data: {
            userId: order.userId,
            type: 'PAYMENT_SUCCESS',
            title: 'Payment Confirmed',
            message: `Payment confirmed for order #${order.orderNumber}.`,
          },
        });
      }
    }

    if (event === 'payment.failed') {
      const razorpayOrderId = payload.payment.entity.order_id;
      await prisma.order.updateMany({
        where: { razorpayOrderId, paymentStatus: 'PENDING' },
        data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
      });
    }

    if (event === 'refund.processed') {
      const refundEntity = payload.refund.entity;
      const refundId = refundEntity.id;
      const paymentId = refundEntity.payment_id;
      const refundAmountRupees = refundEntity.amount / 100;

      const order = await prisma.order.findFirst({ where: { paymentId } });
      if (order) {
        const isFullRefund = Math.abs(parseFloat(order.totalAmount) - refundAmountRupees) < 1;
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
            status: isFullRefund ? 'REFUNDED' : order.status,
          },
        });
        await prisma.refund.updateMany({
          where: { razorpayRefundId: refundId },
          data: { status: 'PROCESSED' },
        });
        await prisma.notification.create({
          data: {
            userId: order.userId,
            type: 'REFUND_PROCESSED',
            title: 'Refund Processed',
            message: `Refund of Rs.${refundAmountRupees} for order #${order.orderNumber} has been processed.`,
          },
        });
        const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true } });
        const fullOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true, shippingAddress: true } });
        sendOrderEmail(user?.email, 'REFUNDED', { ...fullOrder, totalAmount: refundAmountRupees }, user?.name || 'Customer');
      }
    }

    if (event === 'refund.failed') {
      const refundId = payload.refund.entity.id;
      await prisma.refund.updateMany({
        where: { razorpayRefundId: refundId },
        data: { status: 'FAILED' },
      });
    }

  } catch (err) {
    console.error('[Razorpay Webhook] Processing error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIATE REFUND (admin)
// POST /api/payments/refund
// Body: { orderId, amount (optional - full if omitted), reason }
// ─────────────────────────────────────────────────────────────────────────────
const initiateRefund = async (req, res) => {
  try {
    const { orderId, amount, reason = 'Refund initiated by admin' } = req.body;
    const adminId = req.user.id;

    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.paymentId) {
      return res.status(400).json({ success: false, message: 'No Razorpay payment found (COD orders cannot be refunded here)' });
    }
    if (order.paymentStatus === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'Order has already been fully refunded' });
    }

    const adv = parseFloat(order.advanceAmount || 0);
    const totalPaid =
      order.paymentMethod === 'COD' && adv > 0 ? adv : parseFloat(order.totalAmount);
    const refundAmount = amount ? Math.min(parseFloat(amount), totalPaid) : totalPaid;
    if (refundAmount <= 0) return res.status(400).json({ success: false, message: 'Refund amount must be greater than 0' });

    const rzpRefund = await razorpay.payments.refund(order.paymentId, {
      amount: Math.round(refundAmount * 100),
      speed: 'normal',
      notes: { reason, orderId, adminId },
    });

    const isFullRefund = Math.abs(refundAmount - totalPaid) < 1;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
        status: isFullRefund ? 'REFUNDED' : order.status,
      },
    });

    const refundRecord = await prisma.refund.create({
      data: {
        orderId,
        razorpayRefundId: rzpRefund.id,
        razorpayPaymentId: order.paymentId,
        amount: refundAmount,
        reason,
        status: rzpRefund.status === 'processed' ? 'PROCESSED' : 'PENDING',
        initiatedById: adminId,
      },
    });

    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'REFUND_INITIATED',
        title: 'Refund Initiated',
        message: `A refund of Rs.${refundAmount} for order #${order.orderNumber} has been initiated. It will reflect in 5-7 business days.`,
      },
    });

    const fullOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, shippingAddress: true } });
    sendOrderEmail(order.user?.email, 'REFUNDED', { ...fullOrder, totalAmount: refundAmount }, order.user?.name || 'Customer');

    return res.status(200).json({
      success: true,
      message: `Refund of Rs.${refundAmount} initiated successfully`,
      data: {
        refundId: refundRecord.id,
        razorpayRefundId: rzpRefund.id,
        amount: refundAmount,
        status: rzpRefund.status,
        orderNumber: order.orderNumber,
      },
    });
  } catch (err) {
    console.error('initiateRefund error:', err?.error || err.message);
    const msg = err?.error?.description || err?.message || 'Failed to initiate refund';
    return res.status(500).json({ success: false, message: msg });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL REFUNDS (admin)
// GET /api/payments/refunds?page=1&limit=20&status=
// ─────────────────────────────────────────────────────────────────────────────
const getRefunds = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: { user: { select: { name: true, email: true, phone: true } } },
          },
          initiatedBy: { select: { name: true } },
        },
      }),
      prisma.refund.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: refunds,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('getRefunds error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PAYMENT DETAILS FROM RAZORPAY (admin)
// GET /api/payments/details/:paymentId
// ─────────────────────────────────────────────────────────────────────────────
const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await razorpay.payments.fetch(paymentId);
    return res.status(200).json({ success: true, data: payment });
  } catch (err) {
    console.error('getPaymentDetails error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not fetch payment details' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PAYMENTS LIST FROM RAZORPAY (admin)
// GET /api/payments/list?from=&to=&count=&skip=&status=
// ─────────────────────────────────────────────────────────────────────────────
const getPaymentsList = async (req, res) => {
  try {
    const { count = 25, skip = 0, from, to } = req.query;
    const options = { count: parseInt(count), skip: parseInt(skip) };
    if (from) options.from = parseInt(from);
    if (to)   options.to   = parseInt(to);

    const payments = await razorpay.payments.all(options);

    // Enrich each payment with local order data where we have it
    const paymentIds = (payments.items || []).map(p => p.id);
    const localOrders = await prisma.order.findMany({
      where: { paymentId: { in: paymentIds } },
      select: {
        id: true, orderNumber: true, paymentId: true, status: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    const orderMap = {};
    localOrders.forEach(o => { orderMap[o.paymentId] = o; });

    const enriched = (payments.items || []).map(p => ({
      ...p,
      localOrder: orderMap[p.id] || null,
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      count: payments.count,
      total: payments.entity === 'collection' ? payments.count : enriched.length,
    });
  } catch (err) {
    console.error('getPaymentsList error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not fetch payments from Razorpay' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PAYMENT SUMMARY (admin) — our own DB-derived stats
// GET /api/payments/summary
// ─────────────────────────────────────────────────────────────────────────────
const getPaymentSummary = async (req, res) => {
  try {
    const [
      totalPaid,
      totalRefunded,
      totalFailed,
      totalCOD,
      totalOnline,
      pendingRefunds,
      recentPayments,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalAmount: true }, _count: true }),
      prisma.order.aggregate({ where: { paymentStatus: { in: ['REFUNDED', 'PARTIAL_REFUND'] } }, _sum: { totalAmount: true }, _count: true }),
      prisma.order.count({ where: { paymentStatus: 'FAILED' } }),
      prisma.order.aggregate({ where: { paymentMethod: 'COD', paymentStatus: 'PAID' }, _sum: { totalAmount: true }, _count: true }),
      prisma.order.aggregate({ where: { paymentMethod: { not: 'COD' }, paymentStatus: 'PAID' }, _sum: { totalAmount: true }, _count: true }),
      prisma.refund.count({ where: { status: 'PENDING' } }),
      prisma.order.findMany({
        where: { paymentStatus: 'PAID', paymentMethod: { not: 'COD' } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true, orderNumber: true, totalAmount: true, paymentId: true, updatedAt: true,
          user: { select: { name: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalCollected:    parseFloat(totalPaid._sum.totalAmount || 0),
        totalOrders:       totalPaid._count,
        totalRefunded:     parseFloat(totalRefunded._sum.totalAmount || 0),
        refundedOrders:    totalRefunded._count,
        failedPayments:    totalFailed,
        codCollected:      parseFloat(totalCOD._sum.totalAmount || 0),
        codOrders:         totalCOD._count,
        onlineCollected:   parseFloat(totalOnline._sum.totalAmount || 0),
        onlineOrders:      totalOnline._count,
        pendingRefunds,
        recentPayments,
      },
    });
  } catch (err) {
    console.error('getPaymentSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not fetch payment summary' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SETTLEMENTS FROM RAZORPAY (admin)
// GET /api/payments/settlements?count=&skip=
// ─────────────────────────────────────────────────────────────────────────────
const getSettlements = async (req, res) => {
  try {
    const { count = 25, skip = 0 } = req.query;
    const settlements = await razorpay.settlements.all({
      count: parseInt(count),
      skip:  parseInt(skip),
    });
    return res.status(200).json({ success: true, data: settlements.items || [], count: settlements.count });
  } catch (err) {
    console.error('getSettlements error:', err.message);
    // Return empty gracefully — settlements may not be enabled on test accounts
    return res.status(200).json({ success: true, data: [], count: 0, message: 'Settlements not available on this account' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET DISPUTES FROM RAZORPAY (admin)
// GET /api/payments/disputes?count=&skip=
// ─────────────────────────────────────────────────────────────────────────────
const getDisputes = async (req, res) => {
  try {
    const { count = 25, skip = 0 } = req.query;
    // razorpay-node v2.9+ exposes disputes
    const disputes = await razorpay.disputes.all({ count: parseInt(count), skip: parseInt(skip) });
    return res.status(200).json({ success: true, data: disputes.items || [], count: disputes.count });
  } catch (err) {
    console.error('getDisputes error:', err.message);
    return res.status(200).json({ success: true, data: [], count: 0, message: 'Disputes not available' });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  initiateRefund,
  getRefunds,
  getPaymentDetails,
  getPaymentsList,
  getPaymentSummary,
  getSettlements,
  getDisputes,
};