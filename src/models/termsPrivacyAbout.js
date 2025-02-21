const mongoose = require("mongoose");
const { Schema } = mongoose;

const termsPrivacyAbout = new Schema({
  privacyPolicyDetails: {
    type: String,
    default: "",
  },
  termConditionDetails: {
    type: String,
    default: "",
  },
  aboutUsDetails: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("TermsPrivacyAbout", termsPrivacyAbout);