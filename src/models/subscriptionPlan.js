// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const subscriptionPlanSchema = new Schema({
//   planName: { 
//     type: String, 
//     enum: ['Silver', 'Gold', 'Diamond', 'Royal'], 
//     required: true 
//   },
//   pricing: {
//     monthly: {
//       actual: { type: Number, required: true },
//       discounted: { type: Number, required: true }
//     },
//     quarterly: {
//       actual: { type: Number, required: true },
//       discounted: { type: Number, required: true }
//     },
//     annual: {
//       actual: { type: Number, required: true },
//       discounted: { type: Number, required: true }
//     }
//   },
//   features: {
//     contactViews: {
//       total: { type: Number, required: true },
//       description: { type: String, default: "Total contacts you can access" }
//     },
//     profileVisibility: {
//       type: { type: String, enum: ['Standard', 'Enhanced', 'Premium', 'VIP'] },
//       multiplier: { type: Number, default: 1 },
//       description: { type: String }
//     },
//     superInterest: {
//       total: { type: Number },
//       description: { type: String, default: "Get noticed faster with prime placement" }
//     },
//     // sharpFinder: {
//     //   included: { type: Boolean, default: false },
//     //   tier: { type: String, enum: ['None', 'Basic', 'Advanced', 'Premium'], default: 'None' },
//     //   description: { type: String, default: "Sort matches by relevance and compatibility" }
//     // },
//     verifiedBadge: {
//       included: { type: Boolean, default: false },
//       description: { 
//         type: String, 
//         default: "Verified badge showing active subscription" 
//       }
//     },
//     rmManager: {  // New relationship manager field
//       included: { type: Boolean, default: false },
//       accessLevel: { type: String, enum: ['None', 'Basic', 'Premium'], default: 'None' },
//       description: { 
//         type: String, 
//         default: "Verified badge showing active subscription" 
//       }
//     },
//   },
//   displayOrder: { type: Number, default: 0 },
//   isPopular: { type: Boolean, default: false },
//   active: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Pre-save hook to update the updatedAt field
// subscriptionPlanSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

// const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
// module.exports = SubscriptionPlan;


const mongoose = require("mongoose");
const { Schema } = mongoose;

const subscriptionPlanSchema = new Schema({
  planName: {
    type: String,
    enum: ['Silver', 'Gold', 'Diamond', 'Royal'],
    required: true
  },
  durationInMonths: {
    type: Number,
    required: true,
    enum: [1, 3, 6, 12]
  },
  price: {
    actual: { type: Number, required: true },
    discounted: { type: Number, required: true }
  },
  features: {
    chat: {
      included: { type: Boolean, default: false },
      isUnlimited: { type: Boolean, default: false },
      total: { type: Number, default: 0 },
      description: { type: String, default: "Chat with your matches" }
    },
    contactViews: {
      included: { type: Boolean, default: false },
      total: { type: Number, default: 0 },
      description: { type: String, default: "Total contact numbers you can view" }
    },
    profileVisibility: {
      included: { type: Boolean, default: false },
      // type: { type: String, enum: ['Standard', 'Enhanced', 'Premium', 'VIP'], default: 'Standard' },
      multiplier: { type: Number, default: 1 },
      description: { type: String, default: "Your profile visibility level" }
    },
    superInterest: {
      included: { type: Boolean, default: false },
      total: { type: Number, default: 0 },
      description: { type: String, default: "Send super interests to stand out" }
    },
    verifiedBadge: {
      included: { type: Boolean, default: false },
      description: { type: String, default: "Verified badge showing active subscription" }
    },
    rmManager: {
      included: { type: Boolean, default: false },
      // accessLevel: { type: String, enum: ['None', 'Basic', 'Premium'], default: 'None' },
      description: { type: String, default: "Dedicated Relationship Manager" }
    }
    // shaadiLivePasses: {
    //   included: { type: Boolean, default: false },
    //   total: { type: Number, default: 0 },
    //   worth: { type: Number, default: 0 },
    //   description: { type: String, default: "Passes to attend Shaadi Live events" }
    // },
    // standoutProfile: {
    //   included: { type: Boolean, default: false },
    //   description: { type: String, default: "Appear highlighted in search results" }
    // },
    // allowIncomingRequests: {
    //   included: { type: Boolean, default: false },
    //   description: { type: String, default: "Let matches contact you directly" }
    // },
  },
  displayOrder: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriptionPlanSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
module.exports = SubscriptionPlan;
