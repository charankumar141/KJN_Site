const prisma = require('../../config/db');

// Admin: list all pincode delivery rules
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, pincode } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (pincode) where.pincode = { contains: pincode, mode: 'insensitive' };

    const [list, total] = await Promise.all([
      prisma.pincodeDelivery.findMany({ where, skip, take: parseInt(limit), orderBy: { pincode: 'asc' } }),
      prisma.pincodeDelivery.count({ where }),
    ]);
    return res.status(200).json({
      success: true,
      data: list,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('pincodeDelivery getAll error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: create pincode delivery rule
const create = async (req, res) => {
  try {
    const { pincode, estimatedDays, estimatedDaysMax, isServiceable } = req.body;
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: 'Valid 6-digit pincode required' });
    }
    const days = parseInt(estimatedDays) || 3;
    const rule = await prisma.pincodeDelivery.create({
      data: {
        pincode,
        estimatedDays: days,
        estimatedDaysMax: estimatedDaysMax ? parseInt(estimatedDaysMax) : null,
        isServiceable: isServiceable !== false,
      },
    });
    return res.status(201).json({ success: true, message: 'Pincode delivery rule added', data: rule });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ success: false, message: 'This pincode already has a rule' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: update pincode delivery rule
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { estimatedDays, estimatedDaysMax, isServiceable } = req.body;
    const rule = await prisma.pincodeDelivery.update({
      where: { id },
      data: {
        ...(estimatedDays != null && { estimatedDays: parseInt(estimatedDays) }),
        ...(estimatedDaysMax != null && { estimatedDaysMax: estimatedDaysMax === '' ? null : parseInt(estimatedDaysMax) }),
        ...(typeof isServiceable === 'boolean' && { isServiceable }),
      },
    });
    return res.status(200).json({ success: true, data: rule });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: delete pincode delivery rule
const remove = async (req, res) => {
  try {
    await prisma.pincodeDelivery.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, message: 'Pincode rule deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove };
