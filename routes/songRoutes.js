const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/songController');
const {
    authenticate,
    authorizeArtistOrAdmin,
    authorizeAdminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();

// Use in-memory storage for Cloudinary streaming
const upload = multer();

// Upload a new song
// router.post(
//     '/upload',
//     authenticate,
//     authorizeArtistOrAdmin,
//     upload.fields([
//         { name: 'audio', maxCount: 1 },
//         { name: 'image', maxCount: 1 }
//     ]),
//     uploadController.uploadSong
// );

router.post(
    '/upload',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Multer error', details: err.message });
        } else if (err) {
            return res.status(500).json({ error: 'Upload error', details: err.message });
        }
        next();
    },
    uploadController.uploadSong
);


// Get all songs (admin only)
router.get(
    '/admin/all-songs',
    authenticate,
    authorizeAdminOnly,
    uploadController.getAllSongs
);

// Get songs uploaded by the logged-in user
router.get(
    '/my-songs',
    authenticate,
    authorizeArtistOrAdmin,
    uploadController.getMySongs
);

// Get all public songs
router.get('/', uploadController.getAllSongs);

// Get a specific song by UUID
// router.get('/:uuid', uploadController.getSongByUuid);
router.get('/:uid', uploadController.getSongByUid);


// Update a song
router.put(
    '/:id',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    uploadController.updateSong
);

module.exports = router;
