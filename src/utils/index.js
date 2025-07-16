const mongoose = require('mongoose');
const fs = require('fs');
const util = require('util');

const getOtp = require('./getOtp');
const verifyAccessToken = require('./verifyAccessToken');

// const isValidMongoId = (id) => {
//   return mongoose.Types.ObjectId.isValid(id);
// };

async function deleteOldFile(url) {
  try {
    if (url) {
      const unlinkFile = util.promisify(fs.unlink);
      await unlinkFile(url.replace(process.env.BASE_URL, ''));
    }
  } catch (error) {
    console.log(error.message);
  }
}

module.exports = {
  getOtp,
  verifyAccessToken,
  deleteOldFile,
};
