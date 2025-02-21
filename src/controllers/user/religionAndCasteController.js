const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Religion, Caste } = require("../../models");

const getReligions = asyncHandler(async (req, res, next) => {
  const religions = await Religion.find();

  if (!religions) return next(new ApiError("No data found.", 404));

  return res.status(200).json({
    success: true,
    message: "Religions fetched successfully",
    data: religions,
  });
});

const getCastes = asyncHandler(async (req, res, next) => {
    const { id: religionId, searchTerm } = req.body;
  
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

module.exports = { 
  getReligions,
  getCastes 
};
