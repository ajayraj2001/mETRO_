const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ApiError } = require("../../errorHandler");
const User = require("../../models/user");
const { getOtp } = require("../../utils");
const { STATIC_OTP, ACCESS_TOKEN_SECRET } = process.env;
const sendOtpEmail = require("../../utils/sendOtpToEmail"); // Assuming you have a function to send SMS as well

const signup = async (req, res, next) => {
  try {
    let { email, fullName, phone, profile_for } = req.body;

    // Validate required fields
    if (!email) return next(new ApiError("Email is required.", 400));
    if (!phone) return next(new ApiError("Phone is required.", 400));
    if (!fullName) return next(new ApiError("Full Name is required.", 400));
    if (!profile_for)
      return next(new ApiError("Profile for is required.", 400));

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

    // If the user exists but hasn't verified OTP, check the email as well
    if (existingUser && !existingUser.active) {
      const emailInUseByAnotherUser = await User.findOne({
        email: email,
        _id: { $ne: existingUser._id },
      });

      if (emailInUseByAnotherUser) {
        return next(
          new ApiError("This email is already in use by another user.", 400)
        );
      }

      // Resend OTP if the email is not in use by another user
      const otp = getOtp();
      const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

      existingUser.profile_for = profile_for;
      existingUser.fullName = fullName;
      existingUser.otp = otp;
      existingUser.otp_expiry = otpExpiry;

      await existingUser.save();

      // Resend OTP
      // sendOtp(existingUser.phone, otp);

      return res.status(200).json({
        success: true,
        message: `An OTP has been successfully sent to ****${existingUser.phone.slice(
          -4
        )}.`,
      });
    }

    // Check if the email is already in use by another user (exclude the current user by _id)
    existingUser = await User.findOne({ email: email });
    if (existingUser && !existingUser._id.equals(existingUser._id)) {
      return next(
        new ApiError("User is already registered with this email.", 400)
      );
    }

    // If the user doesn't exist, create a new user
    if (!existingUser) {
      const newUser = new User({
        email,
        fullName: fullName.trim(),
        phone,
        active: false,
      });

      // Generate OTP and set expiry
      const otp = getOtp();
      const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

      newUser.otp = otp;
      newUser.otp_expiry = otpExpiry;

      // Save the new user to the database
      await newUser.save();

      // Send OTP to user's phone
      // sendOtp(newUser.phone, otp);

      return res.status(201).json({
        success: true,
        message: `An OTP has been sent to the mobile ****${newUser.phone.slice(
          -4
        )}.`,
      });
    }

    // If we reach here, it means the email belongs to the current user, but other fields need to be updated
    // Update other fields as needed
    existingUser.fullName = fullName.trim();
    existingUser.phone = phone;

    // Generate new OTP and set expiry
    const otp = getOtp();
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

    existingUser.otp = otp;
    existingUser.otp_expiry = otpExpiry;

    // Save the updated user to the database
    await existingUser.save();

    // Resend OTP
    // sendOtp(existingUser.phone, otp);

    return res.status(200).json({
      success: true,
      message: `An OTP has been sent to the mobile ****${existingUser.phone.slice(
        -4
      )}.`,
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

const verifyOtpSignUp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Validate input
    if (!phone || !otp) return next(new ApiError("Phone and OTP are required.", 400));

    // Find the admin by phone or email
    const user = await User.findOne({ phone: phone });

    if (!user) return next(new ApiError("User not found", 404));

    // Validate OTP
    if (Date.now() > new Date(user.otp_expiry).getTime())
      return next(new ApiError("OTP expired", 400));

    if (user.otp !== otp && otp !== STATIC_OTP)
      return next(new ApiError("Invalid OTP", 400));

    user.active = true;

    user.save();

    // If OTP is valid, return success response
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    let { phone, email, loginType } = req.body;

    if (!loginType) return next(new ApiError("Login type is required.", 400));

    if (loginType === "phone") {
      if (!phone) return next(new ApiError("Phone is required.", 400));

      // Find the user by phone
      const user = await User.findOne({ phone, active: true });
      if (!user) return next(new ApiError("User not found with this phone.", 403));

      const otp = getOtp();
      const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

      user.otp = otp;
      user.otp_expiry = otpExpiry;

      user.save();

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

    // Validate input
    if (!phone || !otp) return next(new ApiError("Phone and OTP are required.", 400));

    // Find the admin by phone or email
    const user = await User.findOne({ phone: phone });
    if (!user) return next(new ApiError("User not found", 404));

    // Validate OTP
    if (Date.now() > new Date(user.otp_expiry).getTime())
      return next(new ApiError("OTP expired", 400));

    if (user.otp !== otp && otp !== STATIC_OTP)
      return next(new ApiError("Invalid OTP", 400));

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
};
