const moment = require("moment-timezone");
const mongoose = require('mongoose')
const { isValidObjectId } = require("mongoose");
const { ApiError } = require("../../errorHandler");
const PartnerPreferences = require("../../models/partnerPreference");
const User = require("../../models/user");
const { UserSubscription } = require("../../models")
const ProfileVisit = require("../../models/profileVisit");
const {ProfileView, Connection, Like} = require("../../models");
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
          totalScore: 1,
          height: 1,
          religion: 1,
          caste: 1,
          city: 1,
          state: 1,
          occupation: 1,
          annual_income:1,
          marital_status:1,
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
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

// const matchedProfiles = async (req, res, next) => {
//   try {
//     const user_id = req.user._id;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 5; // Default to 5 profiles per page
//     const skip = (page - 1) * limit;
//     const newUsersOnly = req.query.newUsersOnly === 'true';
//     const rotationStrategy = req.query.rotationStrategy || 'balanced';
    
//     // Get user and their preferences
//     const user = await User.findById(user_id);
//     if (!user) {
//       return next(new ApiError("User not found.", 404));
//     }
    
//     const userPreferences = await PartnerPreferences.findOne({ user_id });
//     if (!userPreferences) {
//       return next(new ApiError("Partner preferences not found. Please complete your preferences.", 404));
//     }
    
//     // Get viewed profiles history (last 30 days)
//     const thirtyDaysAgo = new Date();
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
//     const viewedProfiles = await ProfileView.find({
//       viewer_id: user_id,
//       viewed_at: { $gte: thirtyDaysAgo }
//     }).sort({ viewed_at: -1 });
    
//     // Extract viewed profile IDs
//     const viewedProfileIds = viewedProfiles.map(view => view.viewed_id.toString());
    
//     // Create weighted viewing history (more recent = higher weight to avoid showing)
//     const viewWeights = {};
//     viewedProfiles.forEach((view) => {
//       const daysSinceViewed = Math.floor((Date.now() - view.viewed_at) / (1000 * 60 * 60 * 24));
//       viewWeights[view.viewed_id.toString()] = 1 - (daysSinceViewed / 33);
//     });
    
//     const oppositeGender = user.gender === "Male" ? "Female" : "Male";
    
//     // Get all connections involving this user (both sent and received)
//     const connections = await Connection.find({
//       $or: [
//         { sender: user_id },
//         { receiver: user_id }
//       ]
//     });
    
//     // Create maps for quick lookups of connection status
//     const connectionMap = {};
//     connections.forEach(conn => {
//       if (conn.sender.toString() === user_id.toString()) {
//         connectionMap[conn.receiver.toString()] = {
//           status: conn.status,
//           direction: 'sent',
//           updatedAt: conn.updatedAt
//         };
//       } else {
//         connectionMap[conn.sender.toString()] = {
//           status: conn.status,
//           direction: 'received',
//           updatedAt: conn.updatedAt
//         };
//       }
//     });
    
//     // Get all likes by this user
//     const likes = await Like.find({ user: user_id });
//     const likedProfileIds = likes.map(like => like.userLikedTo.toString());
    
//     // Get all profiles that liked this user
//     const likedByProfiles = await Like.find({ userLikedTo: user_id });
//     const likedByProfileIds = likedByProfiles.map(like => like.user.toString());
    
//     // Create list of blocked profiles (to exclude from results)
//     const blockedProfileIds = [];
//     for (const [profileId, connInfo] of Object.entries(connectionMap)) {
//       if (connInfo.status === 'Blocked') {
//         blockedProfileIds.push(mongoose.Types.ObjectId(profileId));
//       }
//     }
    
//     // Base matching criteria
//     const matchCriteria = {
//       _id: { 
//         $ne: new mongoose.Types.ObjectId(user_id),
//         $nin: blockedProfileIds
//       },
//       gender: oppositeGender,
//       active: true,
//       profileStatus: "Complete"
//     };
    
//     // Add new users filter if requested
//     if (newUsersOnly) {
//       const oneMonthAgo = new Date();
//       oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
//       matchCriteria.created_at = { $gte: oneMonthAgo };
//     }
    
//     // Get current date for time-based calculations
//     const currentDate = new Date();
//     const currentHour = currentDate.getHours();
//     const currentDay = currentDate.getDay();
//     const currentWeek = Math.floor(currentDate.getDate() / 7);
    
//     // Start building the aggregation pipeline
    const pipeline = [
      { $match: matchCriteria },
      
      // Lookup user preferences for better matching
      {
        $lookup: {
          from: "partner_preferences",
          localField: "_id",
          foreignField: "user_id",
          as: "theirPreferences"
        }
      },
      { $unwind: { path: "$theirPreferences", preserveNullAndEmptyArrays: true } },
      
      // Calculate match score based on multiple criteria
      {
        $addFields: {
          ageInYears: { 
            $floor: { 
              $divide: [
                { $subtract: [new Date(), "$dob"] }, 
                31536000000 // ms in a year
              ] 
            } 
          },
          
          // Base match score calculations
          ageMatchScore: {
            $cond: {
              if: { 
                $and: [
                  { $gte: [{ $divide: [{ $subtract: [new Date(), "$dob"] }, 31536000000] }, userPreferences.min_age] },
                  { $lte: [{ $divide: [{ $subtract: [new Date(), "$dob"] }, 31536000000] }, userPreferences.max_age] }
                ]
              },
              then: 20,
              else: {
                $max: [
                  0,
                  {
                    $subtract: [
                      20,
                      {
                        $min: [
                          20,
                          {
                            $multiply: [
                              2,
                              {
                                $min: [
                                  { $abs: { $subtract: [{ $divide: [{ $subtract: [new Date(), "$dob"] }, 31536000000] }, userPreferences.min_age] } },
                                  { $abs: { $subtract: [{ $divide: [{ $subtract: [new Date(), "$dob"] }, 31536000000] }, userPreferences.max_age] } }
                                ]
                              }
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
          
          // Height match score
          heightMatchScore: {
            $cond: {
              if: { 
                $and: [
                  { $gte: ["$heightInCm", userPreferences.min_height_in_cm] },
                  { $lte: ["$heightInCm", userPreferences.max_height_in_cm] }
                ]
              },
              then: 15,
              else: {
                $max: [
                  0,
                  {
                    $subtract: [
                      15,
                      {
                        $min: [
                          15,
                          {
                            $divide: [
                              {
                                $min: [
                                  { $abs: { $subtract: ["$heightInCm", userPreferences.min_height_in_cm] } },
                                  { $abs: { $subtract: ["$heightInCm", userPreferences.max_height_in_cm] } }
                                ]
                              },
                              5
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
          
          // Religion match
          religionMatchScore: {
            $cond: { 
              if: { $eq: ["$religion", userPreferences.religion] }, 
              then: 15, 
              else: 0 
            }
          },
          
          // Mother tongue match
          motherTongueMatchScore: {
            $cond: { 
              if: { $eq: ["$mother_tongue", userPreferences.mother_tongue] }, 
              then: 10, 
              else: 0 
            }
          },
          
          // Marital status match
          maritalStatusMatchScore: {
            $cond: { 
              if: { $eq: ["$marital_status", userPreferences.marital_status] }, 
              then: 10, 
              else: 0 
            }
          },
          
          // Education match
          educationMatchScore: {
            $cond: { 
              if: { $eq: ["$highest_education", userPreferences.highest_education] }, 
              then: 10, 
              else: 0 
            }
          },
          
          // Employment match
          employmentMatchScore: {
            $cond: { 
              if: { $eq: ["$employed_in", userPreferences.employed_in] }, 
              then: 5, 
              else: 0 
            }
          },
          
          // Add profile freshness boost
          freshness: {
            $let: {
              vars: {
                daysSinceCreation: { 
                  $divide: [
                    { $subtract: [new Date(), "$created_at"] }, 
                    86400000 // ms in a day
                  ] 
                },
                daysSinceUpdate: { 
                  $divide: [
                    { $subtract: [new Date(), "$updated_at"] }, 
                    86400000 
                  ] 
                }
              },
              in: {
                $sum: [
                  // New profile boost (0-10 points)
                  {
                    $max: [
                      0,
                      { $subtract: [10, { $min: [10, "$$daysSinceCreation"] }] }
                    ]
                  },
                  // Recently updated profile boost (0-5 points)
                  {
                    $max: [
                      0,
                      { $subtract: [5, { $min: [5, "$$daysSinceUpdate"] }] }
                    ]
                  }
                ]
              }
            }
          },
          
          // Add time-based rotation factor
          rotationFactor: {
            $switch: {
              branches: [
                // Morning profiles (6am-12pm)
                {
                  case: { $and: [
                    { $gte: [currentHour, 6] },
                    { $lt: [currentHour, 12] }
                  ]},
                  then: { $mod: [{ $add: ["$heightInCm", currentDay] }, 5] }
                },
                // Afternoon profiles (12pm-6pm)
                {
                  case: { $and: [
                    { $gte: [currentHour, 12] },
                    { $lt: [currentHour, 18] }
                  ]},
                  then: { $mod: [{ $add: [{ $strLenCP: "$fullName" }, currentDay] }, 5] }
                },
                // Evening profiles (6pm-12am)
                {
                  case: { $and: [
                    { $gte: [currentHour, 18] },
                    { $lt: [currentHour, 24] }
                  ]},
                  then: { $mod: [{ $add: [{ $strLenCP: "$city" }, currentDay] }, 5] }
                },
                // Night profiles (12am-6am)
                {
                  case: { $and: [
                    { $gte: [currentHour, 0] },
                    { $lt: [currentHour, 6] }
                  ]},
                  then: { $mod: [{ $add: [{ $strLenCP: "$occupation" }, currentDay] }, 5] }
                }
              ],
              default: 0
            }
          },
          
          // Add weekly rotation factor
          weeklyBoost: {
            $cond: {
              if: { $eq: [{ $mod: [{ $add: [{ $strLenBytes: { $toString: "$_id" } }, currentWeek] }, 4] }, 0] },
              then: 15,
              else: 0
            }
          },
          
          // Add random factor for variety
          randomBoost: { $multiply: [{ $rand: {} }, 5] }
        }
      },
      
      // Calculate initial score (without the function-based components)
      {
        $addFields: {
          initialScore: {
            $add: [
              "$ageMatchScore",
              "$heightMatchScore",
              "$religionMatchScore",
              "$motherTongueMatchScore",
              "$maritalStatusMatchScore", 
              "$educationMatchScore",
              "$employmentMatchScore",
              "$freshness",
              "$rotationFactor",
              "$weeklyBoost",
              "$randomBoost"
            ]
          }
        }
      },
      
      // Sort by initial score (this will be refined in JavaScript)
      { $sort: { initialScore: -1 } },
      
      // Get a larger batch than needed to allow for JavaScript post-processing
      { $limit: limit * 3 },
      
      // Project only necessary fields for the response
      {
        $project: {
          _id: 1,
          fullName: 1,
          profile_image: 1,
          age: "$ageInYears",
          height: 1,
          religion: 1,
          caste: 1,
          city: 1,
          state: 1,
          occupation: 1,
          annual_income:1,
          marital_status:1,
          highest_education: 1,
          initialScore: 1,
          freshness: 1,
          created_at: 1,
          updated_at: 1
        }
      }
    ];
    
//     // Execute aggregation
//     let potentialMatches = await User.aggregate(pipeline);
    
//     // Post-process in JavaScript to apply connection status, likes, and viewing history
//     potentialMatches = potentialMatches.map(profile => {
//       const profileId = profile._id.toString();
//       let finalScore = profile.initialScore;
      
//       // Add connection status
//       if (connectionMap[profileId]) {
//         profile.connectionStatus = connectionMap[profileId].status;
//         profile.connectionDirection = connectionMap[profileId].direction;
        
//         // Add boost for mutual connections
//         if (profile.connectionStatus === 'Accepted') {
//           finalScore += 15;
//         } else if (profile.connectionStatus === 'Pending' && profile.connectionDirection === 'received') {
//           finalScore += 10; // Boost for received requests
//         }
//       } else {
//         profile.connectionStatus = 'None';
//         profile.connectionDirection = 'None';
//       }
      
//       // Add like status
//       profile.isLiked = likedProfileIds.includes(profileId);
//       profile.isLikedBy = likedByProfileIds.includes(profileId);
      
//       // Add boost for mutual interest
//       if (profile.isLikedBy) {
//         finalScore += 20; // Boost profiles that liked the user
//       }
      
//       // Apply viewing penalty
//       if (viewedProfileIds.includes(profileId)) {
//         const viewPenalty = viewWeights[profileId] * 100;
//         finalScore -= viewPenalty;
//       }
      
//       profile.finalScore = finalScore;
//       return profile;
//     });
    
//     // Sort again by the final score after JavaScript processing
//     potentialMatches.sort((a, b) => b.finalScore - a.finalScore);
    
//     // Apply pagination in JavaScript after complete processing
//     const matchedUsers = potentialMatches.slice(0, limit);
    
//     // Record these profile views
//     if (matchedUsers.length > 0) {
//       const profileViews = matchedUsers.map(profile => ({
//         viewer_id: user_id,
//         viewed_id: profile._id,
//         viewed_at: new Date()
//       }));
      
//       // Use bulkWrite for better performance
//       await ProfileView.bulkWrite(
//         profileViews.map(view => ({
//           updateOne: {
//             filter: { 
//               viewer_id: view.viewer_id,
//               viewed_id: view.viewed_id
//             },
//             update: { $set: view },
//             upsert: true
//           }
//         }))
//       );
//     }
    
//     // Get total count for pagination
//     const totalCount = await User.countDocuments(matchCriteria);
    
//     return res.status(200).json({
//       success: true,
//       message: "Matched users found successfully.",
//       data: matchedUsers,
//       pagination: {
//         totalProfiles: totalCount,
//         currentPage: page,
//         totalPages: Math.ceil(totalCount / limit),
//         hasNextPage: page < Math.ceil(totalCount / limit),
//         profilesPerPage: limit
//       }
//     });
//   } catch (error) {
//     console.error("Error in matchedUsers:", error);
//     next(error);
//   }
// };

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
  matchedProfiles,
};
