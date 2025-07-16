const authenticateAdmin = require('./authenticateAdmin');
const authenticateUser = require('./authenticateUser');
const {getFileUploader} = require('./fileUpload');
const {getMultipleFilesUploader} = require('./multipleFileUpload');
const deleteFile = require('./deleteFile');
module.exports = {
  authenticateUser,
  authenticateAdmin,
  getFileUploader,
  getMultipleFilesUploader,
  deleteFile
};
