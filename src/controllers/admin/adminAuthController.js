const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../../models/admin");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const { ACCESS_TOKEN_SECRET } = process.env;

const registerAdmin = asyncHandler(async (req, res, next) => {
  const { name, phone, email, password } = req.body;

  if (!name) {
    return next(new ApiError("Name is required.", 400));
  }

  if (!phone || phone.length != 10) {
    return next(new ApiError("Enter a valid phone number.", 400));
  }

  if (!email || validator.isEmail(email) === false) {
    return next(new ApiError("Enter a valid email address.", 400));
  }

  if (!password) {
    return next(new ApiError("Password is required.", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    name,
    phone,
    email,
    password: hashedPassword,
    //passwordChangedAt: Date.now(),
  });

  res.status(201).json({
    success: true,
    message: "Admin created successfully.",
  });
});

const logInAdmin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || validator.isEmail(email) === false) {
    return next(new ApiError("Enter a valid email address.", 400));
  }

  if (!password) return next(new ApiError("Password is required.", 400));

  const admin = await Admin.findOne({ email });
  //const admin = (await Admin.findOne({ email })) || (await Admin.findOne({ phone }));

  if (!admin) return next(new ApiError("Not a valid user.", 400));

  const match = await bcrypt.compare(password, admin.password);

  if (!match) return next(new ApiError("Invalid Credential.", 403));

  const token = jwt.sign(
    { _id: admin._id, email: admin.email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "180d" }
  );

  res.status(201).json({
    success: true,
    message: "You have logged in successfully.",
    token,
  });
});

module.exports = {
  registerAdmin,
  logInAdmin,
};
