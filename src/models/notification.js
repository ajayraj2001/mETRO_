// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const notificationSchema = new Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   title: { type: String, required: true },
//   message: { type: String, required: true },
//   pic: { type: [String], default: [] },
//   isRead: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now },
// });

// const Notification = mongoose.model("Notification", notificationSchema);

// module.exports = Notification;

  // notification.model.js
  const mongoose = require("mongoose");
  const { Schema } = mongoose;

  const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Main content
    title: { type: String, required: true },
    message: { type: String, required: true },

    // Single image only
    pic: { type: String, default: '' },

    // Action/Redirection
    type: {
      type: String,
      default: '',
      enum: [
        '',
        'profile_liked',
        'profile',
        'subscription_expiry',
        'subscription_offer',
        'profile_incomplete',
        'admin_announcement'
      ],
      required: false
    },

    // Reference to user (for matches/likes)
    referenceId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // For mobile deep-linking
    // redirectScreen: { type: String, default: '' }, // e.g., "UserProfile", "SubscriptionPage", "EditProfile"

    // Status
    isRead: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
  });

  notificationSchema.index({ user: 1, isRead: 1 });
  notificationSchema.index({ createdAt: -1 });
  notificationSchema.index({ type: 1 });

  const Notification = mongoose.model("Notification", notificationSchema);
  module.exports = Notification;