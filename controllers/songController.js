const mm = require('music-metadata');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const { Song, Artist, Genre, Mood } = require('../models');
const generateAIImage = require('../utils/generateAIImage');
const { Op } = require('sequelize');

// Utility to get audio duration from buffer
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
    console.log('FILES:', req.files);
    console.log('BODY:', req.body);

    try {
        const { title, album, duration } = req.body;
        let { artist, genre, mood } = req.body;
        const uploaderUid = req.user?.uid;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // Normalize to arrays
        artist = typeof artist === 'string' ? artist.split(',').map(a => a.trim()) : artist || [];
        genre = typeof genre === 'string' ? genre.split(',').map(g => g.trim()) : genre || [];
        mood = typeof mood === 'string' ? mood.split(',').map(m => m.trim()) : mood || [];

        // Upload audio
        const audioUploadUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    folder: 'songs',
                    timeout: 120000
                },
                (error, result) => error ? reject(error) : resolve(result.secure_url)
            );
            streamifier.createReadStream(audioFile.buffer).pipe(uploadStream);
        });

        let finalDuration = duration;
        if (!duration) {
            finalDuration = await getAudioDurationFromBuffer(audioFile.buffer);
        }

        // Upload image
        let coverImageUrl;
        if (imageFile) {
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'covers',
                        timeout: 120000
                    },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                );
                streamifier.createReadStream(imageFile.buffer).pipe(uploadStream);
            });
        } else {
            const aiImageBuffer = await generateAIImage(`${title} ${artist.join(' ')} ${album}`);
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'covers',
                        timeout: 120000
                    },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                );
                streamifier.createReadStream(aiImageBuffer).pipe(uploadStream);
            });
        }

        const song = await Song.create({
            title,
            url: audioUploadUrl,
            duration: finalDuration,
            album,
            coverImage: coverImageUrl,
            artistUid: uploaderUid,
        });

        for (const name of artist) {
            const [artistInstance] = await Artist.findOrCreate({ where: { name } });
            await song.addArtist(artistInstance);
        }

        for (const name of genre) {
            const [genreInstance] = await Genre.findOrCreate({ where: { name } });
            await song.addGenre(genreInstance);
        }

        for (const name of mood) {
            const [moodInstance] = await Mood.findOrCreate({ where: { name } });
            await song.addMood(moodInstance);
        }

        const fullSong = await Song.findByPk(song.id, {
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ]
        });

        return res.status(201).json({ message: 'Song uploaded successfully', song: fullSong });

    } catch (err) {
        console.error('Error uploading song:', err);
        return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
};

// GET /api/songs
exports.getAllSongs = async (req, res) => {
    try {
        const songs = await Song.findAll({
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ],
            order: [['createdAt', 'DESC']],
        });
        res.status(200).json({ songs });
    } catch (err) {
        console.error('Failed to fetch all songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

// GET /api/songs/:uid
exports.getSongByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        const song = await Song.findOne({ where: { uid } });

        if (!song) return res.status(404).json({ error: 'Song not found' });

        res.status(200).json({ song });
    } catch (err) {
        console.error('Error fetching song:', err);
        res.status(500).json({ error: 'Failed to fetch song' });
    }
};

// GET /api/songs/my-songs
exports.getMySongs = async (req, res) => {
    try {
        const artistUid = req.user?.uid;
        const songs = await Song.findAll({
            where: { artistUid },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ songs });
    } catch (err) {
        console.error('Failed to fetch artist songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

// PUT /api/songs/:id
exports.updateSong = async (req, res) => {
    try {
        const songId = req.params.id;
        const userUid = req.user.uid;
        const userRole = req.user.role;

        const song = await Song.findByPk(songId);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        if (userRole !== 'admin' && song.artistUid !== userUid) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { title, album, genre, mood, duration } = req.body;
        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        if (audioFile) {
            const audioUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'video', folder: 'songs' },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                );
                streamifier.createReadStream(audioFile.buffer).pipe(uploadStream);
            });
            song.url = audioUrl;
            const newDuration = await getAudioDurationFromBuffer(audioFile.buffer);
            if (newDuration) song.duration = newDuration;
        }

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

        if (title) song.title = title;
        if (album) song.album = album;
        if (duration) song.duration = duration;

        await song.save();

        res.status(200).json({ message: 'Song updated', song });

    } catch (err) {
        console.error('Error updating song:', err);
        res.status(500).json({ error: 'Update failed', details: err.message });
    }
};
