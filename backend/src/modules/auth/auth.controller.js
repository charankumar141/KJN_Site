const prisma = require('../../config/db');
const { sendEmail } = require('../../config/mailer');
const {
  generateOTP,
  saveOTP,
  verifyOTP,
  checkOTPCooldown,
  setOTPCooldown,
  saveSignupSession,
  getSignupSession,
  deleteSignupSession,
} = require('../../utils/otp');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../utils/jwt');
const { awardCoinsForNewUser } = require('../coins/coin.service');
const {
  saveRefreshToken,
  verifyRefreshTokenExists,
  deleteRefreshToken,
} = require('../../utils/tokenStorage');

// ─────────────────────────────────────────────
// SIGNUP — Step 1: Send Email OTP
// POST /api/auth/signup/send-otp
// Body: { name, email, phone }
// ─────────────────────────────────────────────
const signupSendOTP = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and phone are required',
      });
    }

    // Check if a FULLY REGISTERED user already exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      // A real account exists — block and tell them to login
      const field = existingUser.email === email ? 'Email' : 'Phone number';
      return res.status(400).json({
        success: false,
        message: `${field} already registered. Please login.`,
        alreadyRegistered: true,
      });
    }

    // Check if there is an existing pending signup session for this email/phone
    // (user requested OTP before but never completed verification)
    const existingSession = await getSignupSession(email);
    const phoneSession = await prisma.signupSession.findFirst({ where: { phone } }).catch(() => null);

    if (!existingSession && phoneSession) {
      // Phone is tied to a different pending email session — delete it and allow fresh start
      await prisma.signupSession.delete({ where: { id: phoneSession.id } }).catch(() => {});
    }

    // Check cooldown (prevent OTP spam) — only if no existing session to allow re-entry
    const onCooldown = await checkOTPCooldown(`signup:${email}`);
    if (onCooldown && !existingSession) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP',
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP in Database (overwrites any previous OTP for this email)
    await saveOTP(`signup:${email}`, otp);
    await setOTPCooldown(`signup:${email}`);

    // Save (or overwrite) temporary signup data in Database (10 minutes)
    await saveSignupSession(email, name, phone);

    // Send OTP via Email
    await sendEmail({
      to: email,
      subject: 'KJN Shop - Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1B5E20;">KJN Shop - Verify Your Email</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your OTP for account registration is:</p>
          <h1 style="background: #E8F5E9; padding: 20px; text-align: center; 
              letter-spacing: 10px; color: #1B5E20; border-radius: 8px;">
            ${otp}
          </h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr/>
          <small style="color: #999;">KJN Trading Company, Mulakalacheruvu, AP</small>
        </div>
      `,
    });

    // For testing — print OTP in console
    console.log(`\n=============================`);
    console.log(`SIGNUP OTP for ${email}: ${otp}`);
    console.log(`=============================\n`);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}. Valid for 5 minutes.`,
    });
  } catch (error) {
    console.error('signupSendOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// SIGNUP — Step 2: Verify Email OTP & Create Account
// POST /api/auth/signup/verify-otp
// Body: { email, otp }
// ─────────────────────────────────────────────
const signupVerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Verify OTP
    const result = await verifyOTP(`signup:${email}`, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // Get signup data from Database
    const signupData = await getSignupSession(email);
    if (!signupData) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please signup again.',
      });
    }

    const { name, phone } = signupData;

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        isVerified: true,
        role: 'CUSTOMER',
      },
    });

    // Clean up signup session
    await deleteSignupSession(email);

    // Credit KJN coins immediately after account creation.
    // This is non-blocking: if coin credit fails, signup still succeeds.
    try {
      await awardCoinsForNewUser(user.id);
    } catch (e) {
      console.error('awardCoinsForNewUser error:', e);
    }

    // Generate tokens
    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token in Database
    await saveRefreshToken(user.id, refreshToken);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('signupVerifyOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// LOGIN — Step 1: Send Mobile OTP
// POST /api/auth/login/send-otp
// Body: { phone }
// ─────────────────────────────────────────────
const loginSendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number. Please signup first.',
      });
    }

    // Check cooldown
    const onCooldown = await checkOTPCooldown(`login:${phone}`);
    if (onCooldown) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP',
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP in Database
    await saveOTP(`login:${phone}`, otp);
    await setOTPCooldown(`login:${phone}`);

    // Send OTP to user's registered email
    await sendEmail({
      to: user.email,
      subject: 'KJN Shop - Login OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1B5E20;">KJN Shop - Login Verification</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your OTP for login is:</p>
          <h1 style="background: #E8F5E9; padding: 20px; text-align: center;
              letter-spacing: 10px; color: #1B5E20; border-radius: 8px;">
            ${otp}
          </h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr/>
          <small style="color: #999;">KJN Trading Company, Mulakalacheruvu, AP</small>
        </div>
      `,
    });

    // For testing — print OTP in console
    console.log(`\n=============================`);
    console.log(`LOGIN OTP for ${phone} sent to ${user.email}: ${otp}`);
    console.log(`=============================\n`);

    // Mask the email for the response (e.g. us***@gmail.com)
    const [localPart, domain] = user.email.split('@');
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain;

    return res.status(200).json({
      success: true,
      message: `OTP sent to your registered email (${maskedEmail}). Valid for 5 minutes.`,
      maskedEmail,
    });
  } catch (error) {
    console.error('loginSendOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// LOGIN — Step 2: Verify Mobile OTP & Login
// POST /api/auth/login/verify-otp
// Body: { phone, otp }
// ─────────────────────────────────────────────
const loginVerifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required',
      });
    }

    // Verify OTP
    const result = await verifyOTP(`login:${phone}`, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // Get user from database
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate tokens
    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token in Database
    await saveRefreshToken(user.id, refreshToken);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('loginVerifyOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PASSWORD LOGIN (ADMIN)
// POST /api/auth/login/password
// Body: { email, password }
// ─────────────────────────────────────────────
const bcrypt = require('bcryptjs');

const loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // only admins (or staff) can use password login
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      return res.status(403).json({ success: false, message: 'Password login is not allowed for this account' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ success: false, message: 'Password not set. Use OTP login.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // generate tokens same as OTP login
    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await saveRefreshToken(user.id, refreshToken);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('loginWithPassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// REFRESH TOKEN
// POST /api/auth/refresh
// ─────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token found',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Check if refresh token exists in Database
    const tokenExists = await verifyRefreshTokenExists(token);
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token revoked',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: decoded.id,
      role: decoded.role,
    });

    return res.status(200).json({ success: true, accessToken });
  } catch (error) {
    console.error('refreshToken error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// LOGOUT
// POST /api/auth/logout
// ─────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = verifyRefreshToken(token);
      if (decoded) {
        // Remove refresh token from Database
        await deleteRefreshToken(decoded.id);
      }
    }

    // Clear cookie
    res.clearCookie('refreshToken');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('logout error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET CURRENT USER
// GET /api/auth/me
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  signupSendOTP,
  signupVerifyOTP,
  loginSendOTP,
  loginVerifyOTP,
  loginWithPassword,
  refreshToken,
  logout,
  getMe,
};