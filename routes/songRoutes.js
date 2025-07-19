const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/songController');
const { searchSongs } = require('../utils/searchSongs'); // Assuming your search function is in this file
const {
    authenticate,
    authorizeArtistOrAdmin,
    authorizeAdminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Multer Error Handler ---
function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Multer error', details: err.message });
    } else if (err) {
        return res.status(500).json({ error: 'Upload error', details: err.message });
    }
    next();
}

// ==========================
// 🎵 Upload Routes
// ==========================
router.post(
    '/upload',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    multerErrorHandler,
    uploadController.uploadSong
);

router.post(
    '/upload-multiple',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'songs', maxCount: 1 },
        ...Array.from({ length: 20 }, (_, i) => [
            { name: `audio${i}`, maxCount: 1 },
            { name: `image${i}`, maxCount: 1 }
        ]).flat()
    ]),
    multerErrorHandler,
    uploadController.uploadMultipleSongs
);

// ==========================
// Fetch Routes
// ==========================
router.get('/', uploadController.getAllSongsFiltered);
router.get('/album/:albumName', uploadController.getSongsByAlbum);
router.get('/artist/:name', uploadController.getSongsByArtist);
router.get('/genre/:name', uploadController.getSongsByGenre);
router.get('/mood/:name', uploadController.getSongsByMood);
router.get('/director/:name', uploadController.getSongsByMusicDirector);
router.get('/variations/:uid', uploadController.getSongTranslations);
router.get('/year/:year', uploadController.getSongsByYear);
router.get('/language/:lang', uploadController.getSongsByLanguage);
router.get('/filter-by-language-mood', uploadController.getSongsByLanguageAndMood);
router.get('/filter-by-language-year', uploadController.getSongsByLanguageAndYear);
router.get('/suggestions/:uid', uploadController.getSongSuggestions);

// ==========================
// Search Route (New) 
// ==========================
router.get('/search', async (req, res) => {
    const { query, page = 1, limit = 20, mood, genre, artist, decade } = req.query;

    try {
        const results = await searchSongs(query, { mood, genre, artist, decade, page, limit });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:uid', uploadController.getSongByUid);

// ==========================
// Modify Routes
// ==========================
router.put(
    '/:uid',
    authenticate,
    authorizeArtistOrAdmin,
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    multerErrorHandler,
    uploadController.updateSong
);

router.delete(
    '/:uid',
    authenticate,
    authorizeArtistOrAdmin,
    uploadController.deleteSong
);

module.exports = router;
