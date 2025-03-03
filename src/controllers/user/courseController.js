// controllers/courseController.js
const { CourseCategory, Course } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");

// const getCourseStructure = asyncHandler(async (req, res, next) => {
//   const categoriesWithCourses = await CourseCategory.aggregate([
//     { $sort: { name: 1 } }, // Sort categories alphabetically by name
//     {
//       $lookup: {
//         from: "courses", // Collection name for Course model
//         localField: "_id",
//         foreignField: "category",
//         as: "courses",
//         pipeline: [
//           { $sort: { name: 1 } }, // Sort courses alphabetically within each category
//           {
//             $project: {
//               name: 1, // Include only the `name` field for courses
//               _id: 0, // Exclude the `_id` field
//             },
//           },
//         ],
//       },
//     },
//     {
//       $project: {
//         name: 1, // Include only the `name` field for categories
//         courses: 1, // Include the `courses` array
//         _id: 0, // Exclude the `_id` field
//       },
//     },
//   ]);

//   return res.status(200).json({
//     success: true,
//     message: "Course structure retrieved successfully.",
//     data: categoriesWithCourses,
//   });
// });

const getCourseStructure = asyncHandler(async (req, res, next) => {
  const categoriesWithCourses = await CourseCategory.aggregate([
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $in: ["$name", ["Others", "Other"]] }, // Check for both "Others" and "Other"
            then: 1, // Assign highest value to push them to the end
            else: 0, // Assign lower values to all other categories
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } }, // Sort normally but keep "Others" and "Other" at the end
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "category",
        as: "courses",
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
        courses: 1,
        _id: 0,
      },
    },
  ]);

  return res.status(200).json({
    success: true,
    message: "Course structure retrieved successfully.",
    data: categoriesWithCourses,
  });
});


module.exports = {
  getCourseStructure,
};