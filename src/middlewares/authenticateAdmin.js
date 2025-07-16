const { ApiError } = require('../errorHandler');
const { Admin } = require('../models');
const { verifyAccessToken } = require('../utils');

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    
    const legit = verifyAccessToken(token);
    const admin = await Admin.findById(legit._id);

    if (admin) {
      req.admin = admin;
      req.token = token;
      return next();
    }
    throw new ApiError('Access forbidden', 403);
  } catch (err) {
    next(err);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if(!roles.includes(req.admin.role)) {
      throw new ApiError('You are not allowed to access this resource', 403);
    }

    next();
  };
};

module.exports = { 
  authenticateAdmin, 
  authorizeRoles 
};
