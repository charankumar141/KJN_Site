// backend/src/modules/orders/order.email.js
//
// Transactional email notifications for every order lifecycle event.
// Triggered from order.controller.js -- failures are logged but never
// allowed to break the main order flow.

const { sendEmail } = require('../../config/mailer');

const BRAND_COLOR = '#1B5E20';
const ACCENT_COLOR = '#E8F5E9';
const LOGO_URL = 'https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg';
const SITE_URL = process.env.FRONTEND_URL || 'https://www.shopatkjn.com';
const WA_NUMBER = '919440658294';
const COMPANY = 'KJN Trading Company - Mulakalacheruvu, Andhra Pradesh 517390';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const shell = (bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="KJN Shop" style="height:48px;display:block;margin:0 auto 10px;" />
            <p style="margin:0;color:#ffffff;font-size:13px;opacity:0.85;">KJN Shop - Quality Agricultural Products</p>
          </td>
        </tr>
        ${bodyHtml}
        <tr>
          <td style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 6px;font-size:13px;color:#6B7280;">
              Need help? WhatsApp us at
              <a href="https://wa.me/${WA_NUMBER}" style="color:${BRAND_COLOR};font-weight:700;">9440658294</a>
            </p>
            <p style="margin:0;font-size:11px;color:#9CA3AF;">${COMPANY}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const statusBadge = (label, bgColor, textColor) => {
  const bg = bgColor || BRAND_COLOR;
  const fg = textColor || '#ffffff';
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:12px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:0.5px;">${label}</span>`;
};

const orderSummaryBox = (order) => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:${ACCENT_COLOR};border-radius:10px;margin:20px 0;">
  <tr>
    <td style="padding:16px 20px;border-right:1px solid #C8E6C9;" align="center">
      <p style="margin:0;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Order No.</p>
      <p style="margin:4px 0 0;font-size:17px;font-weight:800;color:${BRAND_COLOR};">#${order.orderNumber}</p>
    </td>
    <td style="padding:16px 20px;border-right:1px solid #C8E6C9;" align="center">
      <p style="margin:0;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Total</p>
      <p style="margin:4px 0 0;font-size:17px;font-weight:800;color:${BRAND_COLOR};">Rs. ${fmt(order.totalAmount)}</p>
    </td>
    <td style="padding:16px 20px;" align="center">
      <p style="margin:0;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Payment</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#374151;">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</p>
    </td>
  </tr>
</table>`;

const itemsTable = (items) => {
  const rows = (items || []).map((item) => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">
        ${item.productName}
        ${item.variantInfo ? `<br/><span style="font-size:11px;color:#9CA3AF;">${item.variantInfo}</span>` : ''}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${item.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">Rs. ${fmt(item.totalPrice)}</td>
    </tr>`).join('');
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
  <thead>
    <tr style="background:#f9fafb;">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Product</th>
      <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Qty</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Amount</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
};

const ctaButton = (text, href) => `
<div style="text-align:center;margin:24px 0;">
  <a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">${text}</a>
</div>`;

const addressBlock = (addr, name) => {
  if (!addr) return '';
  const lines = [addr.line1, addr.line2, `${addr.city}, ${addr.state}`, addr.pincode, addr.phone]
    .filter(Boolean).join('<br/>');
  return `
<div style="background:#f9fafb;border-radius:8px;padding:14px 18px;margin:16px 0;">
  <p style="margin:0 0 6px;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Delivering To</p>
  <p style="margin:0;font-size:13px;font-weight:700;color:#374151;">${name}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6B7280;line-height:1.6;">${lines}</p>
</div>`;
};

// ?? Template builders ??????????????????????????????????????????????????????

function buildOrderPlacedEmail(order, userName) {
  const adv = parseFloat(order.advanceAmount || 0);
  const pendingCodAdvance =
    order.paymentMethod === 'COD' && adv > 0 && order.paymentStatus === 'PENDING' && !order.paymentId;
  const badge = pendingCodAdvance
    ? statusBadge('Awaiting advance payment', '#E65100')
    : statusBadge('Order Confirmed', BRAND_COLOR);
  const intro = pendingCodAdvance
    ? `<p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your order is held until the COD advance is paid online.</p>
       <div style="background:#FFF3E0;border-radius:10px;padding:16px 20px;margin:0 0 20px;text-align:center;">
         <p style="margin:0;font-size:13px;color:#E65100;font-weight:700;">Pay Rs. ${fmt(adv)} now to confirm your Cash on Delivery order.</p>
         <p style="margin:8px 0 0;font-size:12px;color:#6B7280;">The rest is payable when the order is delivered.</p>
       </div>`
    : `<p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your order has been received and confirmed.</p>`;
  const subject = pendingCodAdvance
    ? `Complete payment - Order #${order.orderNumber} | KJN Shop`
    : `Order Confirmed - #${order.orderNumber} | KJN Shop`;
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${badge}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Thank You For Your Order!</h2>
    ${intro}
    ${orderSummaryBox(order)}
    ${itemsTable(order.items)}
    ${addressBlock(order.shippingAddress, order.shippingAddress?.name || userName)}
    ${ctaButton('Track Your Order', `${SITE_URL}/orders/${order.id}`)}
    <p style="font-size:13px;color:#6B7280;text-align:center;">We will send you updates as your order progresses.</p>
  </td></tr>`;
  return { subject, html: shell(body) };
}

function buildOrderProcessingEmail(order, userName) {
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Processing', '#1565C0')}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Your Order is Being Processed</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, our team is packing your items right now!</p>
    ${orderSummaryBox(order)}
    ${ctaButton('View Order', `${SITE_URL}/orders/${order.id}`)}
  </td></tr>`;
  return { subject: `Your Order #${order.orderNumber} is Being Processed | KJN Shop`, html: shell(body) };
}

function buildOrderShippedEmail(order, userName) {
  const trackingInfo = order.awbNumber
    ? `<div style="background:#E3F2FD;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#1565C0;text-transform:uppercase;letter-spacing:0.5px;">AWB / Tracking Number</p>
        <p style="margin:6px 0 0;font-size:18px;font-weight:800;color:#1565C0;">${order.awbNumber}</p>
        ${order.trackingId ? `<p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Tracking ID: ${order.trackingId}</p>` : ''}
      </div>`
    : '';
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Shipped', '#0D47A1')}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Your Order is On Its Way!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your package has been handed to the courier.</p>
    ${orderSummaryBox(order)}
    ${trackingInfo}
    ${ctaButton('Track Your Order', `${SITE_URL}/orders/${order.id}`)}
  </td></tr>`;
  return { subject: `Your Order #${order.orderNumber} Has Been Shipped | KJN Shop`, html: shell(body) };
}

function buildOutForDeliveryEmail(order, userName) {
  const codNotice = order.paymentMethod === 'COD'
    ? `<div style="background:#FFF3E0;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#E65100;">Please keep Rs. ${fmt(order.totalAmount)} ready for Cash on Delivery.</p>
       </div>`
    : '';
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Out for Delivery', '#E65100')}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Arriving Today!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your order is out for delivery and will reach you soon.</p>
    ${orderSummaryBox(order)}
    ${addressBlock(order.shippingAddress, order.shippingAddress?.name || userName)}
    ${codNotice}
    ${ctaButton('View Order Details', `${SITE_URL}/orders/${order.id}`)}
  </td></tr>`;
  return { subject: `Out for Delivery - Order #${order.orderNumber} | KJN Shop`, html: shell(body) };
}

function buildOrderDeliveredEmail(order, userName) {
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Delivered', BRAND_COLOR)}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Order Delivered Successfully!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your order has been delivered. We hope you love it!</p>
    ${orderSummaryBox(order)}
    <div style="background:#E8F5E9;border-radius:10px;padding:20px;margin:16px 0;text-align:center;">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${BRAND_COLOR};">How was your experience?</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B7280;">Your feedback helps us serve you better.</p>
      <a href="${SITE_URL}/orders/${order.id}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Rate &amp; Review Products</a>
    </div>
    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin-top:8px;">Thank you for shopping with KJN Shop!</p>
  </td></tr>`;
  return { subject: `Order Delivered - #${order.orderNumber} | KJN Shop`, html: shell(body) };
}

function buildOrderCancelledEmail(order, userName) {
  const refundNote = order.paymentMethod !== 'COD'
    ? `<div style="background:#FFF3E0;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:13px;color:#E65100;font-weight:600;">If you paid online, your refund will be processed within 5-7 business days.</p>
       </div>`
    : '';
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Cancelled', '#B71C1C')}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Order Cancelled</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your order has been cancelled.</p>
    ${orderSummaryBox(order)}
    ${refundNote}
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/products" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Continue Shopping</a>
    </div>
  </td></tr>`;
  return { subject: `Order Cancelled - #${order.orderNumber} | KJN Shop`, html: shell(body) };
}

function buildOrderRefundedEmail(order, userName) {
  const body = `
  <tr><td style="padding:28px 32px;">
    <div style="text-align:center;margin-bottom:16px;">${statusBadge('Refunded', '#4A148C')}</div>
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;text-align:center;">Refund Processed</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;text-align:center;">Hi <strong>${userName}</strong>, your refund for order <strong>#${order.orderNumber}</strong> has been processed.</p>
    ${orderSummaryBox(order)}
    <div style="background:#EDE7F6;border-radius:8px;padding:14px 18px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#4A148C;">Refund Amount: Rs. ${fmt(order.totalAmount)}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#6B7280;">Please allow 5-7 business days for the amount to reflect in your account.</p>
    </div>
    <p style="font-size:13px;color:#6B7280;text-align:center;">Thank you for your patience!</p>
  </td></tr>`;
  return { subject: `Refund Processed - #${order.orderNumber} | KJN Shop`, html: shell(body) };
}

// ?? Public dispatcher ??????????????????????????????????????????????????????

/**
 * Send order email for a given status.
 * Silently swallows errors so email failures never break order flow.
 *
 * @param {string} toEmail
 * @param {string} status   - Order status key or 'PLACED'
 * @param {object} order    - Order data (includes items, shippingAddress)
 * @param {string} userName - Customer display name
 */
async function sendOrderEmail(toEmail, status, order, userName) {
  if (!toEmail) return;
  try {
    let payload = null;
    switch (status) {
      case 'PLACED':
      case 'CONFIRMED':        payload = buildOrderPlacedEmail(order, userName);     break;
      case 'PROCESSING':       payload = buildOrderProcessingEmail(order, userName); break;
      case 'SHIPPED':          payload = buildOrderShippedEmail(order, userName);    break;
      case 'OUT_FOR_DELIVERY': payload = buildOutForDeliveryEmail(order, userName);  break;
      case 'DELIVERED':        payload = buildOrderDeliveredEmail(order, userName);  break;
      case 'CANCELLED':        payload = buildOrderCancelledEmail(order, userName);  break;
      case 'REFUNDED':         payload = buildOrderRefundedEmail(order, userName);   break;
      default:                 return; // PENDING, RETURNED -- no email
    }
    if (payload) await sendEmail({ to: toEmail, subject: payload.subject, html: payload.html });
  } catch (err) {
    console.error(`[OrderEmail] Failed to send ${status} email to ${toEmail}:`, err.message);
  }
}

module.exports = { sendOrderEmail };
