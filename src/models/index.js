const Admin = require("./admin");
const User = require("./user");
const PartnerPreferences = require("./partnerPreference");
const RequestedUser = require("./requestedUser");
const Message = require("./message");
const SubscriptionPlan = require("./subscriptionPlan");
const {Religion, Sect, Jammat, Caste}  = require('./caste')
const Support = require("./support");
const Faq = require("./faq");
const TermsPrivacyAbout = require("./termsPrivacyAbout");
const Like = require("./like");
const Notification = require("./notification");
const Transaction = require("./transaction");
const { CourseCategory, Course} = require("./course");
const Language = require("./language");

module.exports = {
  Admin,
  User,
  PartnerPreferences,
  RequestedUser,
  Message,
  SubscriptionPlan,
  Caste,
  Support,
  Faq,
  TermsPrivacyAbout,
  Like,
  Notification,
  Transaction,
  Religion, Sect, Jammat, Caste,
  CourseCategory, Course,
  Language
};
