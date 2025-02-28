const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const {Language} = require("../../models"); // Adjust the path as necessary

// Create Language
const createLanguage = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    if (!name) return next(new ApiError("Language name is required", 400));

    const existingLanguage = await Language.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingLanguage) return next(new ApiError("Language already exists", 400));

    const language = await Language.create({ name });
    return res.status(201).json({ success: true, message: "Language created successfully", data: language });
});

// Get all Languages
const getLanguages = asyncHandler(async (req, res, next) => {
    const languages = await Language.find();
    if (!languages.length) return next(new ApiError("No languages found", 404));
    return res.status(200).json({ success: true, message: "Languages fetched successfully", data: languages });
});

// Update Language
const updateLanguage = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const id = req.params.id;

    const language = await Language.findById(id);
    if (!language) return next(new ApiError("Language not found", 404));

    const existingLanguage = await Language.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingLanguage && existingLanguage._id.toString() !== id) return next(new ApiError("Language name already exists", 400));

    language.name = name || language.name;
    await language.save();
    return res.status(200).json({ success: true, message: "Language updated successfully", data: language });
});

// Delete Language
const deleteLanguage = asyncHandler(async (req, res, next) => {
    const id = req.params.id;

    const language = await Language.findById(id);
    if (!language) return next(new ApiError("Language not found", 404));

    await Language.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Language deleted successfully" });
});

module.exports = {
    createLanguage,
    getLanguages,
    updateLanguage,
    deleteLanguage
};