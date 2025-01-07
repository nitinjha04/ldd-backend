const multer = require("multer");
const { memoryStorage } = multer;
const _ = require("lodash");
const cloudinaryConfig = require("../config/cloudinaryConfig.js");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Cloudinary configuration
cloudinaryConfig();

// --- Storage Configuration ---
const storage = memoryStorage(); // Use memory storage for multer

// --- Multer Instance ---
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // Optional: 10MB file size limit
  fileFilter: (req, file, cb) => {
    console.log("File MIME Type:", file.mimetype); // Log MIME type
    cb(null, true); // Accept valid files
  },
});

// --- Image Upload Function ---
async function imageUpload(files) {
  return Promise.all(
    files.map((file) => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "auto", // Auto detect file type (image, video, etc.)
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result.secure_url); // Return the secure URL from Cloudinary
              }
            }
          )
          .end(file.buffer); // Send the buffer to Cloudinary upload stream
      });
    })
  );
}

// --- Handle File Uploads ---
const handleFileUploads = async (
  files,
  fileType,
  key,
  dataToSave,
  array = false
) => {
  if (files && files[fileType]) {
    const filePaths = [];

    // Ensure `fileType` is not undefined or empty and handle as an array
    const fileArray = Array.isArray(files[fileType][0])
      ? files[fileType][0]
      : files[fileType];

    // Filter out files that don't have a valid buffer
    const validFiles = fileArray.filter((file) => file && file.buffer);
    if (validFiles.length !== fileArray.length) {
      console.warn(
        `Some files are missing buffers or are invalid for fileType: ${fileType}`
      );
    }

    // Upload each file to Cloudinary
    const uploadPromises = validFiles.map(async (file) => {
      // Assuming your imageUpload function can handle file buffer
      const result = await imageUpload([file]);
      return result.length > 0 ? result[0] : null; // Return the file path or null if failed
    });

    const results = await Promise.all(uploadPromises);

    // Filter out any null results and store valid file paths
    results.forEach((result) => {
      if (result) {
        filePaths.push(result);
      }
    });

    // Handle the file paths by updating `dataToSave` object
    if (filePaths.length > 0) {
      if (array) {
        const existingArray = _.get(dataToSave, key, []);
        _.set(dataToSave, key, [...existingArray, ...filePaths]);
      } else if (filePaths.length > 1) {
        _.set(dataToSave, key, filePaths);
      } else {
        _.set(dataToSave, key, filePaths[0]);
      }
    }
  } else if (fileType === "none") {
    // Handle fallback files (when fileType is "none")
    const fallbackFiles = Object.values(files).flat();
    if (fallbackFiles.length > 0) {
      const fallbackUploadPromises = fallbackFiles.map(async (file) => {
        const result = await imageUpload([file]);
        return result.length > 0 ? result[0] : null;
      });

      const fallbackResults = await Promise.all(fallbackUploadPromises);
      const fallbackFilePaths = fallbackResults.filter((result) => result);

      if (fallbackFilePaths.length > 0) {
        if (array) {
          const existingArray = _.get(dataToSave, key, []);
          _.set(dataToSave, key, [...existingArray, ...fallbackFilePaths]);
        } else if (fallbackFilePaths.length > 1) {
          _.set(dataToSave, key, fallbackFilePaths);
        } else {
          _.set(dataToSave, key, fallbackFilePaths[0]);
        }
      }
    } else {
      console.warn(`No fallback files available to upload for key: ${key}`);
    }
  }
};

module.exports = { upload, handleFileUploads };
