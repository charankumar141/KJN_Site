const prisma = require('../../config/db');
const { sendEmail } = require('../../config/mailer');
const { generateOTP, saveOTP, verifyOTP, checkOTPCooldown, setOTPCooldown } = require('../../utils/otp');

// ?????????????????????????????????????????????
// EMAIL CHANGE — Step 1: Send OTP to new email
// POST /api/user/email/send-otp
// Body: { newEmail }
// ?????????????????????????????????????????????
const sendEmailChangeOTP = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) {
      return res.status(400).json({ success: false, message: 'New email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const existing = await prisma.user.findFirst({ where: { email: newEmail } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already in use' });
    }

    const onCooldown = await checkOTPCooldown(`email-change:${req.user.id}`);
    if (onCooldown) {
      return res.status(429).json({ success: false, message: 'Please wait 1 minute before requesting another OTP' });
    }

    const otp = generateOTP();
    await saveOTP(`email-change:${req.user.id}:${newEmail}`, otp);
    await setOTPCooldown(`email-change:${req.user.id}`);

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

    await sendEmail({
      to: newEmail,
      subject: 'KJN Shop - Verify your new email address',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
          <h2 style="color:#1B5E20;margin:0 0 8px;">Hi ${user?.name || 'there'},</h2>
          <p style="color:#374151;font-size:15px;">Your OTP to update your KJN Shop email address is:</p>
          <div style="background:#E8F5E9;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:40px;font-weight:800;color:#1B5E20;letter-spacing:10px;">${otp}</span>
          </div>
          <p style="color:#6B7280;font-size:13px;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9CA3AF;font-size:12px;">KJN Trading Company · Mulakalacheruvu, Andhra Pradesh</p>
        </div>
      `,
    });

    console.log(`\n=============================`);
    console.log(`EMAIL CHANGE OTP for user ${req.user.id} ? ${newEmail}: ${otp}`);
    console.log(`=============================\n`);

    return res.status(200).json({ success: true, message: `OTP sent to ${newEmail}. Valid for 5 minutes.` });
  } catch (error) {
    console.error('sendEmailChangeOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ?????????????????????????????????????????????
// EMAIL CHANGE — Step 2: Verify OTP & update email
// POST /api/user/email/verify-otp
// Body: { newEmail, otp }
// ?????????????????????????????????????????????
const verifyEmailChangeOTP = async (req, res) => {
  try {
    const { newEmail, otp } = req.body;
    if (!newEmail || !otp) {
      return res.status(400).json({ success: false, message: 'New email and OTP are required' });
    }

    const result = await verifyOTP(`email-change:${req.user.id}:${newEmail}`, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const existing = await prisma.user.findFirst({ where: { email: newEmail } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already in use' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { email: newEmail },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, createdAt: true },
    });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('verifyEmailChangeOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, createdAt: true },
    });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, avatarUrl },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAddresses = async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { isDefault: 'desc' },
    });
    return res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addAddress = async (req, res) => {
  try {
    const { name, phone, line1, line2, city, state, pincode, isDefault } = req.body;
    if (!name || !phone || !line1 || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: 'All address fields are required' });
    }

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.create({
      data: { userId: req.user.id, name, phone, line1, line2, city, state, pincode, isDefault: isDefault || false },
    });
    return res.status(201).json({ success: true, data: address });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, line1, line2, city, state, pincode, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.update({
      where: { id, userId: req.user.id },
      data: { name, phone, line1, line2, city, state, pincode, isDefault },
    });
    return res.status(200).json({ success: true, data: address });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.address.delete({ where: { id, userId: req.user.id } });
    return res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getWishlist = async (req, res) => {
  try {
    const wishlist = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: { images: { where: { isPrimary: true }, take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({
      success: true,
      data: wishlist.map((w) => ({
        id: w.id,
        productId: w.productId,
        name: w.product.name,
        slug: w.product.slug,
        mrp: parseFloat(w.product.mrp),
        sellingPrice: parseFloat(w.product.sellingPrice),
        discountPercent: Math.round(((w.product.mrp - w.product.sellingPrice) / w.product.mrp) * 100),
        image: w.product.images[0]?.image || w.product.image || null,
        inStock: w.product.stockQuantity > 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const existing = await prisma.wishlist.findUnique({ where: { userId_productId: { userId, productId } } });

    if (existing) {
      await prisma.wishlist.delete({ where: { userId_productId: { userId, productId } } });
      return res.status(200).json({ success: true, message: 'Removed from wishlist', wishlisted: false });
    } else {
      await prisma.wishlist.create({ data: { userId, productId } });
      return res.status(200).json({ success: true, message: 'Added to wishlist', wishlisted: true });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    return res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/user/coins — current user's KJN coin balance (1 coin ? ?1 at checkout)
const getMyCoinBalance = async (req, res) => {
  try {
    const wallet = await prisma.userCoinWallet.findUnique({ where: { userId: req.user.id } });
    return res.status(200).json({
      success: true,
      data: { balance: parseInt(wallet?.balance ?? 0, 10) || 0 },
    });
  } catch (error) {
    console.error('getMyCoinBalance error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile, getAddresses, addAddress, updateAddress, deleteAddress, getWishlist, toggleWishlist, getNotifications, markNotificationsRead, sendEmailChangeOTP, verifyEmailChangeOTP, getMyCoinBalance };