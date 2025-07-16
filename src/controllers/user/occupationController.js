const { OccupationCategory, Course } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");

const getOccupationStructure = asyncHandler(async (req, res, next) => {
    const categoriesWithOccupations = await OccupationCategory.aggregate([
      {
        $addFields: {
          sortOrder: {
            $cond: {
              if: { $in: ["$name", ["Others", "Other"]] }, // Keep "Others" and "Other" at the end
              then: 1,
              else: 0,
            },
          },
        },
      },
      { $sort: { sortOrder: 1, name: 1 } }, // Sort normally but push "Others" to the end
      {
        $lookup: {
          from: "occupations",
          localField: "_id",
          foreignField: "category",
          as: "occupations",
          pipeline: [
            { $sort: { name: 1 } },
            {
              $project: {
                name: 1,
                _id: 0,
              },
            },
          ],
        },
      },
      {
        $project: {
          name: 1,
          occupations: 1,
          _id: 0,
        },
      },
    ]);
  
    return res.status(200).json({
      success: true,
      message: "Occupation structure retrieved successfully.",
      data: categoriesWithOccupations,
    });
  });
  
  module.exports = { getOccupationStructure };
  