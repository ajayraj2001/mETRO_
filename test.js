const getMyMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'relevance';

    let sessionId = req.query.sessionId;
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
    }

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
    
    const baseQuery = {
      _id: { $ne: userId },
      gender: genderFilter,
      profileStatus: 'Complete',
      permanentlyDeleted: { $ne: true },
      active: true
    };

    // Build match query based on preferences
    const matchQuery = { ...baseQuery };

    // Age filter
    if (userPreferences.min_age && userPreferences.max_age) {
      const today = new Date();
      const minBirthYear = today.getFullYear() - userPreferences.max_age;
      const maxBirthYear = today.getFullYear() - userPreferences.min_age;
      
      matchQuery.dob = {
        $gte: new Date(minBirthYear, 0, 1),
        $lte: new Date(maxBirthYear, 11, 31)
      };
    }

    // Height filter
    if (userPreferences.min_height_in_cm && userPreferences.max_height_in_cm) {
      matchQuery.heightInCm = {
        $gte: userPreferences.min_height_in_cm,
        $lte: userPreferences.max_height_in_cm
      };
    }

    // Marital status filter
    if (userPreferences.marital_status && userPreferences.marital_status !== 'Any') {
      matchQuery.marital_status = userPreferences.marital_status;
    }

    // Religion filter
    if (userPreferences.religion && userPreferences.religion !== 'Any') {
      matchQuery.religion = userPreferences.religion;
    }

    // Caste filter (only if any_caste is false)
    if (!userPreferences.any_caste && currentUser.caste) {
      matchQuery.caste = currentUser.caste;
    }

    // Mother tongue filter
    if (userPreferences.mother_tongue && userPreferences.mother_tongue !== 'Any') {
      matchQuery.mother_tongue = userPreferences.mother_tongue;
    }

    // Education filter
    if (userPreferences.highest_education && userPreferences.highest_education !== 'Any') {
      matchQuery.highest_education = userPreferences.highest_education;
    }

    // Employment filter
    if (userPreferences.employed_in && userPreferences.employed_in !== 'Any') {
      matchQuery.employed_in = userPreferences.employed_in;
    }

    // Income filter
    if (userPreferences.min_salary && userPreferences.max_salary) {
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          {
            min_salary: { $gte: userPreferences.min_salary },
            max_salary: { $lte: userPreferences.max_salary }
          },
          {
            min_salary: { $lte: userPreferences.max_salary },
            max_salary: { $gte: userPreferences.min_salary }
          }
        ]
      });
    }

    // Manglik filter
    if (userPreferences.manglik && userPreferences.manglik !== 'Does not matter') {
      matchQuery.manglik = userPreferences.manglik;
    }

    // State filter (if specified)
    if (userPreferences.state && userPreferences.state !== 'Any') {
      matchQuery.state = userPreferences.state;
    }

    // Get total count of exact matches
    let exactMatchCount = await User.countDocuments(matchQuery);
    
    // Create relaxed queries for broader matching
    const relaxedQueries = [];
    
    // Level 1: Remove employment and education filters
    const level1Query = { ...matchQuery };
    delete level1Query.highest_education;
    delete level1Query.employed_in;
    
    // Level 2: Remove mother tongue and expand height range
    const level2Query = { ...level1Query };
    delete level2Query.mother_tongue;
    if (level2Query.heightInCm) {
      level2Query.heightInCm = {
        $gte: level2Query.heightInCm.$gte - 5,
        $lte: level2Query.heightInCm.$lte + 5
      };
    }
    
    // Level 3: Remove caste and expand age range
    const level3Query = { ...level2Query };
    delete level3Query.caste;
    if (level3Query.dob) {
      const minDate = new Date(level3Query.dob.$gte);
      minDate.setFullYear(minDate.getFullYear() - 2);
      const maxDate = new Date(level3Query.dob.$lte);
      maxDate.setFullYear(maxDate.getFullYear() + 2);
      level3Query.dob = { $gte: minDate, $lte: maxDate };
    }
    
    // Level 4: Remove manglik filter
    const level4Query = { ...level3Query };
    delete level4Query.manglik;
    
    // Level 5: Keep only essential filters (gender, age range expanded)
    const level5Query = { ...baseQuery };
    if (userPreferences.min_age && userPreferences.max_age) {
      const today = new Date();
      const minBirthYear = today.getFullYear() - userPreferences.max_age - 5;
      const maxBirthYear = today.getFullYear() - userPreferences.min_age + 5;
      level5Query.dob = {
        $gte: new Date(minBirthYear, 0, 1),
        $lte: new Date(maxBirthYear, 11, 31)
      };
    }

    relaxedQueries.push(level1Query, level2Query, level3Query, level4Query, level5Query);

    // Determine which query to use based on available matches
    let finalQuery = matchQuery;
    let matchLevel = 'exact';
    let totalCount = exactMatchCount;

    const minDesiredMatches = page * limit + 20; // Ensure we have enough for pagination

    if (exactMatchCount < minDesiredMatches) {
      for (let i = 0; i < relaxedQueries.length; i++) {
        const relaxedCount = await User.countDocuments(relaxedQueries[i]);
        if (relaxedCount >= minDesiredMatches) {
          finalQuery = relaxedQueries[i];
          matchLevel = `relaxed_level_${i + 1}`;
          totalCount = relaxedCount;
          break;
        }
        if (i === relaxedQueries.length - 1) {
          finalQuery = relaxedQueries[i];
          matchLevel = `relaxed_level_${i + 1}`;
          totalCount = relaxedCount;
        }
      }
    }

    // Sort options
    let sortOption = {};
    if (sortBy === 'newest') {
      sortOption = { created_at: -1 };
    } else if (sortBy === 'photo_first') {
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
    } else {
      // Default relevance sort
      sortOption = { 
        verifiedBadge: -1,
        subscriptionStatus: -1,
        created_at: -1 
      };
    }

    // Fetch matches with pagination
    const matches = await User.find(finalQuery)
      .select('_id fullName dob profile_image height heightInCm city state religion caste marital_status highest_education occupation annual_income manglik created_at verifiedBadge subscriptionStatus profileId')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate age and format data
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
      
      // Add match percentage (based on how many criteria matched)
      let matchPercentage = 100;
      if (matchLevel !== 'exact') {
        const levelNum = parseInt(matchLevel.split('_')[2]);
        matchPercentage = Math.max(50, 100 - (levelNum * 10));
      }
      match.matchPercentage = matchPercentage;
      
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

    // Response format matching existing API
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
        sessionId: sessionId,
        matchInfo: {
          exactMatches: exactMatchCount,
          totalMatches: totalCount,
          matchLevel: matchLevel,
          criteriaRelaxed: matchLevel !== 'exact'
        },
        refreshBehavior: {
          refreshType: sortBy === 'rotation' ? "session" : "stable",
          refreshInfo: sortBy === 'rotation'
            ? "Different profiles shown on each refresh"
            : "Consistent ordering within sort criteria"
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