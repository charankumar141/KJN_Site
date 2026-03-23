// backend/src/config/shipmozo.js
// ShipMozo API wrapper
// Docs: https://app.shipmozo.com/api-docs
// All requests use Authorization header with Bearer token

const axios = require('axios');

const BASE_URL = 'https://app.shipmozo.com/api';

function getClient() {
  const apiKey = process.env.SHIPMOZO_API_KEY;
  if (!apiKey || apiKey === 'your_shipmozo_api_key') {
    throw new Error('SHIPMOZO_API_KEY is not configured in .env');
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Create a shipment on ShipMozo.
 * @param {object} payload
 * @param {string} payload.orderNumber  - Your internal order number (used as reference)
 * @param {number} payload.weightGrams  - Total shipment weight in grams
 * @param {object} payload.consignee    - Customer/delivery details
 * @param {string} payload.consignee.name
 * @param {string} payload.consignee.phone
 * @param {string} payload.consignee.address
 * @param {string} payload.consignee.city
 * @param {string} payload.consignee.state
 * @param {string} payload.consignee.pincode
 * @param {number} payload.declaredValue - Order total value in INR
 * @param {string} [payload.paymentMode] - 'COD' or 'PREPAID'
 * @param {number} [payload.codAmount]   - Amount to collect for COD orders
 * @returns {Promise<object>} ShipMozo API response
 */
async function createShipment(payload) {
  const client = getClient();

  const body = {
    order_reference_id: payload.orderNumber,
    payment_type: payload.paymentMode === 'COD' ? 'COD' : 'Prepaid',
    package_weight: payload.weightGrams,
    package_length: payload.length || 15,
    package_breadth: payload.breadth || 15,
    package_height: payload.height || 10,
    consignee: {
      name: payload.consignee.name,
      address: payload.consignee.address,
      address2: payload.consignee.address2 || '',
      city: payload.consignee.city,
      state: payload.consignee.state,
      pincode: String(payload.consignee.pincode),
      phone: payload.consignee.phone,
    },
    invoice_amount: payload.declaredValue,
    ...(payload.paymentMode === 'COD' ? { cod_amount: payload.codAmount || payload.declaredValue } : {}),
  };

  const res = await client.post('/orders/create', body);
  return res.data;
}

/**
 * Track a shipment by AWB number.
 * @param {string} awbNumber
 * @returns {Promise<object>} Tracking data
 */
async function trackShipment(awbNumber) {
  const client = getClient();
  const res = await client.get(`/tracking/${awbNumber}`);
  return res.data;
}

/**
 * Get serviceability / available couriers for a pincode.
 * @param {string} pincode - destination pincode
 * @param {number} weightGrams
 * @param {string} paymentMode - 'COD' or 'PREPAID'
 */
async function getServiceability(pincode, weightGrams, paymentMode = 'PREPAID') {
  const client = getClient();
  const res = await client.get('/serviceability', {
    params: {
      ...(process.env.SHIPMOZO_PICKUP_PINCODE ? { origin_pincode: process.env.SHIPMOZO_PICKUP_PINCODE } : {}),
      destination_pincode: pincode,
      weight: weightGrams,
      payment_type: paymentMode === 'COD' ? 'COD' : 'Prepaid',
    },
  });
  return res.data;
}

/**
 * Cancel a shipment on ShipMozo.
 * @param {string} awbNumber
 */
async function cancelShipment(awbNumber) {
  const client = getClient();
  const res = await client.post('/orders/cancel', { awb: awbNumber });
  return res.data;
}

module.exports = { createShipment, trackShipment, getServiceability, cancelShipment };
