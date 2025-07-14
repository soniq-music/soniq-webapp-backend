const mm = require('music-metadata');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const { Song, Artist, Genre, Mood } = require('../models');
const generateAIImage = require('../utils/generateAIImage');
const { Op } = require('sequelize');
const path = require('path');

// Get audio duration
async function getAudioDurationFromBuffer(buffer) {
    try {
        const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true });
        return metadata.format.duration;
    } catch (err) {
        console.error('Failed to calculate duration:', err.message);
        return null;
    }
}

exports.uploadSong = async (req, res) => {
    try {
        const { title, album, duration, year, language, parentUid } = req.body;
        let { artist, genre, mood } = req.body;
        const uploaderUid = req.user?.uid;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Title is required and must be a string' });
        }

        if (!language || typeof language !== 'string') {
            return res.status(400).json({ error: 'Language is required and must be a string' });
        }

        if (!audioFile) return res.status(400).json({ error: 'No audio file uploaded' });
        if (!audioFile.mimetype.startsWith('audio/')) {
            return res.status(400).json({ error: 'Invalid audio file type' });
        }

        artist = typeof artist === 'string' ? artist.split(',').map(a => a.trim()) : artist || [];
        genre = typeof genre === 'string' ? genre.split(',').map(g => g.trim()) : genre || [];
        mood = typeof mood === 'string' ? mood.split(',').map(m => m.trim()) : mood || [];

        const audioUploadUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
                resource_type: 'video',
                folder: 'songs',
                public_id: `${Date.now()}-${path.parse(audioFile.originalname).name}`,
            }, (error, result) => error ? reject(error) : resolve(result.secure_url));
            streamifier.createReadStream(audioFile.buffer).pipe(uploadStream);
        });

        let finalDuration = duration;
        if (!duration) {
            finalDuration = await getAudioDurationFromBuffer(audioFile.buffer);
            if (!finalDuration) {
                return res.status(400).json({ error: 'Could not determine audio duration' });
            }
        }

        let coverImageUrl;
        if (imageFile) {
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({
                    resource_type: 'image',
                    folder: 'covers',
                    public_id: `cover-${Date.now()}-${path.parse(imageFile.originalname).name}`,
                }, (error, result) => error ? reject(error) : resolve(result.secure_url));
                streamifier.createReadStream(imageFile.buffer).pipe(uploadStream);
            });
        } else {
            const aiImageBuffer = await generateAIImage(`${title} ${artist.join(' ')} ${album}`);
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({
                    resource_type: 'image',
                    folder: 'covers',
                    public_id: `cover-${Date.now()}-ai`,
                }, (error, result) => error ? reject(error) : resolve(result.secure_url));
                streamifier.createReadStream(aiImageBuffer).pipe(uploadStream);
            });
        }

        const song = await Song.create({
            title: title.trim(),
            album: album?.trim(),
            url: audioUploadUrl,
            duration: finalDuration,
            coverImage: coverImageUrl,
            artistUid: uploaderUid,
            year: year ? parseInt(year) : null,
            language: language.trim(),
            parentUid: parentUid || null,
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

        res.status(201).json({ message: 'Song uploaded successfully', song: fullSong });

    } catch (err) {
        console.error('Error uploading song:', err);
        res.status(500).json({ error: 'Upload failed', details: err.message });
    }
};

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

// GET /api/songs/album/:albumName
exports.getSongsByAlbum = async (req, res) => {
    const { albumName } = req.params;

    try {
        const songs = await Song.findAll({
            where: {
                album: {
                    [Op.like]: `%${albumName}%`
                }
            },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ],
            order: [['createdAt', 'DESC']],
        });

        if (songs.length === 0) {
            return res.status(404).json({ error: 'No songs found for this album name' });
        }

        res.status(200).json({ songs });

    } catch (err) {
        console.error('Error fetching songs by album:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

exports.getSongByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        const song = await Song.findOne({
            where: { uid },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ]
        });

        if (!song) return res.status(404).json({ error: 'Song not found' });

        res.status(200).json({ song });
    } catch (err) {
        console.error('Error fetching song:', err);
        res.status(500).json({ error: 'Failed to fetch song' });
    }
};

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

exports.updateSong = async (req, res) => {
    try {
        const { uid } = req.params;
        const userUid = req.user.uid;
        const userRole = req.user.role;

        const song = await Song.findOne({ where: { uid } });
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

        if (title) song.title = title.trim();
        if (album) song.album = album.trim();
        if (duration) song.duration = duration;

        await song.save();

        res.status(200).json({ message: 'Song updated', song });

    } catch (err) {
        console.error('Error updating song:', err);
        res.status(500).json({ error: 'Update failed', details: err.message });
    }
};

// GET /api/songs/artist/:name
exports.getSongsByArtist = async (req, res) => {
    const { name } = req.params;
    try {
        const artists = await Artist.findAll({
            where: {
                name: {
                    [Op.like]: `%${name}%`
                }
            }
        });

        if (!artists.length) return res.status(404).json({ error: 'Artist not found' });

        const allSongs = [];
        for (const artist of artists) {
            const songs = await artist.getSongs({
                include: [
                    { model: Artist, as: 'Artists' },
                    { model: Genre, as: 'Genres' },
                    { model: Mood, as: 'Moods' },
                ],
                order: [['createdAt', 'DESC']],
            });
            allSongs.push(...songs);
        }

        res.status(200).json({ songs: allSongs });
    } catch (err) {
        console.error('Error fetching songs by artist:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// GET /api/songs/genre/:name
exports.getSongsByGenre = async (req, res) => {
    const { name } = req.params;
    try {
        const genres = await Genre.findAll({
            where: {
                name: {
                    [Op.like]: `%${name}%`
                }
            }
        });

        if (!genres.length) return res.status(404).json({ error: 'Genre not found' });

        const allSongs = [];
        for (const genre of genres) {
            const songs = await genre.getSongs({
                include: [
                    { model: Artist, as: 'Artists' },
                    { model: Genre, as: 'Genres' },
                    { model: Mood, as: 'Moods' },
                ],
                order: [['createdAt', 'DESC']],
            });
            allSongs.push(...songs);
        }

        res.status(200).json({ songs: allSongs });
    } catch (err) {
        console.error('Error fetching songs by genre:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// GET /api/songs/mood/:name
exports.getSongsByMood = async (req, res) => {
    const { name } = req.params;
    try {
        const moods = await Mood.findAll({
            where: {
                name: {
                    [Op.like]: `%${name}%`
                }
            }
        });

        if (!moods.length) return res.status(404).json({ error: 'Mood not found' });

        const allSongs = [];
        for (const mood of moods) {
            const songs = await mood.getSongs({
                include: [
                    { model: Artist, as: 'Artists' },
                    { model: Genre, as: 'Genres' },
                    { model: Mood, as: 'Moods' },
                ],
                order: [['createdAt', 'DESC']],
            });
            allSongs.push(...songs);
        }

        res.status(200).json({ songs: allSongs });
    } catch (err) {
        console.error('Error fetching songs by mood:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// GET /api/songs/filter?artist=&genre=&mood=&title=&page=1&limit=10
exports.getAllSongsFiltered = async (req, res) => {
    const { artist, genre, mood, title, page = 1, limit = 10 } = req.query;

    try {
        const include = [
            { model: Artist, as: 'Artists' },
            { model: Genre, as: 'Genres' },
            { model: Mood, as: 'Moods' },
        ];

        const where = {};
        if (title) where.title = { [Op.like]: `%${title}%` };
        if (artist) include[0].where = { name: { [Op.like]: `%${artist}%` } };
        if (genre) include[1].where = { name: { [Op.like]: `%${genre}%` } };
        if (mood) include[2].where = { name: { [Op.like]: `%${mood}%` } };

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows: songs } = await Song.findAndCountAll({
            where,
            include,
            order: [['createdAt', 'DESC']],
            distinct: true,
            limit: parseInt(limit),
            offset
        });

        res.status(200).json({
            page: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalSongs: count,
            songs
        });

    } catch (err) {
        console.error('Error filtering songs:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

exports.deleteSong = async (req, res) => {
    try {
        const { uid } = req.params;
        const userUid = req.user.uid;
        const userRole = req.user.role;

        const song = await Song.findOne({
            where: { uid },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ]
        });

        if (!song) return res.status(404).json({ error: 'Song not found' });

        if (userRole !== 'admin' && song.artistUid !== userUid) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Remove associations (join table records)
        await song.setArtists([]);
        await song.setGenres([]);
        await song.setMoods([]);

        // Delete audio from Cloudinary
        const audioPublicId = getPublicIdFromUrl(song.url);
        if (audioPublicId) {
            await cloudinary.uploader.destroy(audioPublicId, { resource_type: 'video' });
        }

        // Delete cover image from Cloudinary
        const imagePublicId = getPublicIdFromUrl(song.coverImage);
        if (imagePublicId) {
            await cloudinary.uploader.destroy(imagePublicId, { resource_type: 'image' });
        }

        // Delete song record
        await song.destroy();

        return res.status(200).json({ message: 'Song deleted successfully' });

    } catch (err) {
        console.error('Error deleting song:', err);
        return res.status(500).json({ error: 'Failed to delete song', details: err.message });
    }
};

// Utility: Extract public_id from Cloudinary URL
function getPublicIdFromUrl(url) {
    try {
        const parts = url.split('/');
        const fileName = parts[parts.length - 1];
        return fileName.split('.')[0];
    } catch {
        return null;
    }
}

