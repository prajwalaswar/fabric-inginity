const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, required: true }
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true, required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    subtotal: { type: Number, required: true, min: 1 },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, enum: ["COD", "RAZORPAY"], required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },
    orderStatus: {
      type: String,
      enum: ["NEW", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "NEW"
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    notes: { type: String, default: "" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    shippingProvider: { type: String, default: "" },
    shippingStatus: { type: String, default: "" },
    shippingRaw: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
