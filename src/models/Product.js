const mongoose = require("mongoose");

// ── Gallery image sub-schema ──────────────────────────────────
const galleryImageSchema = new mongoose.Schema({
  url:     { type: String, trim: true },
  altText: { type: String, trim: true, default: "" }
}, { _id: false });

// ── SEO sub-schema ────────────────────────────────────────────
const seoSchema = new mongoose.Schema({
  slug:        { type: String, trim: true, lowercase: true, default: "" },
  metaTitle:   { type: String, trim: true, maxlength: 70, default: "" },
  metaDesc:    { type: String, trim: true, maxlength: 160, default: "" },
  keywords:    { type: String, trim: true, default: "" }
}, { _id: false });

// ── Main product schema ───────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    // ── Basic Information ─────────────────────────────────────
    name:        { type: String, required: true, trim: true, maxlength: 160 },
    sku:         { type: String, trim: true, uppercase: true, default: "" },
    category:    { type: String, required: true, trim: true, maxlength: 80 },
    subcategory: { type: String, trim: true, maxlength: 80, default: "" },
    brand:       { type: String, trim: true, default: "Fabric Infinity" },
    productType: {
      type: String,
      enum: ["Fabric", "Saree", "Dress Material", "Dupatta", "Other"],
      default: "Fabric"
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },

    // ── Pricing ───────────────────────────────────────────────
    costPrice:      { type: Number, min: 0, default: 0 },
    wholesalePrice: { type: Number, min: 0, default: 0 },
    price:          { type: Number, required: true, min: 1 },   // retail price
    offerPrice:     { type: Number, min: 0, default: 0 },
    gst:            { type: Number, min: 0, max: 100, default: 5 }, // % e.g. 5

    // ── Inventory ─────────────────────────────────────────────
    stock:            { type: Number, required: true, min: 0, default: 0 },
    minStockAlert:    { type: Number, min: 0, default: 10 },
    warehouseLocation:{ type: String, trim: true, default: "" },

    // ── Fabric Details ────────────────────────────────────────
    fabricType:  { type: String, trim: true, default: "" },   // Cotton, Silk, Modal…
    material:    { type: String, trim: true, default: "" },   // 100% Cotton / Cotton-Silk blend…
    weave:       { type: String, trim: true, default: "" },   // Plain, Twill, Satin, Dobby…
    printType:   { type: String, trim: true, default: "" },   // Handblock, Screen, Digital…
    gsm:         { type: Number, min: 0, default: 0 },
    width:       { type: String, trim: true, default: "" },   // 44", 56", 60"…
    lengthUnit:  { type: String, enum: ["Metre", "Piece", "Set"], default: "Metre" },
    colour:      { type: String, trim: true, default: "" },
    pattern:     { type: String, trim: true, default: "" },   // Floral, Geometric, Abstract…
    occasion:    { type: String, trim: true, default: "" },   // Casual, Ethnic, Party…
    season:      { type: String, trim: true, default: "" },   // All Season, Summer, Winter…

    // ── Images ────────────────────────────────────────────────
    imageUrl:      { type: String, trim: true, default: "" },   // cover image
    galleryImages: { type: [galleryImageSchema], default: [] },
    videoUrl:      { type: String, trim: true, default: "" },
    zoomImageUrl:  { type: String, trim: true, default: "" },

    // ── SEO ───────────────────────────────────────────────────
    seo: { type: seoSchema, default: () => ({}) },

    // ── Status ────────────────────────────────────────────────
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Auto-generate slug from name if not provided
productSchema.pre("save", function (next) {
  if (this.name && (!this.seo || !this.seo.slug)) {
    const slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!this.seo) this.seo = {};
    if (!this.seo.slug) this.seo.slug = slug;
  }
  // Auto-generate SKU if missing
  if (!this.sku) {
    const prefix = (this.category || "PRD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    this.sku = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
