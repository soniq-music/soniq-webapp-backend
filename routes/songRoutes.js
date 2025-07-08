const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/songController');
const { authenticate, authorizeArtistOrAdmin, authorizeAdminOnly } = require('../middleware/authMiddleware');


const router = express.Router();

// ✅ Use memoryStorage or diskStorage
// const upload = multer({ storage: multer.memoryStorage() });
const { audioStorage, imageStorage } = require('../config/cloudinary');

// Separate uploaders for audio and image
const audioUpload = multer({ storage: audioStorage });
const imageUpload = multer({ storage: imageStorage });

// Combine both storages (hack for multipart uploads)
const upload = multer();


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

router.get('/', uploadController.getAllSongs);
router.get('/:uuid', uploadController.getSongByUuid);
router.get(
    '/my-songs',
    authenticate,
    authorizeArtistOrAdmin,
    uploadController.getMySongs
);

router.get(
    '/admin/all-songs',
    authenticate,
    authorizeAdminOnly,
    uploadController.getAllSongs
);

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
