const mongoose = require("mongoose");
const { Schema } = mongoose;

// Religion Schema
const religionSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true 
  },
  hasSects: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Sect Schema
const sectSchema = new Schema({
  religion: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Religion", 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  hasJammats: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Jammat Schema
const jammatSchema = new Schema({
  sect: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Sect", 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Caste Schema
const casteSchema = new Schema({
  religion: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Religion", 
    required: true 
  },
  sect: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Sect" 
  },
  jammat: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Jammat" 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for efficient lookups
casteSchema.index({ religion: 1, sect: 1, jammat: 1, name: 1 });
sectSchema.index({ religion: 1, name: 1 }, { unique: true });
jammatSchema.index({ sect: 1, name: 1 }, { unique: true });

// Create models
const Religion = mongoose.model("Religion", religionSchema);
const Sect = mongoose.model("Sect", sectSchema);
const Jammat = mongoose.model("Jammat", jammatSchema);
const Caste = mongoose.model("Caste", casteSchema);

module.exports = { Religion, Sect, Jammat, Caste };