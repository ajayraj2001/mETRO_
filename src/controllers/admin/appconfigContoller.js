const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const AppConfig = require("../../models/appConfig");

const updateAppConfig = asyncHandler(async (req, res) => {
    const { ios, android } = req.body; // Both platforms' configurations

    let config = await AppConfig.findOne().sort({ createdAt: -1 });

    if (!config) {
        config = new AppConfig({});
    }

    if (ios) {
        config.ios.latestVersion = ios.latestVersion || config.ios.latestVersion;
        config.ios.mandatoryUpdate = ios.mandatoryUpdate ?? config.ios.mandatoryUpdate;
        config.ios.maintenanceMode = ios.maintenanceMode ?? config.ios.maintenanceMode;
        config.ios.maintenanceMessage = ios.maintenanceMessage || config.ios.maintenanceMessage;
    }

    if (android) {
        config.android.latestVersion = android.latestVersion || config.android.latestVersion;
        config.android.mandatoryUpdate = android.mandatoryUpdate ?? config.android.mandatoryUpdate;
        config.android.maintenanceMode = android.maintenanceMode ?? config.android.maintenanceMode;
        config.android.maintenanceMessage = android.maintenanceMessage || config.android.maintenanceMessage;
    }

    await config.save();

    return res.status(200).json({
        success: true,
        message: "App configuration updated successfully.",
        data: config,
    });
});

const getAppConfig = asyncHandler(async (req, res) => {
    // Fetch the most recent configuration
    const config = await AppConfig.findOne().sort({ createdAt: -1 });

    if (!config) {
        return res.status(404).json({
            success: true,
            message: "Configuration not found.",
        });
    }

    return res.status(200).json({
        success: true,
        message: "App configuration fetched successfully.",
        data: config,  // Return the entire configuration
    });
});


module.exports = { updateAppConfig, getAppConfig };
