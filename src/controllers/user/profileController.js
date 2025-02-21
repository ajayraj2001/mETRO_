const { ApiError } = require("../../errorHandler");
const { getMultipleFilesUploader } = require("../../middlewares/multipleFileUpload");
const { deleteOldFile } = require("../../utils");
const User = require("../../models/user");
const { Country, State, City } = require("country-state-city");
const jwt = require("jsonwebtoken");
const parseDate = require("../../utils/parseDate");
const convertHeightToCM = require("../../utils/convertHeightToCM");
const { ACCESS_TOKEN_SECRET } = process.env;

const getCountries = async (req, res, next) => {
  try {
    const { searchTerm = "" } = req.body;

    let countries = Country.getAllCountries();

    if (searchTerm) {
      countries = countries.filter((country) =>
        country.name.toLowerCase().startsWith(searchTerm.toLowerCase())
      );
    }

    return res.status(200).json({
      success: true,
      message: "Country fetched successfully.",
      data: countries,
    });
  } catch (error) {
    console.log(error.message);
    next(error);
  }
};

const getStates = async (req, res, next) => {
  try {
    const { searchTerm, countryCode } = req.body; // pass isoCode in countryCode

    let states = State.getStatesOfCountry(countryCode);

    if (searchTerm) {
      states = states.filter((state) =>
        state.name.toLowerCase().startsWith(searchTerm.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      message: "State fetched successfully.",
      data: states,
    });
  } catch (error) {
    console.log(error.message);
    next(error);
  }
};

const getCities = async (req, res, next) => {
  try {
    const { searchTerm, countryCode, stateCode } = req.body; // pass isoCode in stateCode

    let cities = City.getCitiesOfState(countryCode, stateCode);
    if (searchTerm) {
      cities = cities.filter((city) =>
        city.name.toLowerCase().startsWith(searchTerm.toLowerCase())
      );
    }

    return res.status(200).json({
      success: true,
      message: "City fetched successfully.",
      data: cities,
    });
  } catch (error) {
    console.log(error.message);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password");
  try {
    return res.status(200).json({
      success: true,
      message: "User Profile",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Use the multiple files uploader for profile_image
const upload = getMultipleFilesUploader(["profile_image"], "uploads/user");

const updateProfile = async (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw new ApiError(error.message, 400);

      const userId = req.user._id;
      let { fullName, type, email, phone, heightInFeet, heightInInches, annual_income, dob, height, longitude, latitude, ...otherFields } = req.body;
      heightInFeet = +heightInFeet;
      heightInInches = +heightInInches;

      const user = await User.findById(userId).select("-password");
      console.log("user", user);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      if (type) {
        console.log("type");
        user.type = type;
        console.log("aftrer_user", user);
        console.log("aftrer_user_type", user.type);
      }
      if (fullName) user.fullName = fullName;
      // Check if email or phone is already in use by another user
      if (email) {
        const existingUser = await User.findOne({
          email,
          _id: { $ne: userId },
        });
        if (existingUser) {
          return next(new ApiError("Email is already in use by another account", 400));
        }
        user.email = email;
      }

      if (phone) {
        const existingUser = await User.findOne({
          phone,
          _id: { $ne: userId },
        });
        if (existingUser) {
          return next(new ApiError("Phone is already in use by another account", 400));
        }
        user.phone = phone;
      }

      if (dob) {
        const dateOfBirth = parseDate(dob);
        user.dob = dateOfBirth;
      }

      if (annual_income) user.annual_income = +annual_income;

      if (heightInFeet && heightInInches) {
        const heightData = convertHeightToCM(heightInFeet, heightInInches);
        const heightInCm = Math.round(parseFloat(heightData));
        user.height = `${heightInFeet} ft ${heightInInches} in`
        user.heightInCm = heightInCm;
      }

      // Update latitude and longitude if provided
      if (longitude && latitude) {
        user.location = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        };
      }

      // Update other fields if provided
      Object.assign(user, otherFields);

      // Handle profile images update
      if (req.files && req.files.profile_image) {
        // Check if the user is adding new images or updating existing ones
        if (user.profile_image && user.profile_image.length > 0) {
          const updatedImages = req.files.profile_image.map(
            (file) => file.path
          );

          if (req.body.imageIndex !== undefined) {
            // Update specific image by index
            const imageIndex = parseInt(req.body.imageIndex);
            if (imageIndex >= 0 && imageIndex < user.profile_image.length) {
              // Delete the old image at the specified index
              await deleteOldFile(user.profile_image[imageIndex]);

              // Replace the image at the specific index
              user.profile_image[imageIndex] = updatedImages[0];
            } else {
              return next(new ApiError("Invalid image index", 400));
            }
          } else {
            // Append new images to the existing array
            user.profile_image.push(...updatedImages);
          }
        } else {
          // Initial upload, or user previously had no images
          user.profile_image = req.files.profile_image.map((file) => file.path);
        }
      }

      // Save the updated user profile
      await user.save();

      if (user.profile_image.length > 0) {
        user.profileStatus = "Complete";
        await user.save();
      }

      const token = jwt.sign(
        { id: user._id, email: user.email },
        ACCESS_TOKEN_SECRET,
        {
          expiresIn: "180d",
        }
      );

      return res.status(200).json({
        success: true,
        message: "User profile updated.",
        data: {
          token,
          user,
        },
      });
    } catch (error) {
      // If an error occurs, delete the newly uploaded files
      if (req.files && req.files.profile_image) {
        for (const file of req.files.profile_image) {
          await deleteOldFile(file.path);
        }
      }
      next(error);
    }
  });
};

const deleteProfileImage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { imageIndex } = req.body;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (imageIndex >= 0 && imageIndex < user.profile_image.length) {
      // Delete the image file from the file system
      await deleteOldFile(user.profile_image[imageIndex]);

      // Remove the image from the array
      user.profile_image.splice(imageIndex, 1);

      // Save the updated user profile
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Profile image deleted successfully.",
        user,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid image index",
      });
    }
  } catch (error) {
    next(error);
  }
};

const deleteProfile = async (req, res, next) => {
  const userId = req.user._id;

  await User.findByIdAndUpdate(userId, { active : false });

  return res.status(200).json({
    success: true,
    message: "You have successfully deleted your profile."
  });

}

module.exports = {
  getCountries,
  getStates,
  getCities,
  getProfile,
  updateProfile,
  deleteProfileImage,
  deleteProfile
};
