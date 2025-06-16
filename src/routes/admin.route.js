const { registerAdmin, logInAdmin } = require("../controllers/admin/adminAuthController");
// const { createCaste, getCastes, updateCaste, deleteCaste } = require("../controllers/admin/casteController");
const { createFaq, getFaqs, updateFaq, deleteFaq } = require("../controllers/admin/faqController");
// const { createReligion, getReligions, updateReligion, deleteReligion } = require("../controllers/admin/religionController");
const { createSubscriptionPlan, getAllSubscriptionPlans, updateSubscriptionPlan, deleteSubscriptionPlan, togglePlanStatus } = require("../controllers/admin/subscriptionPlanController");
const { getAllSupportQueries, updateSupportQuery, deleteSupportQuery } = require("../controllers/admin/supportListController");
const { createDetails, updateDetails, getPrivacyPolicy, getTermsAndCOndition } = require("../controllers/admin/termsPrivacyAboutController");
const { getAllTransactions } = require("../controllers/admin/transactionController");
const { updateAdmin } = require("../controllers/admin/updateAdminProfile.controller");
const { getAllUsers, deleteUser } = require("../controllers/admin/userListController");
const { authenticateAdmin, authorizeRoles } = require("../middlewares/authenticateAdmin");
const { getFileUploader } = require("../middlewares/fileUpload");

//blogs
const {
  createBlog,
  updateBlog,
  deleteBlog,
  getAllBlogs,
  getBlogById,
  updateBlogStatus,
  getActiveBlogs,
} = require('../controllers/admin/blogController');

const {
  // Religion
  createReligion, getReligions, updateReligion, deleteReligion,
  // Sect
  createSect, getSects, updateSect, deleteSect,
  // Jammat
  createJammat, getJammats, updateJammat, deleteJammat,
  // Caste
  createCaste, getCastes, updateCaste, deleteCaste
} = require("../controllers/admin/casteController");

const {
  createCourseCategory,
  getCourseCategories,
  updateCourseCategory,
  deleteCourseCategory,
  createCourse,
  getCourses,
  getCoursesByCategory,
  updateCourse,
  deleteCourse
} = require("../controllers/admin/courseController");

const {
  createOccupationCategory,
  getOccupationCategories,
  updateOccupationCategory,
  deleteOccupationCategory,
  createOccupation,
  getOccupations,
  updateOccupation,
  deleteOccupation,
  getOccupationsByCategory
} = require("../controllers/admin/occupationController");

const {
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
} = require("../controllers/admin/languageController");

const {
  createSubAdmin,
  updateSubAdmin,
  deleteSubAdmin,
  getSubAdmins,
  updateSubAdminStatus,
} = require("../controllers/admin/roleController");

const { chatList, getChatMessages } = require('../controllers/admin/messageController')
// const { sentRequestTo, gotRequestFrom } = require('../controllers/admin/requestedUserController')

const { getUserPreferenceByAdmin } = require('../controllers/admin/partnerPreferenceController')
const { getUserLikedByAdmin } = require('../controllers/admin/likeController')
const { updateAppConfig, getAppConfig } = require('../controllers/admin/appconfigContoller')
const { getAdminUserDashboard } = require('../controllers/admin/dashboardController')

const {
  sentRequestTo,
  gotRequestFrom,
  getUserConnections
} = require("../controllers/admin/connectionController");

const adminRoute = require("express").Router();

// -------------- admin auth ---------------
adminRoute.post("/register", registerAdmin);
adminRoute.post("/login", logInAdmin);

const upload = getFileUploader("profile_image", "uploads/admin"); // 
adminRoute.patch("/profile", authenticateAdmin, upload, updateAdmin);

adminRoute.get('/dashboard', getAdminUserDashboard);
// adminRoute.post("/forget_password", forgetPassword);
// adminRoute.post("/reset_password", resetPassword);
// adminRoute.put("/profile", authenticateAdmin, updateProfile);
// adminRoute.put("/change_password", authenticateAdmin, changePassword);

//appConfig
adminRoute.post('/updateAppConfig', authenticateAdmin, updateAppConfig);
adminRoute.get('/getAppConfig', authenticateAdmin, getAppConfig);


// -------------- Users --------------------
adminRoute.get('/users', authenticateAdmin, getAllUsers);
adminRoute.delete('/users/:id', authenticateAdmin, deleteUser);

//user --preference
adminRoute.get("/userPreference/:user_id", authenticateAdmin, getUserPreferenceByAdmin);
adminRoute.get("/userLikes/:user_id", authenticateAdmin, getUserLikedByAdmin);
adminRoute.get("/userchatList/:userId", authenticateAdmin, chatList);
adminRoute.get("/getChatMessages", authenticateAdmin, getChatMessages);

// adminRoute.get("/requested_to/:user", authenticateAdmin, sentRequestTo);
// adminRoute.get("/requested_by/:user", authenticateAdmin, gotRequestFrom);

adminRoute.get("/requested_to/:user", authenticateAdmin, sentRequestTo);
adminRoute.get("/requested_by/:user", authenticateAdmin, gotRequestFrom);
adminRoute.get("/connections/:user", authenticateAdmin, getUserConnections);


// ------------- Subscription Plan --------------
adminRoute.post("/create_subscription_plan", createSubscriptionPlan);
adminRoute.get("/get_subscription_plans", authenticateAdmin, getAllSubscriptionPlans);
adminRoute.patch("/update_subscription_plan/:id", authenticateAdmin, updateSubscriptionPlan);
adminRoute.delete("/delete_subscription_plan/:id", authenticateAdmin, deleteSubscriptionPlan);
// Toggle plan status (active/inactive)
adminRoute.patch('/:id/toggle_status', authenticateAdmin, togglePlanStatus);

//transaction
adminRoute.get("/transactions", authenticateAdmin, getAllTransactions);

// Religion routes
adminRoute.post("/religions", authenticateAdmin, createReligion);
adminRoute.get("/religions", authenticateAdmin, getReligions);
adminRoute.put("/religions/:id", authenticateAdmin, updateReligion);
adminRoute.delete("/religions/:id", authenticateAdmin, deleteReligion);

// Sect routes
adminRoute.post("/sects", authenticateAdmin, createSect);
adminRoute.get("/religions/:religionId/sects", authenticateAdmin, getSects);
adminRoute.put("/sects/:id", authenticateAdmin, updateSect);
adminRoute.delete("/sects/:id", authenticateAdmin, deleteSect);

// Jammat routes
adminRoute.post("/jammats", authenticateAdmin, createJammat);
adminRoute.get("/sects/:sectId/jammats", authenticateAdmin, getJammats);
adminRoute.put("/jammats/:id", authenticateAdmin, updateJammat);
adminRoute.delete("/jammats/:id", authenticateAdmin, deleteJammat);

// Caste routes
adminRoute.post("/castes", authenticateAdmin, createCaste);
adminRoute.get("/religions/:religionId/castes", authenticateAdmin, getCastes);
adminRoute.get("/religions/:religionId/sects/:sectId/castes", authenticateAdmin, getCastes);
adminRoute.get("/religions/:religionId/sects/:sectId/jammats/:jammatId/castes", authenticateAdmin, getCastes);
adminRoute.put("/castes/:id", authenticateAdmin, updateCaste);
adminRoute.delete("/castes/:id", authenticateAdmin, deleteCaste);

// ------------- Support(Query) ---------------------
adminRoute.get("/get_all_queries", authenticateAdmin, getAllSupportQueries);
adminRoute.patch("/update_single_query/:id", authenticateAdmin, updateSupportQuery);
adminRoute.delete("/delete_single_query/:id", authenticateAdmin, deleteSupportQuery);

// ------------ Terms, Privacy & About ---------------
adminRoute.post("/terms_privacy_about", authenticateAdmin, createDetails);
adminRoute.patch("/update_terms_privacy_about", authenticateAdmin, updateDetails);
adminRoute.get("/privacy_policy", getPrivacyPolicy);
adminRoute.get("/terms_and_condition", getTermsAndCOndition);

// ------------- Faq ---------------------
adminRoute.post("/add_faq", authenticateAdmin, createFaq);
adminRoute.get("/get_all_faqs", authenticateAdmin, getFaqs);
adminRoute.patch("/update_single_faq/:id", authenticateAdmin, updateFaq);
adminRoute.delete("/delete_single_faq/:id", authenticateAdmin, deleteFaq);

// Course Category Routes
adminRoute.post("/categories", authenticateAdmin, createCourseCategory);
adminRoute.get("/categories", authenticateAdmin, getCourseCategories);
adminRoute.put("/categories/:id", authenticateAdmin, updateCourseCategory);
adminRoute.delete("/categories/:id", authenticateAdmin, deleteCourseCategory);

// Course Routes
adminRoute.post("/courses", authenticateAdmin, createCourse);
adminRoute.get("/courses", authenticateAdmin, getCourses);
adminRoute.get("/courses/category/:categoryId", authenticateAdmin, getCoursesByCategory);
adminRoute.put("/courses/:id", authenticateAdmin, updateCourse);
adminRoute.delete("/courses/:id", authenticateAdmin, deleteCourse);

// Occupation Category Routes
adminRoute.post("/occupation_category", authenticateAdmin, createOccupationCategory);
adminRoute.get("/occupation_categories", authenticateAdmin, getOccupationCategories);
adminRoute.put("/occupation_category/:id", authenticateAdmin, updateOccupationCategory);
adminRoute.delete("/occupation_category/:id", authenticateAdmin, deleteOccupationCategory);

// Occupation Routes
adminRoute.post("/occupation", authenticateAdmin, createOccupation);
adminRoute.get("/occupation", authenticateAdmin, getOccupations);
adminRoute.put("/occupation/:id", authenticateAdmin, updateOccupation);
adminRoute.delete("/occupation/:id", authenticateAdmin, deleteOccupation);
adminRoute.get("/occupation_category/:categoryId", authenticateAdmin, getOccupationsByCategory);

// Create a new language
adminRoute.post("/language", authenticateAdmin, createLanguage);
adminRoute.get("/language", authenticateAdmin, getLanguages);
adminRoute.put("/language/:id", authenticateAdmin, updateLanguage);
adminRoute.delete("/language/:id", authenticateAdmin, deleteLanguage);

//sub admin
adminRoute.post('/role', authenticateAdmin, createSubAdmin);
adminRoute.put('/role/:id', authenticateAdmin, updateSubAdmin);
adminRoute.delete('/role/:id', authenticateAdmin, deleteSubAdmin);
adminRoute.get('/role', authenticateAdmin, getSubAdmins);
adminRoute.put('/role/status/:id', authenticateAdmin, updateSubAdminStatus);

// Public routes
adminRoute.get('/blogs/active', authenticateAdmin, getActiveBlogs); // Get all active blogs for public view

// Admin routes (you might want to add authentication middleware here)
adminRoute.post('/blogs', authenticateAdmin, createBlog);
adminRoute.get('/blogs', authenticateAdmin, getAllBlogs);
adminRoute.get('/blogs/:id', authenticateAdmin, getBlogById);
adminRoute.put('/blogs/:id', authenticateAdmin, updateBlog);
adminRoute.delete('/blogs/:id', authenticateAdmin, deleteBlog);
adminRoute.patch('/blogs/:id/status', authenticateAdmin, updateBlogStatus);

// //------getActiveUses--------
// adminRoute.get("/getAllUsers", authenticateAdmin, getUsers)
// adminRoute.put("/updateUser", authenticateAdmin, updateUser)

module.exports = adminRoute;
