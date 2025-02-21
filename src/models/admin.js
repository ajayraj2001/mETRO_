const mongoose = require('mongoose');

const admin = new mongoose.Schema(
  {
    phone: { type: String, trim: true, required: true, unique: true },
    email: { type: String, trim: true, required: true, unique: true },
    name: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['Admin', 'Super Admin'], default: 'Admin' },
    password: { type: String, required: true },
    otp: { type: String, default: "" },
    otp_expiry: { type: Date, default: Date.now },
    profile_image: { type: String, default: "" },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'admins',
  }
);

const Admin = mongoose.model('Admin', admin);
module.exports = Admin;

