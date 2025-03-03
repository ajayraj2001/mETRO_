const mongoose = require("mongoose");

const occupationCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const occupationSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: "OccupationCategory", required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const OccupationCategory = mongoose.model("OccupationCategory", occupationCategorySchema);
const Occupation = mongoose.model("Occupation", occupationSchema);

module.exports = { OccupationCategory, Occupation };