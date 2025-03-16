const mongoose = require('mongoose');

const submenuSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { _id: false });

const accessTabSchema = new mongoose.Schema({
  name: { type: String, required: true },
  submenu: [submenuSchema],
}, { _id: false });

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, required: true, unique: true },
    name: { type: String, trim: true, default: '' },
    password: { type: String, required: true },
    otp: { type: String, default: null },
    otp_expiry: { type: Date, default: Date.now() }, // Set OTP expiry in IST
    profile_image: { type: String, default: null },
    role: { type: String, enum: ['admin', 'subadmin'], required: true }, // Role-based access
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Inactive',
    },
    access_tabs: [accessTabSchema], // Tabs that the user has access to
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'admins',
  }
);

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;


