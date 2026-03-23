// ─────────────────────────────────────────────────────────────
// src/utils/email.js
// Email via Nodemailer (Gmail SMTP dev / SendGrid production)
// ─────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.SENDGRID_API_KEY) {
    // Production: SendGrid
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  // Development: Gmail SMTP
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const FROM = process.env.EMAIL_FROM || 'KJN Shop <noreply@shopatkjn.com>';

// ── Send OTP Email ─────────────────────────────────────────

const sendOTPEmail = async (email, otp, name) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `${otp} is your KJN Shop verification code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <img src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg" alt="KJN Shop" style="height:48px;margin-bottom:24px;" />
        <h2 style="color:#1B5E20;margin:0 0 8px;">Hi ${name || 'there'},</h2>
        <p style="color:#374151;font-size:15px;">Your verification code for KJN Shop is:</p>
        <div style="background:#E8F5E9;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:40px;font-weight:800;color:#1B5E20;letter-spacing:10px;">${otp}</span>
        </div>
        <p style="color:#6B7280;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;">KJN Trading Company · Mulakalacheruvu, Andhra Pradesh</p>
      </div>
    `,
  });
};

// ── Send Order Confirmation Email ──────────────────────────

const sendOrderConfirmationEmail = async (email, order) => {
  const transporter = createTransporter();
  const itemsHtml = order.items?.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;">${item.productName}</td>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;text-align:center;">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;text-align:right;">₹${parseFloat(item.price * item.quantity).toLocaleString('en-IN')}</td>
    </tr>
  `).join('') || '';

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Order Confirmed — #${order.orderNumber} | KJN Shop`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;">
        <div style="background:#1B5E20;padding:24px;text-align:center;">
          <img src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg" alt="KJN Shop" style="height:44px;" />
          <h1 style="color:white;margin:12px 0 0;font-size:22px;">Order Confirmed! 🎉</h1>
        </div>
        <div style="padding:24px;">
          <p style="color:#374151;font-size:15px;">Hi <strong>${order.user?.name}</strong>, thank you for shopping with KJN Shop!</p>
          <div style="background:#E8F5E9;border-radius:10px;padding:16px;margin:16px 0;display:flex;justify-content:space-between;">
            <div>
              <p style="margin:0;font-size:12px;color:#6B7280;">Order Number</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#1B5E20;">#${order.orderNumber}</p>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#6B7280;">Order Total</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#1B5E20;">₹${parseFloat(order.totalAmount).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#6B7280;">Payment</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#374151;">${order.paymentMethod}</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280;">Product</th>
                <th style="padding:10px;text-align:center;font-size:12px;color:#6B7280;">Qty</th>
                <th style="padding:10px;text-align:right;font-size:12px;color:#6B7280;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-top:16px;">
            <p style="margin:0;font-size:12px;color:#6B7280;">Delivering To:</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#374151;">
              ${order.shippingAddress?.name || order.user?.name}<br/>
              ${order.shippingAddress?.addressLine1}, ${order.shippingAddress?.city}<br/>
              ${order.shippingAddress?.state} - ${order.shippingAddress?.pincode}
            </p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://www.shopatkjn.com/orders/${order.id}" style="background:#1B5E20;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Track Your Order</a>
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9CA3AF;font-size:12px;margin:0;">Questions? WhatsApp us at <a href="https://wa.me/919440658294" style="color:#1B5E20;">9440658294</a></p>
          <p style="color:#9CA3AF;font-size:12px;margin:4px 0 0;">KJN Trading Company · Mulakalacheruvu, Andhra Pradesh 517390</p>
        </div>
      </div>
    `,
  });
};

// ── Abandoned cart reminder ───────────────────────────────

const sendAbandonedCartReminderEmail = async (toEmail, { userName, items, cartUrl, whatsappUrl }) => {
  const transporter = createTransporter();
  const rows = (items || []).map(
    (it) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;">${it.name}</td>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;text-align:center;">${it.qty}</td>
      <td style="padding:10px;border-bottom:1px solid #f3f4f6;text-align:right;">₹${it.lineTotal}</td>
    </tr>`
  ).join('');

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'You left items in your cart — complete your order | KJN Shop',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;">
        <div style="background:#1B5E20;padding:20px;text-align:center;">
          <img src="https://image.cdn.shpy.in/386933/KJNLogo-1767688579320.jpeg" alt="KJN Shop" style="height:40px;" />
          <h1 style="color:white;margin:12px 0 0;font-size:20px;">Your cart is waiting</h1>
        </div>
        <div style="padding:24px;">
          <p style="color:#374151;font-size:15px;">Hi <strong>${userName || 'there'}</strong>,</p>
          <p style="color:#374151;font-size:15px;">You still have items in your cart. Complete your purchase before stock runs out.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280;">Product</th>
                <th style="padding:10px;text-align:center;font-size:12px;color:#6B7280;">Qty</th>
                <th style="padding:10px;text-align:right;font-size:12px;color:#6B7280;">Line</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="${cartUrl}" style="background:#1B5E20;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Return to cart</a>
          </div>
          <p style="color:#6B7280;font-size:13px;text-align:center;">Need help? <a href="${whatsappUrl}" style="color:#1B5E20;">Chat on WhatsApp</a></p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9CA3AF;font-size:12px;margin:0;">KJN Trading Company · Mulakalacheruvu, Andhra Pradesh</p>
        </div>
      </div>
    `,
  });
};

module.exports = { sendOTPEmail, sendOrderConfirmationEmail, sendAbandonedCartReminderEmail };