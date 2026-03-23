const prisma = require('../../config/db');
let shipmozo = null;
try {
  shipmozo = require('../../config/shipmozo');
} catch (_) {
  shipmozo = null;
}

function pickShipmozoEtaDays(serviceability) {
  const raw =
    serviceability?.data ||
    serviceability?.data?.data ||
    serviceability?.couriers ||
    serviceability?.data?.couriers ||
    serviceability?.courier ||
    [];

  const list = Array.isArray(raw) ? raw : [];
  const candidates = list
    .map((c) => {
      const days =
        c?.estimated_delivery_days ??
        c?.estimatedDays ??
        c?.etd_days ??
        c?.etd ??
        c?.delivery_days ??
        null;
      const daysNum = days != null ? parseInt(days, 10) : null;
      return {
        courier: c?.courier_name || c?.courier || c?.name || null,
        days: Number.isFinite(daysNum) ? daysNum : null,
        raw: c,
      };
    })
    .filter((c) => c.days != null && c.days > 0);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.days - b.days);
  return candidates[0];
}

// Check pincode: Shipmozo ETA first (real-time), then admin rules, then fallback static logic
const checkPincode = async (req, res) => {
  try {
    const { pincode } = req.params;
    const { weightGrams, paymentMode } = req.query;

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: 'Invalid pincode' });
    }

    // 1) Shipmozo real-time serviceability + ETA (warehouse/rural aware)
    if (shipmozo && process.env.SHIPMOZO_API_KEY && process.env.SHIPMOZO_API_KEY !== 'your_shipmozo_api_key') {
      try {
        const w = weightGrams ? parseInt(weightGrams, 10) : 500;
        const pm = (paymentMode || 'PREPAID').toUpperCase() === 'COD' ? 'COD' : 'PREPAID';
        const svc = await shipmozo.getServiceability(pincode, Number.isFinite(w) ? w : 500, pm);
        const eta = pickShipmozoEtaDays(svc);
        if (eta?.days) {
          const daysMin = eta.days;
          const daysMax = daysMin + 1;
          return res.status(200).json({
            success: true,
            serviceable: true,
            pincode,
            source: 'SHIPMOZO',
            courier: eta.courier,
            estimatedDays: daysMin,
            estimatedDaysMax: daysMax,
            estimatedDeliveryDate: getEstimatedDate(daysMin, daysMax),
            message: `Delivery in ${daysMin}-${daysMax} business days`,
            freeShippingAbove: 500,
            codAvailable: true,
          });
        }
      } catch (e) {
        // fall through to admin/static logic
      }
    }

    // Admin-defined delivery by pincode (accurate estimate)
    const adminRule = await prisma.pincodeDelivery.findUnique({
      where: { pincode },
    });

    if (adminRule) {
      if (!adminRule.isServiceable) {
        return res.status(200).json({
          success: true,
          serviceable: false,
          message: 'Sorry, delivery is not available at this pincode',
        });
      }
      const daysMin = adminRule.estimatedDays;
      const daysMax = adminRule.estimatedDaysMax ?? daysMin + 1;
      return res.status(200).json({
        success: true,
        serviceable: true,
        pincode,
        source: 'ADMIN',
        estimatedDays: daysMin,
        estimatedDaysMax: daysMax,
        estimatedDeliveryDate: getEstimatedDate(daysMin, daysMax),
        message: `Delivery in ${daysMin}-${daysMax} business days`,
        freeShippingAbove: 500,
        codAvailable: true,
      });
    }

    // Fallback: Pincodes not serviceable (example blocked list)
    const blockedPincodes = ['999999', '000000'];
    if (blockedPincodes.includes(pincode)) {
      return res.status(200).json({
        success: true,
        serviceable: false,
        message: 'Sorry, delivery is not available at this pincode',
      });
    }

    // Fallback: Estimated delivery days based on first digit (distance-based logic)
    const firstDigit = pincode[0];
    const deliveryDays = {
      '5': 2,
      '6': 3,
      '4': 4,
      '1': 5,
      '2': 5,
      '3': 5,
      '7': 5,
      '8': 6,
    };
    const days = deliveryDays[firstDigit] || 5;

    return res.status(200).json({
      success: true,
      serviceable: true,
      pincode,
      source: 'FALLBACK',
      estimatedDays: days,
      estimatedDaysMax: days + 1,
      estimatedDeliveryDate: getEstimatedDate(days, days + 1),
      message: `Delivery in ${days}-${days + 1} business days`,
      freeShippingAbove: 500,
      codAvailable: true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

function getEstimatedDate(daysMin, daysMax) {
  const from = new Date();
  from.setDate(from.getDate() + daysMin);
  const to = new Date();
  to.setDate(to.getDate() + (daysMax || daysMin + 1));
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

const calculateShipping = async (req, res) => {
  try {
    const { pincode, weight } = req.body;
    let charge = 0;

    // Free shipping above ₹500
    if (req.body.orderAmount >= 500) {
      return res.status(200).json({ success: true, charge: 0, message: 'Free shipping!' });
    }

    // Weight based (grams)
    if (weight <= 500) charge = 49;
    else if (weight <= 1000) charge = 79;
    else if (weight <= 2000) charge = 99;
    else charge = 99 + Math.ceil((weight - 2000) / 500) * 20;

    return res.status(200).json({ success: true, charge, pincode });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkPincode, calculateShipping };