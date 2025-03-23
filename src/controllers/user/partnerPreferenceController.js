const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const { ApiError } = require("../../errorHandler");
const PartnerPreferences = require("../../models/partnerPreference");
const User = require("../../models/user");
const { UserSubscription } = require("../../models")
const ProfileVisit = require("../../models/profileVisit");
const SeenContact = require("../../models/seenContact");
const calculateAge = require("../../utils/calculateAge");
const parseDate = require("../../utils/parseDate");
const haversineDistance = require("../../utils/haversineDistance");
const convertHeightToCM = require("../../utils/convertHeightToCM");

const parseAnnualIncome = (annual_income) => {
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

const partnerPreferences = async (req, res, next) => {
  try {
    const {
      min_age,
      max_age,
      min_height,
      max_height,
      max_height_in_cm,
      min_height_in_cm,
      marital_status,
      religion,
      any_caste,
      mother_tongue,
      state,
      manglik,
      highest_education,
      employed_in,
      occupation,
      annual_income
    } = req.body;

    const user_id = req.user._id;
    console.log('req/.nody', req.body)
    // Check if a document already exists for the user
    const existingPreferences = await PartnerPreferences.findOne({ user_id });

    if (existingPreferences) {
      // Update only the provided fields
      const [min_salary, max_salary] = parseAnnualIncome(annual_income);

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
          min_height !== undefined
            ? min_height
            : existingPreferences.min_height,
        max_height:
          max_height !== undefined
            ? max_height
            : existingPreferences.max_height,
        min_height_in_cm:
          min_height_in_cm !== undefined
            ? Math.round(min_height_in_cm)
            : existingPreferences.min_height_in_cm,
        max_height_in_cm:
          max_height_in_cm !== undefined
            ? Math.round(max_height_in_cm)
            : existingPreferences.max_height_in_cm,
        marital_status:
          marital_status !== undefined
            ? marital_status
            : existingPreferences.marital_status,
        religion:
          religion !== undefined ? religion : existingPreferences.religion,
        any_caste:
          any_caste !== undefined ? any_caste : existingPreferences.any_caste,
        mother_tongue:
          mother_tongue !== undefined
            ? mother_tongue
            : existingPreferences.mother_tongue,
        // country: country !== undefined ? country : existingPreferences.country,
        state: state !== undefined ? state : existingPreferences.state,
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
            : existingPreferences.annual_income
      });

      // Save the updated document
      await existingPreferences.save({ validateBeforeSave: false });

      await User.findByIdAndUpdate(user_id, { preferenceStatus: "Complete" });

      return res.status(200).json({
        success: true,
        message: "Partner preferences updated successfully",
        data: existingPreferences,
      });
    } else {
      // Create a new document
      console.log('req/nodfu ', req.body)
      if (
        !min_age ||
        !max_age ||
        !min_height ||
        !max_height ||
        !max_height_in_cm ||
        !min_height_in_cm ||
        !marital_status ||
        !religion ||
        any_caste === null || // Allow false but not null
        !mother_tongue ||
        !manglik ||
        !highest_education ||
        !employed_in ||
        !occupation ||
        !annual_income
      ) {
        return next(new ApiError("All fields are required", 400));
      }

      const [min_salary, max_salary] = parseAnnualIncome(annual_income);

      const newPreferences = new PartnerPreferences({
        user_id,
        min_age,
        max_age,
        // min_height: `${min_height_in_feet} ft ${min_height_in_inches} in`,
        // max_height: `${max_height_in_feet} ft ${max_height_in_inches} in`,
        min_height,
        max_height,
        max_height_in_cm: Math.round(max_height_in_cm),
        min_height_in_cm: Math.round(min_height_in_cm),
        marital_status,
        religion,
        any_caste,
        mother_tongue,
        state,
        manglik,
        highest_education,
        employed_in,
        occupation,
        annual_income,
        min_salary,
        max_salary,
      });

      // Save the new document
      const savedPreferences = await newPreferences.save();

      await User.findByIdAndUpdate(user_id, { preferenceStatus: "Complete" });  //extra

      return res.status(201).json({
        success: true,
        message: "Partner preferences created successfully",
        data: savedPreferences,
      });
    }
  } catch (error) {
    console.log("Error handling partner preferences:", error);
    return res.status(500).json({ success: false, message: error.message });
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


const matchedUsers = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    const user = await User.findById(user_id);
    
    if (!user) {
      return next(new ApiError("User not found.", 404));
    }

    const oppositeGender = user.gender === "Male" ? "Female" : "Male";

    const query = {
      _id: { $ne: user_id },
      gender: oppositeGender,
      active: true,
      profileStatus: "Complete"
    };

    const matchedUsers = await User.find(query);

    return res.status(200).json({
      success: true,
      message: "Matching users found.",
      data: matchedUsers,
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

// const matchedUsers = async (req, res, next) => {
//   try {
//     const { startDate, endDate, searchTerm, page = 1, limit = 20 } = req.body;
//     const user_id = req.user._id;
//     const preferences = await PartnerPreferences.findOne({ user_id });

//     // Get the current user
//     const currentUser = await User.findById(user_id);
//     if (!currentUser) {
//       return next(new ApiError("User not found.", 404));
//     }

//     // Basic query - always show opposite gender users
//     const baseQuery = {
//       _id: { $ne: user_id },
//       active: true
//     };

//     // Add gender filter (opposite of current user's gender)
//     if (currentUser.gender === 'Male') {
//       baseQuery.gender = 'Female';
//     } else if (currentUser.gender === 'Female') {
//       baseQuery.gender = 'Male';
//     }

//     // Apply date range filter if provided
//     if (startDate && endDate) {
//       const start = parseDate(startDate);
//       start.setHours(0, 0, 0, 0);
      
//       const end = parseDate(endDate);
//       end.setHours(23, 59, 59, 999);
      
//       baseQuery.created_at = {
//         $gte: start,
//         $lte: end
//       };
//     }

//     // Apply search term if provided
//     if (searchTerm) {
//       baseQuery.$or = [
//         { fullName: { $regex: searchTerm, $options: "i" } },
//         { occupation: { $regex: searchTerm, $options: "i" } },
//         { city: { $regex: searchTerm, $options: "i" } }
//       ];
//     }

//     // Calculate pagination values
//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     // Get all potential matches (no strict filtering)
//     const allUsers = await User.find(baseQuery)
//       .sort({ created_at: -1 }) // Initially sort by most recent
//       .limit(parseInt(limit) * 3) // Fetch more than needed for better selection
//       .lean();

//     // If we found users, score and sort them
//     if (allUsers && allUsers.length > 0) {
//       // If user has preferences, use them for scoring
//       if (preferences) {
//         const {
//           min_age,
//           max_age,
//           min_height_in_cm,
//           max_height_in_cm,
//           min_salary,
//           max_salary,
//           marital_status,
//           religion,
//           any_caste,
//           caste,
//           mother_tongue,
//           state,
//           manglik,
//           highest_education,
//           employed_in,
//           occupation,
//         } = preferences;

//         // Current date for age calculation
//         const currentDate = new Date();

//         // Score each user based on preference matches
//         const scoredUsers = allUsers.map(user => {
//           let score = 0;
//           let matchedCriteria = [];
          
//           // Calculate user age
//           const userAge = calculateAge(user.dob);
          
//           // Age match
//           if (min_age && max_age && userAge >= min_age && userAge <= max_age) {
//             score += 10;
//             matchedCriteria.push('Age');
//           }
          
//           // Height match
//           if (min_height_in_cm && max_height_in_cm && 
//               user.heightInCm >= min_height_in_cm && 
//               user.heightInCm <= max_height_in_cm) {
//             score += 8;
//             matchedCriteria.push('Height');
//           }
          
//           // Salary/Income match
//           if (min_salary && max_salary && 
//               user.min_salary && user.max_salary &&
//               ((user.min_salary <= max_salary && user.max_salary >= min_salary) ||
//                (min_salary <= user.max_salary && max_salary >= user.min_salary))) {
//             score += 8;
//             matchedCriteria.push('Income');
//           }
          
//           // Religion match
//           if (religion && religion !== "Any" && user.religion === religion) {
//             score += 15; // Higher weight for religion
//             matchedCriteria.push('Religion');
//           }
          
//           // Caste match
//           if (!any_caste && caste && user.caste === caste) {
//             score += 10;
//             matchedCriteria.push('Caste');
//           }
          
//           // Marital status match
//           if (marital_status && marital_status !== "Any" && 
//               user.marital_status === marital_status) {
//             score += 10;
//             matchedCriteria.push('Marital Status');
//           }
          
//           // Mother tongue match
//           if (mother_tongue && mother_tongue !== "Any" && 
//               user.mother_tongue === mother_tongue) {
//             score += 8;
//             matchedCriteria.push('Mother Tongue');
//           }
          
//           // State match
//           if (state && state !== "" && user.state === state) {
//             score += 8;
//             matchedCriteria.push('State');
//           }
          
//           // Manglik status match
//           if (manglik && manglik !== "Doesn't matter" && user.manglik === manglik) {
//             score += 7;
//             matchedCriteria.push('Manglik Status');
//           }
          
//           // Education match
//           if (highest_education && highest_education !== "Any" && 
//               user.highest_education === highest_education) {
//             score += 7;
//             matchedCriteria.push('Education');
//           }
          
//           // Employment type match
//           if (employed_in && employed_in !== "Any" && user.employed_in === employed_in) {
//             score += 6;
//             matchedCriteria.push('Employment');
//           }
          
//           // Occupation match
//           if (occupation && occupation !== "Any" && user.occupation === occupation) {
//             score += 6;
//             matchedCriteria.push('Occupation');
//           }
          
//           // Bonus for profile completeness
//           if (user.profile_image && user.profile_image.length > 0) {
//             score += 5;
//           }
          
//           // Bonus for verified profiles
//           if (user.verifiedBadge) {
//             score += 5;
//           }
          
//           // Bonus for newer profiles (less than 30 days old)
//           const profileAgeDays = Math.floor((new Date() - new Date(user.created_at)) / (24 * 60 * 60 * 1000));
//           if (profileAgeDays < 30) {
//             score += 5 - Math.floor(profileAgeDays / 7); // 5 points for first week, decreasing by 1 each week
//           }
          
//           // Calculate distance if location data exists
//           const currentUserLocation = req.user?.location?.coordinates;
//           const matchedUserLocation = user?.location?.coordinates;
//           const distance = currentUserLocation && matchedUserLocation
//             ? haversineDistance(currentUserLocation, matchedUserLocation)?.toFixed(2)
//             : null;
            
//           // Match percentage (out of possible criteria)
//           const possibleCriteria = 11; // Counting all major criteria
//           const matchPercentage = Math.min(Math.round((matchedCriteria.length / possibleCriteria) * 100), 100);

//           return {
//             _id: user._id,
//             profile_for: user.profile_for,
//             email: user.email,
//             fullName: user.fullName,
//             phone: user.phone,
//             profile_image: user.profile_image,
//             height: user.height,
//             state: user.state,
//             city: user.city,
//             highest_education: user.highest_education,
//             annual_income: user.annual_income,
//             marital_status: user.marital_status,
//             caste: user.caste,
//             religion: user.religion,
//             occupation: user.occupation,
//             distance: distance,
//             age: userAge,
//             matchScore: score,
//             matchPercentage: matchPercentage,
//             matchedCriteria: matchedCriteria,
//             isVerified: user.verifiedBadge,
//             profileVisibility: user.features?.profileVisibility || 'Standard',
//             created_at: user.created_at
//           };
//         });
        
//         // Sort by match score (highest first)
//         scoredUsers.sort((a, b) => b.matchScore - a.matchScore);
        
//         // Calculate total results and pages for pagination
//         const totalResults = await User.countDocuments(baseQuery);
//         const totalPages = Math.ceil(totalResults / parseInt(limit));
        
//         // Return results with pagination info
//         return res.status(200).json({
//           success: true,
//           message: "Matching users found.",
//           data: scoredUsers.slice(0, parseInt(limit)),
//           pagination: {
//             total: totalResults,
//             pages: totalPages,
//             page: parseInt(page),
//             limit: parseInt(limit)
//           }
//         });
//       } else {
//         // No preferences found, just return users with basic info
//         const usersWithBasicInfo = allUsers.map(user => {
//           const userAge = calculateAge(user.dob);
//           const distance = req.user?.location?.coordinates && user?.location?.coordinates
//             ? haversineDistance(req.user.location.coordinates, user.location.coordinates)?.toFixed(2)
//             : null;
            
//           return {
//             _id: user._id,
//             profile_for: user.profile_for,
//             email: user.email,
//             fullName: user.fullName,
//             phone: user.phone,
//             profile_image: user.profile_image,
//             height: user.height,
//             state: user.state,
//             city: user.city,
//             highest_education: user.highest_education,
//             annual_income: user.annual_income,
//             marital_status: user.marital_status,
//             caste: user.caste,
//             religion: user.religion,
//             occupation: user.occupation,
//             distance: distance,
//             age: userAge,
//             matchScore: 0,
//             matchPercentage: 0,
//             matchedCriteria: [],
//             isVerified: user.verifiedBadge,
//             profileVisibility: user.features?.profileVisibility || 'Standard',
//             created_at: user.created_at
//           };
//         });
        
//         // Calculate total results and pages for pagination
//         const totalResults = await User.countDocuments(baseQuery);
//         const totalPages = Math.ceil(totalResults / parseInt(limit));
        
//         return res.status(200).json({
//           success: true,
//           message: "Users found, but no preferences set for this user.",
//           data: usersWithBasicInfo.slice(0, parseInt(limit)),
//           pagination: {
//             total: totalResults,
//             pages: totalPages,
//             page: parseInt(page),
//             limit: parseInt(limit)
//           }
//         });
//       }
//     } else {
//       // No users found, still return a successful response with empty data
//       return res.status(200).json({
//         success: true,
//         message: "No users found matching the criteria.",
//         data: [],
//         pagination: {
//           total: 0,
//           pages: 0,
//           page: parseInt(page),
//           limit: parseInt(limit)
//         }
//       });
//     }
//   } catch (error) {
//     console.error("Match users error:", error);
//     next(error);
//   }
// };


const singleMatchedUser = async (req, res, next) => {
  try {
    const matchedUserId = req.params.id;
    const user = req.user;

    let numberVisibility = false;

    if (!isValidObjectId(matchedUserId)) {
      return next(new ApiError("Invalid userId", 400));
    }

    const matchedUser = await User.findOne({ _id: matchedUserId }).exec();
    const preference = await PartnerPreferences.findOne(
      { user_id: matchedUserId },
      { any_caste: 1, _id: 0 } // Selecting only 'any_caste' and excluding '_id'
    ).lean();

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
    responseUser.any_caste = preference && preference.any_caste ? "Yes" : "No";

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
