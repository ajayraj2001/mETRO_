const jwt = require("jsonwebtoken");

const Admin = require("../../models/admin");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { deleteOldFile } = require("../../utils");

const { ACCESS_TOKEN_SECRET } = process.env;

const updateAdmin = asyncHandler(async (req, res, next) => {
  const { phone, email, name } = req.body;

  const adminId = req.admin._id;

  const admin = await Admin.findById(adminId);

  if (!admin) return next(new ApiError("Admin not found.", 404));

  if (phone) admin.phone = phone;
  if (email) admin.email = email;
  if (name) admin.name = name;

  console.log("😁😉😎😉", req.file.profile_image)
  //console.log("❤💖🤞✨", admin)

  if (req.file && req.file.profile_image) {
    if(admin.profile_image) {
        await deleteOldFile(admin.profile_image);
    }
    //admin.profile_image = req.file.profile_image;
  }

  await admin.save();

  const token = jwt.sign(
    { _id: admin._id, email: admin.email },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: "180d",
    }
  );

  return res.status(200).json({
    success: true,
    message: "Admin profile updated.",
    token,
  });
});

module.exports = { updateAdmin };
