const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Storage for audio files (.mp3)
const audioStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'songs',
        resource_type: 'video', // IMPORTANT for audio files
        format: async () => 'mp3',
        public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
    },
});

// ✅ Storage for cover images (.jpg)
const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'covers',
        resource_type: 'image',
        format: async () => 'jpg',
        public_id: (req, file) => `cover-${Date.now()}-${file.originalname.split('.')[0]}`,
    },
});

module.exports = {
    cloudinary,
    audioStorage,
    imageStorage,
};
