const mongoose = require("mongoose");

const partnerPreferencesSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    min_age: { type: Number, required: true },
    max_age: { type: Number, required: true },
    min_height: { type: String, required: true },
    max_height: { type: String, required: true },
    min_height_in_cm: { type: Number, default: 0 },
    max_height_in_cm: { type: Number, default: 0 },
    marital_status: { type: String, required: true },
    religion: { type: String, required: true },
    any_caste: { type: Boolean, default: false },
    mother_tongue: { type: String, required: true },
    // country: { type: String, required: true },
    state: { type: String, default: "" },
    manglik: { type: String, required: true },
    highest_education: { type: String, required: true },
    employed_in: { type: String, required: true },
    annual_income: { type: String, required: true },
    min_salary: { type: Number },
    max_salary: { type: Number },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    collection: "partner_preferences",
  }
);

const PartnerPreferences = mongoose.model(
  "PartnerPreferences",
  partnerPreferencesSchema
);
module.exports = PartnerPreferences;
