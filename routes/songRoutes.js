const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/songController');
const {
    authenticate,
    authorizeArtistOrAdmin,
    authorizeAdminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer(); // In-memory for Cloudinary

// Upload a new song
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

// Filtered + paginated list (also works as "get all")
router.get('/', uploadController.getAllSongsFiltered);

// Get songs uploaded by the current user
router.get(
    '/my-songs',
    authenticate,
    authorizeArtistOrAdmin,
    uploadController.getMySongs
);

router.get('/album/:albumName', uploadController.getSongsByAlbum);

// Get song by UID
router.get('/song/:uid', uploadController.getSongByUid);

// Filter by artist, genre, mood (all by name)
router.get('/artist/:name', uploadController.getSongsByArtist);
router.get('/genre/:name', uploadController.getSongsByGenre);
router.get('/mood/:name', uploadController.getSongsByMood);

// Update song by UID
router.put(
    '/:uid',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    uploadController.updateSong
);

router.delete(
    '/:uid',
    authenticate,
    authorizeArtistOrAdmin,
    uploadController.deleteSong
);


module.exports = router;
