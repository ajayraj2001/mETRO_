const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    profile_for: { type: String, default: '' },
    email: { type: String, trim: true, required: true },
    fullName: { type: String, trim: true, default: '' },
    // brothers: { type: String },
    // sisters: { type: String },
    // familyStatus: { type: String },
    // familyType: { type: String },
    // livingWithParents: { type: String },
    familyIncome: { type: String },
    phone: { type: String, trim: true, required: true },
    profile_image: [{ type: String }],
    otp: { type: String, default: null },
    otp_expiry: { type: Date, default: Date.now },
    active: { type: Boolean, default: false },

    // Extended profile fields
    dob: { type: Date, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    marital_status: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
    height: { type: String, default: '' },
    heightInCm: { type: Number, default: 0 },
    //freeMessages: { type: Number, default: 3 }, 
    // subscriptionExpiryDate: { type: Date },
    country: { type: String, default: 'India' },
    state: { type: String, default: '' },
    stateCode: { type: String, default: '' },
    city: { type: String, default: '' },
    annual_income: { type: String, default: '' }, // Could be a range or exact value
    min_salary: { type: Number },
    max_salary: { type: Number },
    // college_name: { type: String, default: '' },
    // company_name: { type: String, default: '' },
    employed_in: { type: String, default: '' }, // e.g., 'Private', 'Government', 'Business', etc.
    highest_education: {
      type: String,
      default: ""
    },
    course: {
      type: String,
      default: ""
    },
    occupation: {
      type: String,
      default: ""
    },
    mother_tongue: {
      type: String,
      default: ""
    },
    // Updated religious hierarchy references
    religion: {
      type: String,
      default: ""
    },
    sect: {
      type: String,
      default: ""
    },
    jammat: {
      type: String,
      default: ""
    },
    caste: {
      type: String,
      default: ""
    },
    thoughts_on_horoscope: { type: String, default: '' }, // e.g., 'Yes', 'No'
    manglik: { type: String, default: '' },
    description: { type: String, default: '' },
    profileStatus: { type: String, enum: ['Complete', 'Incomplete'], default: 'Incomplete' },
    preferenceStatus: { type: String, enum: ['Complete', 'Incomplete'], default: 'Incomplete' },
    deviceId: { type: String, default: '' },
    deviceToken: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' }, // , required: true
      coordinates: { type: [Number] } // , required: true
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'users',
  }
);

// userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
