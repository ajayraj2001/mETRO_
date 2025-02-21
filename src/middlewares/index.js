const authenticateAdmin = require('./authenticateAdmin');
const authenticateUser = require('./authenticateUser');
const {getFileUploader} = require('./fileUpload');
const {getMultipleFilesUploader} = require('./multipleFileUpload');
module.exports = {
  authenticateUser,
  authenticateAdmin,
  getFileUploader,
  getMultipleFilesUploader
};
