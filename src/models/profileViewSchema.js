const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema({
  viewer_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  viewed_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  viewed_at: { 
    type: Date, 
    default: Date.now 
  },
  // Optional - track interaction type
  interaction_type: { 
    type: String, 
    enum: ['view', 'like', 'shortlist', 'contact', 'ignore', 'block'],
    default: 'view'
  }
}, {
  timestamps: true,
  collection: 'profile_views'
});

// Compound index for fast lookups by viewer
profileViewSchema.index({ viewer_id: 1, viewed_at: -1 });
// Compound index for fast lookups by viewed profile
profileViewSchema.index({ viewed_id: 1, viewed_at: -1 });
// Unique compound index to prevent duplicates
profileViewSchema.index({ viewer_id: 1, viewed_id: 1 }, { unique: true });

const ProfileView = mongoose.model('ProfileView', profileViewSchema);
module.exports = ProfileView;