const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;

const { TermsPrivacyAbout } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const getDetailsById = asyncHandler(async (req, res, next) => {
  const details = await TermsPrivacyAbout.findById("6703928443bcc438e88efb9b");

  if (!details) {
    return next(new ApiError("Details not found", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Details fetched successfully",
    data: details,
  });
});

module.exports = getDetailsById;
