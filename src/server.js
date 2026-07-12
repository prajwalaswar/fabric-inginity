const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Razorpay = require("razorpay");
const cloudinaryModule = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const config = require("./config");
const { connectDb } = require("./db");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const { signToken, requireAuth } = require("./middleware/auth");
const { createShipmentForOrder } = require("./services/shipping");
const MegaMenu = require("./models/Category");

// ── Cloudinary or local disk storage ────────────────────────
const cloudinary = cloudinaryModule.v2;
const cloudinaryEnabled = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

let upload;
if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key:    config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "fabric-infinity/products",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }]
    }
  });
  upload = multer({ storage: cloudStorage, limits: { fileSize: 5 * 1024 * 1024 } });
} else {
  // Local disk fallback (for development)
  const diskStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(config.uploadsDir, { recursive: true });
        cb(null, config.uploadsDir);
      } catch (err) { cb(err); }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  });
  upload = multer({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
      cb(null, true);
    }
  });
}

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("tiny"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
const razorpay = razorpayEnabled
  ? new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret })
  : null;

function fail(res, statusCode, message) {
  res.status(statusCode).json({ message });
}

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

function generateOrderNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `FI${yy}${mm}${dd}${suffix}`;
}

function sanitizeImageUrl(url) {
  if (!url) return "";
  return String(url).trim();
}

// Helper: get the public URL from a multer file object (Cloudinary or local)
function getImageUrl(file) {
  if (!file) return "";
  if (cloudinaryEnabled && file.path) return file.path;
  return `/uploads/${encodeURIComponent(file.filename)}`;
}

async function seedOwner() {
  const email = config.adminEmail.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return;
  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  await User.create({
    name: "Fabric Infinity Owner",
    email,
    passwordHash,
    role: "owner"
  });
}

async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return;
  await Product.insertMany([
    {
      name: "Indigo Handblock Cotton",
      sku: "IND-HB-001",
      category: "Indigo",
      subcategory: "Hand Block Prints",
      productType: "Fabric",
      description: "Premium natural indigo resist-print cotton from Rajasthan artisans. Deep navy base with classic geometric motifs.",
      costPrice: 950, wholesalePrice: 1400, price: 1899, offerPrice: 1799, gst: 5,
      stock: 120, minStockAlert: 20,
      fabricType: "Cotton", material: "100% Cotton", weave: "Plain", printType: "Handblock",
      gsm: 90, width: "44\"", lengthUnit: "Metre", colour: "Indigo Blue", pattern: "Geometric", occasion: "Ethnic", season: "All Season",
      imageUrl: "/assets/WhatsApp-Image-2026-06-24-at-2.26.13-PM.jpeg"
    },
    {
      name: "Ajrakh Heritage Cotton",
      sku: "AJR-COT-001",
      category: "Ajrakh",
      subcategory: "Hand Block Prints",
      productType: "Fabric",
      description: "Authentic Ajrakh handblock print with natural dyes. Iconic geometric patterns in earthy rust and black tones.",
      costPrice: 1200, wholesalePrice: 1800, price: 2499, offerPrice: 2299, gst: 5,
      stock: 80, minStockAlert: 15,
      fabricType: "Cotton", material: "100% Cotton", weave: "Plain", printType: "Handblock",
      gsm: 95, width: "44\"", lengthUnit: "Metre", colour: "Rust & Black", pattern: "Geometric", occasion: "Ethnic", season: "All Season",
      imageUrl: "/assets/WhatsApp-Image-2026-06-24-at-2.24.13-PM-1.jpeg"
    },
    {
      name: "Bagru Floral Print Cotton",
      sku: "BAG-COT-001",
      category: "Bagru",
      subcategory: "Hand Block Prints",
      productType: "Fabric",
      description: "Soft Bagru handblock floral cotton with earthy natural dyes. Perfect for kurtas and summer wear.",
      costPrice: 850, wholesalePrice: 1250, price: 1799, offerPrice: 1699, gst: 5,
      stock: 95, minStockAlert: 20,
      fabricType: "Cotton", material: "100% Cotton", weave: "Plain", printType: "Handblock",
      gsm: 85, width: "44\"", lengthUnit: "Metre", colour: "Earthy Tones", pattern: "Floral", occasion: "Casual", season: "Summer",
      imageUrl: "/assets/WhatsApp-Image-2026-06-24-at-2.24.38-PM.jpeg"
    }
  ]);
}

async function seedMegaMenu() {
  // Always reset to keep categories clean and correct
  await MegaMenu.deleteMany({});
  await MegaMenu.insertMany([
    // ── 1. FABRICS ──────────────────────────────────────────
    {
      navLabel: "FABRICS",
      slug: "fabrics",
      order: 0,
      isActive: true,
      columns: [
        {
          heading: "HAND BLOCK PRINTS",
          order: 0,
          items: [
            { label: "Ajrakh", highlight: true },
            { label: "Cotton Ajrakh" },
            { label: "Modal Silk Ajrakh" },
            { label: "Indigo" },
            { label: "Dabu" },
            { label: "Bagru" },
            { label: "Vanaspati" },
            { label: "Rapid" },
            { label: "Kalamkari" },
            { label: "Bagh" },
            { label: "Pigment Prints" }
          ]
        },
        {
          heading: "HANDLOOM FABRICS",
          order: 1,
          items: [
            { label: "Ikat", highlight: true },
            { label: "Single Ikat" },
            { label: "Double Ikat" },
            { label: "SICO Ikat" },
            { label: "Mercerised Ikat" },
            { label: "Jamdhani Cotton" },
            { label: "Handloom Cotton" }
          ]
        },
        {
          heading: "PLAIN FABRICS",
          order: 2,
          items: [
            { label: "Cambric Cotton (60×60)" },
            { label: "Cotton Slub" },
            { label: "Cotton Flex (Khadi)" },
            { label: "Mule Cotton" },
            { label: "Cotton Rayon" },
            { label: "Cotton Silk" },
            { label: "Slub Silk" }
          ]
        },
        {
          heading: "SCREEN PRINTS",
          order: 3,
          items: [
            { label: "Kantha Cotton", highlight: true }
          ]
        }
      ]
    },
    // ── 2. DRESS MATERIALS ───────────────────────────────────
    {
      navLabel: "DRESS MATERIALS",
      slug: "dress-materials",
      order: 1,
      isActive: true,
      columns: [
        {
          heading: "SUIT COLLECTIONS",
          order: 0,
          items: [
            { label: "Jaipuri Handblock Suit", highlight: true },
            { label: "Kota Doria Suit" },
            { label: "Modal Silk Suit" },
            { label: "Cotton Linen Suit" },
            { label: "Maheshwari Silk Suit" },
            { label: "Cotton Print Suit" }
          ]
        }
      ]
    },
    // ── 3. SAREES ─────────────────────────────────────────────
    {
      navLabel: "SAREES",
      slug: "sarees",
      order: 2,
      isActive: true,
      columns: [
        {
          heading: "SAREE COLLECTIONS",
          order: 0,
          items: [
            { label: "Modal Silk Sarees", highlight: true },
            { label: "Kota Doria Sarees" },
            { label: "Dola Silk Sarees" },
            { label: "Georgette Sarees" },
            { label: "Maheshwari Sarees" },
            { label: "Cotton Handblock Sarees" },
            { label: "Chanderi Silk Sarees" },
            { label: "Cotton Linen Sarees" },
            { label: "Chiffon Sarees" }
          ]
        }
      ]
    },
    // ── 4. DUPATTAS ───────────────────────────────────────────
    {
      navLabel: "DUPATTAS",
      slug: "dupattas",
      order: 3,
      isActive: true,
      columns: [
        {
          heading: "DUPATTA COLLECTIONS",
          order: 0,
          items: [
            { label: "Ikkat Dupatta", highlight: true },
            { label: "Banarasi Silk Dupatta" },
            { label: "Kalamkari Dupatta" },
            { label: "Ajrakh Modal Dupatta" },
            { label: "Bandhani Dupatta" },
            { label: "Orange Brush Print Dupatta" }
          ]
        }
      ]
    }
  ]);
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "fabric-infinity-backend",
    db: "mongodb",
    razorpayEnabled,
    now: new Date().toISOString()
  });
});

// ── Force re-seed categories (admin only, safe to call multiple times) ──
app.post("/api/admin/reseed-menu", requireAuth, async (req, res) => {
  try {
    await seedMegaMenu();
    const menus = await MegaMenu.find({}).lean();
    res.json({ message: "Menu re-seeded", count: menus.length, menus: menus.map(m => m.navLabel) });
  } catch(e) {
    fail(res, 500, "Re-seed failed: " + e.message);
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const password = String(req.body.password || "");
  if (!email || !password) return fail(res, 400, "Email and password are required");

  const user = await User.findOne({ email });
  if (!user) return fail(res, 401, "Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail(res, 401, "Invalid credentials");

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

app.get("/api/payment/config", (req, res) => {
  res.json({
    razorpayKeyId: config.razorpayKeyId || "",
    razorpayEnabled,
    shop: config.shop
  });
});

app.get("/api/products", async (req, res) => {
  const q = {};
  if (req.query.category) q.category = String(req.query.category);
  q.isActive = true;
  const products = await Product.find(q).sort({ createdAt: -1 }).lean();
  res.json({ products });
});

app.get("/api/admin/products", requireAuth, async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 }).lean();
  res.json({ products });
});

app.post("/api/admin/products", requireAuth, upload.single("image"), async (req, res) => {
  const b = req.body;
  const payload = {
    name:        String(b.name || "").trim(),
    sku:         String(b.sku || "").trim().toUpperCase(),
    category:    String(b.category || "").trim(),
    subcategory: String(b.subcategory || "").trim(),
    brand:       String(b.brand || "Fabric Infinity").trim(),
    productType: String(b.productType || "Fabric").trim(),
    description: String(b.description || "").trim(),
    // pricing
    costPrice:      money(b.costPrice),
    wholesalePrice: money(b.wholesalePrice),
    price:          money(b.price),
    offerPrice:     money(b.offerPrice),
    gst:            Number(b.gst) || 5,
    // inventory
    stock:             money(b.stock),
    minStockAlert:     money(b.minStockAlert) || 10,
    warehouseLocation: String(b.warehouseLocation || "").trim(),
    // fabric details
    fabricType:  String(b.fabricType  || "").trim(),
    material:    String(b.material    || "").trim(),
    weave:       String(b.weave       || "").trim(),
    printType:   String(b.printType   || "").trim(),
    gsm:         Number(b.gsm) || 0,
    width:       String(b.width       || "").trim(),
    lengthUnit:  String(b.lengthUnit  || "Metre").trim(),
    colour:      String(b.colour      || "").trim(),
    pattern:     String(b.pattern     || "").trim(),
    occasion:    String(b.occasion    || "").trim(),
    season:      String(b.season      || "").trim(),
    // images
    imageUrl:     req.file ? getImageUrl(req.file) : String(b.imageUrl || "").trim(),
    videoUrl:     String(b.videoUrl     || "").trim(),
    zoomImageUrl: String(b.zoomImageUrl || "").trim(),
    // seo
    seo: {
      slug:      String(b.seoSlug      || "").trim().toLowerCase(),
      metaTitle: String(b.metaTitle    || "").trim(),
      metaDesc:  String(b.metaDesc     || "").trim(),
      keywords:  String(b.keywords     || "").trim()
    }
  };
  if (!payload.name || !payload.category || payload.price <= 0) {
    return fail(res, 400, "Name, category and retail price are required");
  }
  const product = await Product.create(payload);
  res.status(201).json({ message: "Product created", product });
});

app.put("/api/admin/products/:id", requireAuth, upload.single("image"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, "Product not found");
  const b = req.body;
  const str = (v, fb="") => v !== undefined ? String(v).trim() : fb;
  // basic
  if (b.name        !== undefined) product.name        = str(b.name);
  if (b.sku         !== undefined) product.sku         = str(b.sku).toUpperCase();
  if (b.category    !== undefined) product.category    = str(b.category);
  if (b.subcategory !== undefined) product.subcategory = str(b.subcategory);
  if (b.brand       !== undefined) product.brand       = str(b.brand);
  if (b.productType !== undefined) product.productType = str(b.productType);
  if (b.description !== undefined) product.description = str(b.description);
  // pricing
  if (b.costPrice      !== undefined) product.costPrice      = money(b.costPrice);
  if (b.wholesalePrice !== undefined) product.wholesalePrice = money(b.wholesalePrice);
  if (b.price          !== undefined) product.price          = money(b.price);
  if (b.offerPrice     !== undefined) product.offerPrice     = money(b.offerPrice);
  if (b.gst            !== undefined) product.gst            = Number(b.gst) || 5;
  // inventory
  if (b.stock             !== undefined) product.stock             = money(b.stock);
  if (b.minStockAlert     !== undefined) product.minStockAlert     = money(b.minStockAlert);
  if (b.warehouseLocation !== undefined) product.warehouseLocation = str(b.warehouseLocation);
  if (b.isActive          !== undefined) product.isActive          = String(b.isActive) !== "false";
  // fabric details
  if (b.fabricType !== undefined) product.fabricType = str(b.fabricType);
  if (b.material   !== undefined) product.material   = str(b.material);
  if (b.weave      !== undefined) product.weave      = str(b.weave);
  if (b.printType  !== undefined) product.printType  = str(b.printType);
  if (b.gsm        !== undefined) product.gsm        = Number(b.gsm) || 0;
  if (b.width      !== undefined) product.width      = str(b.width);
  if (b.lengthUnit !== undefined) product.lengthUnit = str(b.lengthUnit);
  if (b.colour     !== undefined) product.colour     = str(b.colour);
  if (b.pattern    !== undefined) product.pattern    = str(b.pattern);
  if (b.occasion   !== undefined) product.occasion   = str(b.occasion);
  if (b.season     !== undefined) product.season     = str(b.season);
  // images
  if (req.file)       product.imageUrl     = getImageUrl(req.file);
  if (b.imageUrl)     product.imageUrl     = sanitizeImageUrl(b.imageUrl);
  if (b.videoUrl)     product.videoUrl     = str(b.videoUrl);
  if (b.zoomImageUrl) product.zoomImageUrl = str(b.zoomImageUrl);
  // seo
  if (!product.seo) product.seo = {};
  if (b.seoSlug    !== undefined) product.seo.slug      = str(b.seoSlug).toLowerCase();
  if (b.metaTitle  !== undefined) product.seo.metaTitle = str(b.metaTitle);
  if (b.metaDesc   !== undefined) product.seo.metaDesc  = str(b.metaDesc);
  if (b.keywords   !== undefined) product.seo.keywords  = str(b.keywords);
  product.markModified("seo");
  await product.save();
  res.json({ message: "Product updated", product });
});

app.delete("/api/admin/products/:id", requireAuth, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, "Product not found");
  await product.deleteOne();
  res.json({ message: "Product deleted" });
});

app.post("/api/orders/checkout", async (req, res) => {
  const { items, shippingAddress, paymentMethod, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return fail(res, 400, "Cart items are required");
  const method = String(paymentMethod || "").toUpperCase();
  if (!["COD", "RAZORPAY"].includes(method)) return fail(res, 400, "Invalid payment method");

  const requiredShippingFields = ["fullName", "phone", "email", "addressLine1", "city", "state", "pincode"];
  for (const f of requiredShippingFields) {
    if (!shippingAddress || !shippingAddress[f]) return fail(res, 400, `Missing shipping field: ${f}`);
  }

  const productIds = items.map((x) => x.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  let subtotal = 0;
  for (const rawItem of items) {
    const product = productMap.get(String(rawItem.productId));
    if (!product) return fail(res, 400, "One or more products are unavailable");
    const quantity = money(rawItem.quantity);
    if (quantity <= 0) return fail(res, 400, "Invalid quantity");
    if (product.stock < quantity) return fail(res, 400, `Insufficient stock for ${product.name}`);
    orderItems.push({
      productId: product._id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      imageUrl: product.imageUrl
    });
    subtotal += product.price * quantity;
  }

  const shippingFee = subtotal >= 2499 ? 0 : 99;
  const total = subtotal + shippingFee;

  for (const item of orderItems) {
    const product = productMap.get(String(item.productId));
    product.stock = Math.max(0, product.stock - item.quantity);
    await product.save();
  }

  const order = await Order.create({
    orderNo: generateOrderNo(),
    items: orderItems,
    subtotal,
    shippingFee,
    total,
    paymentMethod: method,
    paymentStatus: method === "COD" ? "PENDING" : "PENDING",
    orderStatus: "NEW",
    shippingAddress: {
      fullName: String(shippingAddress.fullName).trim(),
      phone: String(shippingAddress.phone).trim(),
      email: String(shippingAddress.email).trim(),
      addressLine1: String(shippingAddress.addressLine1).trim(),
      addressLine2: String(shippingAddress.addressLine2 || "").trim(),
      city: String(shippingAddress.city).trim(),
      state: String(shippingAddress.state).trim(),
      pincode: String(shippingAddress.pincode).trim()
    },
    notes: String(notes || "").trim()
  });

  if (method === "COD") {
    try {
      const shippingResult = await createShipmentForOrder(order);
      order.shippingProvider = shippingResult.provider;
      order.shippingStatus = shippingResult.status;
      order.shippingRaw = shippingResult.raw;
      await order.save();
    } catch (err) {
      order.shippingProvider = "DELHIVERY";
      order.shippingStatus = "FAILED_TO_CREATE";
      order.shippingRaw = { error: err.message };
      await order.save();
    }
    return res.status(201).json({ message: "COD order placed", order });
  }

  if (!razorpayEnabled) return fail(res, 500, "Razorpay is not configured on server");
  const rzOrder = await razorpay.orders.create({
    amount: total * 100,
    currency: "INR",
    receipt: order.orderNo,
    notes: { orderId: String(order._id), orderNo: order.orderNo }
  });
  order.razorpayOrderId = rzOrder.id;
  await order.save();

  return res.status(201).json({
    message: "Razorpay order created",
    order,
    razorpayOrder: rzOrder
  });
});

app.post("/api/payments/razorpay/verify", async (req, res) => {
  if (!razorpayEnabled) return fail(res, 500, "Razorpay is not configured on server");
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return fail(res, 400, "Missing Razorpay verification fields");
  }

  const order = await Order.findById(orderId);
  if (!order) return fail(res, 404, "Order not found");
  if (order.razorpayOrderId !== razorpay_order_id) return fail(res, 400, "Razorpay order mismatch");

  const expected = crypto
    .createHmac("sha256", config.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    order.paymentStatus = "FAILED";
    await order.save();
    return fail(res, 400, "Invalid payment signature");
  }

  order.razorpayPaymentId = razorpay_payment_id;
  order.razorpaySignature = razorpay_signature;
  order.paymentStatus = "PAID";
  order.orderStatus = "PROCESSING";

  try {
    const shippingResult = await createShipmentForOrder(order);
    order.shippingProvider = shippingResult.provider;
    order.shippingStatus = shippingResult.status;
    order.shippingRaw = shippingResult.raw;
  } catch (err) {
    order.shippingProvider = "DELHIVERY";
    order.shippingStatus = "FAILED_TO_CREATE";
    order.shippingRaw = { error: err.message };
  }

  await order.save();
  return res.json({ message: "Payment verified and order confirmed", order });
});

app.get("/api/admin/orders", requireAuth, async (req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
  res.json({ orders });
});

app.patch("/api/admin/orders/:id/status", requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return fail(res, 404, "Order not found");
  const nextStatus = String(req.body.orderStatus || "").toUpperCase();
  const nextPayment = String(req.body.paymentStatus || "").toUpperCase();
  if (nextStatus) {
    const allowedOrder = ["NEW", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!allowedOrder.includes(nextStatus)) return fail(res, 400, "Invalid order status");
    order.orderStatus = nextStatus;
  }
  if (nextPayment) {
    const allowedPay = ["PENDING", "PAID", "FAILED"];
    if (!allowedPay.includes(nextPayment)) return fail(res, 400, "Invalid payment status");
    order.paymentStatus = nextPayment;
  }
  await order.save();
  res.json({ message: "Order updated", order });
});

app.get("/api/shop/meta", (req, res) => {
  res.json({
    location: config.shop.address,
    phone: config.shop.phone,
    email: config.shop.email
  });
});

// ── AI Product Auto-Detect (Groq) ────────────────────────────
// Accepts a base64 image + optional filename and returns
// suggested name, category, description, price, stock.
app.post("/api/admin/ai-product-detect", requireAuth, upload.single("image"), async (req, res) => {
  if (!config.groqApiKey) {
    return fail(res, 503, "GROQ_API_KEY is not configured.");
  }

  // Build image context: if a file was uploaded, use its path; else expect base64 in body
  let imageContext = "";
  if (req.file) {
    imageContext = `The owner just uploaded an image file named "${req.file.originalname}" (${req.file.mimetype}).`;
  } else if (req.body.imageName) {
    imageContext = `The owner is uploading an image file named "${req.body.imageName}".`;
  }

  const userHint = req.body.hint ? `Owner hint: "${req.body.hint}".` : "";

  const prompt = `You are a product listing assistant for ${config.shop.name}, a premium Indian fabric store.
${imageContext}
${userHint}

Based on the image name / hint (which often contains fabric type, colour, craft, etc.), generate a JSON product listing with these exact keys:
- name: short, marketable product name (4–7 words, e.g. "Indigo Bagru Handblock Cotton")
- category: one of [Georgette, Chanderi, Satin, Linen, Crepe, Cotton, Kota, Muslin, Organza, Pashmina, Rayon, Silk, Spun, Ajrakh, Indigo, Bagru, Bandhani, Batik, Block Prints, Chikankari, Embroidered, Floral, Printed, Dupatta, Saree, Other]
- description: 1–2 sentences, highlight fabric type and craft technique
- price: reasonable INR price per meter (integer, 800–4500 range typical)
- stock: suggested starting stock quantity (integer, 50–200)

Respond ONLY with valid JSON. No markdown, no explanation.`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.4
      })
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      return fail(res, groqRes.status, errBody?.error?.message || "Groq API error");
    }

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content || "{}";

    // Parse — strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    let suggestion;
    try {
      suggestion = JSON.parse(cleaned);
    } catch (_) {
      return fail(res, 502, "AI returned invalid JSON. Please try again.");
    }

    // Attach the uploaded file URL if present
    if (req.file) {
      suggestion.imageUrl = getImageUrl(req.file);
      suggestion._uploadedFilename = req.file.filename || req.file.public_id;
    }

    return res.json({ suggestion });
  } catch (err) {
    return fail(res, 502, "Could not reach AI service: " + err.message);
  }
});

// ── AI Chat (Groq proxy) ─────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  if (!config.groqApiKey) {
    return fail(res, 503, "AI chat is not configured yet. Please set GROQ_API_KEY.");
  }

  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (!messages.length) return fail(res, 400, "messages array is required");

  // System prompt — fabric store assistant
  const systemPrompt = {
    role: "system",
    content: `You are a helpful customer support assistant for ${config.shop.name}, a premium Indian fabric store. ` +
      `The store specialises in handblock prints, Ajrakh, Bagru, Indigo, Batik, and other artisan fabrics sold by the meter. ` +
      `You help customers with fabric questions, pricing guidance, care instructions, order status queries, and wholesale enquiries. ` +
      `Be warm, concise, and knowledgeable. If a customer asks about pricing always mention they can browse the shop for exact rates. ` +
      `For order status or account issues, suggest they contact the store on WhatsApp: ${config.shop.phone} or email: ${config.shop.email}. ` +
      `Never make up order details. Keep replies under 120 words unless a detailed explanation is genuinely needed.`
  };

  // Keep only the last 10 messages to stay within token limits
  const trimmed = messages.slice(-10);

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...trimmed],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      return fail(res, groqRes.status, errBody?.error?.message || "Groq API error");
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response. Please try again.";
    return res.json({ reply });
  } catch (err) {
    return fail(res, 502, "Could not reach AI service: " + err.message);
  }
});
// Public: get all active menus
app.get("/api/mega-menu", async (req, res) => {
  const menus = await MegaMenu.find({ isActive: true }).sort({ order: 1 }).lean();
  res.json({ menus });
});

// Admin: get all (including inactive)
app.get("/api/admin/mega-menu", requireAuth, async (req, res) => {
  const menus = await MegaMenu.find({}).sort({ order: 1 }).lean();
  res.json({ menus });
});

// Admin: create a new mega-menu entry
app.post("/api/admin/mega-menu", requireAuth, async (req, res) => {
  const { navLabel, slug, columns, order, isActive } = req.body || {};
  if (!navLabel || !slug) return fail(res, 400, "navLabel and slug are required");
  try {
    const menu = await MegaMenu.create({ navLabel, slug, columns: columns || [], order: order ?? 0, isActive: isActive !== false });
    res.status(201).json({ message: "Menu created", menu });
  } catch (e) {
    fail(res, 400, e.code === 11000 ? "Slug already exists" : e.message);
  }
});

// Admin: update an existing mega-menu entry
app.put("/api/admin/mega-menu/:id", requireAuth, async (req, res) => {
  const menu = await MegaMenu.findById(req.params.id);
  if (!menu) return fail(res, 404, "Menu not found");
  const { navLabel, slug, columns, order, isActive } = req.body || {};
  if (navLabel !== undefined) menu.navLabel = String(navLabel).trim();
  if (slug !== undefined) menu.slug = String(slug).trim().toLowerCase();
  if (columns !== undefined) menu.columns = columns;
  if (order !== undefined) menu.order = Number(order);
  if (isActive !== undefined) menu.isActive = Boolean(isActive);
  await menu.save();
  res.json({ message: "Menu updated", menu });
});

// Admin: delete a mega-menu entry
app.delete("/api/admin/mega-menu/:id", requireAuth, async (req, res) => {
  const menu = await MegaMenu.findById(req.params.id);
  if (!menu) return fail(res, 404, "Menu not found");
  await menu.deleteOne();
  res.json({ message: "Menu deleted" });
});

// Admin: add an item to a column inside a menu
app.post("/api/admin/mega-menu/:id/columns/:colIndex/items", requireAuth, async (req, res) => {
  const menu = await MegaMenu.findById(req.params.id);
  if (!menu) return fail(res, 404, "Menu not found");
  const col = menu.columns[Number(req.params.colIndex)];
  if (!col) return fail(res, 404, "Column not found");
  const { label, href, highlight } = req.body || {};
  if (!label) return fail(res, 400, "label is required");
  col.items.push({ label: String(label).trim(), href: href || "#", highlight: Boolean(highlight) });
  menu.markModified("columns");
  await menu.save();
  res.json({ message: "Item added", menu });
});

// Admin: remove an item from a column
app.delete("/api/admin/mega-menu/:id/columns/:colIndex/items/:itemIndex", requireAuth, async (req, res) => {
  const menu = await MegaMenu.findById(req.params.id);
  if (!menu) return fail(res, 404, "Menu not found");
  const col = menu.columns[Number(req.params.colIndex)];
  if (!col) return fail(res, 404, "Column not found");
  col.items.splice(Number(req.params.itemIndex), 1);
  menu.markModified("columns");
  await menu.save();
  res.json({ message: "Item removed", menu });
});

app.use("/uploads", express.static(config.uploadsDir, { maxAge: "30d" }));
app.use(express.static(config.frontendDir, { maxAge: "1h" }));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(config.frontendDir, "index.html"));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return fail(res, 400, err.message);
  if (err) return fail(res, 400, err.message || "Bad request");
  return next();
});

// ── Startup: connect DB + seed, then either listen (local) or export (Vercel) ──
let _ready = false;
let _readyPromise = null;

async function ensureReady() {
  if (_ready) return;
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    await fs.mkdir(config.uploadsDir, { recursive: true }).catch(() => {});
    await connectDb();
    await seedOwner();
    await seedProducts();
    await seedMegaMenu();
    _ready = true;
  })();
  return _readyPromise;
}

// Wrap app so Vercel waits for DB before first request
const handler = async (req, res) => {
  await ensureReady();
  return app(req, res);
};

// Local dev: just listen normally
if (process.env.VERCEL !== "1") {
  ensureReady().then(() => {
    app.listen(config.port, () => {
      console.log(`Fabric Infinity running on http://localhost:${config.port}`);
    });
  }).catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}

// Vercel serverless export
module.exports = handler;
