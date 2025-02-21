const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { TermsPrivacyAbout } = require("../../models");


const createDetails = asyncHandler(async (req, res, next) => {
  const { privacyPolicyDetails, termConditionDetails, aboutUsDetails } =
    req.body;

  const newDetails = await TermsPrivacyAbout.create({
    privacyPolicyDetails,
    termConditionDetails,
    aboutUsDetails,
  });

  return res.status(201).json({
    success: true,
    message: "Details created successfully",
    data: newDetails,
  });
});


const updateDetails = asyncHandler(async (req, res, next) => {
  const { privacyPolicyDetails, termConditionDetails, aboutUsDetails }  = req.body;
  const obj = {};

  if(privacyPolicyDetails) obj.privacyPolicyDetails = privacyPolicyDetails;
  if(termConditionDetails) obj.termConditionDetails = termConditionDetails;
  if(aboutUsDetails) obj.aboutUsDetails = aboutUsDetails;

  const updatedDetails = await TermsPrivacyAbout.findByIdAndUpdate(
    "6703928443bcc438e88efb9b",
    obj,
    { new: true, runValidators: false }
  );

  if (!updatedDetails) {
    return next(new ApiError("Details not found", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Details updated successfully",
    data: updatedDetails,
  });
});


const getPrivacyPolicy = asyncHandler(async (req, res, next) => {

  const details = await TermsPrivacyAbout.findById("6703928443bcc438e88efb9b");

  if (!details) {
    return next(new ApiError("Details not found", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Details fetched successfully",
    data: details.privacyPolicyDetails,
  });

});

const getTermsAndCOndition = asyncHandler(async (req, res, next) => {

  const details = await TermsPrivacyAbout.findById("6703928443bcc438e88efb9b");

  if (!details) {
    return next(new ApiError("Details not found", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Details fetched successfully",
    data: details.termConditionDetails,
  });

});

module.exports = {
  createDetails,
  updateDetails,
  getPrivacyPolicy,
  getTermsAndCOndition
};
