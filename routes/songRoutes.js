const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/songController');
const { authenticate, authorizeArtistOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ Use memoryStorage or diskStorage
const upload = multer({ storage: multer.memoryStorage() });

router.post(
    '/upload',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 },
    ]),
    uploadController.uploadSong
);

module.exports = router;
