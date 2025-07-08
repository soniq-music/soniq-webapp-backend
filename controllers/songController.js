const mm = require('music-metadata');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const Song = require('../models/Song');
const generateAIImage = require('../utils/generateAIImage');
const { Op } = require('sequelize');



async function getAudioDurationFromBuffer(buffer) {
    try {
        const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true });
        return metadata.format.duration;
    } catch (err) {
        console.error('Failed to calculate duration:', err.message);
        return null;
    }
}

// POST /api/songs/upload
exports.uploadSong = async (req, res) => {
    try {
        console.log('📥 req.body:', req.body);
        console.log('📁 req.files:', req.files);

        const { title, artist, mood, genre, album, duration } = req.body;
        const uploaderId = req.user?.id;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // 📤 Upload audio buffer to Cloudinary
        const audioUploadUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video', // required for audio
                    folder: 'songs',
                    timeout: 120000 // 2-minute timeout
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            );
            streamifier.createReadStream(audioFile.buffer).pipe(uploadStream);
        });

        // ⏱️ Get duration if not provided
        let finalDuration = duration;
        if (!duration) {
            // finalDuration = await getAudioDurationFromURL(audioUploadUrl);
            finalDuration = await getAudioDurationFromBuffer(audioFile.buffer);
        }

        // 📸 Upload or generate cover image
        let coverImageUrl;
        if (imageFile) {
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'covers',
                        timeout: 120000
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }
                );
                streamifier.createReadStream(imageFile.buffer).pipe(uploadStream);
            });
        } else {
            const aiImageBuffer = await generateAIImage(`${title} ${artist} ${album}`);
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'covers',
                        timeout: 120000
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }
                );
                streamifier.createReadStream(aiImageBuffer).pipe(uploadStream);
            });
        }

        // 💾 Save to DB
        const song = await Song.create({
            title,
            artist,
            url: audioUploadUrl,
            mood,
            genre,
            album,
            duration: finalDuration,
            coverImage: coverImageUrl,
            artistId: uploaderId,
        });

        console.log('✅ Song uploaded:', song.title);
        return res.status(201).json({ message: 'Song uploaded successfully', song });

    } catch (err) {
        console.error('❌ Error uploading song:', err);
        return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
};

// GET /api/songs
exports.getAllSongs = async (req, res) => {
    try {
        const { search, genre, mood, limit = 20, offset = 0 } = req.query;

        const where = {};

        if (genre) where.genre = genre;
        if (mood) where.mood = mood;
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { artist: { [Op.like]: `%${search}%` } }
            ];
        }

        const songs = await Song.findAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
        });

        return res.json({ songs });

    } catch (err) {
        console.error('Error fetching songs:', err);
        return res.status(500).json({ error: 'Failed to fetch songs' });
    }
};

// GET /api/songs/:uuid
exports.getSongByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;

        const song = await Song.findOne({ where: { uuid } });

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        return res.json({ song });
    } catch (err) {
        console.error('Error fetching song:', err);
        return res.status(500).json({ error: 'Failed to fetch song' });
    }
};

// GET /api/songs/my-songs
// Fetch songs uploaded by the authenticated artist
exports.getMySongs = async (req, res) => {
    try {
        const artistId = req.user?.id;
        const songs = await Song.findAll({
            where: { artistId },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ songs });
    } catch (err) {
        console.error('❌ Failed to fetch artist songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

// GET /api/songs/my-songs
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ songs });
    } catch (err) {
        console.error('❌ Failed to fetch all songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

// GET /api/songs/admin/all-songs
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ songs });
    } catch (err) {
        console.error('❌ Failed to fetch all songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

// PUT /api/songs/:id
exports.updateSong = async (req, res) => {
    try {
        const songId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        const song = await Song.findByPk(songId);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        // Ownership check (unless admin)
        if (userRole !== 'admin' && song.artistId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { title, album, genre, mood, duration } = req.body;
        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        // Upload new audio if provided
        if (audioFile) {
            const audioUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'video', folder: 'songs' },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                );
                streamifier.createReadStream(audioFile.buffer).pipe(uploadStream);
            });
            song.url = audioUrl;

            // Optional: update duration from buffer if not passed
            const newDuration = await getAudioDurationFromBuffer(audioFile.buffer);
            if (newDuration) song.duration = newDuration;
        }

        // Upload new image if provided
        if (imageFile) {
            const imageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'image', folder: 'covers' },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                );
                streamifier.createReadStream(imageFile.buffer).pipe(uploadStream);
            });
            song.coverImage = imageUrl;
        }

        // Update text fields
        if (title) song.title = title;
        if (album) song.album = album;
        if (genre) song.genre = genre;
        if (mood) song.mood = mood;
        if (duration) song.duration = duration;

        await song.save();

        return res.status(200).json({ message: 'Song updated', song });

    } catch (err) {
        console.error('❌ Error updating song:', err);
        return res.status(500).json({ error: 'Update failed', details: err.message });
    }
};




