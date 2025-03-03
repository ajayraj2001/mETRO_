const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Religion, Sect, Jammat, Caste } = require("../../models");

// Religion Controllers --------------
const createReligion = asyncHandler(async (req, res, next) => {
  const { name, hasSects } = req.body;

  if (!name) return next(new ApiError("Religion name is required", 400));

  const existingReligion = await Religion.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
  if (existingReligion) return next(new ApiError("Religion already exists", 400));

  const religion = await Religion.create({
    name,
    hasSects: !!hasSects
  });

  return res.status(201).json({
    success: true,
    message: "Religion created successfully",
    data: religion
  });
});

const getReligions = asyncHandler(async (req, res) => {
  const { searchTerm } = req.query;

  const query = {};
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const religions = await Religion.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Religions fetched successfully",
    data: religions
  });
});

// Religion Update & Delete
const updateReligion = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, hasSects } = req.body;

  const religion = await Religion.findById(id);
  if (!religion) return next(new ApiError("Religion not found", 404));

  if (name) {
    const existingReligion = await Religion.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });
    if (existingReligion) return next(new ApiError("Religion name already exists", 400));
    religion.name = name;
  }

  if (hasSects !== undefined) religion.hasSects = hasSects;
  await religion.save();

  return res.status(200).json({
    success: true,
    message: "Religion updated successfully",
    data: religion
  });
});

const deleteReligion = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const religion = await Religion.findById(id);
  if (!religion) return next(new ApiError("Religion not found", 404));

  // Check for dependent sects
  const hasSects = await Sect.exists({ religion: id });
  if (hasSects) return next(new ApiError("Cannot delete religion with existing sects", 400));

  await Religion.deleteOne({ _id: id });

  return res.status(200).json({
    success: true,
    message: "Religion deleted successfully"
  });
});


// Sect Controllers -------------
const createSect = asyncHandler(async (req, res, next) => {
  const { religion, sects, hasJammats } = req.body;

  // Validate input
  if (!religion || !Array.isArray(sects) || sects.length === 0) {
    return next(new ApiError("Religion ID and at least one sect name are required", 400));
  }

  // Check if religion exists
  const religionExists = await Religion.findById(religion);
  if (!religionExists) return next(new ApiError("Religion not found", 404));

  // Ensure the religion supports sects
  if (!religionExists.hasSects) {
    return next(new ApiError(`Religion ${religionExists.name} doesn't support sects`, 400));
  }

  // Check for existing sects to prevent duplicates
  const existingSects = await Sect.find({
    religion,
    name: { $in: sects.map(name => new RegExp(`^${name}$`, "i")) }
  });

  if (existingSects.length > 0) {
    const duplicateNames = existingSects.map(s => s.name).join(", ");
    return next(new ApiError(`Sects already exist: ${duplicateNames}`, 400));
  }

  // Prepare sect data for bulk insertion
  const sectData = sects.map(name => ({
    religion,
    name,
    hasJammats: !!hasJammats // Convert to boolean
  }));

  // Insert sects into DB
  const createdSects = await Sect.insertMany(sectData);

  return res.status(201).json({
    success: true,
    message: "Sects created successfully",
    data: createdSects
  });
});

// const createSect = asyncHandler(async (req, res, next) => {
//   const { religion, name, hasJammats } = req.body;

//   if (!religion || !name) return next(new ApiError("Religion ID and sect name are required", 400));

//   const religionExists = await Religion.findById(religion);
//   if (!religionExists) return next(new ApiError("Religion not found", 404));

//   if (!religionExists.hasSects) return next(new ApiError("This religion doesn't support sects", 400));

//   const existingSect = await Sect.findOne({
//     religion,
//     name: { $regex: new RegExp(`^${name}$`, "i") }
//   });

//   if (existingSect) return next(new ApiError("Sect already exists for this religion", 400));

//   const sect = await Sect.create({
//     religion,
//     name,
//     hasJammats: !!hasJammats
//   });

//   return res.status(201).json({
//     success: true,
//     message: "Sect created successfully",
//     data: sect
//   });
// });

const getSects = asyncHandler(async (req, res) => {
  const { religionId } = req.params;
  const { searchTerm } = req.query;

  const query = { religion: religionId };
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const sects = await Sect.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Sects fetched successfully",
    data: sects
  });
});

// Sect Update & Delete
const updateSect = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, hasJammats } = req.body;

  const sect = await Sect.findById(id).populate('religion');
  if (!sect) return next(new ApiError("Sect not found", 404));

  if (name) {
    const existingSect = await Sect.findOne({
      religion: sect.religion,
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });
    if (existingSect) return next(new ApiError("Sect name already exists in this religion", 400));
    sect.name = name;
  }

  if (hasJammats !== undefined) sect.hasJammats = hasJammats;
  await sect.save();

  return res.status(200).json({
    success: true,
    message: "Sect updated successfully",
    data: sect
  });
});

const deleteSect = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const sect = await Sect.findById(id);
  if (!sect) return next(new ApiError("Sect not found", 404));

  // Check for dependent jammats or castes
  const hasJammats = await Jammat.exists({ sect: id });
  const hasCastes = await Caste.exists({ sect: id });

  if (hasJammats || hasCastes) {
    return next(new ApiError("Cannot delete sect with existing jammats or castes", 400));
  }

  await Sect.deleteOne({ _id: id });

  return res.status(200).json({
    success: true,
    message: "Sect deleted successfully"
  });
});

// Jammat Controllers-----------
const createJammat = asyncHandler(async (req, res, next) => {
  const { sect, jammats } = req.body;

  // Validate input
  if (!sect || !Array.isArray(jammats) || jammats.length === 0) {
    return next(new ApiError("Sect ID and at least one jammat name are required", 400));
  }

  // Check if sect exists
  const sectExists = await Sect.findById(sect);
  if (!sectExists) return next(new ApiError("Sect not found", 404));

  // Ensure the sect supports jammats
  if (!sectExists.hasJammats) {
    return next(new ApiError(`Sect ${sectExists.name} doesn't support jammats`, 400));
  }

  // Check for existing jammats to prevent duplicates
  const existingJammats = await Jammat.find({
    sect,
    name: { $in: jammats.map(name => new RegExp(`^${name}$`, "i")) }
  });

  if (existingJammats.length > 0) {
    const duplicateNames = existingJammats.map(j => j.name).join(", ");
    return next(new ApiError(`Jammats already exist: ${duplicateNames}`, 400));
  }

  // Prepare jammat data for bulk insertion
  const jammatData = jammats.map(name => ({
    sect,
    name
  }));

  // Insert jammats into DB
  const createdJammats = await Jammat.insertMany(jammatData);

  return res.status(201).json({
    success: true,
    message: "Jammats created successfully",
    data: createdJammats
  });
});

// const createJammat = asyncHandler(async (req, res, next) => {
//   const { sect, name } = req.body;

//   if (!sect || !name) return next(new ApiError("Sect ID and jammat name are required", 400));

//   const sectExists = await Sect.findById(sect);
//   if (!sectExists) return next(new ApiError("Sect not found", 404));

//   if (!sectExists.hasJammats) return next(new ApiError("This sect doesn't support jammats", 400));

//   const existingJammat = await Jammat.findOne({
//     sect,
//     name: { $regex: new RegExp(`^${name}$`, "i") }
//   });

//   if (existingJammat) return next(new ApiError("Jammat already exists for this sect", 400));

//   const jammat = await Jammat.create({
//     sect,
//     name
//   });

//   return res.status(201).json({
//     success: true,
//     message: "Jammat created successfully",
//     data: jammat
//   });
// });

const getJammats = asyncHandler(async (req, res) => {
  const { sectId } = req.params;
  const { searchTerm } = req.query;

  const query = { sect: sectId };
  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const jammats = await Jammat.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Jammats fetched successfully",
    data: jammats
  });
});


// Jammat Update & Delete
const updateJammat = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  const jammat = await Jammat.findById(id);
  if (!jammat) return next(new ApiError("Jammat not found", 404));

  if (name) {
    const existingJammat = await Jammat.findOne({
      sect: jammat.sect,
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });
    if (existingJammat) return next(new ApiError("Jammat name already exists in this sect", 400));
    jammat.name = name;
  }

  await jammat.save();

  return res.status(200).json({
    success: true,
    message: "Jammat updated successfully",
    data: jammat
  });
});

const deleteJammat = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const jammat = await Jammat.findById(id);
  if (!jammat) return next(new ApiError("Jammat not found", 404));

  // Check for dependent castes
  const hasCastes = await Caste.exists({ jammat: id });
  if (hasCastes) return next(new ApiError("Cannot delete jammat with existing castes", 400));

  await Jammat.deleteOne({ _id: id });

  return res.status(200).json({
    success: true,
    message: "Jammat deleted successfully"
  });
});

// Caste Controllers -----------------
const createCaste = asyncHandler(async (req, res, next) => {
  const { religion, sect, jammat, castes } = req.body;

  // Validate required fields
  if (!religion || !Array.isArray(castes) || castes.length === 0) {
    return next(new ApiError("Religion ID and at least one caste name are required", 400));
  }

  // Validate religion exists
  const religionExists = await Religion.findById(religion);
  if (!religionExists) return next(new ApiError(`Religion with ID ${religion} not found`, 404));

  // Validate sect if provided
  if (sect) {
    if (!religionExists.hasSects) {
      return next(new ApiError(`Religion ${religionExists.name} doesn't support sects`, 400));
    }

    const sectExists = await Sect.findById(sect);
    if (!sectExists) return next(new ApiError(`Sect with ID ${sect} not found`, 404));
    if (sectExists.religion.toString() !== religion.toString()) {
      return next(new ApiError(`Sect doesn't belong to specified religion`, 400));
    }

    // Validate jammat if provided
    if (jammat) {
      if (!sectExists.hasJammats) {
        return next(new ApiError(`Sect ${sectExists.name} doesn't support jammats`, 400));
      }

      const jammatExists = await Jammat.findById(jammat);
      if (!jammatExists) return next(new ApiError(`Jammat with ID ${jammat} not found`, 404));
      if (jammatExists.sect.toString() !== sect.toString()) {
        return next(new ApiError(`Jammat doesn't belong to specified sect`, 400));
      }
    }
  }

  // Check for duplicate caste names within the same religion/sect/jammat
  const existingCastes = await Caste.find({
    religion,
    sect: sect || null,
    jammat: jammat || null,
    name: { $in: castes.map(name => new RegExp(`^${name}$`, "i")) }
  });

  if (existingCastes.length > 0) {
    const duplicateNames = existingCastes.map(c => c.name).join(", ");
    return next(new ApiError(`Castes already exist: ${duplicateNames}`, 400));
  }

  // Prepare caste data for insertion
  const casteData = castes.map(name => ({
    religion,
    sect: sect || null,
    jammat: jammat || null,
    name
  }));

  // Insert new castes
  const createdCastes = await Caste.insertMany(casteData);

  return res.status(201).json({
    success: true,
    message: "Castes created successfully",
    data: createdCastes
  });
});

// const createCaste = asyncHandler(async (req, res, next) => {
//   const castes = req.body;
//   const casteArray = Array.isArray(castes) ? castes : [castes];

//   if (casteArray.length === 0) return next(new ApiError("At least one caste is required", 400));

//   for (const caste of casteArray) {
//     const { religion, sect, jammat, name } = caste;

//     if (!religion || !name) return next(new ApiError("Religion ID and caste name are required", 400));

//     // Validate religion exists
//     const religionExists = await Religion.findById(religion);
//     if (!religionExists) return next(new ApiError(`Religion with ID ${religion} not found`, 404));

//     // Build query to check for existing caste
//     const query = {
//       religion,
//       name: { $regex: new RegExp(`^${name}$`, "i") }
//     };

//     // Validate sect if provided
//     if (sect) {
//       if (!religionExists.hasSects) {
//         return next(new ApiError(`Religion ${religionExists.name} doesn't support sects`, 400));
//       }

//       const sectExists = await Sect.findById(sect);
//       if (!sectExists) return next(new ApiError(`Sect with ID ${sect} not found`, 404));
//       if (sectExists.religion.toString() !== religion.toString()) {
//         return next(new ApiError(`Sect doesn't belong to specified religion`, 400));
//       }

//       query.sect = sect;

//       // Validate jammat if provided
//       if (jammat) {
//         if (!sectExists.hasJammats) {
//           return next(new ApiError(`Sect ${sectExists.name} doesn't support jammats`, 400));
//         }

//         const jammatExists = await Jammat.findById(jammat);
//         if (!jammatExists) return next(new ApiError(`Jammat with ID ${jammat} not found`, 404));
//         if (jammatExists.sect.toString() !== sect.toString()) {
//           return next(new ApiError(`Jammat doesn't belong to specified sect`, 400));
//         }

//         query.jammat = jammat;
//       }
//     }

//     // Check if caste already exists
//     const existingCaste = await Caste.findOne(query);
//     if (existingCaste) {
//       return next(new ApiError(`Caste ${name} already exists with these specifications`, 400));
//     }
//   }

//   // All validations passed, create the castes
//   const casteData = casteArray.map(caste => ({
//     religion: caste.religion,
//     sect: caste.sect || null,
//     jammat: caste.jammat || null,
//     name: caste.name
//   }));

//   const createdCastes = await Caste.insertMany(casteData);

//   return res.status(201).json({
//     success: true,
//     message: "Castes created successfully",
//     data: createdCastes
//   });
// });


const getCastes = asyncHandler(async (req, res) => {
  const { religionId, sectId, jammatId } = req.params;
  const { searchTerm } = req.query;

  const query = { religion: religionId };

  if (sectId) query.sect = sectId;
  if (jammatId) query.jammat = jammatId;
  if (searchTerm) query.name = { $regex: searchTerm, $options: "i" };

  const castes = await Caste.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Castes fetched successfully",
    data: castes
  });
});

const updateCaste = asyncHandler(async (req, res, next) => {
  const { name, sect, jammat } = req.body;
  const { id } = req.params;

  const caste = await Caste.findById(id);
  if (!caste) return next(new ApiError("Caste not found", 404));

  // Check if sect belongs to the caste's religion if sect is being updated
  if (sect && sect !== caste.sect) {
    const sectDoc = await Sect.findById(sect);
    if (!sectDoc) return next(new ApiError("Sect not found", 404));
    if (sectDoc.religion.toString() !== caste.religion.toString()) {
      return next(new ApiError("Sect doesn't belong to the caste's religion", 400));
    }
  }

  // Check if jammat belongs to the caste's sect if jammat is being updated
  if (jammat && jammat !== caste.jammat) {
    const jammatDoc = await Jammat.findById(jammat);
    if (!jammatDoc) return next(new ApiError("Jammat not found", 404));

    const sectToCheck = sect || caste.sect;
    if (!sectToCheck) return next(new ApiError("Cannot add jammat without a sect", 400));

    if (jammatDoc.sect.toString() !== sectToCheck.toString()) {
      return next(new ApiError("Jammat doesn't belong to the specified sect", 400));
    }
  }

  if (name) caste.name = name;
  if (sect !== undefined) caste.sect = sect || null;
  if (jammat !== undefined) caste.jammat = jammat || null;

  await caste.save();

  return res.status(200).json({
    success: true,
    message: "Caste updated successfully",
    data: caste
  });
});

const deleteCaste = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const caste = await Caste.findByIdAndDelete(id);
  if (!caste) return next(new ApiError("Caste not found", 404));

  return res.status(200).json({
    success: true,
    message: "Caste deleted successfully"
  });
});

module.exports = {
  // Religion
  createReligion,
  getReligions,
  updateReligion,
  deleteReligion,

  // Sect
  createSect,
  getSects,
  updateSect,
  deleteSect,

  // Jammat
  createJammat,
  getJammats,
  updateJammat,
  deleteJammat,

  // Caste
  createCaste,
  getCastes,
  updateCaste,
  deleteCaste
};