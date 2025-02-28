const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const Language = require("../../models"); // Adjust the path as necessary

// Get all languages sorted alphabetically
const getLanguages = asyncHandler(async (req, res, next) => {
  // Fetch all languages and sort them by name in ascending order
  const languages = await Language.find().sort({ name: 1 });

  if (!languages || languages.length === 0) {
    return next(new ApiError("No languages found.", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Languages fetched and sorted alphabetically.",
    data: languages,
  });
});

module.exports = {
  getLanguages,
};