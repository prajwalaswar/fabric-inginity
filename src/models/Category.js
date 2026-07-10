const mongoose = require("mongoose");

const categoryItemSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  href: { type: String, default: "#", trim: true },
  highlight: { type: Boolean, default: false } // renders in accent colour like FabricRoot
}, { _id: false });

const categoryColumnSchema = new mongoose.Schema({
  heading: { type: String, required: true, trim: true },
  items: { type: [categoryItemSchema], default: [] },
  order: { type: Number, default: 0 }
}, { _id: false });

const megaMenuSchema = new mongoose.Schema(
  {
    navLabel: { type: String, required: true, trim: true }, // e.g. "FABRICS"
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    columns: { type: [categoryColumnSchema], default: [] },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MegaMenu", megaMenuSchema);
