const mongoose = require('mongoose');
const { User, PartnerPreferences, Like } = require('../../models');

// Utility function to calculate match percentage
const calculateMatchPercentage = (user, potentialMatch, preferences) => {
  let matchScore = 0;
  let totalCriteria = 0;

  // Age match
  if (potentialMatch.dob) {
    const age = new Date().getFullYear() - new Date(potentialMatch.dob).getFullYear();
    if (preferences.min_age <= age && age <= preferences.max_age) {
      matchScore += 1;
    }
    totalCriteria += 1;
  }

  // Height match
  if (potentialMatch.heightInCm) {
    if (preferences.min_height_in_cm <= potentialMatch.heightInCm &&
      potentialMatch.heightInCm <= preferences.max_height_in_cm) {
      matchScore += 1;
    }
    totalCriteria += 1;
  }

  // Religion match
  if (potentialMatch.religion === preferences.religion) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Caste match (if any_caste is false)
  if (!preferences.any_caste && potentialMatch.caste) {
    if (user.caste === potentialMatch.caste) {
      matchScore += 1;
    }
    totalCriteria += 1;
  }

  // Mother tongue match
  if (potentialMatch.mother_tongue === preferences.mother_tongue) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Marital status match
  if (potentialMatch.marital_status === preferences.marital_status) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Education match
  if (potentialMatch.highest_education === preferences.highest_education) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Employment match
  if (potentialMatch.employed_in === preferences.employed_in) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Income match
  if (potentialMatch.min_salary && potentialMatch.max_salary) {
    if ((potentialMatch.min_salary >= preferences.min_salary &&
      potentialMatch.min_salary <= preferences.max_salary) ||
      (potentialMatch.max_salary >= preferences.min_salary &&
        potentialMatch.max_salary <= preferences.max_salary)) {
      matchScore += 1;
    }
    totalCriteria += 1;
  }

  // State match
  if (preferences.state && potentialMatch.state === preferences.state) {
    matchScore += 1;
    totalCriteria += 1;
  }

  // Manglik match
  if (potentialMatch.manglik === preferences.manglik) {
    matchScore += 1;
    totalCriteria += 1;
  }

  return totalCriteria > 0 ? Math.round((matchScore / totalCriteria) * 100) : 0;
};

/**
 * Get New Matches - Recently joined users that match preferences
 * Strategy: 
 * - Show profiles created in last 15 days, prioritizing newest
 * - If fewer matches found, extend days gradually to 30, 60, 90 days
 * - Implement consistent paged results that don't change on refresh
 */
const getNewMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    // Get current user and preferences
    const currentUser = await User.findById(userId);
    const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

    if (!currentUser || !userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User profile or preferences not found'
      });
    }

    // Basic gender filter
    const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

    // Start with 15 days and gradually increase if needed
    const searchPeriods = [15, 30, 60, 90];
    let matches = [];
    let totalCount = 0;
    let period = searchPeriods[0];
    let matchDate = new Date();

    // Try different periods until we get enough matches
    for (let i = 0; i < searchPeriods.length; i++) {
      period = searchPeriods[i];
      matchDate = new Date();
      matchDate.setDate(matchDate.getDate() - period);

      // Build query based on preferences
      // const query = {
      //   _id: { $ne: userId },
      //   gender: genderFilter,
      //   profileStatus: 'Complete',
      //   created_at: { $gte: matchDate }
      // };

      // Build query based on preferences
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const query = {
        _id: { $ne: userId },
        gender: genderFilter,
        profileStatus: 'Complete',
        created_at: { $gte: matchDate, $lte: twoDaysAgo }  // 🟢 Add upper limit
      };

      // Add basic preference filters
      // if (userPreferences.religion) query.religion = userPreferences.religion;

      // Add marital status filter
      // if (userPreferences.marital_status) {
      //   query.marital_status = userPreferences.marital_status;
      // }

      // // Add age filter
      // if (userPreferences.min_age && userPreferences.max_age) {
      //   const minDate = new Date();
      //   minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

      //   const maxDate = new Date();
      //   maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

      //   query.dob = { $gte: minDate, $lte: maxDate };
      // }

      // Check total count for this period
      totalCount = await User.countDocuments(query);

      // If we have at least some matches or this is the last attempt, proceed
      if (totalCount >= limit || i === searchPeriods.length - 1) {
        // Get matches with pagination
        matches = await User.find(query)
          // .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus created_at')
          .select('_id fullName profileId dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge')
          .sort({ created_at: -1, verifiedBadge: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        break;
      }
    }


    // ==== ✨ CHANGE: Added Age calculation logic ====
    const today = new Date();
    matches = matches.map(match => {
      if (match.dob) {
        const birthDate = new Date(match.dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        match.age = age; // ✅ Add age field
      }
      return match;
    });
    // ==== ✅ END of Age block ====

    // Calculate match percentage and process matches
    // const processedMatches = matches.map(match => {
    //   // Calculate match percentage
    //   match.matchPercentage = calculateMatchPercentage(currentUser, match, userPreferences);

    //   // Calculate age from DOB
    //   if (match.dob) {
    //     const today = new Date();
    //     const birthDate = new Date(match.dob);
    //     let age = today.getFullYear() - birthDate.getFullYear();
    //     const m = today.getMonth() - birthDate.getMonth();
    //     if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    //       age--;
    //     }
    //     match.age = age;
    //   }

    //   // Calculate days since joined
    //   const createdDate = new Date(match.created_at);
    //   const currentDate = new Date();
    //   const diffTime = Math.abs(currentDate - createdDate);
    //   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    //   // Add join label
    //   if (diffDays <= 1) {
    //     match.joinedLabel = "Joined today";
    //   } else {
    //     match.joinedLabel = `Joined ${diffDays} days ago`;
    //   }

    //   return match;
    // });

    const profileIds = matches.map(p => p._id);
    const likes = await Like.find({
      user: userId,
      userLikedTo: { $in: profileIds }
    }).lean();

    const likedMap = new Map();
    likes.forEach(like => likedMap.set(like.userLikedTo.toString(), true));

    const processedMatches = matches.map(match => ({
      ...match,
      liked: likedMap.has(match._id.toString())
    }));


    // Build meaningful response
    return res.status(200).json({
      success: true,
      data: {
        matches: processedMatches,
        pagination: {
          total: totalCount,
          page,
          hasNextPages: page < Math.ceil(totalCount / limit),
          pages: Math.ceil(totalCount / limit),
          limit
        },
        daysSearched: period
      }
    });
  } catch (error) {
    console.error('Error in getNewMatches:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get Today's Matches - Daily curated selection
 * Strategy:
 * - Create date-based seed for consistent daily results
 * - Rotate matches daily but remain stable within a day
 * - If too few matches, gradually relax criteria
 * - Add freshness indicators that change daily
 */
// const getTodaysMatches = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const limit = parseInt(req.query.limit) || 9;
//     const page = parseInt(req.query.page) || 1;
//     const skip = (page - 1) * limit;

//     const [currentUser, userPreferences] = await Promise.all([
//       User.findById(userId),
//       PartnerPreferences.findOne({ user_id: userId }),
//     ]);

//     if (!currentUser || !userPreferences) {
//       return res.status(400).json({
//         success: false,
//         message: 'User profile or preferences not found'
//       });
//     }

//     const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const dateSeed = today.toISOString().split('T')[0] + userId.toString();

//     const createHash = (str) => {
//       let hash = 0;
//       for (let i = 0; i < str.length; i++) {
//         const char = str.charCodeAt(i);
//         hash = ((hash << 5) - hash) + char;
//         hash = hash & hash;
//       }
//       return Math.abs(hash);
//     };

//     // Initial Query
//     let query = {
//       _id: { $ne: userId },
//       gender: genderFilter,
//       profileStatus: 'Complete',
//     };

//     if (userPreferences.marital_status) query.marital_status = userPreferences.marital_status;

//     if (userPreferences.min_age && userPreferences.max_age) {
//       const minDOB = new Date();
//       minDOB.setFullYear(minDOB.getFullYear() - userPreferences.max_age);
//       const maxDOB = new Date();
//       maxDOB.setFullYear(maxDOB.getFullYear() - userPreferences.min_age);
//       query.dob = { $gte: minDOB, $lte: maxDOB };
//     }

//     // Relaxation logic
//     const relaxationSteps = [
//       { criteria: 'mother_tongue', action: 'remove' },
//       { criteria: 'caste', action: 'remove' },
//       { criteria: 'marital_status', action: 'remove' },
//       { criteria: 'dob', action: 'expand', factor: 5 }
//     ];

//     let relaxationIndex = 0;
//     let currentQuery = { ...query };
//     let matchCount = await User.countDocuments(currentQuery);

//     while (matchCount < limit * 1.5 && relaxationIndex < relaxationSteps.length) {
//       const step = relaxationSteps[relaxationIndex];

//       if (step.action === 'remove' && currentQuery[step.criteria]) {
//         delete currentQuery[step.criteria];
//       } else if (step.action === 'expand' && step.criteria === 'dob' && currentQuery.dob) {
//         const newMin = new Date(currentQuery.dob.$gte);
//         newMin.setFullYear(newMin.getFullYear() - step.factor);
//         const newMax = new Date(currentQuery.dob.$lte);
//         newMax.setFullYear(newMax.getFullYear() + step.factor);
//         currentQuery.dob = { $gte: newMin, $lte: newMax };
//       }

//       matchCount = await User.countDocuments(currentQuery);
//       relaxationIndex++;
//     }

//     // Get ALL matches first to sort and score
//     let allMatches = await User.find(currentQuery)
//       .select('_id fullName dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge')
//       .lean();

//     const specialTags = [
//       "Perfect match for you", "High compatibility", "Recommended today",
//       "Selected for you", "Great personality match", "Similar interests", "Compatible background"
//     ];

//     // Add age, score, tag
//     let processedMatches = allMatches.map(match => {
//       if (match.dob) {
//         const birth = new Date(match.dob);
//         let age = today.getFullYear() - birth.getFullYear();
//         const m = today.getMonth() - birth.getMonth();
//         if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
//         match.age = age;
//       }

//       const combinedString = dateSeed + match._id.toString();
//       const hashValue = createHash(combinedString);
//       const dailyScore = (hashValue % 1000) / 1000;

//       match.finalScore = dailyScore * 100;

//       if (match.finalScore > 70) {
//         const tagIndex = createHash(combinedString) % specialTags.length;
//         match.specialTag = specialTags[tagIndex];
//       }

//       return match;
//     });

//     // Sort and paginate
//     processedMatches.sort((a, b) => b.finalScore - a.finalScore);
//     const totalCount = processedMatches.length;
//     const paginatedMatches = processedMatches.slice(skip, skip + limit);

//     // Get only LIKEs for shown users
//     const matchIds = paginatedMatches.map(u => u._id);
//     const likedDocs = await Like.find({
//       user: userId,
//       userLikedTo: { $in: matchIds }
//     })

//     const likedUserIds = likedDocs.map(doc => doc.userLikedTo.toString());

//     // Append liked status
//     const finalMatches = paginatedMatches.map(match => ({
//       ...match,
//       liked: likedUserIds.includes(match._id.toString())
//     }));

//     // Refresh time
//     const now = new Date();
//     const midnight = new Date(now);
//     midnight.setDate(midnight.getDate() + 1);
//     midnight.setHours(0, 0, 0, 0);

//     const millisecondsUntilMidnight = midnight - now;
//     const hoursUntilMidnight = Math.floor(millisecondsUntilMidnight / (1000 * 60 * 60));
//     const minutesUntilMidnight = Math.floor((millisecondsUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

//     return res.status(200).json({
//       success: true,
//       data: {
//         matches: finalMatches,
//         pagination: {
//           total: totalCount,
//           page,
//           hasNextPages: page < Math.ceil(totalCount / limit),
//           pages: Math.ceil(totalCount / limit),
//           limit
//         },
//         refreshBehavior: {
//           refreshType: "daily",
//           refreshInfo: "New selection every day at midnight"
//         },
//         refreshesIn: {
//           hours: hoursUntilMidnight,
//           minutes: minutesUntilMidnight,
//           timestamp: midnight.getTime()
//         },
//         relaxationLevel: relaxationIndex,
//         criteriaAdjusted: relaxationIndex > 0
//       }
//     });
//   } catch (error) {
//     console.error('Error in getTodaysMatches:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

const getMyMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'newest'; // Default to newest first

    // SessionId removed - not needed for newest first sorting

    // Fetch current user and their preferences
    const currentUser = await User.findById(userId);
    const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

    if (!currentUser || !userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User profile or preferences not found'
      });
    }

    // Base query - opposite gender and complete profiles
    const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

    const matchQuery = {
      _id: { $ne: userId },
      gender: genderFilter,
      profileStatus: 'Complete',
      active: true
    };

    // STRICT FILTERS (Always apply these)

    // Religion filter - STRICT
    if (userPreferences.religion && userPreferences.religion !== 'Any') {
      matchQuery.religion = userPreferences.religion;
    }

    // RELAXED FILTERS

    // Age filter - Relaxed by 2 years on both sides
    if (userPreferences.min_age && userPreferences.max_age) {
      const today = new Date();
      const minBirthYear = today.getFullYear() - userPreferences.max_age - 2; // +2 years relaxation
      const maxBirthYear = today.getFullYear() - userPreferences.min_age + 2; // +2 years relaxation

      matchQuery.dob = {
        $gte: new Date(minBirthYear, 0, 1),
        $lte: new Date(maxBirthYear, 11, 31)
      };
    }

    // Height filter - Relaxed by 3cm on both sides
    if (userPreferences.min_height_in_cm && userPreferences.max_height_in_cm) {
      matchQuery.heightInCm = {
        $gte: userPreferences.min_height_in_cm - 4, // -3cm relaxation
        $lte: userPreferences.max_height_in_cm + 4  // +3cm relaxation
      };
    }

    // COMMENTED FILTERS (Uncomment when needed)

    // Marital status filter
    // if (userPreferences.marital_status && userPreferences.marital_status !== 'Any') {
    //   matchQuery.marital_status = userPreferences.marital_status;
    // }

    // Mother tongue filter
    // if (userPreferences.mother_tongue && userPreferences.mother_tongue !== 'Any') {
    //   matchQuery.mother_tongue = userPreferences.mother_tongue;
    // }

    // Caste filter (only if any_caste is false)
    // if (!userPreferences.any_caste && currentUser.caste) {
    //   matchQuery.caste = currentUser.caste;
    // }

    // Education filter
    // if (userPreferences.highest_education && userPreferences.highest_education !== 'Any') {
    //   matchQuery.highest_education = userPreferences.highest_education;
    // }

    // Employment filter
    // if (userPreferences.employed_in && userPreferences.employed_in !== 'Any') {
    //   matchQuery.employed_in = userPreferences.employed_in;
    // }

    // Income filter
    // if (userPreferences.min_salary && userPreferences.max_salary) {
    //   matchQuery.$and = matchQuery.$and || [];
    //   matchQuery.$and.push({
    //     $or: [
    //       {
    //         min_salary: { $gte: userPreferences.min_salary },
    //         max_salary: { $lte: userPreferences.max_salary }
    //       },
    //       {
    //         min_salary: { $lte: userPreferences.max_salary },
    //         max_salary: { $gte: userPreferences.min_salary }
    //       }
    //     ]
    //   });
    // }

    // Manglik filter
    // if (userPreferences.manglik && userPreferences.manglik !== 'Does not matter') {
    //   matchQuery.manglik = userPreferences.manglik;
    // }

    // State filter
    // if (userPreferences.state && userPreferences.state !== 'Any') {
    //   matchQuery.state = userPreferences.state;
    // }

    // Get total count of matches
    const totalCount = await User.countDocuments(matchQuery);

    // Sort options - Default to newest first
    let sortOption = { created_at: -1 }; // Show newest users at top

    if (sortBy === 'photo_first') {
      sortOption = {
        'profile_image.0': -1,
        created_at: -1
      };
    } else if (sortBy === 'premium_first') {
      sortOption = {
        verifiedBadge: -1,
        subscriptionStatus: -1,
        created_at: -1
      };
    }

    // Fetch matches with pagination
    const matches = await User.find(matchQuery)
      .select('_id fullName profileId dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge subscriptionStatus profileId')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate age
    const matchesWithAge = matches.map(match => {
      if (match.dob) {
        const today = new Date();
        const birthDate = new Date(match.dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        match.age = age;
      }
      return match;
    });

    // Get match IDs for like status check
    const matchIds = matchesWithAge.map(m => m._id);

    // Fetch liked status
    const likedDocs = await Like.find({
      user: userId,
      userLikedTo: { $in: matchIds }
    }).lean();

    const likedIds = new Set(likedDocs.map(like => like.userLikedTo.toString()));

    // Add liked flag to each match
    matchesWithAge.forEach(match => {
      match.liked = likedIds.has(match._id.toString());
    });

    // Response format
    return res.status(200).json({
      success: true,
      data: {
        matches: matchesWithAge,
        pagination: {
          total: totalCount,
          page,
          pages: Math.ceil(totalCount / limit),
          hasNextPages: page < Math.ceil(totalCount / limit),
          limit
        },
        totalMatches: totalCount, // Simple match count
        refreshBehavior: {
          refreshType: "stable",
          refreshInfo: "Newest profiles shown first"
        }
      }
    });

  } catch (error) {
    console.error('Error in getMyMatches:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getTodaysMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 9;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Get today's start and end timestamps
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const genderFilter = req.user.gender === 'Male' ? 'Female' : 'Male';

    // Simple query - just get today's users
    const query = {
      _id: { $ne: userId }, // Don't include current user
      profileStatus: 'Complete',
      gender: genderFilter,
      active: true,
      created_at: {
        $gte: today,
        $lt: tomorrow
      }
    };

    // Get total count
    const totalCount = await User.countDocuments(query);

    // Get paginated users sorted by newest first
    const todaysUsers = await User.find(query)
      .select('_id fullName profileId dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge gender')
      .sort({ created_at: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    const specialTags = [
      "New member today", "Just joined", "Fresh profile",
      "New to the community", "Recently joined", "Today's new member", "Welcome them!"
    ];

    // Process users - add age and tags
    const processedUsers = todaysUsers.map((user, index) => {
      // Calculate age if DOB exists
      if (user.dob) {
        const birth = new Date(user.dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        user.age = age;
      }

      // Add special tag
      const tagIndex = index % specialTags.length;
      user.specialTag = specialTags[tagIndex];

      // Simple score for display
      user.finalScore = 100 - (index * 5);

      return user;
    });

    // Get liked status for these users
    const userIds = processedUsers.map(u => u._id);
    const likedDocs = await Like.find({
      user: userId,
      userLikedTo: { $in: userIds }
    });

    const likedUserIds = likedDocs.map(doc => doc.userLikedTo.toString());

    // Add liked status
    const finalMatches = processedUsers.map(user => ({
      ...user,
      liked: likedUserIds.includes(user._id.toString())
    }));

    // Calculate refresh time (midnight)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);

    const millisecondsUntilMidnight = midnight - now;
    const hoursUntilMidnight = Math.floor(millisecondsUntilMidnight / (1000 * 60 * 60));
    const minutesUntilMidnight = Math.floor((millisecondsUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

    return res.status(200).json({
      success: true,
      data: {
        matches: finalMatches,
        pagination: {
          total: totalCount,
          page,
          hasNextPages: page < Math.ceil(totalCount / limit),
          pages: Math.ceil(totalCount / limit),
          limit
        },
        refreshBehavior: {
          refreshType: "daily",
          refreshInfo: "Today's new members"
        },
        refreshesIn: {
          hours: hoursUntilMidnight,
          minutes: minutesUntilMidnight,
          timestamp: midnight.getTime()
        },
        relaxationLevel: 0,
        criteriaAdjusted: false
      }
    });
  } catch (error) {
    console.error('Error in getTodaysMatches:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
/**
 * Get My Matches - Most compatible profiles with rotation strategy
 * Strategy:
 * - Strict preference matching with highest compatibility
 * - If too few, gradually relax criteria
 * - Implement rotation algorithm to show different profiles each time
 * - Combine deterministic and session-based rotation
 */

// const getMyMatches = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 9;
//     const skip = (page - 1) * limit;
//     const sortBy = req.query.sortBy || 'relevance';

//     let sessionId = req.query.sessionId;
//     if (!sessionId) {
//       sessionId = Math.random().toString(36).substring(2, 15);
//     }

//     const currentUser = await User.findById(userId);
//     const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

//     if (!currentUser || !userPreferences) {
//       return res.status(400).json({
//         success: false,
//         message: 'User profile or preferences not found'
//       });
//     }

//     const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

//     const query = {
//       _id: { $ne: userId },
//       gender: genderFilter,
//       profileStatus: 'Complete'
//     };

//     // Apply filters based on preferences
//     // if (userPreferences.min_age && userPreferences.max_age) {
//     //   const minDate = new Date();
//     //   minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

//     //   const maxDate = new Date();
//     //   maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

//     //   query.dob = { $gte: minDate, $lte: maxDate };
//     // }

//     // if (userPreferences.min_height_in_cm && userPreferences.max_height_in_cm) {
//     //   query.heightInCm = {
//     //     $gte: userPreferences.min_height_in_cm,
//     //     $lte: userPreferences.max_height_in_cm
//     //   };
//     // }

//     // if (userPreferences.religion) {
//     //   query.religion = userPreferences.religion;
//     // }

//     // if (userPreferences.mother_tongue) {
//     //   query.mother_tongue = userPreferences.mother_tongue;
//     // }

//     // if (userPreferences.marital_status) {
//     //   query.marital_status = userPreferences.marital_status;
//     // }

//     // if (!userPreferences.any_caste && currentUser.caste) {
//     //   query.caste = currentUser.caste;
//     // }

//     // if (userPreferences.highest_education) {
//     //   query.highest_education = userPreferences.highest_education;
//     // }

//     // if (userPreferences.employed_in) {
//     //   query.employed_in = userPreferences.employed_in;
//     // }

//     let totalCount = await User.countDocuments(query);
//     let relaxationLevel = 0;
//     let relaxedQuery = { ...query };

//     const minDesiredMatches = limit * 3;

//     const relaxationSteps = [
//       // { criteria: 'highest_education', action: 'remove' },
//       // { criteria: 'employed_in', action: 'remove' },
//       // { criteria: 'mother_tongue', action: 'remove' },
//       // { criteria: 'caste', action: 'remove' },
//       { criteria: 'heightInCm', action: 'expand', factor: 5 },
//       { criteria: 'dob', action: 'expand', factor: 3 }
//     ];

//     while (totalCount < minDesiredMatches && relaxationLevel < relaxationSteps.length) {
//       const step = relaxationSteps[relaxationLevel];
// // console.log('relaxationSteps[relaxationLevel]', relaxationSteps[relaxationLevel], 'step', step)
//       if (step.action === 'remove' && relaxedQuery[step.criteria]) {
//         delete relaxedQuery[step.criteria];
//       } else if (step.action === 'expand') {
//         if (step.criteria === 'heightInCm' && relaxedQuery.heightInCm) {
//           relaxedQuery.heightInCm = {
//             $gte: relaxedQuery.heightInCm.$gte - step.factor,
//             $lte: relaxedQuery.heightInCm.$lte + step.factor
//           };
//         } else if (step.criteria === 'dob' && relaxedQuery.dob) {
//           const minDate = new Date(relaxedQuery.dob.$gte);
//           minDate.setFullYear(minDate.getFullYear() - step.factor);

//           const maxDate = new Date(relaxedQuery.dob.$lte);
//           maxDate.setFullYear(maxDate.getFullYear() + step.factor);

//           relaxedQuery.dob = { $gte: minDate, $lte: maxDate };
//         }
//       }
//       totalCount = await User.countDocuments(relaxedQuery);
//       relaxationLevel++;
//     }

//     let sortOption = {};
//     if (sortBy === 'newest') {
//       sortOption = { created_at: -1 };
//     } else if (sortBy === 'photo_first') {
//       sortOption = { 'profile_image.0': { $exists: true } };
//     } else if (sortBy === 'premium_first') {
//       sortOption = { subscriptionStatus: -1, created_at: -1 };
//     } else {
//       sortOption = { subscriptionStatus: -1, _id: 1 };
//     }

//     const fetchLimit = Math.min(1000, totalCount);

//     const allPotentialMatches = await User.find(relaxedQuery)
//       // .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus created_at')
//       .select('_id fullName dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge')
//       .sort(sortOption)
//       .limit(fetchLimit)
//       .lean();

//     const matchesWithMeta = allPotentialMatches.map(match => {
//       // Age
//       if (match.dob) {
//         const today = new Date();
//         const birthDate = new Date(match.dob);
//         let age = today.getFullYear() - birthDate.getFullYear();
//         const m = today.getMonth() - birthDate.getMonth();
//         if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
//           age--;
//         }
//         match.age = age;
//       }

//       // Rotation Score
//       const combinedString = sessionId + match._id.toString();
//       let rotationScore = 0;
//       for (let i = 0; i < combinedString.length; i++) {
//         rotationScore += combinedString.charCodeAt(i);
//       }
//       match.rotationScore = rotationScore % 100;

//       return match;
//     });

//     if (sortBy === 'relevance') {
//       matchesWithMeta.sort((a, b) => {
//         if ((a.subscriptionStatus !== 'none') !== (b.subscriptionStatus !== 'none')) {
//           return a.subscriptionStatus !== 'none' ? -1 : 1;
//         }

//         return a.rotationScore - b.rotationScore;
//       });
//     } else if (sortBy === 'rotation') {
//       matchesWithMeta.sort((a, b) => {
//         if ((a.subscriptionStatus !== 'none') !== (b.subscriptionStatus !== 'none')) {
//           return a.subscriptionStatus !== 'none' ? -1 : 1;
//         }

//         return a.rotationScore - b.rotationScore;
//       });
//     }

//     const paginatedMatches = matchesWithMeta.slice(skip, skip + limit);
//     const matchIds = paginatedMatches.map(m => m._id);

//     // Fetch liked info only for visible matches
//     const likedDocs = await Like.find({
//       user: userId,
//       userLikedTo: { $in: matchIds }
//     })

//     const likedIds = likedDocs.map(like => like.userLikedTo.toString());

//     // Add `liked` flag
//     paginatedMatches.forEach(match => {
//       match.liked = likedIds.includes(match._id.toString());
//       delete match.rotationScore;
//     });

//     return res.status(200).json({
//       success: true,
//       data: {
//         matches: paginatedMatches,
//         pagination: {
//           total: totalCount,
//           page,
//           pages: Math.ceil(totalCount / limit),
//           hasNextPages: page < Math.ceil(totalCount / limit),
//           limit
//         },
//         sessionId: sessionId,
//         relaxationLevel: relaxationLevel > 0 ? relaxationLevel : null,
//         criteriaAdjusted: relaxationLevel > 0,
//         refreshBehavior: {
//           refreshType: sortBy === 'rotation' ? "session" : "stable",
//           refreshInfo: sortBy === 'rotation'
//             ? "Different profiles shown on each refresh"
//             : "Consistent ordering within sort criteria"
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error in getMyMatches:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

const getNearMeMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    let maxDistance = parseInt(req.query.distance) || 100; // in km

    const currentUser = await User.findById(userId);
    const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

    if (!currentUser || !userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User profile or preferences not found'
      });
    }

    if (
      !currentUser.location ||
      !currentUser.location.coordinates ||
      currentUser.location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message: 'Location not available. Please update your location.'
      });
    }

    const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

    let expandedDistance = maxDistance * 1000; // meters
    let results = [];
    let expansionCount = 0;
    const maxExpansionAttempts = 3;
    const minDesiredResults = limit * 2;

    // Loop to expand radius if results are too few
    while (results.length < minDesiredResults && expansionCount <= maxExpansionAttempts) {
      results = await User.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: currentUser.location.coordinates
            },
            distanceField: 'distance',
            maxDistance: expandedDistance,
            spherical: true,
            query: {
              _id: { $ne: userId },
              gender: genderFilter,
              profileStatus: 'Complete'
            }
          }
        },
        {
          $project: {
            _id: 1,
            fullName: 1,
            dob: 1,
            profile_image: 1,
            height: 1,
            heightInCm: 1,
            city: 1,
            state: 1,
            religion: 1,
            caste: 1,
            marital_status: 1,
            highest_education: 1,
            occupation: 1,
            annual_income: 1,
            manglik: 1,
            created_at: 1,
            verifiedBadge: 1,
            distance: 1,
            profileId: 1
          }
        },
        { $sort: { distance: 1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      if (results.length < minDesiredResults) {
        expandedDistance *= 1.5; // Increase search radius
        expansionCount++;
      } else {
        break;
      }
    }

    const matchIds = results.map(match => match._id);
    const likedDocs = await Like.find({
      user: userId,
      userLikedTo: { $in: matchIds }
    })
    const likedUserIds = new Set(likedDocs.map(doc => doc.userLikedTo.toString()));

    const matchesWithDetails = results.map(match => {
      // Age
      if (match.dob) {
        const today = new Date();
        const birthDate = new Date(match.dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        match.age = age;
      }

      // Distance text & tag
      const distanceKm = Math.round(match.distance / 1000);
      match.distance = distanceKm;

      if (distanceKm < 1) {
        match.distanceText = "Less than 1 km away";
      } else if (distanceKm === 1) {
        match.distanceText = "1 km away";
      } else {
        match.distanceText = `${distanceKm} km away`;
      }

      if (distanceKm <= 5) {
        match.locationTag = "Very close to you";
      } else if (distanceKm <= 15) {
        match.locationTag = "Near you";
      } else if (match.city === currentUser.city) {
        match.locationTag = `Same city: ${match.city}`;
      }

      // Like status
      match.liked = likedUserIds.has(match._id.toString());

      return match;
    });

    return res.status(200).json({
      success: true,
      data: {
        matches: matchesWithDetails,
        pagination: {
          total: results.length,
          page,
          hasNextPages: page < Math.ceil(results / limit),
          pages: Math.ceil(results.length / limit),
          limit,
          expandedRadiusInKm: expandedDistance / 1000,
          expansionLevel: expansionCount
        },
        userLocation: {
          city: currentUser.city,
          state: currentUser.state,
          coordinates: currentUser.location.coordinates
        },
        refreshBehavior: {
          refreshType: "location_based",
          refreshInfo: "Updates when your location changes or new profiles are added nearby"
        }
      }
    });
  } catch (error) {
    console.error('Error in getNearMeMatches:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get Discovery/More Matches - Explore profiles with relaxed criteria
 * Strategy:
 * - Much more relaxed criteria than My Matches
 * - Prioritize premium profiles for visibility
 * - Include profiles that may be outside strict preferences
 * - Maintain good randomization to show variety each time
 */

const getDiscoveryMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    // Generate a session seed for consistent yet varied results
    const sessionSeed = req.query.sessionSeed || Math.random().toString(36).substring(2, 15);

    // Get current user and preferences
    const currentUser = await User.findById(userId);
    const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

    if (!currentUser || !userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User profile or preferences not found'
      });
    }

    // Basic gender filter
    const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

    // For discovery, we use very relaxed criteria
    const query = {
      _id: { $ne: userId },
      gender: genderFilter,
      profileStatus: 'Complete'
    };

    // Keep only essential filters
    if (userPreferences.religion) {
      query.religion = userPreferences.religion;
    }

    // Add expanded age filter (much wider range)
    if (userPreferences.min_age && userPreferences.max_age) {
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - (userPreferences.max_age + 5));

      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - (userPreferences.min_age - 5));

      query.dob = { $gte: minDate, $lte: maxDate };
    }

    // Define premium query - we'll prioritize premium users
    const premiumQuery = {
      ...query,
      subscriptionStatus: { $ne: 'none' }
    };

    // Get counts
    const premiumCount = await User.countDocuments(premiumQuery);
    const totalCount = await User.countDocuments(query);

    // Calculate how many premium profiles to include (at least 30% of results)
    const premiumLimit = Math.min(
      premiumCount,
      Math.max(Math.ceil(limit * 0.3), 3)
    );

    // Get premium matches first (they always appear at top)
    let premiumMatches = [];
    if (premiumCount > 0) {
      premiumMatches = await User.find(premiumQuery)
        .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus profileVisibilityBoost')
        .sort({ profileVisibilityBoost: -1, created_at: -1 })
        .limit(premiumLimit)
        .lean();
    }

    // Calculate how many regular profiles to fetch
    const regularLimit = limit - premiumMatches.length;

    // Generate hash from session seed
    const generateHash = (str, salt = '') => {
      const combinedStr = str + salt;
      let hash = 0;
      for (let i = 0; i < combinedStr.length; i++) {
        const char = combinedStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    // Get regular matches with interesting randomization
    let regularMatches = [];
    if (regularLimit > 0) {
      // Exclude premium users and already fetched users
      const regularQuery = {
        ...query,
        subscriptionStatus: 'none',
        _id: {
          $ne: userId,
          $nin: premiumMatches.map(match => match._id)
        }
      };

      // Get a larger pool for random selection
      const poolSize = Math.min(totalCount - premiumCount, regularLimit * 5);
      const candidateMatches = await User.find(regularQuery)
        .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus created_at')
        .skip(page > 1 ? skip : 0)
        .limit(poolSize)
        .lean();

      // Score and sort the candidate matches
      const scoredMatches = candidateMatches.map(match => {
        // Calculate match percentage
        match.matchPercentage = calculateMatchPercentage(currentUser, match, userPreferences);

        // Calculate age
        if (match.dob) {
          const today = new Date();
          const birthDate = new Date(match.dob);
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          match.age = age;
        }

        // Generate a discovery score based on the session seed
        // This ensures variety but consistency within a session
        const discoveryScore = generateHash(sessionSeed, match._id.toString()) % 100;

        // Final discovery score: 50% match percentage, 50% randomness for variety
        match.discoveryScore = (match.matchPercentage * 0.5) + (discoveryScore * 0.5);

        return match;
      });

      // Sort by discovery score
      scoredMatches.sort((a, b) => b.discoveryScore - a.discoveryScore);

      // Take the top candidates after sorting
      regularMatches = scoredMatches.slice(0, regularLimit);
    }

    // Combine premium and regular matches
    const allMatches = [...premiumMatches, ...regularMatches];

    // Clean up internal scoring fields before sending
    allMatches.forEach(match => {
      delete match.discoveryScore;
    });

    // Add a special discovery tag to some profiles
    const discoveryTags = [
      "New discovery",
      "You might like",
      "Explore this profile",
      "Based on your preferences",
      "Recommended for you",
      "Outside your usual matches"
    ];

    allMatches.forEach(match => {
      const tagIndex = generateHash(match._id.toString(), sessionSeed) % discoveryTags.length;
      if (match.subscriptionStatus !== 'none' || Math.random() > 0.7) {
        match.discoveryTag = discoveryTags[tagIndex];
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        matches: allMatches,
        pagination: {
          total: totalCount,
          premiumTotal: premiumCount,
          page,
          hasNextPages: page < Math.ceil(totalCount / limit),
          pages: Math.ceil(totalCount / limit),
          limit
        },
        sessionSeed: sessionSeed,
        refreshBehavior: {
          refreshType: "discovery",
          refreshInfo: "Different selection on each visit, consistent within a session"
        }
      }
    });
  } catch (error) {
    console.error('Error in getDiscoveryMatches:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get all home page data in one efficient call
 * Strategy:
 * - Fetch preview data for all sections in parallel
 * - Limit each section to smaller preview size
 * - Include metadata for each section
 */

const getHomePageData = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get current user and preferences
    const currentUser = await User.findById(userId).select('-phone -email');

    const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

    if (!currentUser || !userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User profile or preferences not found'
      });
    }

    // Create custom request objects for each section
    const mockRes = {
      status: () => ({ json: (data) => data })
    };

    // Use Promise.all for parallel execution
    const [
      todaysMatchesResult,
      newMatchesResult,
      myMatchesResult,
      nearMeResult,
      discoveryMatchesResult
    ] = await Promise.all([
      getTodaysMatches({ ...req, query: { limit: 15 } }, mockRes),
      getNewMatches({ ...req, query: { limit: 10 } }, mockRes),
      getMyMatches({ ...req, query: { limit: 10, sortBy: 'rotation' } }, mockRes),
      getNearMeMatches({ ...req, query: { limit: 10 } }, mockRes),
      getDiscoveryMatches({ ...req, query: { limit: 10 } }, mockRes)
    ]);

    // Calculate profile completeness for user guidance
    const profileCompleteness = calculateProfileCompleteness(currentUser);

    // Calculate preference completeness
    const preferenceCompleteness = calculatePreferenceCompleteness(userPreferences);

    // Compose home page response
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: currentUser._id,
          name: currentUser.fullName,
          profileCompleteness: profileCompleteness,
          preferenceCompleteness: preferenceCompleteness,
          isPremium: currentUser.subscriptionStatus !== 'none',
          hasProfileImage: currentUser.profile_image && currentUser.profile_image.length > 0
        },
        sections: {
          todaysMatches: {
            title: "Today's Matches",
            description: "Refreshes daily at midnight",
            count: todaysMatchesResult.data.matches.length,
            total: todaysMatchesResult.data.matches.length,
            refreshesIn: todaysMatchesResult.data.refreshesIn,
            refreshType: "daily",
            matches: todaysMatchesResult.data.matches.slice(0, 5), // Preview only
            criteriaAdjusted: todaysMatchesResult.data.criteriaAdjusted
          },
          newMatches: {
            title: "New Matches",
            description: "Recently joined members matching your preferences",
            count: newMatchesResult.data.matches.length,
            total: newMatchesResult.data.pagination.total,
            refreshType: "static",
            matches: newMatchesResult.data.matches.slice(0, 5), // Preview only
            daysSearched: newMatchesResult.data.daysSearched
          },
          myMatches: {
            title: "My Matches",
            description: "Members matching your preferences",
            count: myMatchesResult.data.matches.length,
            total: myMatchesResult.data.pagination.total,
            refreshType: myMatchesResult.data.refreshBehavior.refreshType,
            matches: myMatchesResult.data.matches.slice(0, 5), // Preview only
            sessionId: myMatchesResult.data.sessionId,
            criteriaAdjusted: myMatchesResult.data.criteriaAdjusted
          },
          nearMe: {
            title: "Near Me",
            description: `Matches within ${nearMeResult.data.searchRadius.expanded} km of you`,
            count: nearMeResult.data.matches.length,
            total: nearMeResult.data.pagination.total,
            refreshType: "location_based",
            matches: nearMeResult.data.matches.slice(0, 5), // Preview only
            searchRadius: nearMeResult.data.searchRadius
          },
          discoveryMatches: {
            title: "More Matches",
            description: "Explore beyond your usual preferences",
            count: discoveryMatchesResult.data.matches.length,
            total: discoveryMatchesResult.data.pagination.total,
            refreshType: "discovery",
            matches: discoveryMatchesResult.data.matches.slice(0, 5), // Preview only
            sessionSeed: discoveryMatchesResult.data.sessionSeed
          }
        },
        // If user is missing key profile fields, suggest completing profile
        suggestions: generateUserSuggestions(currentUser, userPreferences)
      }
    });
  } catch (error) {
    console.error('Error in getHomePageData:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to calculate profile completeness
const calculateProfileCompleteness = (user) => {
  const requiredFields = [
    'fullName', 'dob', 'gender', 'marital_status', 'height', 'religion',
    'caste', 'mother_tongue', 'country', 'state', 'city', 'highest_education',
    'occupation', 'employed_in', 'annual_income', 'description'
  ];

  const profileImageWeight = 20; // 20% for profile photo
  const detailsWeight = 80; // 80% for profile details

  // Photo completeness
  const hasProfileImage = user.profile_image && user.profile_image.length > 0;
  const photoScore = hasProfileImage ? profileImageWeight : 0;

  // Profile details completeness
  let filledFields = 0;
  for (const field of requiredFields) {
    if (user[field] && user[field] !== '') {
      filledFields++;
    }
  }

  const detailsScore = (filledFields / requiredFields.length) * detailsWeight;
  return Math.round(photoScore + detailsScore);
};

// Helper function to calculate preference completeness
const calculatePreferenceCompleteness = (preferences) => {
  if (!preferences) return 0;

  const requiredFields = [
    'min_age', 'max_age', 'min_height', 'max_height', 'marital_status',
    'religion', 'mother_tongue', 'highest_education', 'employed_in',
    'annual_income', 'manglik'
  ];

  let filledFields = 0;
  for (const field of requiredFields) {
    if (preferences[field] !== undefined && preferences[field] !== null &&
      preferences[field] !== '') {
      filledFields++;
    }
  }

  return Math.round((filledFields / requiredFields.length) * 100);
};

// Generate personalized suggestions for the user
const generateUserSuggestions = (user, preferences) => {
  const suggestions = [];

  // Check if profile image exists
  if (!user.profile_image || user.profile_image.length === 0) {
    suggestions.push({
      type: "profile_image",
      title: "Add Profile Photo",
      description: "Profiles with photos get 10x more responses",
      priority: "high"
    });
  }

  // Check if profile is complete
  const profileCompleteness = calculateProfileCompleteness(user);
  if (profileCompleteness < 90) {
    suggestions.push({
      type: "profile_completion",
      title: "Complete Your Profile",
      description: `Your profile is ${profileCompleteness}% complete`,
      priority: "medium"
    });
  }

  // Check if preferences are set
  if (!preferences) {
    suggestions.push({
      type: "preferences",
      title: "Set Partner Preferences",
      description: "Tell us what you're looking for in a partner",
      priority: "high"
    });
  } else {
    const preferenceCompleteness = calculatePreferenceCompleteness(preferences);
    if (preferenceCompleteness < 80) {
      suggestions.push({
        type: "preferences_completion",
        title: "Complete Partner Preferences",
        description: `Your preferences are ${preferenceCompleteness}% complete`,
        priority: "medium"
      });
    }
  }

  // Check if premium
  if (!user.subscriptionStatus || user.subscriptionStatus === 'none') {
    suggestions.push({
      type: "premium",
      title: "Upgrade to Premium",
      description: "Get 3x more responses and contact information",
      priority: "low"
    });
  }

  return suggestions;
};

module.exports = {
  calculateMatchPercentage,
  getNewMatches,
  getTodaysMatches,
  getMyMatches,
  getNearMeMatches,
  getDiscoveryMatches,
  getHomePageData
};