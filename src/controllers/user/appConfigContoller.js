const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const AppConfig = require("../../models/appConfig");

// const getAppConfig = asyncHandler(async (req, res) => {
//     const { version, platform } = req.query; // Example: ?version=2.0.1&platform=ios

//     if (!platform || !["ios", "android"].includes(platform.toLowerCase())) {
//         return res.status(400).json({
//             success: false,
//             message: "Invalid or missing platform parameter. Use 'ios' or 'android'.",
//         });
//     }

//     const config = await AppConfig.findOne().sort({ createdAt: -1 });

//     if (!config) {
//         return res.status(404).json({
//             success: false,
//             message: "Configuration not found.",
//         });
//     }

//     const appConfig = config[platform.toLowerCase()];
//     let updateRequired = false;
//     let mandatory = false;

//     if (version && version !== appConfig.latestVersion) {
//         updateRequired = true;
//         mandatory = appConfig.mandatoryUpdate;
//     }

//     return res.status(200).json({
//         success: true,
//         message: "App configuration fetched successfully.",
//         data: {
//             latestVersion: appConfig.latestVersion,
//             updateRequired,
//             mandatoryUpdate: mandatory,
//             maintenanceMode: appConfig.maintenanceMode,
//             maintenanceMessage: appConfig.maintenanceMessage,
//         },
//     });
// });

const getAppConfig = asyncHandler(async (req, res) => {
    const { version, platform } = req.query; // Example: ?version=2.0.1&platform=ios

    if (!platform || !["ios", "android"].includes(platform.toLowerCase())) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing platform parameter. Use 'ios' or 'android'.",
        });
    }

    const config = await AppConfig.findOne().sort({ createdAt: -1 });

    if (!config) {
        return res.status(404).json({
            success: false,
            message: "Configuration not found.",
        });
    }

    const platformKey = platform.toLowerCase();
    const appConfig = config[platformKey];
    let updateRequired = false;
    let mandatory = false;

    if (version && version !== appConfig.latestVersion) {
        updateRequired = true;
        mandatory = appConfig.mandatoryUpdate;
    }

    // Set platform-specific store link
    const storeLinks = {
        android: "https://www.google.com",
        ios: "", // Add iOS App Store link when available
    };

    return res.status(200).json({
        success: true,
        message: "App configuration fetched successfully.",
        data: {
            latestVersion: appConfig.latestVersion,
            updateRequired,
            mandatoryUpdate: mandatory,
            maintenanceMode: appConfig.maintenanceMode,
            maintenanceMessage: appConfig.maintenanceMessage,
            storeLink: storeLinks[platformKey],
        },
    });
});


module.exports = { getAppConfig };
