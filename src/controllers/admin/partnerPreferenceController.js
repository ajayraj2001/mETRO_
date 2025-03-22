const PartnerPreferences = require("../../models/partnerPreference");

const getUserPreferenceByAdmin = async (req, res, next) => {
    try {
      const { user_id } = '6719e88525089de3f6fb5a74'; // Admin will provide user_id in the request params
  
      // Fetch user preference
      const preference = await PartnerPreferences.findOne({ user_id });
  
      if (!preference) {
        return res.status(404).json({
          success: true,
          message: "No preferences found for this user.",
          data:{}
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
  