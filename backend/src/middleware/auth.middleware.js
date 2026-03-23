const { verifyAccessToken } = require('../utils/jwt');

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

// Optional auth — populates req.user if a valid token is present, but never rejects
const optionalProtect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded) req.user = decoded;
    }
  } catch (_) {
    // ignore — guest request
  }
  next();
};

// Admin only middleware (matches admin UI: ADMIN + STAFF)
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.',
    });
  }
  next();
};

// Role-based restriction middleware
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only ${roles.join(', ')} can access this.`,
      });
    }
    next();
  };
};

module.exports = { protect, optionalProtect, adminOnly, restrictTo };