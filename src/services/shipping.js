const axios = require("axios");
const config = require("../config");

function shippingEnabled() {
  return Boolean(config.delhivery.baseUrl && config.delhivery.token);
}

async function createShipmentForOrder(order) {
  if (!shippingEnabled()) {
    return {
      provider: "DELHIVERY",
      enabled: false,
      status: "NOT_CONFIGURED",
      raw: null
    };
  }

  const payload = {
    orderNo: order.orderNo,
    total: order.total,
    paymentMethod: order.paymentMethod,
    customer: order.shippingAddress,
    items: order.items.map((i) => ({
      name: i.name,
      qty: i.quantity
    }))
  };

  const response = await axios.post(`${config.delhivery.baseUrl}/shipments`, payload, {
    headers: {
      Authorization: `Token ${config.delhivery.token}`,
      "Content-Type": "application/json"
    },
    timeout: 15000
  });

  return {
    provider: "DELHIVERY",
    enabled: true,
    status: "CREATED",
    raw: response.data
  };
}

module.exports = { createShipmentForOrder };
