const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Faq } = require("../../models");

const createFaq = asyncHandler(async (req, res, next) => {
  const { query, answer } = req.body;

  if (!query || !answer)
    return next(new ApiError("Both query and answer are required", 400));

  const faq = await Faq.create({ query, answer });

  return res.status(201).json({
    success: true,
    message: "FAQ created successfully",
    data: faq,
  });
});

const getFaqs = asyncHandler(async (req, res, next) => {
  const faqs = await Faq.find();

  if (!faqs || faqs.length === 0)
    return next(new ApiError("No FAQs found", 404));

  return res.status(200).json({
    success: true,
    message: "FAQs fetched successfully",
    data: faqs,
  });
});


const updateFaq = asyncHandler(async (req, res, next) => {
  const { query, answer } = req.body;
  const id = req.params.id;

  const faq = await Faq.findById(id);

  if (!faq) return next(new ApiError("FAQ not found", 404));

  faq.query = query || faq.query;
  faq.answer = answer || faq.answer;

  await faq.save();

  return res.status(200).json({
    success: true,
    message: "FAQ updated successfully",
    data: faq,
  });
});


const deleteFaq = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const faq = await Faq.findByIdAndDelete(id);

  if (!faq) return next(new ApiError("FAQ not found", 404));

  return res.status(200).json({
    success: true,
    message: "FAQ deleted successfully",
  });
});

module.exports = {
  createFaq,
  getFaqs,
  updateFaq,
  deleteFaq,
};
