const mongoose = require("mongoose");

const appConfigSchema = new mongoose.Schema({
    ios: {
        latestVersion: { type: String, required: true },
        mandatoryUpdate: { type: Boolean, default: false },
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: "" },
    },
    android: {
        latestVersion: { type: String, required: true },
        mandatoryUpdate: { type: Boolean, default: false },
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: "" },
    }
}, { timestamps: true });

module.exports = mongoose.model("AppConfig", appConfigSchema);
