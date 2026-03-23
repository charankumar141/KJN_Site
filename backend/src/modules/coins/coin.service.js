const prisma = require('../../config/db');

function now() {
  return new Date();
}

async function getCoinSettings() {
  const settings = await prisma.coinSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    // Create default row on first run (safety for older DBs).
    return prisma.coinSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', newUserCoins: 100 },
      update: {},
    });
  }
  return settings;
}

async function getActiveFestivalPromos(tx) {
  const n = now();
  const promos = await (tx || prisma).coinFestivalPromo.findMany({
    where: {
      isActive: true,
      startAt: { lte: n },
      endAt: { gte: n },
    },
    orderBy: { startAt: 'asc' },
  });
  return promos;
}

async function ensureWallet(tx, userId) {
  await tx.userCoinWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

/**
 * Real-time coin credit for a user that just signed up.
 * - Always credits `CoinSettings.newUserCoins`
 * - Plus any active `CoinFestivalPromo` coins (based on current time window)
 */
async function awardCoinsForNewUser(userId) {
  const settings = await getCoinSettings();
  const nUserCoins = parseInt(settings.newUserCoins || 0, 10) || 0;

  return prisma.$transaction(async (tx) => {
    await ensureWallet(tx, userId);

    const promos = await getActiveFestivalPromos(tx);
    const totalFestivalCoins = promos.reduce((sum, p) => sum + (parseInt(p.coinsAmount || 0, 10) || 0), 0);
    const total = nUserCoins + totalFestivalCoins;

    if (total <= 0) return { awarded: 0, balanceAfter: null };

    // Apply wallet balance first (atomic)
    await tx.userCoinWallet.update({
      where: { userId },
      data: { balance: { increment: total } },
    });

    const txRows = [];
    if (nUserCoins > 0) {
      txRows.push({
        userId,
        amount: nUserCoins,
        type: 'EARN',
        source: 'NEW_USER',
        reason: 'Welcome bonus',
        meta: { coinsType: 'NEW_USER' },
      });
    }

    for (const promo of promos) {
      const amt = parseInt(promo.coinsAmount || 0, 10) || 0;
      if (amt <= 0) continue;
      txRows.push({
        userId,
        amount: amt,
        type: 'EARN',
        source: 'FESTIVAL',
        reason: `Festival promo: ${promo.name}`,
        meta: { promoId: promo.id, promoName: promo.name },
      });
    }

    if (txRows.length) {
      await tx.coinTransaction.createMany({ data: txRows });
    }

    const wallet = await tx.userCoinWallet.findUnique({ where: { userId } });
    return { awarded: total, balanceAfter: wallet?.balance ?? null };
  });
}

/**
 * Admin grant / adjustment.
 * - `amount` must be positive integer (EARN only for now)
 */
async function grantCoinsToUser({ userId, amount, reason, source = 'ADMIN_GRANT' }) {
  const amt = parseInt(amount, 10);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('coinsAmount must be a positive integer');

  return prisma.$transaction(async (tx) => {
    await ensureWallet(tx, userId);

    await tx.userCoinWallet.update({
      where: { userId },
      data: { balance: { increment: amt } },
    });

    await tx.coinTransaction.create({
      data: {
        userId,
        amount: amt,
        type: 'EARN',
        source,
        reason: reason || 'Admin grant',
        meta: {},
      },
    });

    const wallet = await tx.userCoinWallet.findUnique({ where: { userId } });
    return { granted: amt, balanceAfter: wallet?.balance ?? null };
  });
}

module.exports = { awardCoinsForNewUser, grantCoinsToUser };

