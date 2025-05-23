const mongoose = require('mongoose');
const {User, PartnerPreferences} = require('../../models');

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
        const limit = parseInt(req.query.limit) || 10;
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
            const query = {
                _id: { $ne: userId },
                gender: genderFilter,
                profileStatus: 'Complete',
                created_at: { $gte: matchDate }
            };

            // Add basic preference filters
            if (userPreferences.religion) query.religion = userPreferences.religion;

            // Add marital status filter
            if (userPreferences.marital_status) {
                query.marital_status = userPreferences.marital_status;
            }

            // Add age filter
            if (userPreferences.min_age && userPreferences.max_age) {
                const minDate = new Date();
                minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

                const maxDate = new Date();
                maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

                query.dob = { $gte: minDate, $lte: maxDate };
            }

            // Check total count for this period
            totalCount = await User.countDocuments(query);

            // If we have at least some matches or this is the last attempt, proceed
            if (totalCount >= limit || i === searchPeriods.length - 1) {
                // Get matches with pagination
                matches = await User.find(query)
                    .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus created_at')
                    .sort({ created_at: -1, verifiedBadge: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                break;
            }
        }

        // Calculate match percentage and process matches
        const processedMatches = matches.map(match => {
            // Calculate match percentage
            match.matchPercentage = calculateMatchPercentage(currentUser, match, userPreferences);

            // Calculate age from DOB
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

            // Calculate days since joined
            const createdDate = new Date(match.created_at);
            const currentDate = new Date();
            const diffTime = Math.abs(currentDate - createdDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Add join label
            if (diffDays <= 1) {
                match.joinedLabel = "Joined today";
            } else {
                match.joinedLabel = `Joined ${diffDays} days ago`;
            }

            return match;
        });

        // Build meaningful response
        return res.status(200).json({
            success: true,
            data: {
                matches: processedMatches,
                pagination: {
                    total: totalCount,
                    page,
                    pages: Math.ceil(totalCount / limit),
                    limit
                },
                daysSearched: period,
                refreshBehavior: {
                    refreshType: "static",
                    refreshInfo: "New matches are added as users join. Results remain consistent within a session."
                }
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
const getTodaysMatches = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 15; // Typically show 15 for today's matches

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

        // Get the current date at midnight (for consistent results throughout the day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Create a seed for randomization that changes daily
        const dateSeed = today.toISOString().split('T')[0] + userId.toString();

        // Create hash from seed (simple hash function)
        const createHash = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
        };

        // Start with strict preferences
        let query = {
            _id: { $ne: userId },
            gender: genderFilter,
            profileStatus: 'Complete',
        };

        // Add religion filter
        if (userPreferences.religion) {
            query.religion = userPreferences.religion;
        }

        // Add caste filter if not any_caste
        if (!userPreferences.any_caste && currentUser.caste) {
            query.caste = currentUser.caste;
        }

        // Add age filter
        if (userPreferences.min_age && userPreferences.max_age) {
            const minDate = new Date();
            minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

            query.dob = { $gte: minDate, $lte: maxDate };
        }

        // Add mother tongue filter
        if (userPreferences.mother_tongue) {
            query.mother_tongue = userPreferences.mother_tongue;
        }

        // Add marital status filter
        if (userPreferences.marital_status) {
            query.marital_status = userPreferences.marital_status;
        }

        // Count matches with strict criteria
        let matchCount = await User.countDocuments(query);

        // If insufficient matches, progressively relax criteria
        const relaxationSteps = [
            { criteria: 'mother_tongue', action: 'remove' },
            { criteria: 'caste', action: 'remove' },
            { criteria: 'marital_status', action: 'remove' },
            { criteria: 'dob', action: 'expand', factor: 5 } // Expand age range by 5 years
        ];

        let relaxationIndex = 0;
        let currentQuery = { ...query };

        while (matchCount < limit * 1.5 && relaxationIndex < relaxationSteps.length) {
            const step = relaxationSteps[relaxationIndex];

            if (step.action === 'remove' && currentQuery[step.criteria]) {
                delete currentQuery[step.criteria];
            } else if (step.action === 'expand' && step.criteria === 'dob' && currentQuery.dob) {
                // Expand age range
                const minDate = new Date(currentQuery.dob.$gte);
                minDate.setFullYear(minDate.getFullYear() - step.factor);

                const maxDate = new Date(currentQuery.dob.$lte);
                maxDate.setFullYear(maxDate.getFullYear() + step.factor);

                currentQuery.dob = { $gte: minDate, $lte: maxDate };
            }

            matchCount = await User.countDocuments(currentQuery);
            relaxationIndex++;
        }

        // Get potential matches with possibly relaxed criteria
        let potentialMatches = await User.find(currentQuery)
            .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus')
            .limit(Math.min(200, matchCount)) // Limit to a reasonable number
            .lean();

        // Calculate match percentage for each profile
        potentialMatches = potentialMatches.map(match => {
            // Calculate match percentage
            match.matchPercentage = calculateMatchPercentage(currentUser, match, userPreferences);

            // Calculate age
            if (match.dob) {
                const birthDate = new Date(match.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                match.age = age;
            }

            // Create a deterministic daily score using the date seed and user ID
            const combinedString = dateSeed + match._id.toString();
            const hashValue = createHash(combinedString);

            // Deterministic daily score (consistent for the day, changes tomorrow)
            match.dailyScore = (hashValue % 1000) / 1000; // Value between 0-1

            // Weighted scoring: 60% match percentage, 40% daily randomized factor
            match.finalScore = (match.matchPercentage * 0.6) + (match.dailyScore * 40);

            // Add a daily special tag (rotates daily)
            const specialTags = [
                "Perfect match for you",
                "High compatibility",
                "Recommended today",
                "Selected for you",
                "Great personality match",
                "Similar interests",
                "Compatible background"
            ];

            // Use hash to deterministically select a tag
            const tagIndex = createHash(combinedString) % specialTags.length;
            if (match.matchPercentage > 70) { // Only add tags for good matches
                match.specialTag = specialTags[tagIndex];
            }

            return match;
        });

        // Sort by final score (combination of match percentage and daily factor)
        potentialMatches.sort((a, b) => b.finalScore - a.finalScore);

        // Take top matches
        const todaysTopMatches = potentialMatches.slice(0, limit);

        // Calculate time until midnight for next refresh
        const now = new Date();
        const midnight = new Date();
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        const millisecondsUntilMidnight = midnight - now;
        const hoursUntilMidnight = Math.floor(millisecondsUntilMidnight / (1000 * 60 * 60));
        const minutesUntilMidnight = Math.floor((millisecondsUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

        return res.status(200).json({
            success: true,
            data: {
                matches: todaysTopMatches,
                refreshBehavior: {
                    refreshType: "daily",
                    refreshInfo: "New selection every day at midnight"
                },
                refreshesIn: {
                    hours: hoursUntilMidnight,
                    minutes: minutesUntilMidnight,
                    timestamp: midnight.getTime()
                },
                relaxationLevel: relaxationIndex,
                criteriaAdjusted: relaxationIndex > 0
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
const getMyMatches = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const sortBy = req.query.sortBy || 'relevance'; // relevance, newest, etc.

        // Get session ID or create one for consistent sequence within a session
        let sessionId = req.query.sessionId;
        if (!sessionId) {
            // Generate a random session ID
            sessionId = Math.random().toString(36).substring(2, 15);
        }

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

        // Start with strict preference-based query
        const query = {
            _id: { $ne: userId },
            gender: genderFilter,
            profileStatus: 'Complete'
        };

        // Add age filter
        if (userPreferences.min_age && userPreferences.max_age) {
            const minDate = new Date();
            minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

            query.dob = { $gte: minDate, $lte: maxDate };
        }

        // Add height filter
        if (userPreferences.min_height_in_cm && userPreferences.max_height_in_cm) {
            query.heightInCm = {
                $gte: userPreferences.min_height_in_cm,
                $lte: userPreferences.max_height_in_cm
            };
        }

        // Add religion filter
        if (userPreferences.religion) {
            query.religion = userPreferences.religion;
        }

        // Add mother tongue filter
        if (userPreferences.mother_tongue) {
            query.mother_tongue = userPreferences.mother_tongue;
        }

        // Add marital status filter
        if (userPreferences.marital_status) {
            query.marital_status = userPreferences.marital_status;
        }

        // Add caste filter if not any_caste
        if (!userPreferences.any_caste && currentUser.caste) {
            query.caste = currentUser.caste;
        }

        // Add education filter
        if (userPreferences.highest_education) {
            query.highest_education = userPreferences.highest_education;
        }

        // Add employment filter
        if (userPreferences.employed_in) {
            query.employed_in = userPreferences.employed_in;
        }

        // First get total count with strict criteria
        let totalCount = await User.countDocuments(query);
        let relaxationLevel = 0;
        let relaxedQuery = { ...query };

        // If fewer than desired matches, progressively relax criteria
        const minDesiredMatches = limit * 3; // Aim for at least 3 pages worth

        const relaxationSteps = [
            { criteria: 'highest_education', action: 'remove' },
            { criteria: 'employed_in', action: 'remove' },
            { criteria: 'mother_tongue', action: 'remove' },
            { criteria: 'caste', action: 'remove' },
            { criteria: 'heightInCm', action: 'expand', factor: 5 }, // +/- 5cm
            { criteria: 'dob', action: 'expand', factor: 3 } // +/- 3 years
        ];

        while (totalCount < minDesiredMatches && relaxationLevel < relaxationSteps.length) {
            const step = relaxationSteps[relaxationLevel];

            if (step.action === 'remove' && relaxedQuery[step.criteria]) {
                delete relaxedQuery[step.criteria];
            } else if (step.action === 'expand') {
                if (step.criteria === 'heightInCm' && relaxedQuery.heightInCm) {
                    relaxedQuery.heightInCm = {
                        $gte: relaxedQuery.heightInCm.$gte - step.factor,
                        $lte: relaxedQuery.heightInCm.$lte + step.factor
                    };
                } else if (step.criteria === 'dob' && relaxedQuery.dob) {
                    const minDate = new Date(relaxedQuery.dob.$gte);
                    minDate.setFullYear(minDate.getFullYear() - step.factor);

                    const maxDate = new Date(relaxedQuery.dob.$lte);
                    maxDate.setFullYear(maxDate.getFullYear() + step.factor);

                    relaxedQuery.dob = { $gte: minDate, $lte: maxDate };
                }
            }

            totalCount = await User.countDocuments(relaxedQuery);
            relaxationLevel++;
        }

        // Determine sort order for database query
        let sortOption = {};
        if (sortBy === 'newest') {
            sortOption = { created_at: -1 };
        } else if (sortBy === 'photo_first') {
            sortOption = { 'profile_image.0': { $exists: true } };
        } else if (sortBy === 'premium_first') {
            sortOption = { subscriptionStatus: -1, created_at: -1 };
        } else {
            // Default sort by premium status and ID to get consistent ordering
            sortOption = { subscriptionStatus: -1, _id: 1 };
        }

        // Get all potential matches (up to a reasonable limit)
        // For rotation logic, we need to fetch more than just the page
        const fetchLimit = Math.min(1000, totalCount);

        const allPotentialMatches = await User.find(relaxedQuery)
            .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus created_at')
            .sort(sortOption)
            .limit(fetchLimit)
            .lean();

        // Calculate match percentage and add to each profile
        const matchesWithScore = allPotentialMatches.map(match => {
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

            // Generate a rotation score based on session ID
            // This ensures consistent ordering within a session but different across sessions
            const combinedString = sessionId + match._id.toString();
            let rotationScore = 0;
            for (let i = 0; i < combinedString.length; i++) {
                rotationScore += combinedString.charCodeAt(i);
            }
            match.rotationScore = rotationScore % 100; // 0-99

            return match;
        });

        // Sort based on the requested criteria
        if (sortBy === 'relevance') {
            // Sort by match percentage primarily
            matchesWithScore.sort((a, b) => {
                // First by premium status
                if ((a.subscriptionStatus !== 'none') !== (b.subscriptionStatus !== 'none')) {
                    return a.subscriptionStatus !== 'none' ? -1 : 1;
                }

                // Then by match percentage
                if (a.matchPercentage !== b.matchPercentage) {
                    return b.matchPercentage - a.matchPercentage;
                }

                // Then by rotationScore for variety between sessions
                return a.rotationScore - b.rotationScore;
            });
        } else if (sortBy === 'rotation') {
            // Special sort that shows different profiles on each refresh
            // Sort by a combination of match percentage and rotation score
            matchesWithScore.sort((a, b) => {
                // Premium profiles first
                if ((a.subscriptionStatus !== 'none') !== (b.subscriptionStatus !== 'none')) {
                    return a.subscriptionStatus !== 'none' ? -1 : 1;
                }

                // Combined score: 70% match percentage, 30% rotation
                const scoreA = (a.matchPercentage * 0.7) + (a.rotationScore * 0.3);
                const scoreB = (b.matchPercentage * 0.7) + (b.rotationScore * 0.3);
                return scoreB - scoreA;
            });
        }

        // Paginate from the sorted results
        const paginatedMatches = matchesWithScore.slice(skip, skip + limit);

        // Remove internal scoring fields
        paginatedMatches.forEach(match => {
            delete match.rotationScore;
        });

        return res.status(200).json({
            success: true,
            data: {
                matches: paginatedMatches,
                pagination: {
                    total: totalCount,
                    page,
                    pages: Math.ceil(totalCount / limit),
                    limit
                },
                sessionId: sessionId,
                relaxationLevel: relaxationLevel > 0 ? relaxationLevel : null,
                criteriaAdjusted: relaxationLevel > 0,
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

/**
 * Get Near Me Matches - Location-based matching
 * Strategy:
 * - Use geospatial queries for accurate distance calculation
 * - Adaptively expand search radius if too few results
 * - Allow filtering by distance
 * - Show exact distance from user
 */
const getNearMeMatches = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let maxDistance = parseInt(req.query.distance) || 100; // Default 100km

        // Get current user and preferences
        const currentUser = await User.findById(userId);
        const userPreferences = await PartnerPreferences.findOne({ user_id: userId });

        if (!currentUser || !userPreferences) {
            return res.status(400).json({
                success: false,
                message: 'User profile or preferences not found'
            });
        }

        // Check if user has location coordinates
        if (!currentUser.location || !currentUser.location.coordinates ||
            currentUser.location.coordinates.length !== 2) {
            return res.status(400).json({
                success: false,
                message: 'Location information not available. Please update your profile with your location.'
            });
        }

        // Basic gender filter
        const genderFilter = currentUser.gender === 'Male' ? 'Female' : 'Male';

        // Start with basic preference filters
        const query = {
            _id: { $ne: userId },
            gender: genderFilter,
            profileStatus: 'Complete',
            // Geospatial query
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: currentUser.location.coordinates
                    },
                    $maxDistance: maxDistance * 1000 // Convert km to meters
                }
            }
        };

        // Add basic preference filters
        if (userPreferences.religion) query.religion = userPreferences.religion;

        // Add marital status filter
        if (userPreferences.marital_status) {
            query.marital_status = userPreferences.marital_status;
        }

        // Add age filter
        if (userPreferences.min_age && userPreferences.max_age) {
            const minDate = new Date();
            minDate.setFullYear(minDate.getFullYear() - userPreferences.max_age);

            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() - userPreferences.min_age);

            query.dob = { $gte: minDate, $lte: maxDate };
        }

        // First get count with initial radius
        let totalCount = await User.countDocuments(query);
        let originalMaxDistance = maxDistance;

        // If too few results, progressively expand search radius
        const minDesiredResults = limit * 2; // Aim for at least 2 pages
        const maxRadiusExpansions = 3;
        let expansionCount = 0;

        while (totalCount < minDesiredResults && expansionCount < maxRadiusExpansions) {
            // Expand radius by 50% each time
            maxDistance = Math.round(maxDistance * 1.5);

            // Update the query with new radius
            query.location.$near.$maxDistance = maxDistance * 1000;

            // Recount with expanded radius
            totalCount = await User.countDocuments(query);
            expansionCount++;
        }

        // Get matches with pagination
        const nearMeMatches = await User.find(query)
            .select('_id fullName gender dob height heightInCm religion caste mother_tongue city state profile_image description occupation highest_education employed_in annual_income manglik profileStatus verifiedBadge subscriptionStatus location')
            .skip(skip)
            .limit(limit)
            .lean();

        // Calculate match percentage and distance for each profile
        const matchesWithDetails = nearMeMatches.map(match => {
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

            // Calculate precise distance
            if (match.location && match.location.coordinates) {
                const userCoords = currentUser.location.coordinates;
                const matchCoords = match.location.coordinates;

                // Haversine formula for accurate distance calculation
                const R = 6371; // Radius of the Earth in km
                const dLat = (matchCoords[1] - userCoords[1]) * Math.PI / 180;
                const dLon = (matchCoords[0] - userCoords[0]) * Math.PI / 180;
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(userCoords[1] * Math.PI / 180) * Math.cos(matchCoords[1] * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;

                // Continuing from the Near Me Matches API
                match.distance = Math.round(distance);

                // Format distance for display
                if (match.distance < 1) {
                    match.distanceText = "Less than 1 km away";
                } else if (match.distance === 1) {
                    match.distanceText = "1 km away";
                } else if (match.distance <= 20) {
                    match.distanceText = `${match.distance} km away`;
                } else {
                    match.distanceText = `${match.distance} km away`;
                }

                // Add location-based tags
                if (match.distance <= 5) {
                    match.locationTag = "Very close to you";
                } else if (match.distance <= 15) {
                    match.locationTag = "Near you";
                } else if (match.city === currentUser.city) {
                    match.locationTag = `Same city: ${match.city}`;
                }
            }

            return match;
        });

        // Sort by distance (closest first)
        matchesWithDetails.sort((a, b) => (a.distance || 999) - (b.distance || 999));

        return res.status(200).json({
            success: true,
            data: {
                matches: matchesWithDetails,
                pagination: {
                    total: totalCount,
                    page,
                    pages: Math.ceil(totalCount / limit),
                    limit
                },
                searchRadius: {
                    original: originalMaxDistance,
                    expanded: maxDistance,
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
    const limit = parseInt(req.query.limit) || 10;
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
    const currentUser = await User.findById(userId);
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
      getTodaysMatches({...req, query: { limit: 15 }}, mockRes),
      getNewMatches({...req, query: { limit: 10 }}, mockRes),
      getMyMatches({...req, query: { limit: 10, sortBy: 'rotation' }}, mockRes),
      getNearMeMatches({...req, query: { limit: 10 }}, mockRes),
      getDiscoveryMatches({...req, query: { limit: 10 }}, mockRes)
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