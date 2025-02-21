const bodyParser = require("body-parser")
const authenticateUser = require("../middlewares/authenticateUser");

const { signup, verifyOtpSignUp, login, verifyOtpLogin, forgotPassword, resetPassword } = require("../controllers/user/authController");
const { getCountries, getStates, getCities, getProfile, updateProfile, deleteProfileImage, deleteProfile } = require("../controllers/user/profileController");
const { partnerPreferences, getPreference, matchedUsers, singleMatchedUser, checkContactEligibility } = require("../controllers/user/partnerPreferenceController");
const { sendOrUpdateRequest, sentRequestTo, unsendRequest, gotRequestFrom, checkStatusForChatting } = require("../controllers/user/requestedUserController");
const { createQuery, getQueryData } = require("../controllers/user/supportController");
const { getAllSubscriptionPlans } = require("../controllers/user/subscriptionPlansController");
const { getReligions, getCastes } = require("../controllers/user/religionAndCasteController");
const getDetailsById = require("../controllers/user/getTermsPrivacyAboutController");
const { createTransaction, transactionWebhook } = require("../controllers/user/purchaseSubscriptionController");
const getFaqs = require("../controllers/user/getAllFaqsController.js");
const { chatList, getChatMessages } = require("../controllers/user/messageController.js");
const { likeUserProfile, getLikedUsers, unlikeUserProfile } = require("../controllers/user/likeController.js");
const { getNotification, deleteNotification } = require("../controllers/user/notificationController.js");

const userRoute = require("express").Router();

//---------- user auth ----------
userRoute.post("/signup", signup);
userRoute.post("/verify_otp_sign_up", verifyOtpSignUp);
userRoute.post("/login", login);
userRoute.post("/verify_otp_login", verifyOtpLogin);
userRoute.post("/forget_password", forgotPassword);
userRoute.post("/reset_password", resetPassword);

// Update Profile
userRoute.post("/religions", authenticateUser, getReligions);
userRoute.post("/castes", authenticateUser, getCastes);

userRoute.post("/country", authenticateUser, getCountries);
userRoute.post("/states", authenticateUser, getStates);
userRoute.post("/cities", authenticateUser, getCities);

userRoute.get("/profile", authenticateUser,  getProfile);   
userRoute.put("/profile", authenticateUser, updateProfile);

userRoute.post("/deleteProfileImage", authenticateUser, deleteProfileImage);
userRoute.delete("/delete_profile", authenticateUser, deleteProfile);

// Preferences & Match
userRoute.post("/preferences", authenticateUser, partnerPreferences);
userRoute.get("/yourPreference", authenticateUser, getPreference);
userRoute.post("/all_match", authenticateUser, matchedUsers);
userRoute.get("/single_match/:id", authenticateUser, singleMatchedUser);
userRoute.get("/contact_eligibility", authenticateUser, checkContactEligibility);

// Liked User Profile
userRoute.get("/like_user/:id", authenticateUser, likeUserProfile);
userRoute.get("/get_liked_users", authenticateUser, getLikedUsers);
userRoute.get("/unlike_user/:id", authenticateUser, unlikeUserProfile);

// request user
userRoute.post("/send_request", authenticateUser, sendOrUpdateRequest);
userRoute.get("/requested_to", authenticateUser, sentRequestTo);
userRoute.get("/unsend_request/:id", authenticateUser, unsendRequest);
userRoute.get("/requested_by", authenticateUser, gotRequestFrom);
userRoute.get("/chat_eligibility/:id", authenticateUser, checkStatusForChatting);

// Subscription Plans
userRoute.get("/subscription_plans", authenticateUser, getAllSubscriptionPlans);

// Purchase Subscription
userRoute.post("/create_transaction", authenticateUser, createTransaction);
userRoute.post(
    "/transactionWebhook",
    bodyParser.raw({ type: "application/json" }),
    transactionWebhook
  );

// chat message
//userRoute.get("/message_eligibility", authenticateUser, checkChatEligibility);
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

module.exports = userRoute;
