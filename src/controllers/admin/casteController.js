const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Religion, Sect, Jammat, Caste } = require("../../models");

// Religion Controllers
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

// Sect Controllers
const createSect = asyncHandler(async (req, res, next) => {
  const { religion, name, hasJammats } = req.body;

  if (!religion || !name) return next(new ApiError("Religion ID and sect name are required", 400));

  const religionExists = await Religion.findById(religion);
  if (!religionExists) return next(new ApiError("Religion not found", 404));

  if (!religionExists.hasSects) return next(new ApiError("This religion doesn't support sects", 400));

  const existingSect = await Sect.findOne({
    religion,
    name: { $regex: new RegExp(`^${name}$`, "i") }
  });

  if (existingSect) return next(new ApiError("Sect already exists for this religion", 400));

  const sect = await Sect.create({
    religion,
    name,
    hasJammats: !!hasJammats
  });

  return res.status(201).json({
    success: true,
    message: "Sect created successfully",
    data: sect
  });
});

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

// Jammat Controllers
const createJammat = asyncHandler(async (req, res, next) => {
  const { sect, name } = req.body;

  if (!sect || !name) return next(new ApiError("Sect ID and jammat name are required", 400));

  const sectExists = await Sect.findById(sect);
  if (!sectExists) return next(new ApiError("Sect not found", 404));

  if (!sectExists.hasJammats) return next(new ApiError("This sect doesn't support jammats", 400));

  const existingJammat = await Jammat.findOne({
    sect,
    name: { $regex: new RegExp(`^${name}$`, "i") }
  });

  if (existingJammat) return next(new ApiError("Jammat already exists for this sect", 400));

  const jammat = await Jammat.create({
    sect,
    name
  });

  return res.status(201).json({
    success: true,
    message: "Jammat created successfully",
    data: jammat
  });
});

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

// Caste Controllers
const createCaste = asyncHandler(async (req, res, next) => {
  const castes = req.body;
  const casteArray = Array.isArray(castes) ? castes : [castes];

  if (casteArray.length === 0) return next(new ApiError("At least one caste is required", 400));

  for (const caste of casteArray) {
    const { religion, sect, jammat, name } = caste;

    if (!religion || !name) return next(new ApiError("Religion ID and caste name are required", 400));

    // Validate religion exists
    const religionExists = await Religion.findById(religion);
    if (!religionExists) return next(new ApiError(`Religion with ID ${religion} not found`, 404));

    // Build query to check for existing caste
    const query = {
      religion,
      name: { $regex: new RegExp(`^${name}$`, "i") }
    };

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

      query.sect = sect;

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

        query.jammat = jammat;
      }
    }

    // Check if caste already exists
    const existingCaste = await Caste.findOne(query);
    if (existingCaste) {
      return next(new ApiError(`Caste ${name} already exists with these specifications`, 400));
    }
  }

  // All validations passed, create the castes
  const casteData = casteArray.map(caste => ({
    religion: caste.religion,
    sect: caste.sect || null,
    jammat: caste.jammat || null,
    name: caste.name
  }));

  const createdCastes = await Caste.insertMany(casteData);

  return res.status(201).json({
    success: true,
    message: "Castes created successfully",
    data: createdCastes
  });
});

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

  // Sect
  createSect,
  getSects,

  // Jammat
  createJammat,
  getJammats,

  // Caste
  createCaste,
  getCastes,
  updateCaste,
  deleteCaste
};