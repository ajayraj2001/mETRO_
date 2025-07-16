const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Religion, Sect, Jammat, Caste } = require("../../models");

/**
 * Get all religions in alphabetical order
 */
const getReligions = asyncHandler(async (req, res, next) => {
  const { searchTerm } = req.query;
  
  const query = {};
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }
  
  const religions = await Religion.aggregate([
    { $match: query },
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $in: ["$name", ["Others", "Other"]] },
            then: 1, // Push "Others" and "Other" to the end
            else: 0, // Normal sorting for other values
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } }, // Sort normally but push "Others" and "Other" to the end
  ]);

  if (!religions.length) 
    return next(new ApiError("No religions found.", 404));

  return res.status(200).json({
    success: true,
    message: "Religions fetched successfully",
    data: religions,
  });
});

/**
 * Get sects for a specific religion in alphabetical order
 */
const getSects = asyncHandler(async (req, res, next) => {
  const { religionId } = req.params;
  const { searchTerm } = req.query;

  const religion = await Religion.findById(religionId);
  if (!religion) return next(new ApiError("Religion not found.", 404));
  if (!religion.hasSects) return next(new ApiError("This religion does not have sects.", 400));

  const religionObjectId = new mongoose.Types.ObjectId(religionId);

  const query = { religion: religionObjectId };
  
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const sects = await Sect.aggregate([
    { $match: query },
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $in: ["$name", ["Others", "Other"]] },
            then: 1,
            else: 0,
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $project: {
        _id: 1,
        religion: 1,
        name: 1,
        hasJammats: 1,
      },
    },
  ]);
  
  if (!sects.length) return next(new ApiError("No sects found for this religion.", 404));

  return res.status(200).json({
    success: true,
    message: "Sects fetched successfully",
    data: sects,
  });
});


/**
 * Get jammats for a specific sect in alphabetical order
 */
const getJammats = asyncHandler(async (req, res, next) => {
  const { sectId } = req.params;
  const { searchTerm } = req.query;

  const sect = await Sect.findById(sectId);
  if (!sect) return next(new ApiError("Sect not found.", 404));
  if (!sect.hasJammats) return next(new ApiError("This sect does not have jammats.", 400));


  const sectObjectId = new mongoose.Types.ObjectId(sectId);

  const query = { sect: sectObjectId };
  
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const jammats = await Jammat.aggregate([
    { $match: query },
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $in: ["$name", ["Others", "Other"]] },
            then: 1,
            else: 0,
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $project: {
        _id: 1,
        sect: 1,
        name: 1,
      },
    },
  ]);

  if (!jammats.length) return next(new ApiError("No jammats found for this sect.", 404));

  return res.status(200).json({
    success: true,
    message: "Jammats fetched successfully",
    data: jammats,
  });
});


/**
 * Get castes based on religious hierarchy (religion, optional sect, optional jammat)
 */
const getCastes = asyncHandler(async (req, res, next) => {
  const { religionId, sectId, jammatId } = req.body;
  const { searchTerm } = req.query;

  if (!religionId) return next(new ApiError("Religion ID is required.", 400));

  // Convert IDs to ObjectId if they are valid
  const religionObjectId = mongoose.Types.ObjectId.isValid(religionId) ? new mongoose.Types.ObjectId(religionId) : null;
  const sectObjectId = mongoose.Types.ObjectId.isValid(sectId) ? new mongoose.Types.ObjectId(sectId) : null;
  const jammatObjectId = mongoose.Types.ObjectId.isValid(jammatId) ? new mongoose.Types.ObjectId(jammatId) : null;

  if (!religionObjectId) return next(new ApiError("Invalid Religion ID.", 400));

  const religion = await Religion.findById(religionObjectId);
  if (!religion) return next(new ApiError("Religion not found.", 404));

  const query = { religion: religionObjectId };

  if (religion.hasSects) {
    if (sectId) {
      if (!sectObjectId) return next(new ApiError("Invalid Sect ID.", 400));
      const sect = await Sect.findById(sectObjectId);
      if (!sect) return next(new ApiError("Sect not found.", 404));
      if (!sect.religion.equals(religionObjectId)) 
        return next(new ApiError("Sect does not belong to this religion.", 400));

      query.sect = sectObjectId;

      if (sect.hasJammats) {
        if (jammatId) {
          if (!jammatObjectId) return next(new ApiError("Invalid Jammat ID.", 400));
          const jammat = await Jammat.findById(jammatObjectId);
          if (!jammat) return next(new ApiError("Jammat not found.", 404));
          if (!jammat.sect.equals(sectObjectId)) 
            return next(new ApiError("Jammat does not belong to this sect.", 400));

          query.jammat = jammatObjectId;
        }
      } else {
        if (jammatId) return next(new ApiError("This sect does not support jammats.", 400));
        query.jammat = null;
      }
    } else {
      query.sect = null;
    }
  } else {
    if (sectId) return next(new ApiError("This religion does not support sects.", 400));
    query.sect = null;
    query.jammat = null;
  }

  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const castes = await Caste.aggregate([
    { $match: query },
    {
      $addFields: {
        sortOrder: {
          $cond: {
            if: { $in: ["$name", ["Others", "Other"]] },
            then: 1,
            else: 0,
          },
        },
      },
    },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $project: {
        _id: 1,
        religion: 1,
        sect: 1,
        jammat: 1,
        name: 1,
      },
    },
  ]);

  if (!castes.length) return next(new ApiError("No castes found for the given criteria.", 404));

  return res.status(200).json({
    success: true,
    message: "Castes fetched successfully",
    data: castes,
  });
});

/**
 * Get full hierarchy structure for a religion in one API call
 * Useful for populating multi-level dropdowns on the frontend
 */
const getFullHierarchy = asyncHandler(async (req, res, next) => {
  const { religionId } = req.params;
  
  // Validate religion exists
  const religion = await Religion.findById(religionId);
  if (!religion)
    return next(new ApiError("Religion not found.", 404));
  
  const result = {
    _id: religion._id,
    name: religion.name,
    hasSects: religion.hasSects
  };
  
  // If religion has no sects, just return castes
  if (!religion.hasSects) {
    const castes = await Caste.find({ 
      religion: religionId,
      sect: null,
      jammat: null 
    }).sort({ name: 1 });
    
    result.castes = castes.map(c => ({ _id: c._id, name: c.name }));
    
    return res.status(200).json({
      success: true,
      message: "Religion hierarchy fetched successfully",
      data: result
    });
  }
  
  // If religion has sects, get structured data
  const sects = await Sect.find({ religion: religionId }).sort({ name: 1 });
  result.sects = [];
  
  // For each sect, get its data
  for (const sect of sects) {
    const sectData = {
      _id: sect._id,
      name: sect.name,
      hasJammats: sect.hasJammats
    };
    
    // If sect has jammats, get all jammats
    if (sect.hasJammats) {
      const jammats = await Jammat.find({ sect: sect._id }).sort({ name: 1 });
      sectData.jammats = [];
      
      // For each jammat, get its castes
      for (const jammat of jammats) {
        const castes = await Caste.find({
          religion: religionId,
          sect: sect._id,
          jammat: jammat._id
        }).sort({ name: 1 });
        
        sectData.jammats.push({
          _id: jammat._id,
          name: jammat.name,
          castes: castes.map(c => ({ _id: c._id, name: c.name }))
        });
      }
    } else {
      // Otherwise, get castes directly for this sect
      const castes = await Caste.find({
        religion: religionId,
        sect: sect._id,
        jammat: null
      }).sort({ name: 1 });
      
      sectData.castes = castes.map(c => ({ _id: c._id, name: c.name }));
    }
    
    result.sects.push(sectData);
  }
  
  // Also get direct castes (without sect) if any
  const directCastes = await Caste.find({
    religion: religionId,
    sect: null,
    jammat: null
  }).sort({ name: 1 });
  
  if (directCastes.length > 0) {
    result.castes = directCastes.map(c => ({ _id: c._id, name: c.name }));
  }
  
  return res.status(200).json({
    success: true,
    message: "Religion hierarchy fetched successfully",
    data: result
  });
});

module.exports = {
  getReligions,
  getSects,
  getJammats,
  getCastes,
  getFullHierarchy
};