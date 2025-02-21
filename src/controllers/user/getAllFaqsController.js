const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Faq } = require("../../models");

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

module.exports = getFaqs;
