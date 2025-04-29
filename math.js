// console.time("a")
// // let p=0;
// for(let i =0; i<100000;i++){
//     // console.log(i)
// }
// // console.log(p)

// console.timeEnd("a")

const matchedUsers = async (req, res, next) => {
    try {
    const user_id = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Additional query parameters for enhanced experience
    const filterType = req.query.filterType || "smart"; // Options: smart, new, premium, nearby, etc.
    const freshProfiles = req.query.freshProfiles === "true"; // Show profiles not seen before
    const excludeContacted = req.query.excludeContacted === "true"; // Exclude already contacted profiles
    
    // Get current user and their preferences
    const user = await User.findById(user_id);
    if (!user) {
    return next(new ApiError("User not found.", 404));
    }
    
    const userPreferences = await PartnerPreferences.findOne({ user_id });
    if (!userPreferences) {
    return next(new ApiError("Partner preferences not found.", 404));
    }
    
    // Get user's viewed profiles (for freshness filtering)
    const viewedProfiles = await ProfileView.find({ viewer_id: user_id })
    .distinct('viewed_id');
    
    // Get user's contacted profiles if needed
    let contactedProfiles = [];
    if (excludeContacted) {
    contactedProfiles = await Message.find({
    $or: [{ sender_id: user_id }, { receiver_id: user_id }]
    }).distinct('sender_id', 'receiver_id');
    }
    
    // Combine profiles to exclude
    const excludeProfileIds = [...viewedProfiles, ...contactedProfiles, user_id];
    
    // Basic opposite gender filter - this is always applied
    const oppositeGender = user.gender === "Male" ? "Female" : "Male";
    
    // Convert age preferences to DOB range
    const currentDate = new Date();
    const getDateFromAge = (age) => {
    const date = new Date(currentDate);
    date.setFullYear(date.getFullYear() - age);
    return date;
    };
    
    // Original age range from preferences
    const originalMinAge = userPreferences.min_age;
    const originalMaxAge = userPreferences.max_age;
    const originalMinDob = getDateFromAge(originalMaxAge);
    const originalMaxDob = getDateFromAge(originalMinAge);
    
    // Calculate expanded age ranges for fallback searches
    const expandedMinAge = Math.max(18, originalMinAge - 2);
    const expandedMaxAge = originalMaxAge + 2;
    const expandedMinDob = getDateFromAge(expandedMaxAge);
    const expandedMaxDob = getDateFromAge(expandedMinAge);
    
    // Further expanded age ranges for last resort
    const wideMinAge = Math.max(18, originalMinAge - 5);
    const wideMaxAge = originalMaxAge + 5;
    const wideMinDob = getDateFromAge(wideMaxAge);
    const wideMaxDob = getDateFromAge(wideMinAge);
    
    // Create base query objects with different matching levels
    // We'll use these as templates based on the filter type
    const createBaseQuery = (excludeIds = []) => ({
    _id: { $ne: user_id, $nin: excludeIds },
    gender: oppositeGender,
    active: true,
    profileStatus: "Complete"
    });
    
    let exactMatches = [];
    let premiumMatches = [];
    let newProfileMatches = [];
    let nearbyMatches = [];
    let recommendedMatches = [];
    let otherMatches = [];
    
    // FILTER STRATEGY BASED ON FILTER TYPE
    if (filterType === "smart" || filterType === "best") {
    // SMART MATCHING - Default strategy with weighted criteria
    // 1. Get premium/featured matches first (users who have paid for visibility boost)
    const premiumQuery = {
    ...createBaseQuery(excludeProfileIds),
    premiumMember: true, // Assuming you have this field for paid users
    dob: { $gte: originalMinDob, $lte: originalMaxDob },
    religion: userPreferences.religion
    };
    
    // If specifically excluding viewed profiles, apply that filter
    if (freshProfiles) {
    premiumQuery._id.$nin = excludeProfileIds;
    }
    
    premiumMatches = await User.find(premiumQuery)
    .sort({ matchPriority: -1 }) // Assuming you have a priority field for premium users
    .limit(2); // Just get a couple to highlight
    
    // 2. Get newly joined profiles (within last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const newProfilesQuery = {
    ...createBaseQuery(excludeProfileIds),
    created_at: { $gte: oneWeekAgo },
    religion: userPreferences.religion
    };
    
    newProfileMatches = await User.find(newProfilesQuery)
    .sort({ created_at: -1 })
    .limit(3); // Show a few new profiles
    
    // 3. EXACT MATCH QUERY - Strict adherence to all preferences
    const exactMatchQuery = {
    ...createBaseQuery([...excludeProfileIds,
    ...premiumMatches.map(m => m._id),
    ...newProfileMatches.map(m => m._id)]),
    dob: { $gte: originalMinDob, $lte: originalMaxDob },
    heightInCm: {
    $gte: userPreferences.min_height_in_cm,
    $lte: userPreferences.max_height_in_cm
    },
    religion: userPreferences.religion
    };
    
    // Add caste filter only if any_caste is false
    if (!userPreferences.any_caste && user.caste) {
    exactMatchQuery.caste = user.caste;
    }
    
    // Add mother tongue filter
    if (userPreferences.mother_tongue !== "Any") {
    exactMatchQuery.mother_tongue = userPreferences.mother_tongue;
    }
    
    // Add marital status filter if not "Any"
    if (userPreferences.marital_status !== "Any") {
    exactMatchQuery.marital_status = userPreferences.marital_status;
    }
    
    // Add education filter if not "All"
    if (userPreferences.highest_education !== "All") {
    exactMatchQuery.highest_education = userPreferences.highest_education;
    }
    
    // Add employment filter if not "All"
    if (userPreferences.employed_in !== "All") {
    exactMatchQuery.employed_in = userPreferences.employed_in;
    }
    
    // Add manglik preference filter if applicable
    if (userPreferences.manglik !== "Doesn't matter") {
    exactMatchQuery.manglik = userPreferences.manglik;
    }
    
    // Add salary range filter for exact matches
    if (userPreferences.min_salary && userPreferences.max_salary) {
    exactMatchQuery.$or = [
    { min_salary: { $gte: userPreferences.min_salary, $lte: userPreferences.max_salary } },
    { max_salary: { $gte: userPreferences.min_salary, $lte: userPreferences.max_salary } },
    {
    $and: [
    { min_salary: { $lte: userPreferences.min_salary } },
    { max_salary: { $gte: userPreferences.max_salary } }
    ]
    }
    ];
    }
    
    // Calculate needed quantity after premium and new profiles
    const remainingLimit = limit - premiumMatches.length - newProfileMatches.length;
    
    if (remainingLimit > 0) {
    exactMatches = await User.find(exactMatchQuery)
    .sort({
    last_active: -1, // Prioritize recently active users
    created_at: -1 // Then newest profiles
    })
    .limit(Math.floor(remainingLimit * 0.6)); // Use 60% of remaining space for exact matches
    }
    
    // 4. NEARBY MATCHES - Location-based matching if available
    if (user.location && user.location.coordinates && user.location.coordinates.length === 2) {
    const nearbyQuery = {
    ...createBaseQuery([...excludeProfileIds,
    ...premiumMatches.map(m => m._id),
    ...newProfileMatches.map(m => m._id),
    ...exactMatches.map(m => m._id)]),
    religion: userPreferences.religion,
    dob: { $gte: expandedMinDob, $lte: expandedMaxDob },
    location: {
    $near: {
    $geometry: {
    type: "Point",
    coordinates: user.location.coordinates
    },
    $maxDistance: 50000 // 50km radius
    }
    }
    };
    
    nearbyMatches = await User.find(nearbyQuery)
    .limit(Math.floor(remainingLimit * 0.2)); // Use 20% for nearby matches
    }
    
    // 5. RECOMMENDED MATCHES - Algorithmically determined good matches
    // This would typically come from a recommendation engine or ML model
    // For now, we'll simulate with relaxed criteria + high activity
    const recommendedQuery = {
    ...createBaseQuery([...excludeProfileIds,
    ...premiumMatches.map(m => m._id),
    ...newProfileMatches.map(m => m._id),
    ...exactMatches.map(m => m._id),
    ...nearbyMatches.map(m => m._id)]),
    religion: userPreferences.religion,
    dob: { $gte: wideMinDob, $lte: wideMaxDob }
    };
    
    const stillNeeded = limit - premiumMatches.length - newProfileMatches.length -
    exactMatches.length - nearbyMatches.length;
    
    if (stillNeeded > 0) {
    recommendedMatches = await User.find(recommendedQuery)
    .sort({ profileCompleteness: -1, last_active: -1 })
    .limit(stillNeeded);
    }
    
    } else if (filterType === "new") {
    // NEW PROFILES FILTER - Prioritize recently joined users
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const newProfilesQuery = {
    ...createBaseQuery(freshProfiles ? excludeProfileIds : [user_id]),
    created_at: { $gte: twoWeeksAgo },
    religion: userPreferences.religion // Still keep religion as it's critical
    };
    
    newProfileMatches = await User.find(newProfilesQuery)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
    
    } else if (filterType === "nearby") {
    // NEARBY FILTER - Prioritize location-based matches
    if (user.location && user.location.coordinates && user.location.coordinates.length === 2) {
    const nearbyQuery = {
    ...createBaseQuery(freshProfiles ? excludeProfileIds : [user_id]),
    religion: userPreferences.religion,
    location: {
    $near: {
    $geometry: {
    type: "Point",
    coordinates: user.location.coordinates
    },
    $maxDistance: 100000 // 100km radius
    }
    }
    };
    
    nearbyMatches = await User.find(nearbyQuery)
    .skip(skip)
    .limit(limit);
    }
    } else if (filterType === "premium") {
    // PREMIUM FILTER - Show only premium members
    const premiumQuery = {
    ...createBaseQuery(freshProfiles ? excludeProfileIds : [user_id]),
    premiumMember: true,
    religion: userPreferences.religion
    };
    
    premiumMatches = await User.find(premiumQuery)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
    }
    
    // Combine all matches
    const allMatches = [
    ...premiumMatches,
    ...newProfileMatches,
    ...exactMatches,
    ...nearbyMatches,
    ...recommendedMatches
    ];
    
    // If we still don't have enough matches, fetch random profiles as a fallback
    if (allMatches.length < limit) {
    const remainingNeeded = limit - allMatches.length;
    const existingIds = allMatches.map(m => m._id);
    
    const otherMatchQuery = {
    ...createBaseQuery([...existingIds, user_id]),
    // Only enforce gender and active status
    };
    
    otherMatches = await User.find(otherMatchQuery)
    .sort(() => Math.random() - 0.5) // MongoDB's way of random sorting
    .limit(remainingNeeded);
    
    allMatches.push(...otherMatches);
    }
    
    // Rotate profiles to ensure variety - this is what big sites do
    // Store the last accessed timestamp and user IDs to ensure variety in subsequent requests
    await UserActivity.findOneAndUpdate(
    { user_id },
    {
    $set: { last_match_fetch: new Date() },
    $push: { shown_profiles: { $each: allMatches.map(m => m._id) } }
    },
    { upsert: true }
    );
    
    // Calculate match percentage for each profile
    const scoredMatches = allMatches.map(match => {
    // Starting with a full score system
    let matchScore = 0;
    let totalFactors = 0;
    
    // Age match (0-15 points)
    const matchAge = calculateAgeFromDob(match.dob);
    if (matchAge >= originalMinAge && matchAge <= originalMaxAge) {
    matchScore += 15; // Full points for exact age match
    } else if (matchAge >= expandedMinAge && matchAge <= expandedMaxAge) {
    // Partial points for close age match
    matchScore += 10;
    } else if (matchAge >= wideMinAge && matchAge <= wideMaxAge) {
    // Fewer points for wide age match
    matchScore += 5;
    }
    totalFactors += 15;
    
    // Height match (0-10 points)
    if (match.heightInCm >= userPreferences.min_height_in_cm &&
    match.heightInCm <= userPreferences.max_height_in_cm) {
    matchScore += 10; // Full points for exact height match
    } else if (match.heightInCm >= userPreferences.min_height_in_cm - 3 &&
    match.heightInCm <= userPreferences.max_height_in_cm + 3) {
    matchScore += 5; // Partial points for close height match
    }
    totalFactors += 10;
    
    // Religion match (0-20 points) - this is critical for matrimonial sites
    if (match.religion === userPreferences.religion) {
    matchScore += 20;
    }
    totalFactors += 20;
    
    // Caste match (0-15 points)
    if (!userPreferences.any_caste) {
    if (match.caste === user.caste) {
    matchScore += 15;
    }
    totalFactors += 15;
    }
    
    // Mother tongue match (0-8 points)
    if (userPreferences.mother_tongue === "Any" ||
    match.mother_tongue === userPreferences.mother_tongue) {
    matchScore += 8;
    }
    totalFactors += 8;
    
    // Marital status (0-10 points)
    if (userPreferences.marital_status === "Any" ||
    match.marital_status === userPreferences.marital_status) {
    matchScore += 10;
    }
    totalFactors += 10;
    
    // Education match (0-12 points)
    if (userPreferences.highest_education === "All" ||
    match.highest_education === userPreferences.highest_education) {
    matchScore += 12;
    }
    totalFactors += 12;
    
    // Employment match (0-10 points)
    if (userPreferences.employed_in === "All" ||
    match.employed_in === userPreferences.employed_in) {
    matchScore += 10;
    }
    totalFactors += 10;
    
    // Manglik status (0-8 points)
    if (userPreferences.manglik === "Doesn't matter" ||
    match.manglik === userPreferences.manglik) {
    matchScore += 8;
    }
    totalFactors += 8;
    
    // Income match (0-12 points)
    let incomeMatch = 0;
    if (match.min_salary && match.max_salary &&
    userPreferences.min_salary && userPreferences.max_salary) {
    
    if ((match.min_salary >= userPreferences.min_salary &&
    match.min_salary <= userPreferences.max_salary) ||
    (match.max_salary >= userPreferences.min_salary &&
    match.max_salary <= userPreferences.max_salary) ||
    (match.min_salary <= userPreferences.min_salary &&
    match.max_salary >= userPreferences.max_salary)) {
    incomeMatch = 12; // Full match
    } else if (match.min_salary <= userPreferences.max_salary * 1.2 &&
    match.max_salary >= userPreferences.min_salary * 0.8) {
    incomeMatch = 6; // Partial match
    }
    }
    matchScore += incomeMatch;
    totalFactors += 12;
    
    // Calculate percentage
    const matchPercentage = Math.round((matchScore / totalFactors) * 100);
    
    // Determine match tier (for UI display)
    let matchTier = "other";
    if (premiumMatches.some(m => m._id.equals(match._id))) {
    matchTier = "premium";
    } else if (newProfileMatches.some(m => m._id.equals(match._id))) {
    matchTier = "new";
    } else if (exactMatches.some(m => m._id.equals(match._id))) {
    matchTier = "exact";
    } else if (nearbyMatches.some(m => m._id.equals(match._id))) {
    matchTier = "nearby";
    } else if (recommendedMatches.some(m => m._id.equals(match._id))) {
    matchTier = "recommended";
    }
    
    // Apply randomized special tags (like "Popular", "Active today", etc.)
    // This is a common technique used by dating/matrimonial apps to increase engagement
    const specialTags = [];
    const rand = Math.random();
    
    if (match.last_active &&
    (new Date() - new Date(match.last_active)) / (1000 * 60 * 60) < 24) {
    specialTags.push("Online Today");
    } else if (rand > 0.85) {
    specialTags.push("Popular Profile");
    } else if (rand > 0.7) {
    specialTags.push("Highly Compatible");
    } else if (rand > 0.55 && matchTier === "nearby") {
    specialTags.push("In Your City");
    }
    
    // Calculate a "trending score" based on profile views and interactions
    // This would come from your analytics in a real system
    const trendingScore = match.profileViews || 0;
    
    // Create a simplified user object with essential fields
    return {
    _id: match._id,
    fullName: match.fullName,
    age: calculateAgeFromDob(match.dob),
    height: match.height,
    religion: match.religion,
    caste: match.caste,
    mother_tongue: match.mother_tongue,
    highest_education: match.highest_education,
    employed_in: match.employed_in,
    occupation: match.occupation,
    annual_income: match.annual_income,
    city: match.city,
    state: match.state,
    marital_status: match.marital_status,
    profile_image: match.profile_image && match.profile_image.length > 0 ?
    [match.profile_image[0]] : [], // Only include first image for list view
    premiumMember: match.premiumMember || false,
    matchPercentage,
    matchTier,
    specialTags,
    trendingScore,
    lastActive: match.last_active
    };
    });
    
    // Final sort order - prioritizing premium and new profiles above exact matches
    // This encourages premium subscriptions and keeps the content fresh
    const sortedMatches = [...scoredMatches].sort((a, b) => {
    // First tier sorting by match type
    const tierOrder = {
    "premium": 5,
    "new": 4,
    "exact": 3,
    "nearby": 2,
    "recommended": 1,
    "other": 0
    };
    
    const tierDiff = tierOrder[b.matchTier] - tierOrder[a.matchTier];
    if (tierDiff !== 0) return tierDiff;
    
    // Second tier sorting by match percentage for same tier
    return b.matchPercentage - a.matchPercentage;
    });
    
    // Total count by filter type (for pagination UI)
    let totalCount;
    if (filterType === "new") {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    totalCount = await User.countDocuments({
    _id: { $ne: user_id },
    gender: oppositeGender,
    active: true,
    profileStatus: "Complete",
    created_at: { $gte: twoWeeksAgo }
    });
    } else if (filterType === "premium") {
    totalCount = await User.countDocuments({
    _id: { $ne: user_id },
    gender: oppositeGender,
    active: true,
    profileStatus: "Complete",
    premiumMember: true
    });
    } else {
    // Default count for smart filtering
    totalCount = await User.countDocuments({
    _id: { $ne: user_id },
    gender: oppositeGender,
    active: true,
    profileStatus: "Complete"
    });
    }
    
    // Return the profiles with metadata
    return res.status(200).json({
    success: true,
    message: "Matching profiles found",
    data: {
    matches: sortedMatches,
    pagination: {
    total: totalCount,
    page,
    limit,
    pages: Math.ceil(totalCount / limit)
    },
    categories: {
    premium: premiumMatches.length,
    new: newProfileMatches.length,
    exact: exactMatches.length,
    nearby: nearbyMatches.length,
    recommended: recommendedMatches.length,
    other: otherMatches.length
    },
    // Additional metadata helpful for the frontend
    filterType,
    freshProfiles,
    excludeContacted
    }
    });
    
    } catch (error) {
    console.error("Match finding error:", error);
    next(error);
    }
    };
    
    // Helper function to calculate age from DOB
    const calculateAgeFromDob = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
    }
    
    return age;
    };
    
    // Add these models to your application
    /*
    const UserActivity = mongoose.model('UserActivity', new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    last_match_fetch: { type: Date, default: Date.now },
    shown_profiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }));
    
    const ProfileView = mongoose.model('ProfileView', new mongoose.Schema({
    viewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    viewed_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    viewDate: { type: Date, default: Date.now }
    }, { timestamps: true }));
    
    const Message = mongoose.model('Message', new mongoose.Schema({
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false }
    }, { timestamps: true }));
    */
    
    module.exports = { matchedUsers };