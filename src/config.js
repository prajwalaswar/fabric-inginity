const path = require("path");
require("dotenv").config();

const ROOT_DIR = path.resolve(__dirname, "..");

module.exports = {
  port: Number(process.env.PORT || 3000),
  rootDir: ROOT_DIR,
  frontendDir: path.join(ROOT_DIR, "frontend"),
  uploadsDir: path.join(ROOT_DIR, "backend", "uploads"),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fabric_infinity",
  jwtSecret: process.env.JWT_SECRET || "change_me_now",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  adminEmail: process.env.ADMIN_EMAIL || "owner@fabricinfinity.com",
  adminPassword: process.env.ADMIN_PASSWORD || "fabric-Infinity**787",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  shop: {
    name: process.env.SHOP_NAME || "Fabric Infinity",
    phone: process.env.SHOP_PHONE || "+919000000000",
    email: process.env.SHOP_EMAIL || "hello@fabricinfinity.com",
    address: process.env.SHOP_ADDRESS || "Shop No.02, Fabric Infinity, 2, Baner - Pashan Link Rd, opp. Orange county phase -II, Pashan, Pune, Maharashtra 411021"
  },
  delhivery: {
    baseUrl: process.env.DELHIVERY_BASE_URL || "",
    token: process.env.DELHIVERY_TOKEN || ""
  },
  groqApiKey: process.env.GROQ_API_KEY || ""
};
