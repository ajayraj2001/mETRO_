const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ApiError } = require("../../errorHandler");
const User = require("../../models/user");
const { getOtp } = require("../../utils");
const { STATIC_OTP, ACCESS_TOKEN_SECRET } = process.env;
const sendOtpEmail = require("../../utils/sendOtpToEmail"); // Assuming you have a function to send SMS as well
const sendOTP = require("../../utils/sendOtpToPhone"); // Assuming you have a function to send SMS as well


const updateStatusByPhone = async (req, res, next) => {
  try {
    const {active } = req.body;


    const phone = "8178925920"
    // if (!phone || !['Active', 'Inactive'].includes(status)) {
    //   return res.status(400).json({ message: 'Invalid phone or status' });
    // }

    const user = await User.findOneAndUpdate(
      { phone },
      { active },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Status updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to generate unique profileId
const generateProfileId = async () => {
  const prefix = 'JD'; // JODI4EVER prefix
  let isUnique = false;
  let profileId = '';

  while (!isUnique) {
    // Generate random 8-digit number
    const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
    profileId = `${prefix}${randomNumber}`;

    // Check if this profileId already exists
    const existingUser = await User.findOne({ profileId });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return profileId;
};

const signup = async (req, res, next) => {
  try {
    let { email, fullName, phone, profile_for, source } = req.body;

    console.log('req/ody', req.body)
    // Validate required fields
    if (!email) return next(new ApiError("Email is required.", 400));
    if (!phone) return next(new ApiError("Phone is required.", 400));
    if (!fullName) return next(new ApiError("Full Name is required.", 400));
    if (!profile_for) return next(new ApiError("Profile for is required.", 400));

    // Trim inputs
    email = String(email).trim();

    // Validate phone number format
    if (
      phone &&
      (isNaN(phone) ||
        phone.includes("e") ||
        phone.includes(".") ||
        phone.length !== 10)
    ) {
      return next(new ApiError("Invalid phone number format.", 400));
    }

    // Check if the user exists by phone number
    let existingUser = await User.findOne({ phone: phone });

    if (existingUser?.permanentlyDeleted) {
      return next(new ApiError("This account has been permanently deleted. Please contact support.", 400));
    }

    // If user exists and is active, return an error
    if (existingUser && existingUser.active) {
      return next(new ApiError("This number is already registered. Try logging in.", 400));
    }

    // If the user exists but hasn't verified OTP, check the email as well
    // if (existingUser && !existingUser.active) {
    if (existingUser && !existingUser.active) {

      const emailInUseByAnotherUser = await User.findOne({
        email: email,
        _id: { $ne: existingUser._id },
      });

      if (emailInUseByAnotherUser) {
        return next(
          new ApiError("This email is already registered with another account.", 400)
        );
      }

      // Resend OTP if the email is not in use by another user
      const otp = getOtp();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      existingUser.profile_for = profile_for;
      existingUser.fullName = fullName;
      existingUser.otp = otp;
      existingUser.otp_expiry = otpExpiry;

      await existingUser.save();

      // Resend OTP
      sendOTP(existingUser.phone, otp)

      return res.status(200).json({
        success: true,
        message: `An OTP has been successfully sent to ****${existingUser.phone.slice(
          -4
        )}.`,
      });
    }

    // Check if the email is already in use by another user (exclude the current user by _id)
    existingUser = await User.findOne({ email: email });

    if (existingUser?.permanentlyDeleted) {
      return next(new ApiError("This account has been permanently deleted. Please contact support.", 400));
    }

    // if (existingUser && !existingUser._id.equals(existingUser._id)) {
    if (existingUser) {
      return next(new ApiError("This email is already registered with another account.", 400));
    }

    // If the user doesn't exist, create a new user
    // if (!existingUser) {

    const newUser = new User({
      email,
      profile_for,
      fullName: fullName.trim(),
      phone,
      active: false,
      source
    });

    // Generate OTP and set expiry
    const otp = getOtp();
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

    newUser.otp = otp;
    newUser.otp_expiry = otpExpiry;

    // Save the new user to the database
    await newUser.save();

    // Send OTP to user's phone
    sendOTP(newUser.phone, otp)

    return res.status(201).json({
      success: true,
      message: `An OTP has been sent to the mobile ****${newUser.phone.slice(
        -4
      )}.`,
    });
    // }

  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

const verifyOtpSignUp = async (req, res, next) => {
  try {
    const { phone, otp, deviceId, deviceToken } = req.body;

    console.log('req.nody_singup', req.body)

    // Validate input
    if (!phone) return next(new ApiError("Phone is required.", 400));
    if (!otp) return next(new ApiError("OTP is required.", 400));

    // Find the admin by phone or email
    const user = await User.findOne({ phone: phone });

    if (!user) return next(new ApiError("User not found", 404));

    // Validate OTP
    if (Date.now() > new Date(user.otp_expiry).getTime())
      return next(new ApiError("OTP expired", 400));

    const allowedStaticOtpNumbers = ["9899981720", "8178925920", "7056702795"];

    // Allow static OTP only for 9899981720
    if (allowedStaticOtpNumbers.includes(phone)) {
      if (otp != STATIC_OTP) {
        return next(new ApiError("Invalid OTP", 400));
      }
    } else {
      if (user.otp != otp) {
        return next(new ApiError("Invalid OTP", 400));
      }
    }

    // Generate profileId only if user doesn't have one (first-time verification)
    if (!user.profileId) {
      user.profileId = await generateProfileId();
    }

    user.active = true;
    user.deviceId = deviceId;
    user.deviceToken = deviceToken;

    user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      ACCESS_TOKEN_SECRET,
      {
        expiresIn: "180d",
      }
    );

    // If OTP is valid, return success response
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user
      //       user: {
      // ...user.toObject(),
      // profileId: user.profileId // Ensure profileId is included in response
      // }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    let { phone, email, loginType = "phone" } = req.body;

    if (!loginType) return next(new ApiError("Login type is required.", 400));

    if (loginType === "phone") {
      if (!phone) return next(new ApiError("Phone is required.", 400));

      // Find the user by phone
      const user = await User.findOne({ phone });

      if (user?.permanentlyDeleted) {
        return next(new ApiError("This account has been permanently deleted. Please contact support.", 403));
      }

      if (!user || !user.active) {
        return next(new ApiError("User not found with this number.", 403));
      }

      if (!user) return next(new ApiError("User not found with this number.", 403));

      const otp = getOtp();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = otp;
      user.otp_expiry = otpExpiry;

      user.save();

      // Resend OTP
      sendOTP(user.phone, otp)

      return res.status(200).json({
        success: true,
        message: `An OTP has been successfully sent to the mobile ****${user.phone.slice(
          -4
        )}.`,
      });
    } else if (loginType === "social") {
      if (!email)
        return next(new ApiError("Email is required for social login.", 400));

      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) return next(new ApiError("User not found with this email.", 403));

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, {
        expiresIn: "180d",
      });

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        token,
      });

    } else {
      return next(new ApiError("Invalid login type.", 400));
    }
  } catch (error) {
    next(error);
  }
};

const verifyOtpLogin = async (req, res, next) => {
  try {
    const { phone, otp, deviceId, deviceToken } = req.body;

     console.log('req.body_login', req.body)
    // Validate input
    if (!phone) return next(new ApiError("Phone is required.", 400));
    if (!otp) return next(new ApiError("OTP is required.", 400));

    // Find the admin by phone or email
    const user = await User.findOne({ phone: phone });
    if (!user) return next(new ApiError("User not found", 404));
    // Validate OTP
    if (Date.now() > new Date(user.otp_expiry).getTime()) {
      return next(new ApiError("OTP expired", 400));

    }

    const allowedStaticOtpNumbers = ["9899981720", "8178925920", "7056702795"];
    // Allow static OTP only for 9899981720

    if (allowedStaticOtpNumbers.includes(phone)) {
      if (otp != STATIC_OTP) {
        return next(new ApiError("Invalid OTP", 400));
      }
    } else {
      if (user.otp != otp) {
        return next(new ApiError("Invalid OTP", 400));
      }
    }

    user.active = true;
    user.deviceId = deviceId;
    user.deviceToken = deviceToken;

    await user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      ACCESS_TOKEN_SECRET,
      {
        expiresIn: "180d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "You have Successfully Logged in.",
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ApiError("Email is required.", 400));

    // Find the user by either phone or email
    const user = await User.findOne({
      email: email,
    });

    if (!user) return next(new ApiError("User not found with this email", 404));

    const otp = getOtp();
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

    // Save the OTP and its expiry time
    user.otp = otp;
    user.otp_expiry = otpExpiry;
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: `OTP has been sent to your registered email address ${user.email}`,
      data: {
        email: user.email,
        otpExpiry: user.otp_expiry,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    // Validate input
    if (!email || !newPassword)
      return next(new ApiError("Email and new password are required.", 400));

    // Find the admin by email
    const user = await User.findOne({ email });
    if (!user) return next(new ApiError("User not found.", 400));

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the admin's password
    user.password = hashedPassword;
    user.otp = null;
    user.otp_expiry = null;
    await user.save();

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  verifyOtpSignUp,
  login,
  verifyOtpLogin,
  forgotPassword,
  resetPassword,
  updateStatusByPhone
};
