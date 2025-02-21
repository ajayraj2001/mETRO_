const mongoose = require("mongoose");
const { Schema } = mongoose;

const religionSchema = new Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Religion = mongoose.model("Religion", religionSchema);
module.exports = Religion;