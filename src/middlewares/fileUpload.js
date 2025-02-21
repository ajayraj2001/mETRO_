// const multer = require('multer');
// const fs = require('fs');
// const {ApiError} = require('../errorHandler')

// function getFileUploader(fieldName, publicDirName = '') {
//   //if (!mimetypes) mimetypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif'];

//   const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//       if (!fs.existsSync(`public/${publicDirName}`)) {
//         fs.mkdirSync(`public/${publicDirName}`, { recursive: true });
//       }
//       cb(null, `public/${publicDirName}`);
//     },
//     filename: function (req, file, cb) {
//       const { originalname } = file;
//       let fileExt = '.jpeg';
//       const extI = originalname.lastIndexOf('.');
//       if (extI !== -1) {
//         fileExt = originalname.substring(extI).toLowerCase();
//       }
//       const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//       const fileName = `${uniqueSuffix}${fileExt}`;
//       cb(null, fileName);
//     },
//   });
//   const upload = multer({
//     storage: storage,
//     // fileFilter: (req, file, cb) => {
//     //   mimetypes.includes(file.mimetype) ? cb(null, true) : cb(new ApiError('Invalid image type', 400));
//     // },
//     limits: {
//       fileSize: 10 * 1024 * 1024 // 10 MB size limit
//     }
//   }).single(fieldName);
//   return upload;
// }

// module.exports = { getFileUploader };

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

