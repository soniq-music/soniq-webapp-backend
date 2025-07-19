// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const dotenv = require('dotenv');
dotenv.config();

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload helper: stream buffer to Cloudinary
async function uploadToCloudinaryStream(buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            return resolve(result.secure_url);
        });
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

module.exports = {
    cloudinary,
    uploadToCloudinaryStream,
};
