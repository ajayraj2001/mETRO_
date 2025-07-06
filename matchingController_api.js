//my matches API  ----------
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
      .select('_id fullName dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge subscriptionStatus profileId')
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
      .select('_id fullName dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge gender')
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