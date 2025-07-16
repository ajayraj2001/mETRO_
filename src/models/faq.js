const mongoose = require("mongoose");
const { Schema } = mongoose;

const faqSchema = new Schema({
  query: { type: String },
  answer: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Faq = mongoose.model("Faq", faqSchema);
module.exports = Faq;
