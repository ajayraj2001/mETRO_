const moment = require("moment-timezone");
const mongoose = require('mongoose')
const { isValidObjectId } = require("mongoose");
const { ApiError } = require("../../errorHandler");
const PartnerPreferences = require("../../models/partnerPreference");
const User = require("../../models/user");
const { UserSubscription } = require("../../models")
const ProfileVisit = require("../../models/profileVisit");
const { ProfileView, Connection, Like } = require("../../models");
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

const matchedProfiles = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const newUsersOnly = req.query.newUsersOnly === 'true';
    const rotationStrategy = req.query.rotationStrategy || 'balanced';

    // Get user and preferences
    const [user, userPreferences] = await Promise.all([
      User.findById(user_id),
      PartnerPreferences.findOne({ user_id })
    ]);

    if (!user) return next(new ApiError("User not found.", 404));
    if (!userPreferences) return next(new ApiError("Partner preferences not found.", 404));

    // Viewed profiles in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const viewedProfiles = await ProfileView.find({
      viewer_id: user_id,
      viewed_at: { $gte: thirtyDaysAgo }
    }).lean();

    // Create view weights
    const viewWeights = viewedProfiles.reduce((acc, view) => {
      const days = (Date.now() - view.viewed_at) / (1000 * 60 * 60 * 24);
      acc[view.viewed_id.toString()] = 1 - (days / 33);
      return acc;
    }, {});

    // Base match criteria
    const matchCriteria = {
      _id: { $ne: user_id },
      gender: user.gender === "Male" ? "Female" : "Male",
      active: true,
      profileStatus: "Complete"
    };

    if (newUsersOnly) {
      matchCriteria.created_at = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      };
    }

    // Aggregation pipeline
    const currentDate = new Date();
    const pipeline = [
      { $match: matchCriteria },
      {
        $lookup: {
          from: "partner_preferences",
          localField: "_id",
          foreignField: "user_id",
          as: "prefs"
        }
      },
      { $unwind: { path: "$prefs", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          age: {
            $dateDiff: {
              startDate: "$dob",
              endDate: "$$NOW",
              unit: "year"
            }
          }
        }
      },
      {
        $addFields: {
          ageScore: {
            $cond: {
              if: {
                $and: [
                  { $gte: ["$age", userPreferences.min_age] },
                  { $lte: ["$age", userPreferences.max_age] }
                ]
              },
              then: 20,
              else: 0
            }
          },
          freshness: {
            $add: [
              {
                $subtract: [
                  10,
                  {
                    $min: [
                      10,
                      {
                        $divide: [
                          { $subtract: ["$$NOW", "$created_at"] },
                          86400000
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                $subtract: [
                  5,
                  {
                    $min: [
                      5,
                      {
                        $divide: [
                          { $subtract: ["$$NOW", "$updated_at"] },
                          86400000
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          totalScore: {
            $add: [
              "$ageScore",
              "$freshness",
              { $multiply: [{ $rand: {} }, 5] }
            ]
          }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: limit * 3 },
      {
        $project: {
          _id: 1,
          fullName: 1,
          profile_image: 1,
          age: 1,
          dob: 1,
          totalScore: 1,
          height: 1,
          religion: 1,
          caste: 1,
          city: 1,
          state: 1,
          occupation: 1,
          annual_income: 1,
          marital_status: 1,
          highest_education: 1,
          initialScore: 1,
          freshness: 1,
          created_at: 1,
          updated_at: 1

          // Add other fields as needed
        }
      }
    ];


    // Get potential matches
    let potentialMatches = await User.aggregate(pipeline);

    // Apply view penalties
    potentialMatches = potentialMatches.map(profile => {
      const penalty = viewWeights[profile._id.toString()] * 100 || 0;
      return {
        ...profile,
        finalScore: profile.totalScore - penalty
      };
    });

    // Sort by final score
    potentialMatches.sort((a, b) => b.finalScore - a.finalScore);

    // Paginate results
    const matchedUsers = potentialMatches.slice(skip, skip + limit);

    // Check likes ONLY for final results
    let likedMap = new Map();
    if (matchedUsers.length > 0) {
      const profileIds = matchedUsers.map(p => p._id);
      const likes = await Like.find({
        user: user_id,
        userLikedTo: { $in: profileIds }
      }).lean();

      likes.forEach(like => {
        likedMap.set(like.userLikedTo.toString(), true);
      });
    }

    // Add like status
    const finalResults = matchedUsers.map(profile => ({
      ...profile,
      isLiked: likedMap.has(profile._id.toString())
    }));

    // Record views
    if (finalResults.length > 0) {
      const views = finalResults.map(profile => ({
        viewer_id: user_id,
        viewed_id: profile._id,
        viewed_at: new Date()
      }));

      await ProfileView.bulkWrite(views.map(view => ({
        updateOne: {
          filter: { viewer_id: view.viewer_id, viewed_id: view.viewed_id },
          update: { $set: view },
          upsert: true
        }
      })));
    }

    // Get total count
    const total = await User.countDocuments(matchCriteria);

    res.status(200).json({
      success: true,
      data: finalResults,
      pagination: {
        totalProfiles: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        hasNextPages: page < Math.ceil(total / limit),
        ProfilePerPage: limit
      }
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
    const pipeline = [
      {
        $match: {
          _id: { $ne: user._id },
          gender: oppositeGender,
          active: true,
          profileStatus: "Complete"
        }
      },
      {
        $addFields: { randomSort: { $rand: {} } }
      },
      {
        $sort: { randomSort: 1 }
      },
      {
        $project: {
          phone: 0 // Exclude the phone field
        }
      }
    ];

    const matchedUsers = await User.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      message: "Randomized matching users found.",
      data: matchedUsers,
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

    const matchedUser = await User.findOne({ _id: matchedUserId })
      .select('-email') // exclude email field
      .exec();
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

    // Mask the phone before sending it in response
    responseUser.phone = maskPhone(responseUser.phone);

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

const getProfileById = async (req, res, next) => {
  try {
    const profileId = req.params.profileId;
    const currentUser = req.user;

    // Check for same profile to avoid DB hit
    if (currentUser.profileId === profileId) {
      const responseUser = currentUser.toObject ? currentUser.toObject() : currentUser;

      const age = responseUser.dob ? calculateAge(responseUser.dob) : null;

      return res.status(200).json({
        success: true,
        message: "Own profile data",
        data: {
          ...responseUser,
          age,
          distance: null,
          connectionStatus: "own_profile"
        }
      });
    }

    // Find matched user by profileId
    const matchedUser = await User.findOne({ profileId, active: true }).lean();
    if (!matchedUser) return next(new ApiError("Profile not found", 404));

    // Age and distance
    const age = matchedUser.dob ? calculateAge(matchedUser.dob) : null;

    const currentCoords = currentUser.location?.coordinates;
    const matchedCoords = matchedUser.location?.coordinates;

    const distance =
      currentCoords && matchedCoords
        ? haversineDistance(currentCoords, matchedCoords)?.toFixed(2)
        : null;

    // Visit log
    // const existingVisit = await ProfileVisit.findOne({
    //   visitor: currentUser._id,
    //   visited: matchedUser._id,
    // });

    // if (!existingVisit) {
    //   await ProfileVisit.create({ visitor: currentUser._id, visited: matchedUser._id });
    // }

    // const currentMatchedUserCount = await ProfileVisit.countDocuments({
    //   visited: matchedUser._id,
    // });

    // Check connection status
    const connection = await Connection.findOne({
      $or: [
        { sender: currentUser._id, receiver: matchedUser._id },
        { sender: matchedUser._id, receiver: currentUser._id },
      ],
    }).lean();

      let connectionStatus = "not_connected";
    let connectionId = "";

    if (connection) {
      connectionId = connection._id;
      if (connection.status === "Blocked") {
        // Enhanced blocking logic
        if (connection.blockedBy && connection.blockedBy.length > 0) {
          const blockedByCurrentUser = connection.blockedBy.some(
            id => id.toString() === currentUser._id.toString()
          );
          const blockedByOtherUser = connection.blockedBy.some(
            id => id.toString() === matchedUser._id.toString()
          );

          // Priority: Show what the current user did first
          if (blockedByCurrentUser && blockedByOtherUser) {
            // Both blocked each other - show current user's action first
            connectionStatus = "you_blocked"; // You blocked them (even though it's mutual)
          } else if (blockedByCurrentUser) {
            connectionStatus = "you_blocked";
          } else if (blockedByOtherUser) {
            connectionStatus = "blocked_by_other";
          }
        } else {
          // Fallback to old logic for backward compatibility
          connectionStatus = connection.sender.toString() === currentUser._id.toString()
            ? "you_blocked"
            : "blocked_by_other";
        }
      } else if (connection.status === "Pending") {
        connectionStatus = connection.sender.toString() === currentUser._id.toString()
          ? "request_sent"
          : "request_received";
      } else if (connection.status === "Accepted") {
        connectionStatus = "connected";
      }
    }

    // Prepare final response
    const responseUser = matchedUser;
    responseUser.age = age;
    responseUser.distance = distance;
    responseUser.connectionStatus = connectionStatus;
    responseUser.connectionId = connectionId || "";

    // Always mask the phone number (never show full)
    if (responseUser.phone) {
      responseUser.phone = maskPhone(responseUser.phone);
    }

    // Remove sensitive fields
    delete responseUser.location;
    delete responseUser.otp_expiry;
    delete responseUser.heightInCm;

    return res.status(200).json({
      success: true,
      message: "Profile data",
      data: responseUser,
    });
  } catch (err) {
    console.log("Error in getProfileById:", err);
    next(err);
  }
};

// const getProfileDetails = async (req, res, next) => {
//   try {
//     const profileId = req.params.id;
//     const currentUser = req.user;

//     // Check for same profile to avoid DB hit
//     if (currentUser.profileId === profileId) {
//       const responseUser = currentUser.toObject ? currentUser.toObject() : currentUser;

//       const age = responseUser.dob ? calculateAge(responseUser.dob) : null;

//       return res.status(200).json({
//         success: true,
//         message: "Own profile data",
//         data: {
//           ...responseUser,
//           age,
//           distance: null,
//           connectionStatus: "own_profile"
//         }
//       });
//     }

//     // Find matched user by profileId
//     // const matchedUser = await User.findOne({ profileId }).lean();
//     const matchedUser = await User.findById(profileId).lean();
//     if (!matchedUser) return next(new ApiError("Profile not found", 404));

//     // Age and distance
//     const age = matchedUser.dob ? calculateAge(matchedUser.dob) : null;

//     const currentCoords = currentUser.location?.coordinates;
//     const matchedCoords = matchedUser.location?.coordinates;

//     const distance =
//       currentCoords && matchedCoords
//         ? haversineDistance(currentCoords, matchedCoords)?.toFixed(2)
//         : null;

//     // Visit log
//     const existingVisit = await ProfileVisit.findOne({
//       visitor: currentUser._id,
//       visited: matchedUser._id,
//     });

//     if (!existingVisit) {
//       await ProfileVisit.create({ visitor: currentUser._id, visited: matchedUser._id });
//     }

//     // const currentMatchedUserCount = await ProfileVisit.countDocuments({
//     //   visited: matchedUser._id,
//     // });

//     // Check connection status
//     const connection = await Connection.findOne({
//       $or: [
//         { sender: currentUser._id, receiver: matchedUser._id },
//         { sender: matchedUser._id, receiver: currentUser._id },
//       ],
//     }).lean();

//     let connectionStatus = "not_connected";
//     let connectionId = "";

//     if (connection) {
//       connectionId = connection._id;
//       if (connection.status === "Blocked") {
//         connectionStatus = connection.sender.toString() === currentUser._id.toString()
//           ? "you_blocked"
//           : "blocked_by_other";
//       } else if (connection.status === "Pending") {
//         connectionStatus = connection.sender.toString() === currentUser._id.toString()
//           ? "request_sent"
//           : "request_received";
//       } else if (connection.status === "Accepted") {
//         connectionStatus = "connected";
//       }
//     }

//     // Prepare final response
//     const responseUser = matchedUser;
//     responseUser.age = age;
//     responseUser.distance = distance;
//     responseUser.connectionStatus = connectionStatus;
//     responseUser.connectionId = connectionId || "";

//     // Always mask the phone number (never show full)
//     if (responseUser.phone) {
//       responseUser.phone = maskPhone(responseUser.phone);
//     }

//     // Remove sensitive fields
//     delete responseUser.location;
//     delete responseUser.otp_expiry;
//     delete responseUser.heightInCm;

//     return res.status(200).json({
//       success: true,
//       message: "Profile data",
//       data: responseUser,
//     });
//   } catch (err) {
//     console.log("Error in getProfileById:", err);
//     next(err);
//   }
// };

const getProfileDetails = async (req, res, next) => {
  try {
    const profileId = req.params.id;
    const currentUser = req.user;

    // Check for same profile to avoid DB hit
    if (currentUser.profileId === profileId) {
      const responseUser = currentUser.toObject ? currentUser.toObject() : currentUser;

      const age = responseUser.dob ? calculateAge(responseUser.dob) : null;

      return res.status(200).json({
        success: true,
        message: "Own profile data",
        data: {
          ...responseUser,
          age,
          distance: null,
          connectionStatus: "own_profile"
        }
      });
    }

    // Find matched user by profileId
    const matchedUser = await User.findById(profileId).lean();
    if (!matchedUser) return next(new ApiError("Profile not found", 404));

    // Age and distance
    const age = matchedUser.dob ? calculateAge(matchedUser.dob) : null;

    const currentCoords = currentUser.location?.coordinates;
    const matchedCoords = matchedUser.location?.coordinates;

    const distance =
      currentCoords && matchedCoords
        ? haversineDistance(currentCoords, matchedCoords)?.toFixed(2)
        : null;

    // Visit log
    // const existingVisit = await ProfileVisit.findOne({
    //   visitor: currentUser._id,
    //   visited: matchedUser._id,
    // });

    // if (!existingVisit) {
    //   await ProfileVisit.create({ visitor: currentUser._id, visited: matchedUser._id });
    // }

    // Enhanced connection status check
    const connection = await Connection.findOne({
      $or: [
        { sender: currentUser._id, receiver: matchedUser._id },
        { sender: matchedUser._id, receiver: currentUser._id },
      ],
    }).lean();

    let connectionStatus = "not_connected";
    let connectionId = "";

    if (connection) {
      connectionId = connection._id;
      if (connection.status === "Blocked") {
        // Enhanced blocking logic
        if (connection.blockedBy && connection.blockedBy.length > 0) {
          const blockedByCurrentUser = connection.blockedBy.some(
            id => id.toString() === currentUser._id.toString()
          );
          const blockedByOtherUser = connection.blockedBy.some(
            id => id.toString() === matchedUser._id.toString()
          );

          // Priority: Show what the current user did first
          if (blockedByCurrentUser && blockedByOtherUser) {
            // Both blocked each other - show current user's action first
            connectionStatus = "you_blocked"; // You blocked them (even though it's mutual)
          } else if (blockedByCurrentUser) {
            connectionStatus = "you_blocked";
          } else if (blockedByOtherUser) {
            connectionStatus = "blocked_by_other";
          }
        } else {
          // Fallback to old logic for backward compatibility
          connectionStatus = connection.sender.toString() === currentUser._id.toString()
            ? "you_blocked"
            : "blocked_by_other";
        }
      } else if (connection.status === "Pending") {
        connectionStatus = connection.sender.toString() === currentUser._id.toString()
          ? "request_sent"
          : "request_received";
      } else if (connection.status === "Accepted") {
        connectionStatus = "connected";
      }
    }

    // Prepare final response
    const responseUser = matchedUser;
    responseUser.age = age;
    responseUser.distance = distance;
    responseUser.connectionStatus = connectionStatus;
    responseUser.connectionId = connectionId || "";
    // responseUser.profile_image = [];

    // Always mask the phone number (never show full)
    if (responseUser.phone) {
      responseUser.phone = maskPhone(responseUser.phone);
    }

    // Remove sensitive fields
    delete responseUser.location;
    delete responseUser.otp_expiry;
    delete responseUser.heightInCm;

    return res.status(200).json({
      success: true,
      message: "Profile data",
      data: responseUser,
    });
  } catch (err) {
    console.log("Error in getProfileById:", err);
    next(err);
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

function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone || '';
  const visibleDigits = 4; // Show last 4 digits
  const maskedSection = '*'.repeat(phone.length - visibleDigits);
  return maskedSection + phone.slice(-visibleDigits);
}


module.exports = {
  partnerPreferences,
  getPreference,
  matchedUsers,
  singleMatchedUser,
  checkContactEligibility,
  matchedProfiles,
  getProfileById,
  getProfileDetails
};
