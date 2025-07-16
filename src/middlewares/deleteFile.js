const fs = require('fs');
const path = require('path');

// Adjust base path according to your directory structure
const BASE_PATH = path.resolve(__dirname, '../..'); // Go up two levels from src to the root

/**
 * Deletes a file from the filesystem.
 * @param {string} filePath - The path to the file to delete.
 * @returns {Promise<void>} A promise that resolves when the file is deleted.
 */
const deleteFile = (filePath) => {

  return new Promise((resolve, reject) => {
    if (!filePath) return resolve(); // If no file path is provided, resolve without error.

    // Normalize the path to ensure compatibility across different operating systems
    const fullPath = path.resolve(BASE_PATH, filePath); // Construct the full path based on the base path

    fs.access(fullPath, fs.constants.F_OK, (err) => {
      if (err) {
        return resolve(); // If the file does not exist, resolve without error.
      }

      fs.unlink(fullPath, (err) => {
        if (err) {
          return reject(err); // If there's an error during deletion, reject the promise.
        }
        resolve(); // Resolve the promise when deletion is successful.
      });
    });
  });
};

module.exports = deleteFile;
