const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const { ApiError } = require("../../errorHandler");
const PartnerPreferences = require("../../models/partnerPreference");
const User = require("../../models/user");
const {UserSubscription} = require("../../models")
const ProfileVisit = require("../../models/profileVisit");
const SeenContact = require("../../models/seenContact");
const calculateAge = require("../../utils/calculateAge");
const parseDate = require("../../utils/parseDate");
const haversineDistance = require("../../utils/haversineDistance");
const convertHeightToCM = require("../../utils/convertHeightToCM");

const partnerPreferences = async (req, res, next) => {
  try {
    const {
      min_age,
      max_age,
      min_height_in_feet,
      min_height_in_inches,
      max_height_in_feet,
      max_height_in_inches,
      gender,
      marital_status,
      religion,
      caste,
      mother_tongue,
      country,
      residential_status,
      manglik,
      highest_education,
      employed_in,
      occupation,
      annual_income,
      thoughts_on_horoscope,
    } = req.body;

    const user_id = req.user._id;

    // Check if a document already exists for the user
    const existingPreferences = await PartnerPreferences.findOne({ user_id });

    if (existingPreferences) {
      // Update only the provided fields
      const [min_salary, max_salary] = annual_income.split("-");
      existingPreferences.set({
        min_age: min_age !== undefined ? min_age : existingPreferences.min_age,
        max_age: max_age !== undefined ? max_age : existingPreferences.max_age,
        min_salary:
          min_salary !== undefined
            ? min_salary
            : existingPreferences.min_salary,
        max_salary:
          max_salary !== undefined
            ? max_salary
            : existingPreferences.max_salary,

        min_height:
          min_height_in_feet !== undefined && min_height_in_inches !== undefined
            ? `${min_height_in_feet} ft ${min_height_in_inches} in`
            : existingPreferences.min_height,

        max_height:
          max_height_in_feet !== undefined && max_height_in_inches !== undefined
            ? `${max_height_in_feet} ft ${max_height_in_inches} in`
            : existingPreferences.max_height,

        gender: gender !== undefined ? gender : existingPreferences.gender,
        marital_status:
          marital_status !== undefined
            ? marital_status
            : existingPreferences.marital_status,
        religion:
          religion !== undefined ? religion : existingPreferences.religion,
        caste: caste !== undefined ? caste : existingPreferences.caste,
        mother_tongue:
          mother_tongue !== undefined
            ? mother_tongue
            : existingPreferences.mother_tongue,
        country: country !== undefined ? country : existingPreferences.country,
        residential_status:
          residential_status !== undefined
            ? residential_status
            : existingPreferences.residential_status,
        manglik: manglik !== undefined ? manglik : existingPreferences.manglik,
        highest_education:
          highest_education !== undefined
            ? highest_education
            : existingPreferences.highest_education,
        employed_in:
          employed_in !== undefined
            ? employed_in
            : existingPreferences.employed_in,
        occupation:
          occupation !== undefined
            ? occupation
            : existingPreferences.occupation,
        annual_income:
          annual_income !== undefined
            ? annual_income
            : existingPreferences.annual_income,
        thoughts_on_horoscope:
          thoughts_on_horoscope !== undefined
            ? thoughts_on_horoscope
            : existingPreferences.thoughts_on_horoscope,
      });

      if (min_height_in_feet && min_height_in_inches) {
        const minHeightData = convertHeightToCM(
          +min_height_in_feet,
          +min_height_in_inches
        );
        const minHeightInCm = Math.round(parseFloat(minHeightData));
        existingPreferences.min_height_in_cm = minHeightInCm;
      }

      if (max_height_in_feet && max_height_in_inches) {
        const maxHeightData = convertHeightToCM(
          +max_height_in_feet,
          +max_height_in_inches
        );
        const maxHeightInCm = Math.round(parseFloat(maxHeightData));
        existingPreferences.max_height_in_cm = maxHeightInCm;
      }

      // Save the updated document
      await existingPreferences.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        message: "Partner preferences updated successfully",
        data: existingPreferences,
      });
    } else {
      // Create a new document
      if (
        !min_age ||
        !max_age ||
        !min_height_in_feet ||
        !min_height_in_inches ||
        !max_height_in_feet ||
        !max_height_in_inches ||
        !gender ||
        !marital_status ||
        !religion ||
        !caste ||
        !mother_tongue ||
        !country ||
        !residential_status ||
        !manglik ||
        !highest_education ||
        !employed_in ||
        !occupation ||
        !annual_income ||
        !thoughts_on_horoscope
      ) {
        return next(new ApiError("All fields are required", 400));
      }

      const [min_salary, max_salary] = annual_income.split("-");

      const newPreferences = new PartnerPreferences({
        user_id,
        min_age,
        max_age,
        min_height: `${min_height_in_feet} ft ${min_height_in_inches} in`,
        max_height: `${max_height_in_feet} ft ${max_height_in_inches} in`,
        gender,
        marital_status,
        religion,
        caste,
        mother_tongue,
        country,
        residential_status,
        manglik,
        highest_education,
        employed_in,
        occupation,
        annual_income,
        min_salary,
        max_salary,
        thoughts_on_horoscope,
      });

      if (min_height_in_feet && min_height_in_inches) {
        const minHeightData = convertHeightToCM(
          +min_height_in_feet,
          +min_height_in_inches
        );
        const minHeightInCm = Math.round(parseFloat(minHeightData));
        newPreferences.min_height_in_cm = minHeightInCm;
      }

      if (max_height_in_feet && max_height_in_inches) {
        const maxHeightData = convertHeightToCM(
          +max_height_in_feet,
          +max_height_in_inches
        );
        const maxHeightInCm = Math.round(parseFloat(maxHeightData));
        newPreferences.max_height_in_cm = maxHeightInCm;
      }

      // Save the new document
      const savedPreferences = await newPreferences.save();

      return res.status(201).json({
        success: true,
        message: "Partner preferences created successfully",
        data: savedPreferences,
      });
    }
  } catch (error) {
    console.log("Error handling partner preferences:", error);
    return res.status(500).json({ success: true, message: error.message });
  }
};

const getPreference = async (req, res, next) => {
  try {
    const user_id = req.user._id;

    // Check if a document already exists for the user
    const preference = await PartnerPreferences.findOne({ user_id });

    if (!preference) {
      return res.status(404).json({
        success: false,
        message: "No preferences found for this user.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Preference found successfully",
      data: preference,
    });
  } catch (error) {
    next(error);
  }
};
//by nikhil
// const matchedUsers = async (req, res, next) => {
//   try {
//     const { startDate, endDate, searchTerm } = req.body;
//     const user_id = req.user._id;
//     const preferences = await PartnerPreferences.findOne({ user_id });

//     if (!preferences)
//       return next(new ApiError("No preferences found for this user.", 404));

//     let start, end;
//     if (startDate && endDate) {
//       start = parseDate(startDate);
//       start.setHours(0, 0, 0, 0); // Set start date to the beginning of the day

//       end = parseDate(endDate);
//       end.setHours(23, 59, 59, 999); // Set end date to the end of the day
//     }

//     const {
//       min_age,
//       max_age,
//       min_height_in_cm,
//       max_height_in_cm,
//       min_salary,
//       max_salary,
//       gender,
//       marital_status,
//       religion,
//       caste,
//       mother_tongue,
//       country,
//       residential_status,
//       manglik,
//       highest_education,
//       annual_income,
//     } = preferences;

//     // Get the current date for age calculation
//     const currentDate = new Date();

//     const query = {
//       _id: { $ne: user_id },
//       dob: {
//         $gte: new Date(
//           currentDate.getFullYear() - max_age,
//           currentDate.getMonth(),
//           currentDate.getDate()
//         ),
//         $lte: new Date(
//           currentDate.getFullYear() - min_age,
//           currentDate.getMonth(),
//           currentDate.getDate()
//         ),
//       },
//       heightInCm: { $gte: min_height_in_cm, $lte: max_height_in_cm },
//       annual_income: { $gte: min_salary, $lte: max_salary },
//       gender: gender,
//       //manglik: manglik
//     };

//     // Add religion filter if it's not "Any"
//     if (religion && religion !== "Any") {
//       query.religion = religion;
//     }

//     // if (marital_status && marital_status !== "Any") {
//     //   query.marital_status = marital_status;
//     // }

//     if (start && end) {
//       query.created_at = {
//         $gte: start,
//         $lte: end,
//       };
//     }

//     if (searchTerm) {
//       query.fullName = { $regex: searchTerm, $options: "i" };
//     }

//     // Find users matching the preferences
//     const matchedUsers = await User.find(query);

//     const currentTime = moment().tz("Asia/Kolkata");

//     if (!matchedUsers || matchedUsers.length === 0)
//       return next(new ApiError("No match found for this user.", 404));

//     const usersWithDistances = matchedUsers.map((user) => {
//       const currentUserLocation = req.user?.location?.coordinates;
//       const matchedUserLocation = user?.location?.coordinates;

//       const distance =
//         currentUserLocation && matchedUserLocation
//           ? haversineDistance(
//               currentUserLocation,
//               matchedUserLocation
//             )?.toFixed(2)
//           : null;

//       const age = calculateAge(user.dob);

//       const isVerified = user.subscriptionExpiryDate
//         ? moment(user.subscriptionExpiryDate)
//             .tz("Asia/Kolkata")
//             .isAfter(currentTime)
//         : false;

//       return {
//         _id: user._id,
//         profile_for: user.profile_for,
//         email: user.email,
//         fullName: user.fullName,
//         phone: user.phone,
//         profile_image: user.profile_image,
//         height: user.height,
//         state: user.state,
//         city: user.city,
//         highest_education: user.highest_education,
//         annual_income: user.annual_income,
//         marital_status: user.marital_status,
//         caste: user.caste,
//         occupation: user.occupation,
//         distance: distance,
//         age: age,
//         isVerified,
//         profileVisibility: user.features.profileVisibility, // Add profile visibility
//         created_at: user.created_at, // Include creation date for sorting
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Matching users found.",
//       data: usersWithDistances,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const matchedUsers = async (req, res, next) => {
  try {
    const { 
      startDate, 
      endDate, 
      searchTerm, 
      page = 1, 
      limit = 10 
    } = req.body;
    const user_id = req.user._id;
    
    // Validate page and limit
    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNumber - 1) * pageSize;
    
    // Find user's current subscription
    const userSubscription = await UserSubscription.findOne({ 
      user: user_id, 
      status: 'active' 
    }).populate('plan');

    const preferences = await PartnerPreferences.findOne({ user_id });

    if (!preferences)
      return next(new ApiError("No preferences found for this user.", 404));

    let start, end;
    if (startDate && endDate) {
      start = parseDate(startDate);
      start.setHours(0, 0, 0, 0);

      end = parseDate(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const {
      min_age,
      max_age,
      min_height_in_cm,
      max_height_in_cm,
      min_salary,
      max_salary,
      gender,
      religion,
      caste,
      highest_education,
      annual_income,
    } = preferences;

    // Get the current date for age calculation
    const currentDate = new Date();

    const query = {
      _id: { $ne: user_id },
      dob: {
        $gte: new Date(
          currentDate.getFullYear() - max_age,
          currentDate.getMonth(),
          currentDate.getDate()
        ),
        $lte: new Date(
          currentDate.getFullYear() - min_age,
          currentDate.getMonth(),
          currentDate.getDate()
        ),
      },
      heightInCm: { $gte: min_height_in_cm, $lte: max_height_in_cm },
      annual_income: { $gte: min_salary, $lte: max_salary },
      gender: gender,
    };

    // Add religion filter if it's not "Any"
    if (religion && religion !== "Any") {
      query.religion = religion;
    }

    if (start && end) {
      query.created_at = {
        $gte: start,
        $lte: end,
      };
    }

    if (searchTerm) {
      query.fullName = { $regex: searchTerm, $options: "i" };
    }

    // Determine sorting and visibility based on user's subscription
    let sortOptions = { created_at: -1 }; // Default sort
    let visibilityMultiplier = 1;

    if (userSubscription && userSubscription.plan) {
      // Adjust sorting based on subscription plan
      switch(userSubscription.plan.planName) {
        case 'Silver':
          sortOptions = { created_at: -1 };
          visibilityMultiplier = 1.2;
          break;
        case 'Gold':
          sortOptions = { 'features.profileVisibility': -1, created_at: -1 };
          visibilityMultiplier = 1.5;
          break;
        case 'Platinum':
          sortOptions = { 'features.profileVisibility': -1, created_at: -1 };
          visibilityMultiplier = 2;
          break;
        case 'Royal':
          sortOptions = { 'features.profileVisibility': -1, created_at: -1 };
          visibilityMultiplier = 3;
          break;
      }
    }

    // Calculate total number of matched users
    const totalMatchedUsers = await User.countDocuments(query);

    // Find users matching the preferences with sorting and pagination
    const matchedUsers = await User.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const currentTime = moment().tz("Asia/Kolkata");

    if (!matchedUsers || matchedUsers.length === 0)
      return next(new ApiError("No match found for this user.", 404));

    const usersWithDistances = await Promise.all(
      matchedUsers.map(async (user) => {
        const currentUserLocation = req.user?.location?.coordinates;
        const matchedUserLocation = user?.location?.coordinates;
    
        // Calculate distance
        const distance =
          currentUserLocation && matchedUserLocation
            ? haversineDistance(currentUserLocation, matchedUserLocation)?.toFixed(2)
            : null;
    
        // Calculate age
        const age = calculateAge(user.dob);
    
        // Check subscription status using UserSubscription
        const userSubscription = await UserSubscription.findOne({
          user: user._id,
          status: "active",
          endDate: { $gt: currentTime },
        }).populate("plan");
    
        const isVerified =
          userSubscription?.plan?.features?.verifiedBadge?.included || false;
    
        // Calculate match relevance score
        let matchScore = 0;
    
        // Base matching logic
        if (user.highest_education?.toString() === preferences.highest_education)
          matchScore += 20;
    
        if (user.occupation?.toString() === preferences.occupation)
          matchScore += 15;
    
        if (user.caste?.toString() === preferences.caste) 
          matchScore += 10;
    
        // Apply visibility multiplier to match score
        matchScore *= visibilityMultiplier;
    
        return {
          _id: user._id,
          profile_for: user.profile_for,
          fullName: user.fullName,
          profile_image: user.profile_image,
          height: user.height,
          state: user.state,
          city: user.city,
          highest_education: user.highest_education,
          annual_income: user.annual_income,
          marital_status: user.marital_status,
          caste: user.caste,
          occupation: user.occupation,
          distance,
          age,
          isVerified,
          matchScore,
        };
      })
    );
    
    // Sort users by match score in descending order
    const sortedUsers = usersWithDistances.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
      success: true,
      message: "Matching users found.",
      data: sortedUsers,
      pagination: {
        currentPage: pageNumber,
        pageSize,
        totalUsers: totalMatchedUsers,
        totalPages: Math.ceil(totalMatchedUsers / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
};

const singleMatchedUser = async (req, res, next) => {
  try {
    const matchedUserId = req.params.id;
    const user = req.user;

    let numberVisibility = false;

    if (!isValidObjectId(matchedUserId)) {
      return next(new ApiError("Invalid userId", 400));
    }

    const matchedUser = await User.findOne({ _id: matchedUserId }).exec();

    if (!matchedUser) {
      return next(new ApiError("User not found", 400));
    }

    const currentUserLocation = req.user?.location?.coordinates;
    const matchedUserLocation = matchedUser?.location?.coordinates;

    const distance =
      currentUserLocation && matchedUserLocation
        ? haversineDistance(currentUserLocation, matchedUserLocation)?.toFixed(
            2
          )
        : null;

    const age = calculateAge(matchedUser.dob);

    const currentTime = moment().tz("Asia/Kolkata");

    const isVerified = matchedUser.subscriptionExpiryDate
      ? moment(matchedUser.subscriptionExpiryDate)
          .tz("Asia/Kolkata")
          .isAfter(currentTime)
      : false;

    // Check if the contact has already been seen
    const existingDoc = await SeenContact.findOne({
      user: user._id,
      contactSeen: matchedUserId,
    });

    if (!existingDoc) numberVisibility = false;
    else numberVisibility = true;

    // Check if the user has already visited the profile
    const existingVisit = await ProfileVisit.findOne({
      visitor: user._id,
      visited: matchedUserId,
    });
    if (!existingVisit) {
      await ProfileVisit.create({ visitor: user._id, visited: matchedUserId });
    }
    const currentMatchedUserCount = await ProfileVisit.countDocuments({
      visited: matchedUserId,
    });

    // Convert to plain object if needed
    const responseUser = matchedUser.toObject
      ? matchedUser.toObject()
      : matchedUser;

    // Include distance and age in the response
    responseUser.distance = distance;
    responseUser.age = age;
    responseUser.numberVisibility = numberVisibility;
    responseUser.currentMatchedUserCount = currentMatchedUserCount;
    responseUser.isVerified = isVerified;

    delete responseUser.location;
    delete responseUser.otp_expiry;
    delete responseUser.heightInCm;

    return res.status(200).json({
      success: true,
      message: "Matched user found.",
      data: responseUser,
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

const checkContactEligibility = async (req, res, next) => {
  try {
    const user = req.user;
    const { contactSeen } = req.query;

    // Set IST timezone and keep it as a moment object
    const currentDate = moment().tz("Asia/Kolkata"); // current time in IST

    // Check if the subscription expiry date is present
    if (!user.subscriptionExpiryDate) {
      return next(
        new ApiError(
          "You have not subscribed yet. Please subscribe to see contact details.",
          400
        )
      );
    }

    // Convert subscriptionExpiryDate to moment object and compare
    const expiryDate = moment(user.subscriptionExpiryDate).tz("Asia/Kolkata");

    if (expiryDate.isBefore(currentDate)) {
      user.maxPhoneNumbersViewable = 0;
      user.subscriptionExpiryDate = undefined;

      const seenContactPromise = SeenContact.deleteMany({ user: user._id });
      const userPromise = user.save();

      await Promise.all([seenContactPromise, userPromise]);

      return next(new ApiError("Your subscription plan has expired.", 400));
    }

    // Check if maxPhoneNumbersViewable is 0 and subscription is still active
    if (user.maxPhoneNumbersViewable === 0 && expiryDate.isAfter(currentDate)) {
      return next(
        new ApiError(
          "You have reached the max limit to see contact details. Please upgrade your plan to see more.",
          400
        )
      );
    }

    // Check if the contact has already been seen
    const existingDoc = await SeenContact.findOne({
      user: user._id,
      contactSeen: contactSeen,
    });

    // If subscription is valid and maxPhoneNumbersViewable is greater than 0
    if (
      expiryDate.isSameOrAfter(currentDate) &&
      user.maxPhoneNumbersViewable > 0
    ) {
      if (!existingDoc) {
        // Save the seen contact
        await SeenContact.create({ user: user._id, contactSeen: contactSeen });
        user.maxPhoneNumbersViewable -= 1; // Decrease the count of viewable contacts
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  partnerPreferences,
  getPreference,
  matchedUsers,
  singleMatchedUser,
  checkContactEligibility,
};
