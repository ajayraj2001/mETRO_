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
  
  const religions = await Religion.find(query).sort({ name: 1 });

  if (!religions || religions.length === 0) 
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
  
  // Verify the religion exists and has sects
  const religion = await Religion.findById(religionId);
  if (!religion) 
    return next(new ApiError("Religion not found.", 404));
  
  if (!religion.hasSects)
    return next(new ApiError("This religion does not have sects.", 400));
  
  const query = { religion: religionId };
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }
  
  const sects = await Sect.find(query).sort({ name: 1 });
  
  if (!sects || sects.length === 0)
    return next(new ApiError("No sects found for this religion.", 404));
  
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
  
  // Verify the sect exists and has jammats
  const sect = await Sect.findById(sectId);
  if (!sect) 
    return next(new ApiError("Sect not found.", 404));
  
  if (!sect.hasJammats)
    return next(new ApiError("This sect does not have jammats.", 400));
  
  const query = { sect: sectId };
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }
  
  const jammats = await Jammat.find(query).sort({ name: 1 });
  
  if (!jammats || jammats.length === 0)
    return next(new ApiError("No jammats found for this sect.", 404));
  
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
  
  if (!religionId)
    return next(new ApiError("Religion ID is required.", 400));
  
  // Validate religion exists
  const religion = await Religion.findById(religionId);
  if (!religion)
    return next(new ApiError("Religion not found.", 404));
  
  // Build query based on provided hierarchy
  const query = { religion: religionId };
  
  // If religion has sects, validate sect hierarchy
  if (religion.hasSects) {
    // If sect is provided, add to query
    if (sectId) {
      const sect = await Sect.findById(sectId);
      if (!sect)
        return next(new ApiError("Sect not found.", 404));
      
      if (sect.religion.toString() !== religionId.toString())
        return next(new ApiError("Sect does not belong to this religion.", 400));
      
      query.sect = sectId;
      
      // If sect has jammats, validate jammat hierarchy
      if (sect.hasJammats) {
        // If jammat is provided, add to query
        if (jammatId) {
          const jammat = await Jammat.findById(jammatId);
          if (!jammat)
            return next(new ApiError("Jammat not found.", 404));
          
          if (jammat.sect.toString() !== sectId.toString())
            return next(new ApiError("Jammat does not belong to this sect.", 400));
          
          query.jammat = jammatId;
        }
      } else {
        // This sect doesn't have jammats, so jammat should not be provided
        if (jammatId)
          return next(new ApiError("This sect does not support jammats.", 400));
        
        query.jammat = null;
      }
    } else {
      // If religion has sects but no sect provided, return direct castes (if any)
      query.sect = null;
    }
  } else {
    // If religion doesn't have sects, sect and jammat should not be provided
    if (sectId)
      return next(new ApiError("This religion does not support sects.", 400));
    
    query.sect = null;
    query.jammat = null;
  }
  
  // Add search term to query if provided
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }
  
  // Get castes sorted alphabetically
  const castes = await Caste.find(query).sort({ name: 1 });
  
  if (!castes || castes.length === 0)
    return next(new ApiError("No castes found for the given criteria.", 404));
  
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