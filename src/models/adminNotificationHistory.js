// adminNotificationHistory.model.js
const mongoose = require('mongoose');
const { getCurrentIST } = require('../utils/timeUtils');

const adminNotificationHistorySchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['subscription_offer', 'admin_announcement'],
    default: 'subscription_offer'
  },
  totalUsers: {
    type: Number,
    default: 0
  },
  processedUsers: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  startedAt: Date,
  completedAt: Date,
  error: String
}, {
  timestamps: {
    currentTime: () => getCurrentIST(),
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  collection: 'admin_notification_history'
});

adminNotificationHistorySchema.index({ adminId: 1, created_at: -1 });
adminNotificationHistorySchema.index({ status: 1 });

module.exports = mongoose.model('AdminNotificationHistory', adminNotificationHistorySchema);
