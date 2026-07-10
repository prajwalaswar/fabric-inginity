const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Razorpay = require("razorpay");

const config = require("./config");
const { connectDb } = require("./db");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const { signToken, requireAuth } = require("./middleware/auth");
const { createShipmentForOrder } = require("./services/shipping");
const MegaMenu = require("./models/Category");

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

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(config.uploadsDir, { recursive: true });
      cb(null, config.uploadsDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    return cb(null, true);
  }
});

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
      name: "Indigo Handblock Bloom",
      category: "Indigo",
      description: "Premium indigo print cotton for elegant silhouettes.",
      price: 1899,
      stock: 120,
      imageUrl: "/assets/WhatsApp%20Image%202026-06-24%20at%202.26.13%20PM.jpeg"
    },
    {
      name: "Ajrakh Heritage Print",
      category: "Ajrakh",
      description: "Classic Ajrakh motifs crafted with rich earthy tones.",
      price: 2499,
      stock: 80,
      imageUrl: "/assets/WhatsApp%20Image%202026-06-24%20at%202.24.13%20PM%20(1).jpeg"
    },
    {
      name: "Bagru Cotton Floral",
      category: "Bagru",
      description: "Soft handblock floral bagru cotton for all-season wear.",
      price: 1799,
      stock: 95,
      imageUrl: "/assets/WhatsApp%20Image%202026-06-24%20at%202.24.38%20PM.jpeg"
    }
  ]);
}

async function seedMegaMenu() {
  const count = await MegaMenu.countDocuments();
  if (count > 0) return;
  await MegaMenu.insertMany([
    {
      navLabel: "FABRICS",
      slug: "fabrics",
      order: 0,
      columns: [
        {
          heading: "TYPE",
          order: 0,
          items: [
            { label: "Georgette" }, { label: "Chanderi" }, { label: "Satin" },
            { label: "Linen" }, { label: "Crepe" }, { label: "Cotton" },
            { label: "Kota" }, { label: "Muslin" }, { label: "Organza" },
            { label: "Pashmina" }, { label: "Rayon" }, { label: "Silk" },
            { label: "Spun" }, { label: "Tweed" }
          ]
        },
        {
          heading: "PRINTED FABRIC",
          order: 1,
          items: [
            { label: "Cotton" }, { label: "Rayon", highlight: true }, { label: "Pashmina" },
            { label: "Satin" }, { label: "Spun" }, { label: "Georgette" },
            { label: "Chiffon" }, { label: "Chinon", highlight: true }, { label: "Muslin" },
            { label: "Chanderi" }, { label: "Organza" }, { label: "Linen", highlight: true },
            { label: "Kota" }, { label: "Crepe" }, { label: "Velvet" },
            { label: "Modal" }, { label: "Mashru Silk" }
          ]
        },
        {
          heading: "EMBROIDERED",
          order: 2,
          items: [
            { label: "Silk", highlight: true }, { label: "Cotton" }, { label: "Linen", highlight: true },
            { label: "Chiffon" }, { label: "Chinon" }, { label: "Georgette" },
            { label: "Net" }, { label: "Organza" }, { label: "Rayon" },
            { label: "Velvet" }, { label: "Kota" }
          ]
        },
        {
          heading: "DESIGN & PATTERN",
          order: 3,
          items: [
            { label: "Position Printing" }, { label: "Designer Fabric" }, { label: "Baby Prints", highlight: true },
            { label: "Floral" }, { label: "Animal", highlight: true }, { label: "Stripes" },
            { label: "Checks" }, { label: "Polka" }, { label: "Palazzo" },
            { label: "Bandhani" }, { label: "Cross Stitch" }, { label: "Cotswool" },
            { label: "Kali" }, { label: "Hot Selling", highlight: true }, { label: "Mix & Match" },
            { label: "Shaded" }, { label: "Cut Work" }, { label: "Pleated" }
          ]
        },
        {
          heading: "BY CRAFTS",
          order: 4,
          items: [
            { label: "Pintex" }, { label: "Chikankari" }, { label: "Indigo" },
            { label: "Banorsi / Brocade" }, { label: "Batik" }, { label: "Dyeable" },
            { label: "Block Prints" }, { label: "Gota Patti" }, { label: "Ikkat" },
            { label: "Kalamkari" }, { label: "Sequins" }, { label: "Mirror Work" },
            { label: "Jacquard" }, { label: "Chantilly Net" }, { label: "Glitter" },
            { label: "Mukoish" }, { label: "Imported Fabrics" }, { label: "Hakoba" }
          ]
        },
        {
          heading: "FABRICS SUITED FOR",
          order: 5,
          items: [
            { label: "Tops & Kurtis" }, { label: "Lehengas", highlight: true },
            { label: "Night Suit" }, { label: "Suits & Blazers" },
            { label: "Kurtas / Sherwani Men" }, { label: "Gowns" },
            { label: "Blouse", highlight: true }, { label: "Dupattas", highlight: true },
            { label: "Sarees" }
          ]
        }
      ]
    },
    {
      navLabel: "PLAIN DYEABLES",
      slug: "plain-dyeables",
      order: 1,
      columns: [
        {
          heading: "PLAIN FABRICS",
          order: 0,
          items: [
            { label: "Plain Cotton" }, { label: "Plain Georgette" }, { label: "Plain Chiffon" },
            { label: "Plain Satin" }, { label: "Plain Crepe" }, { label: "Plain Rayon" },
            { label: "Plain Linen" }, { label: "Plain Silk" }, { label: "Plain Muslin" },
            { label: "Plain Chanderi" }, { label: "Plain Organza" }, { label: "Plain Kota" }
          ]
        }
      ]
    },
    {
      navLabel: "DUPATTAS",
      slug: "dupattas",
      order: 2,
      columns: [
        {
          heading: "BY FABRIC",
          order: 0,
          items: [
            { label: "Cotton Dupattas" }, { label: "Silk Dupattas" }, { label: "Chiffon Dupattas" },
            { label: "Georgette Dupattas" }, { label: "Net Dupattas" }, { label: "Chanderi Dupattas" }
          ]
        },
        {
          heading: "BY CRAFT",
          order: 1,
          items: [
            { label: "Handblock Dupattas" }, { label: "Ajrakh Dupattas" }, { label: "Bandhani Dupattas" },
            { label: "Embroidered Dupattas" }, { label: "Printed Dupattas" }
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
  if (!req.file) return fail(res, 400, "Product image is required");
  const payload = {
    name: String(req.body.name || "").trim(),
    category: String(req.body.category || "").trim(),
    description: String(req.body.description || "").trim(),
    price: money(req.body.price),
    stock: money(req.body.stock),
    imageUrl: `/uploads/${encodeURIComponent(req.file.filename)}`
  };
  if (!payload.name || !payload.category || !payload.description || payload.price <= 0 || payload.stock < 0) {
    return fail(res, 400, "Invalid product data");
  }
  const product = await Product.create(payload);
  res.status(201).json({ message: "Product created", product });
});

app.put("/api/admin/products/:id", requireAuth, upload.single("image"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, "Product not found");

  if (req.body.name !== undefined) product.name = String(req.body.name).trim();
  if (req.body.category !== undefined) product.category = String(req.body.category).trim();
  if (req.body.description !== undefined) product.description = String(req.body.description).trim();
  if (req.body.price !== undefined) product.price = money(req.body.price);
  if (req.body.stock !== undefined) product.stock = money(req.body.stock);
  if (req.body.isActive !== undefined) product.isActive = String(req.body.isActive) !== "false";
  if (req.file) product.imageUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
  if (req.body.imageUrl) product.imageUrl = sanitizeImageUrl(req.body.imageUrl);

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
      suggestion.imageUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
      suggestion._uploadedFilename = req.file.filename;
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

async function start() {
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await connectDb();
  await seedOwner();
  await seedProducts();
  await seedMegaMenu();
  app.listen(config.port, () => {
    console.log(`Fabric Infinity running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
