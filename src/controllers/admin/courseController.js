const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { CourseCategory, Course } = require("../../models");

// Create Course Category
const createCourseCategory = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    if (!name) return next(new ApiError("Category name is required", 400));

    const existingCategory = await CourseCategory.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCategory) return next(new ApiError("Category already exists", 400));

    const category = await CourseCategory.create({ name });
    return res.status(201).json({ success: true, message: "Category created successfully", data: category });
});

// Get all Course Categories
const getCourseCategories = asyncHandler(async (req, res, next) => {
    const categories = await CourseCategory.find();
    if (!categories.length) return next(new ApiError("No categories found", 404));
    return res.status(200).json({ success: true, message: "Categories fetched successfully", data: categories });
});

// Update Course Category
const updateCourseCategory = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const id = req.params.id;

    const category = await CourseCategory.findById(id);
    if (!category) return next(new ApiError("Category not found", 404));

    const existingCategory = await CourseCategory.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCategory && existingCategory._id.toString() !== id) return next(new ApiError("Category name already exists", 400));

    category.name = name || category.name;
    await category.save();
    return res.status(200).json({ success: true, message: "Category updated successfully", data: category });
});

// Delete Course Category and its Courses
const deleteCourseCategory = asyncHandler(async (req, res, next) => {
    const id = req.params.id;

    const category = await CourseCategory.findById(id);
    if (!category) return next(new ApiError("Category not found", 404));

    await Course.deleteMany({ category: id });
    await CourseCategory.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Category and its courses deleted successfully" });
});

// Create Course
const createCourse = asyncHandler(async (req, res, next) => {
    const { category, name } = req.body;
    if (!category || !name) return next(new ApiError("Category and name are required", 400));

    const existingCourse = await Course.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCourse) return next(new ApiError("Course already exists", 400));

    const course = await Course.create({ category, name });
    return res.status(201).json({ success: true, message: "Course created successfully", data: course });
});

// Get all Courses
const getCourses = asyncHandler(async (req, res, next) => {
    const courses = await Course.find().populate("category");
    if (!courses.length) return next(new ApiError("No courses found", 404));
    return res.status(200).json({ success: true, message: "Courses fetched successfully", data: courses });
});

// Update Course
const updateCourse = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    const id = req.params.id;
    const course = await Course.findById(id);

    if (!course) return next(new ApiError("Course not found", 404));

    const existingCourse = await Course.findOne({ name: new RegExp("^" + name + "$", "i") });
    if (existingCourse && existingCourse._id.toString() !== id) return next(new ApiError("Course name already exists", 400));

    course.name = name || course.name;
    await course.save();
    return res.status(200).json({ success: true, message: "Course updated successfully", data: course });
});

// Delete Course
const deleteCourse = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    const course = await Course.findByIdAndDelete(id);
    if (!course) return next(new ApiError("Course not found", 404));
    return res.status(200).json({ success: true, message: "Course deleted successfully" });
});

// Get Courses by Category ID
const getCoursesByCategory = asyncHandler(async (req, res, next) => {
    const { categoryId } = req.params;
    const courses = await Course.find({ category: categoryId }).populate("category");
    if (!courses.length) return next(new ApiError("No courses found for this category", 404));
    return res.status(200).json({ success: true, message: "Courses fetched successfully", data: courses });
  });

module.exports = {
    createCourseCategory,
    getCourseCategories,
    updateCourseCategory,
    deleteCourseCategory,
    createCourse,
    getCourses,
    updateCourse,
    deleteCourse,
    getCoursesByCategory
};
