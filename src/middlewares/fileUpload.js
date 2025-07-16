const multer = require('multer');
const fs = require('fs');
const { ApiError } = require('../errorHandler');

function getFileUploader(fieldName, publicDirName = '') {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dirPath = `public/${publicDirName}`;
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      cb(null, dirPath);
    },
    filename: function (req, file, cb) {
      const { originalname } = file;
      const extIndex = originalname.lastIndexOf('.');
      const fileExt = extIndex !== -1 ? originalname.substring(extIndex).toLowerCase() : '.jpeg';
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileName = `${uniqueSuffix}${fileExt}`;
      cb(null, fileName);
    },
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB size limit
    }
  }).single(fieldName);

  return upload;
}

module.exports = { getFileUploader };

