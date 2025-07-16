const Admin = require("./admin");
const User = require("./user");
const PartnerPreferences = require("./partnerPreference");
const RequestedUser = require("./requestedUser");
const Connection = require("./connection");
const Message = require("./message");
const SubscriptionPlan = require("./subscriptionPlan");
const { Religion, Sect, Jammat, Caste } = require('./caste')
const Support = require("./support");
const Faq = require("./faq");
const TermsPrivacyAbout = require("./termsPrivacyAbout");
const Like = require("./like");
const Notification = require("./notification");
const Transaction = require("./transaction");
const UserSubscription = require('./userSubscription')
const { CourseCategory, Course } = require("./course");
const { OccupationCategory, Occupation } = require("./occupation");
const Language = require("./language");
const ProfileView = require("./profileViewSchema");
const Report = require("./report");
const Blog = require("./blog");

module.exports = {
  Admin,
  User,
  PartnerPreferences,
  RequestedUser,
  Connection,
  Message,
  SubscriptionPlan,
  Caste,
  Support,
  Faq,
  TermsPrivacyAbout,
  Like,
  Notification,
  Transaction,
  UserSubscription,
  Religion, Sect, Jammat, Caste,
  CourseCategory, Course,
  OccupationCategory, Occupation,
  Language,
  ProfileView,
  Report,
  Blog
};
