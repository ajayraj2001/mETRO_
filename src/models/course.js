const mongoose = require("mongoose");

const courseCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const courseSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: "CourseCategory", required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const CourseCategory = mongoose.model("CourseCategory", courseCategorySchema);
const Course = mongoose.model("Course", courseSchema);

module.exports = { CourseCategory, Course };
