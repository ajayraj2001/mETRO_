const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Religion } = require("../../models");


const createReligion = asyncHandler(async (req, res, next) => {
  const religionNames = req.body;

  const religions = Array.isArray(religionNames) ? religionNames : [religionNames];

  if (religions.length === 0)
    return next(new ApiError("At least one religion is required", 400));

  // Prepare data for insertMany by mapping the array of objects
  const religionData = religions.map((religion) => ({ name: religion.name }));

  // Insert multiple religions
  const createdReligions = await Religion.insertMany(religionData);

  return res.status(201).json({
    success: true,
    message: "Religions created successfully",
    data: createdReligions,
  });
});

const getReligions = asyncHandler(async (req, res, next) => {
  const religions = await Religion.find();

  if (!religions) return next(new ApiError("No data found.", 404));

  return res.status(200).json({
    success: true,
    message: "Religions fetched successfully",
    data: religions,
  });
});

const updateReligion = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  const religion = await Religion.findById(req.params.id);

  if (!religion) return next(new ApiError("No religion found.", 404));

  religion.name = name || religion.name;

  await religion.save();

  return res.status(200).json({
    success: true,
    message: "Religion updated successfully",
  });
});

const deleteReligion = asyncHandler(async (req, res, next) => {

  const religion = await Religion.findByIdAndDelete(req.params.id);

  if (!religion) return next(new ApiError("No religion found.", 404));

  return res.status(200).json({
    success: true,
    message: "Religion deleted successfully",
  });
});

module.exports = {
  createReligion,
  getReligions,
  updateReligion,
  deleteReligion,
};
