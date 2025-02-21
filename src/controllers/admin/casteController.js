const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Caste } = require("../../models");

const createCaste = asyncHandler(async (req, res, next) => {
  const castes = req.body;

  const casteArray = Array.isArray(castes) ? castes : [castes];

  if (casteArray.length === 0)
    return next(new ApiError("At least one caste is required", 400));

  for (const caste of casteArray) {
    // Check if caste already exists for the given religion
    const existedCaste = await Caste.findOne({ religion: caste.religion, caste: caste.caste});

    if (existedCaste) {
      return next(
        new ApiError(
          `Caste ${caste.caste} already exists for the specified religion`,
          400
        )
      );
    }
  }

  const casteData = casteArray.map((caste) => ({
    religion: caste.religion, // expecting religion as ObjectId
    caste: caste.caste,
  }));

  // Insert multiple castes
  const createdCastes = await Caste.insertMany(casteData);

  return res.status(201).json({
    success: true,
    message: "Castes created successfully",
    data: createdCastes,
  });
});

const getCastes = asyncHandler(async (req, res, next) => {
  const { id: religionId } = req.params;
  const { searchTerm } = req.query;

  const query = { religion: religionId };

  if(searchTerm) {
    query.caste = { $regex: searchTerm, $options: 'i' };
  }

  const castes = await Caste.find(query).sort({ caste: 1 }); ;
  //const castes = await Caste.find().populate('religion', 'name');

  if (!castes || castes.length === 0)
    return next(new ApiError("No castes found.", 404));

  return res.status(200).json({
    success: true,
    message: "Castes fetched successfully",
    data: castes,
  });
});

const updateCaste = asyncHandler(async (req, res, next) => {
  const { caste } = req.body;
  const { id } = req.params;

  const casteToUpdate = await Caste.findById(id);

  if (!casteToUpdate) return next(new ApiError("Caste not found.", 404));

  //casteToUpdate.religion = religion || casteToUpdate.religion;
  casteToUpdate.caste = caste || casteToUpdate.caste;

  await casteToUpdate.save();

  return res.status(200).json({
    success: true,
    message: "Caste updated successfully",
    data: casteToUpdate,
  });
});

const deleteCaste = asyncHandler(async (req, res, next) => {
  const caste = await Caste.findByIdAndDelete(req.params.id);

  if (!caste) return next(new ApiError("Caste not found.", 404));

  return res.status(200).json({
    success: true,
    message: "Caste deleted successfully",
  });
});

module.exports = {
  createCaste,
  getCastes,
  updateCaste,
  deleteCaste,
};
