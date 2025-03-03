const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { OccupationCategory, Occupation } = require("../../models");

// Create Occupation Category
const createOccupationCategory = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    if (!name) return next(new ApiError("Category name is required", 400));

    const existingCategory = await OccupationCategory.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCategory) return next(new ApiError("Category already exists", 400));

    const category = await OccupationCategory.create({ name });
    return res.status(201).json({ success: true, message: "Category created successfully", data: category });
});

// Get all Occupation Categories
const getOccupationCategories = asyncHandler(async (req, res, next) => {
    const categories = await OccupationCategory.find();
    if (!categories.length) return next(new ApiError("No categories found", 404));
    return res.status(200).json({ success: true, message: "Categories fetched successfully", data: categories });
});

// Update Occupation Category
const updateOccupationCategory = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const id = req.params.id;
    const category = await OccupationCategory.findById(id);
    if (!category) return next(new ApiError("Category not found", 404));

    const existingCategory = await OccupationCategory.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCategory && existingCategory._id.toString() !== id) return next(new ApiError("Category name already exists", 400));

    category.name = name || category.name;
    await category.save();
    return res.status(200).json({ success: true, message: "Category updated successfully", data: category });
});

// Delete Occupation Category and its Occupations
const deleteOccupationCategory = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    const category = await OccupationCategory.findById(id);
    if (!category) return next(new ApiError("Category not found", 404));

    await Occupation.deleteMany({ category: id });
    await OccupationCategory.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Category and its occupations deleted successfully" });
});

// Create Occupation
const createOccupation = asyncHandler(async (req, res, next) => {
    const { category, occupations } = req.body;
    if (!category) return next(new ApiError("Category is required", 400));
    if (!occupations || !Array.isArray(occupations) || occupations.length === 0) {
        return next(new ApiError("Occupations array is required and must not be empty", 400));
    }

    for (const occupation of occupations) {
        const { name } = occupation;
        if (!name) return next(new ApiError("Name is required for each occupation", 400));

        const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const existingOccupation = await Occupation.findOne({ name: { $regex: "^" + escapedName + "$", $options: "i" } });
        if (existingOccupation) return next(new ApiError(`Occupation '${name}' already exists`, 400));
    }

    const occupationsToInsert = occupations.map((occupation) => ({ category, name: occupation.name }));
    const createdOccupations = await Occupation.insertMany(occupationsToInsert);

    return res.status(201).json({ success: true, message: "Occupations created successfully", data: createdOccupations });
});

// Get all Occupations
const getOccupations = asyncHandler(async (req, res, next) => {
    const occupations = await Occupation.find().populate("category");
    if (!occupations.length) return next(new ApiError("No occupations found", 404));
    return res.status(200).json({ success: true, message: "Occupations fetched successfully", data: occupations });
});

// Update Occupation
const updateOccupation = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const id = req.params.id;
    const occupation = await Occupation.findById(id);

    if (!occupation) return next(new ApiError("Occupation not found", 404));

    const existingOccupation = await Occupation.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingOccupation && existingOccupation._id.toString() !== id) return next(new ApiError("Occupation name already exists", 400));

    occupation.name = name || occupation.name;
    await occupation.save();
    return res.status(200).json({ success: true, message: "Occupation updated successfully", data: occupation });
});

// Delete Occupation
const deleteOccupation = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    const occupation = await Occupation.findByIdAndDelete(id);
    if (!occupation) return next(new ApiError("Occupation not found", 404));
    return res.status(200).json({ success: true, message: "Occupation deleted successfully" });
});

// Get Occupations by Category ID
const getOccupationsByCategory = asyncHandler(async (req, res, next) => {
    const { categoryId } = req.params;
    const occupations = await Occupation.find({ category: categoryId }).populate("category");
    if (!occupations.length) return next(new ApiError("No occupations found for this category", 404));
    return res.status(200).json({ success: true, message: "Occupations fetched successfully", data: occupations });
});

module.exports = {
    createOccupationCategory,
    getOccupationCategories,
    updateOccupationCategory,
    deleteOccupationCategory,
    createOccupation,
    getOccupations,
    updateOccupation,
    deleteOccupation,
    getOccupationsByCategory
};
