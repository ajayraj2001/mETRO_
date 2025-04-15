const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentTransactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'UserSubscription'
  },
  type: {
    type: String,
    enum: ['subscription_purchase', 'subscription_renewal', 'subscription_upgrade', 'refund'],
    required: true
  },
  orderAmount: { 
    type: Number, 
    required: true 
  },
  gstAmount: { 
    type: Number, 
    required: true 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'INR' 
  },
  gateway: {
    type: String,
    default: 'razorpay'
  },
  status: {
    type: String,
    enum: ['initiated', 'processing', 'completed', 'failed', 'refunded'],
    default: 'initiated'
  },
  gatewayData: {
    orderId: { type: String },
    paymentId: { type: String },
    signature: { type: String },
    receiptId: { type: String },
    method: { type: String },
    bank: { type: String },
    wallet: { type: String },
    upi: { type: String },
    vpa: { type: String },
    error: {
      code: { type: String },
      description: { type: String },
      source: { type: String },
      step: { type: String },
      reason: { type: String }
    },
    notes: { type: Object }
  },
  metadata: {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    planName: { type: String },
    durationInMonths: { type: Number },
    couponCode: { type: String },
    originalAmount: { type: Number },
    discountAmount: { type: Number },
    taxAmount: { type: Number },
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  collection: 'payment_transactions'
});

// Indexing for faster queries
paymentTransactionSchema.index({ userId: 1 });
// paymentTransactionSchema.index({ subscriptionId: 1 });
// paymentTransactionSchema.index({ status: 1 });
// paymentTransactionSchema.index({ 'gatewayData.orderId': 1 });
// paymentTransactionSchema.index({ 'gatewayData.paymentId': 1 });
paymentTransactionSchema.index({ created_at: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
module.exports = PaymentTransaction;