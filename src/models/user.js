const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    profile_for: { type: String, default: '' },
    email: { type: String, trim: true, required: true },
    fullName: { type: String, trim: true, default: '' },
    brothers: { type: String, default: '' },
    sisters: { type: String, default: '' },
    familyStatus: { type: String, default: '' },
    familyType: { type: String, default: '' },
    livingWithParents: { type: String, default: '' },
    familyIncome: { type: String, default: '' },
    phone: { type: String, trim: true, required: true },
    profile_image: [{ type: String }],
    otp: { type: String, default: null },
    otp_expiry: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },

    // Extended profile fields
    dob: { type: Date, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    marital_status: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
    height: { type: String, default: '' },
    heightInCm: { type: Number, default: 0 },
    //freeMessages: { type: Number, default: 3 }, 
    subscriptionExpiryDate: { type: Date },
    country: { type: String, default: '' },
    state: { type: String, default: '' },
    city: { type: String, default: '' },
    annual_income: { type: String, default: '' }, // Could be a range or exact value
    college_name: { type: String, default: '' },
    company_name: { type: String, default: '' },
    employed_in: { type: String, default: '' }, // e.g., 'Private', 'Government', 'Business', etc.
    highest_education: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null
    },
    occupation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Occupation',
      default: null
    },
    mother_tongue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Language',
      default: null
    },
    // Updated religious hierarchy references
    religion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Religion',
      default: null
    },
    sect: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sect',
      default: null
    },
    jammat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jammat',
      default: null
    },
    caste: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caste',
      default: null
    },
    thoughts_on_horoscope: { type: String, default: '' }, // e.g., 'Yes', 'No'
    manglik: { type: String, default: '' },
    description: { type: String, default: '' },
    profileStatus: { type: String, enum: ['Complete', 'Incomplete'], default: 'Incomplete' },
    deviceId: { type: String, default: '' },
    deviceToken: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' }, // , required: true
      coordinates: { type: [Number] } // , required: true
    },
    maxPhoneNumbersViewable: { type: Number, default: 0 },
    contactViewsRemaining: { type: Number, default: 0 },
    subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    rmAccess: { type: Boolean, default: false },
    profileVisibility: { type: String, enum: ['Standard', 'Enhanced', 'Premium', 'VIP'], default: 'Standard' }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'users',
  }
);

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
