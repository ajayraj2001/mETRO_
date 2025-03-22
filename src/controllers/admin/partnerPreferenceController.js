const PartnerPreferences = require("../../models/partnerPreference");

const getUserPreferenceByAdmin = async (req, res, next) => {
    try {
      const { user_id } = req.params; // Admin will provide user_id in the request params
  
      // Fetch user preference
      const preference = await PartnerPreferences.findOne({ user_id });
  
      if (!preference) {
        return res.status(200).json({
          success: true,
          message: "No preferences found for this user.",
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "User preference retrieved successfully",
        data: preference,
      });
    } catch (error) {
      next(error);
    }
  };
    
  module.exports = {getUserPreferenceByAdmin};
  