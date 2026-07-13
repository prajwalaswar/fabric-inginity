const mongoose = require("mongoose");

// Single-document settings store — only one record ever exists (singleton)
const settingsSchema = new mongoose.Schema(
  {
    groqApiKey:        { type: String, default: "" },
    shiprocketEmail:   { type: String, default: "" },
    shiprocketPassword:{ type: String, default: "" },
    shiprocketToken:   { type: String, default: "" },      // cached JWT token
    shiprocketTokenAt: { type: Date,   default: null },    // when token was fetched
    // Shop info (editable from dashboard)
    shopName:    { type: String, default: "Fabric Infinity" },
    shopPhone:   { type: String, default: "" },
    shopEmail:   { type: String, default: "" },
    shopAddress: { type: String, default: "" },
    // Announcement bar text
    announcement: { type: String, default: "Blue Craft Collection Live | Free Shipping Above INR 2,499 | COD Available" }
  },
  { timestamps: true }
);

// Helper: always return the single settings document, creating it if missing
settingsSchema.statics.getSingleton = async function () {
  let s = await this.findOne({});
  if (!s) s = await this.create({});
  return s;
};

module.exports = mongoose.model("Settings", settingsSchema);
