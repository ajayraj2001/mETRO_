const mongoose = require("mongoose");
const { Schema } = mongoose;

const subscriptionPlanSchema = new Schema({
  planName: { type: String, enum: ['Silver', 'Gold', 'Platinum', 'Diamond'], required: true },
  price: { type: String, required: true },
  maxPhoneNumbersViewable: { type: String, required: true },
  durationInDays: { type: String, required: true },
  match: { type: String, default: "Connect directly with Matches" },
  profileDetailInfo: { type: String, default: "View detailed Profile information" },
  createdAt: { type: Date, default: Date.now },
});

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

module.exports = SubscriptionPlan;
