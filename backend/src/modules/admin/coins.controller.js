const prisma = require('../../config/db');
const { awardCoinsForNewUser, grantCoinsToUser } = require('../coins/coin.service');

async function getUserByIdentifier({ userId, email, phone }) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (email) return prisma.user.findUnique({ where: { email } });
  if (phone) return prisma.user.findUnique({ where: { phone } });
  return null;
}

// GET /api/admin/coins/settings
const getCoinSettings = async (req, res) => {
  try {
    const settings = await prisma.coinSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      const created = await prisma.coinSettings.create({ data: { id: 'singleton', newUserCoins: 100 } });
      return res.status(200).json({ success: true, data: created });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (e) {
    console.error('getCoinSettings error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/coins/settings
const updateCoinSettings = async (req, res) => {
  try {
    const { newUserCoins } = req.body;
    const coins = parseInt(newUserCoins, 10);
    if (!Number.isFinite(coins) || coins < 0) {
      return res.status(400).json({ success: false, message: 'newUserCoins must be a non-negative integer' });
    }

    const updated = await prisma.coinSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', newUserCoins: coins },
      update: { newUserCoins: coins },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    console.error('updateCoinSettings error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/coins/festivals
const listFestivalPromos = async (req, res) => {
  try {
    const promos = await prisma.coinFestivalPromo.findMany({ orderBy: { createdAt: 'desc' } });
    return res.status(200).json({ success: true, data: promos });
  } catch (e) {
    console.error('listFestivalPromos error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/coins/festivals
const createFestivalPromo = async (req, res) => {
  try {
    const { name, coinsAmount, startAt, endAt, isActive } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'name is required' });

    const coins = parseInt(coinsAmount, 10);
    if (!Number.isFinite(coins) || coins < 0) {
      return res.status(400).json({ success: false, message: 'coinsAmount must be a non-negative integer' });
    }

    const s = new Date(startAt);
    const e = new Date(endAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ success: false, message: 'startAt and endAt must be valid datetimes' });
    }
    if (e < s) return res.status(400).json({ success: false, message: 'endAt must be after startAt' });

    const promo = await prisma.coinFestivalPromo.create({
      data: {
        name: String(name).trim(),
        coinsAmount: coins,
        startAt: s,
        endAt: e,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    return res.status(201).json({ success: true, data: promo });
  } catch (e) {
    console.error('createFestivalPromo error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/coins/festivals/:id  (activate/deactivate)
const setFestivalPromoActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = await prisma.coinFestivalPromo.update({
      where: { id },
      data: { isActive: !!isActive },
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    console.error('setFestivalPromoActive error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/coins/grant
// Body: { userId?, email?, phone?, coinsAmount, reason?, source? }
const grantCoins = async (req, res) => {
  try {
    const { userId, email, phone, coinsAmount, reason, source } = req.body;
    const user = await getUserByIdentifier({ userId, email, phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const result = await grantCoinsToUser({
      userId: user.id,
      amount: coinsAmount,
      reason,
      source: source || 'ADMIN_GRANT',
    });

    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('grantCoins error:', e);
    return res.status(400).json({ success: false, message: e.message || 'Grant failed' });
  }
};

// GET /api/admin/coins/balance?userId=&email=&phone=
const getCoinBalance = async (req, res) => {
  try {
    const { userId, email, phone } = req.query;
    const user = await getUserByIdentifier({ userId, email, phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const wallet = await prisma.userCoinWallet.findUnique({ where: { userId: user.id } });
    const transactions = await prisma.coinTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({
      success: true,
      data: {
        balance: wallet?.balance ?? 0,
        walletExists: !!wallet,
        transactions,
      },
    });
  } catch (e) {
    console.error('getCoinBalance error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/coins/debug/reaward/:userId  (optional utility)
const reawardCoinsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await awardCoinsForNewUser(userId);
    return res.status(200).json({ success: true, data: result, message: 'Coins re-awarded for debugging' });
  } catch (e) {
    console.error('reawardCoinsForUser error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getCoinSettings,
  updateCoinSettings,
  listFestivalPromos,
  createFestivalPromo,
  setFestivalPromoActive,
  grantCoins,
  getCoinBalance,
  reawardCoinsForUser,
};

