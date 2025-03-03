const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const {Language} = require("../../models"); // Adjust the path as necessary

// Get all languages sorted alphabetically
// const getLanguages = asyncHandler(async (req, res, next) => {
//   // Fetch all languages and sort them by name in ascending order
//   const languages = await Language.find().sort({ name: 1 });

//   if (!languages || languages.length === 0) {
//     return next(new ApiError("No languages found.", 404));
//   }

//   return res.status(200).json({
//     success: true,
//     message: "Languages fetched and sorted alphabetically.",
//     data: languages,
//   });
// });

const getLanguages = asyncHandler(async (req, res, next) => {
  // Fetch all languages and sort them, keeping "Others" and "Other" at the end
  const languages = await Language.aggregate([
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $regexMatch: { input: "$name", regex: /^Others?$/i } }, // Matches "Other" and "Others"
            then: 1, // Push "Other" and "Others" to the end
            else: 0, // Keep all other languages normally sorted
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } }, // Sort normally, keeping "Other" and "Others" last
    { $project: { name: 1, _id: 1 } }, // Only return name and _id
  ]);

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