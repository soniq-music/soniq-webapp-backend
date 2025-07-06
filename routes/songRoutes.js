const express = require('express');
const multer = require('multer');
const { audioStorage, imageStorage } = require('../config/cloudinary');
const uploadController = require('../controllers/songController');
const { authenticate, authorizeArtistOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for audio and image uploads
const audioUpload = multer({ storage: audioStorage });
const imageUpload = multer({ storage: imageStorage });

// Accept both `audio` and optional `image`
const upload = multer({ storage: null }).fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

// Secure route: only artists/admins can upload
router.post(
    '/upload',
    authenticate,
    authorizeArtistOrAdmin,
    upload,
    uploadController.uploadSong
);

module.exports = router;
