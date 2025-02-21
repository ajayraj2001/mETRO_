const mongoose = require("mongoose");
const { Schema } = mongoose;

const casteSchema = new Schema({
  religion: { type: mongoose.Schema.Types.ObjectId, ref : "Religion", required: true },
  caste: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Caste = mongoose.model("Caste", casteSchema);
module.exports = Caste;