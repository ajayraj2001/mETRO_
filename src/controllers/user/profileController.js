const { ApiError } = require("../../errorHandler");
const { getMultipleFilesUploader } = require("../../middlewares/multipleFileUpload");
const { deleteOldFile } = require("../../utils");
const {User, Message, Notification} = require("../../models");
const { Country, State, City } = require("country-state-city");
const jwt = require("jsonwebtoken");
const parseDate = require("../../utils/parseDate");
const { ACCESS_TOKEN_SECRET } = process.env;
const asyncHandler = require('../../utils/asyncHandler')
const mongoose = require('mongoose')

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
    const { searchTerm } = req.body; // pass isoCode in countryCode
    const countryCode = "IN"

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
    const { searchTerm, stateCode } = req.body; // pass isoCode in stateCode
    const countryCode = "IN"

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
  try {
    const user = await User.findById(req.user._id)
      .select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User Profile",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const parseAnnualIncome = (annual_income) => {
  console.log('annual income', annual_income)
  const match = annual_income.match(/(\d+)(?:\s*Lakh|\s*Crore)?/gi);
  if (!match) return [0, 0]; // If no numbers found, return default values

  let min_salary = 0;
  let max_salary = 0;

  if (match.length >= 1) {
    min_salary = parseInt(match[0]) || 0;
    if (annual_income.includes("Crore")) {
      min_salary *= 100; // Convert Crore to Lakh (1 Crore = 100 Lakh)
    }
  }

  if (match.length >= 2) {
    max_salary = parseInt(match[1]) || min_salary;
    if (annual_income.includes("Crore")) {
      max_salary *= 100; // Convert Crore to Lakh
    }
  } else {
    max_salary = min_salary;
  }

  return [min_salary * 100000, max_salary * 100000]; // Convert Lakh to Rupees
};

// Use the multiple files uploader for profile_image
const upload = getMultipleFilesUploader(["profile_image"], "user");

const updateProfile = async (req, res, next) => {
  upload(req, res, async (error) => {
    try {
      if (error) throw new ApiError(error.message, 400);

      const userId = req.user._id;
      let { fullName, type, email, phone, height, annual_income, dob, country, state, stateCode, city, longitude, latitude, heightInCm,
        religion, sect, jammat, caste, occupation, highest_education, course, mother_tongue, living_with_family, diet, ...otherFields } = req.body;

      let min_salary, max_salary
      if (annual_income) {
        [min_salary, max_salary] = parseAnnualIncome(annual_income);
      }

      const user = await User.findById(userId).select("-password");


      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      if (type) {
        user.type = type;
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

      if (annual_income) {
        user.annual_income = annual_income;
        user.min_salary = min_salary;
        user.max_salary = max_salary;
      }
      if (country) {
        user.country = country;
      }
      if (state) {
        user.state = state; //ajay
        user.stateCode = stateCode; //ajay
      }
      if (city) {
        user.city = city;
      }

      if (height) {
        user.height = height
        user.heightInCm = Math.round(heightInCm);
      }

      // Update latitude and longitude if provided
      if (longitude && latitude) {
        user.location = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        };
      }

      // Religion field
      if (occupation) {
        user.occupation = occupation;
      }
      if (highest_education) {
        user.highest_education = highest_education;
      }
      if (course) {
        user.course = course;
      }
      if (mother_tongue) {
        user.mother_tongue = mother_tongue;
      }
      if (living_with_family) {
        user.living_with_family = living_with_family;
      }
      if (diet) {
        user.diet = diet;
      }

      if (religion !== undefined) {
        user.religion = religion;
      }

      // Sect field
      if (sect !== undefined) {
        user.sect = sect;
      }

      // Jammat field
      if (jammat !== undefined) {
        user.jammat = jammat;
      }

      // Caste field
      if (caste !== undefined) {
        user.caste = caste;
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

    const user = await User.findById(userId).select("id  profile_image");

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

  try {
    const user = await User.findById(userId).select("profile_image");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all profile images from the file system
    if (user.profile_image && user.profile_image.length > 0) {
      for (const imagePath of user.profile_image) {
        await deleteOldFile(imagePath); // This should be your file system delete function
      }
    }

    // Mark user as inactive and clear the profile_image array
    await User.findByIdAndUpdate(userId, {
      active: false,
      permanentlyDeleted: true,
      profile_image: [],
    });

    return res.status(200).json({
      success: true,
      message: "You have successfully deleted your account",
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCounts = asyncHandler(async (req, res, next) => {
  const  userId  = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, message: "Invalid userId" });
  }

  const [unreadMessageCount, unreadNotificationCount] = await Promise.all([
    Message.countDocuments({
      recipient: new mongoose.Types.ObjectId(userId),
      isRead: false
    }),
    Notification.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      isRead: false
    })
  ]);

  res.status(200).json({
    success: true,
    message: "Unread counts fetched successfully",
    data: {
      unreadMessageCount,
      unreadNotificationCount
    }
  });
});

module.exports = {
  getCountries,
  getStates,
  getCities,
  getProfile,
  updateProfile,
  deleteProfileImage,
  deleteProfile,
  getUnreadCounts
};
