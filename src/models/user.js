const mongoose = require('mongoose');
const { getCurrentIST } = require('../utils/timeUtils');

const userSchema = new mongoose.Schema(
  {
    // Add Profile ID field
    profileId: {
      type: String,
      unique: true,
      sparse: true // Only enforce uniqueness for non-null values
    },
    profile_for: { type: String, default: '' },
    source: { type: String, default: 'app', enum: ['app', 'web'] },
    email: { type: String, trim: true, required: true },
    fullName: { type: String, trim: true, default: '' },
    permanentlyDeleted: { type: Boolean, default: false },
    living_with_family: {
      type: String,
      enum: ['Yes', 'No', ''],
      default: ''
    },
    diet: {
      type: String,
      enum: ['Veg', 'Eggetarian', 'Non-Veg', 'Vegan', 'Jain', 'Occasionally Non-Veg', ''],
      default: ''
    },
    // familyIncome: { type: String },
    phone: { type: String, trim: true, required: true },
    profile_image: [{ type: String }],
    otp: { type: String, default: null },
    otp_expiry: { type: Date, default: Date.now },
    active: { type: Boolean, default: false },

    // Extended profile fields
    dob: { type: Date, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    likeCount: { type: Number, default: 0 },
    marital_status: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
    height: { type: String, default: '' },
    heightInCm: { type: Number, default: 0 },

    country: { type: String, default: 'India' },
    state: { type: String, default: '' },
    stateCode: { type: String, default: '' },
    city: { type: String, default: '' },
    annual_income: { type: String, default: '' }, // Could be a range or exact value
    min_salary: { type: Number },
    max_salary: { type: Number },

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
    birthplace: { type: String, default: '' },
    birth_long: { type: String, default: '' },
    birth_lat: { type: String, default: '' },
    birth_time: { type: String, default: '' },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0], // Safe placeholder to prevent MongoDB error
      },
    },


    // Add these fields to the User schema  -- suscription purpose
    // verifiedBadge: { type: Boolean, default: false },
    // subscriptionStatus: { type: String, enum: ['none', 'active', 'expired'], default: 'none' },
    // subscriptionPlan: { type: String, enum: ['', 'Silver', 'Gold', 'Diamond', 'Royal'], default: '' },
    // subscriptionExpiry: { type: Date },
    // messageCreditsRemaining: { type: Number, default: 0 },
    // contactViewsRemaining: { type: Number, default: 0 },
    // superInterestsRemaining: { type: Number, default: 0 },
    // unlimitedMessaging: { type: Boolean, default: false },
    // profileVisibilityBoost: { type: Number, default: 1 },
    // lastSubscriptionCheck: { type: Date }
  },
  {
    timestamps: {
      currentTime: () => getCurrentIST(),
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'users',
  }
);

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ location: '2dsphere' });

//for subscription
// userSchema.index({ verifiedBadge: -1, created_at: -1 });
// userSchema.index({ subscriptionStatus: 1 });
// userSchema.index({ subscriptionExpiry: 1 });
// userSchema.index({ profileVisibilityBoost: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
