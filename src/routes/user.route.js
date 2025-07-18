const bodyParser = require("body-parser")
const authenticateUser = require("../middlewares/authenticateUser");

const { signup, verifyOtpSignUp, login, verifyOtpLogin, forgotPassword, resetPassword, updateStatusByPhone, deleteUserByPhone } = require("../controllers/user/authController");
const { getCountries, getStates, getCities, getProfile, updateProfile, getUnreadCounts, deleteProfileImage, deleteProfile } = require("../controllers/user/profileController");
const { partnerPreferences, getPreference, matchedUsers, matchedProfiles, singleMatchedUser, getProfileById, getProfileDetails, checkContactEligibility } = require("../controllers/user/partnerPreferenceController");

const { createQuery, getQueryData } = require("../controllers/user/supportController");
const { getAllSubscriptionPlans } = require("../controllers/user/subscriptionPlansController");
const getDetailsById = require("../controllers/user/getTermsPrivacyAboutController");
// const { createTransaction, transactionWebhook } = require("../controllers/user/purchaseSubscriptionController");
const getFaqs = require("../controllers/user/getAllFaqsController.js");
const { chatList, getChatMessages } = require("../controllers/user/messageController.js");
const { likeUserProfile, getLikedUsers, unlikeUserProfile } = require("../controllers/user/likeController.js");
const { getNotification, deleteNotification } = require("../controllers/user/notificationController.js");
const { getCourseStructure } = require("../controllers/user/courseController.js");
const { getOccupationStructure } = require("../controllers/user/occupationController.js");
const { getAllBlogs, getBlogById, getActiveBlogBySlug } = require('../controllers/user/blogController.js')

const {
  getReligions,
  getSects,
  getJammats,
  getCastes,
  getFullHierarchy
} = require("../controllers/user/casteController.js");

const {
  getAppConfig
} = require("../controllers/user/appConfigContoller.js");

const {
  sendOrUpdateRequest,
  getSentRequests,
  getReceivedRequests,
  cancelRequest,
  getConnections,
  canMessage,
  blockUser,
  reportUser,
  getBlockedUsers,
  unblockUser,
} = require("../controllers/user/connectionController");

const { matchWithVedicAstro } = require('../controllers/user/vedhicController.js')
const { getLanguages } = require("../controllers/user/languageController.js")

const userRoute = require("express").Router();

//---------- user auth ----------
userRoute.post("/signup", signup);
userRoute.post("/verify_otp_sign_up", verifyOtpSignUp);
userRoute.post("/login", login);
userRoute.post("/verify_otp_login", verifyOtpLogin);
userRoute.post("/forget_password", forgotPassword);
userRoute.post("/reset_password", resetPassword);

// Get all religions  ---
userRoute.get("/appConfig", getAppConfig);
userRoute.get("/religions", getReligions);
// Get sects for a religion
userRoute.get("/religions/:religionId/sects", getSects);
// Get jammats for a sect
userRoute.get("/sects/:sectId/jammats", getJammats);
// Get castes based on hierarchy
userRoute.post("/castes", getCastes);
// Get full hierarchy for a religion (for frontend dropdowns)
userRoute.get("/religions/:religionId/hierarchy", getFullHierarchy);

userRoute.post("/country", getCountries);
userRoute.post("/states", getStates);
userRoute.post("/cities", getCities);

userRoute.get("/profile", authenticateUser, getProfile);
userRoute.put("/profile", authenticateUser, updateProfile);
userRoute.get("/unreadCounts", authenticateUser, getUnreadCounts);

userRoute.post("/deleteProfileImage", authenticateUser, deleteProfileImage);
userRoute.delete("/delete_profile", authenticateUser, deleteProfile);

//subscription
const subscriptionController = require('../controllers/user/purchaseSubscriptionController.js');

// Public routes
userRoute.post('/webhook', subscriptionController.webhookHandler);

userRoute.get('/vedic_match/:matchUserId', authenticateUser, matchWithVedicAstro);

// Protected routes (require authentication)
userRoute.get('/plans', subscriptionController.getSubscriptionPlans);
userRoute.get('/my_subscription', authenticateUser, subscriptionController.getUserSubscription);
userRoute.post('/create_order', authenticateUser, subscriptionController.createSubscriptionOrder);
userRoute.post('/verify_payment', authenticateUser, subscriptionController.verifyPayment);
userRoute.post('/cancel', authenticateUser, subscriptionController.cancelSubscription);
userRoute.post('/auto_renewal', authenticateUser, subscriptionController.setupAutoRenewal);
userRoute.get('/payment_history', authenticateUser, subscriptionController.getPaymentHistory);

// Preferences & Match
userRoute.post("/preferences", authenticateUser, partnerPreferences);
userRoute.get("/yourPreference", authenticateUser, getPreference);
userRoute.post("/all_match", authenticateUser, matchedUsers);
userRoute.get("/matchedProfiles", authenticateUser, matchedProfiles);
userRoute.get("/single_match/:id", authenticateUser, singleMatchedUser);
userRoute.get("/getProfile/:profileId", authenticateUser, getProfileById);
userRoute.get("/getProfileDetails/:id", authenticateUser, getProfileDetails);
userRoute.get("/contact_eligibility", authenticateUser, checkContactEligibility);

const matchesController = require('../controllers/user/matchingController.js')

// Home page data (combined data for all tabs)
userRoute.get('/home', authenticateUser, matchesController.getHomePageData);

// Individual tab APIs
userRoute.get('/new_matches', authenticateUser, matchesController.getNewMatches);
userRoute.get('/today_matches', authenticateUser, matchesController.getTodaysMatches);
userRoute.get('/my_matches', authenticateUser, matchesController.getMyMatches);
userRoute.get('/near_me', authenticateUser, matchesController.getNearMeMatches);
userRoute.get('/discovery', authenticateUser, matchesController.getDiscoveryMatches);

// Liked User Profile
userRoute.get("/like_user/:id", authenticateUser, likeUserProfile);
userRoute.get("/unlike_user/:id", authenticateUser, unlikeUserProfile);
userRoute.get("/get_liked_users", authenticateUser, getLikedUsers);

// request user
const { get_Follow_Data, send_Or_UpdateRequest, sent_Request_To, unsend_Request, got_Request_From, check_Status_For_Chatting } = require("../controllers/user/requestedUserController");
// userRoute.post("/send_request", authenticateUser, send_Or_UpdateRequest);
userRoute.post("/send_request", authenticateUser, sendOrUpdateRequest);
userRoute.get("/getFollowData", authenticateUser, get_Follow_Data);
userRoute.get("/requested_to", authenticateUser, sent_Request_To);
userRoute.get("/unsend_request/:id", authenticateUser, unsend_Request);
userRoute.get("/requested_by", authenticateUser, got_Request_From);
userRoute.get("/chat_eligibility/:id", authenticateUser, check_Status_For_Chatting);

// Routes for connection management
userRoute.post("/connection", authenticateUser, sendOrUpdateRequest);
// userRoute.get("/connections", authenticateUser, getConnectionsUnified);
userRoute.get("/connections", authenticateUser, getConnections);
userRoute.get("/connections/sent", authenticateUser, getSentRequests);
userRoute.get("/connections/received", authenticateUser, getReceivedRequests);
userRoute.delete("/connections/:connectionId", authenticateUser, cancelRequest);
userRoute.get("/connections/can_message/:otherUserId", authenticateUser, canMessage);
userRoute.post("/connections/block", authenticateUser, blockUser);
userRoute.post("/connections/report", authenticateUser, reportUser);
userRoute.post("/connections/unblock", authenticateUser, unblockUser);
userRoute.get("/connections/getBlockedUsers", authenticateUser, getBlockedUsers);

// Subscription Plans
userRoute.get("/subscription_plans", authenticateUser, getAllSubscriptionPlans);

// chat message
userRoute.get("/chat_list", authenticateUser, chatList);
userRoute.get("/get_messages/:id", authenticateUser, getChatMessages);

// Faqs
userRoute.get("/get_faqs", authenticateUser, getFaqs);

// Support (Query)
userRoute.post("/submit_query", authenticateUser, createQuery);
userRoute.get("/get_query", authenticateUser, getQueryData);

// Terms & Condition, Privacy Policy & About Us
userRoute.get("/get_terms_privacy_about", getDetailsById); // authenticateUser

// Notification
userRoute.get("/get_notification", authenticateUser, getNotification);
userRoute.delete("/delete_notification", authenticateUser, deleteNotification);

//Courses
userRoute.get("/course", getCourseStructure)
userRoute.get("/occupation", getOccupationStructure)

//languages
userRoute.get("/language", getLanguages)

//blog 
userRoute.get("/blogs", getAllBlogs)
userRoute.get("/blogs/:id", getBlogById)
userRoute.get("/getBlogBySlug/:slug", getActiveBlogBySlug)

const sendFirebaseNotification = require('../utils/sendFirebaseNotification.js');

userRoute.post('/yesh', async (req, res) => {
  let { type = 'profile', token, title } = req.body;

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'token is required' });
  }

  // Hardcoded test values
  const deviceToken = token;
  const fullName = "RADHA RANI Raj";
  title = title || "Connection Request Accepted";
  const body = `${fullName} has accepted your connection request`;
  const _id = "685a90c7119b6058b0940a6e";
  const pic = "public/user/1752051992891-638931146.jpg";

  try {
    const response = await sendFirebaseNotification(deviceToken, title, body, _id, type, pic);
    if (response) {
      return res.status(200).json({ status: 'success', response });
    } else {
      return res.status(500).json({ status: 'error', message: 'Notification failed' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Unknown error' });
  }
});

userRoute.put('/update_status_manish', updateStatusByPhone);
userRoute.put('/delete_user_manish', deleteUserByPhone);


module.exports = userRoute;
