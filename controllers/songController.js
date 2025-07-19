const mm = require('music-metadata');
const path = require('path');

const { cloudinary, uploadToCloudinaryStream } = require('../utils/cloudinaryUpload');
const generateAIImage = require('../utils/generateAIImage');
const { handleUploadIfNoUrl } = require('../utils/uploadHelpers');

const { Op, fn, col, where } = require('sequelize');
const { Song, Mood, Artist, Genre } = require('../models');

// Utility to extract audio duration
async function getAudioDurationFromBuffer(buffer) {
    try {
        const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true });
        return metadata.format.duration;
    } catch (err) {
        console.error('Failed to calculate duration:', err.message);
        return null;
    }
}

// Extract public ID from Cloudinary URL
function getPublicIdFromUrl(url) {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0];
}

// POST /api/songs/upload
const uploadSong = async (req, res) => {
    try {
        const { title, album, duration, year, language, parentUid, audioUrl, imageUrl } = req.body;
        let { artist, genre, mood, musicDirector } = req.body;
        const uploaderUid = req.user?.uid;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required' });
        if (!language || typeof language !== 'string') return res.status(400).json({ error: 'Language is required' });
        if (!audioUrl && !audioFile) return res.status(400).json({ error: 'Audio file or audioUrl is required' });

        const cleanList = (input) =>
            typeof input === 'string'
                ? [...new Set(input.split(',').map(i => i.trim()).filter(i => i))]
                : Array.isArray(input) ? [...new Set(input.map(i => i.trim()).filter(i => i))] : [];

        artist = cleanList(artist);
        genre = cleanList(genre);
        mood = cleanList(mood);
        musicDirector = cleanList(musicDirector);

        // Upload audio
        let finalAudioUrl;
        try {
            finalAudioUrl = await handleUploadIfNoUrl(audioFile, audioUrl, 'songs', 'audio');
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        // Get duration
        let finalDuration = duration;
        if (!finalDuration && audioFile) {
            finalDuration = await getAudioDurationFromBuffer(audioFile.buffer);
            if (!finalDuration) return res.status(400).json({ error: 'Could not determine audio duration' });
        }

        // Upload image or generate fallback
        let coverImageUrl;
        try {
            coverImageUrl = await handleUploadIfNoUrl(imageFile, imageUrl, 'covers', 'image');
        } catch {
            const aiBuffer = await generateAIImage(`${title} ${artist.join(' ')} ${album}`);
            coverImageUrl = await uploadToCloudinaryStream(aiBuffer, {
                resource_type: 'image',
                folder: 'covers',
                public_id: `cover-${Date.now()}-ai`
            });
        }

        // Create Song
        const song = await Song.create({
            title: title.trim(),
            album: album?.trim(),
            url: finalAudioUrl,
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

        for (const name of musicDirector) {
            const [directorInstance] = await Artist.findOrCreate({ where: { name } });
            await song.addMusicDirector(directorInstance);
        }

        const fullSong = await Song.findByPk(song.id, {
            include: [
                { model: Artist, as: 'Artists' },
                { model: Artist, as: 'MusicDirectors' },
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

// PUT /api/songs/update-song/:uid
const updateSong = async (req, res) => {
    try {
        const { uid } = req.params;
        const userUid = req.user.uid;
        const userRole = req.user.role;

        const song = await Song.findOne({ where: { uid } });
        if (!song) return res.status(404).json({ error: 'Song not found' });

        if (userRole !== 'admin' && song.artistUid !== userUid) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const {
            title, album, duration, language, year, parentUid,
            genre, mood, artist, musicDirector, audioUrl, coverImageUrl
        } = req.body;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        // Audio update
        if (audioFile || audioUrl) {
            song.url = await handleUploadIfNoUrl(audioFile, audioUrl, 'songs', 'audio');
            const dur = audioFile ? await getAudioDurationFromBuffer(audioFile.buffer) : null;
            if (dur) song.duration = dur;
        }

        // Image update
        if (coverImageUrl || imageFile) {
            song.coverImage = await handleUploadIfNoUrl(imageFile, coverImageUrl, 'covers', 'image');
        } else if (!song.coverImage) {
            const aiImageBuffer = await generateAIImage(`${title || song.title} ${artist || ''} ${album || ''}`);
            song.coverImage = await uploadToCloudinaryStream(aiImageBuffer, {
                resource_type: 'image',
                folder: 'covers',
                public_id: `cover-${Date.now()}-ai`
            });
        }

        if (title) song.title = title.trim();
        if (album) song.album = album.trim();
        if (duration) song.duration = parseFloat(duration);
        if (language) song.language = language.trim();
        if (year) song.year = parseInt(year);
        if (parentUid) song.parentUid = parentUid;

        const artistList = typeof artist === 'string' ? artist.split(',').map(a => a.trim()) : artist || [];
        const genreList = typeof genre === 'string' ? genre.split(',').map(g => g.trim()) : genre || [];
        const moodList = typeof mood === 'string' ? mood.split(',').map(m => m.trim()) : mood || [];
        const directorList = typeof musicDirector === 'string' ? musicDirector.split(',').map(d => d.trim()) : musicDirector || [];

        if (artistList.length > 0) {
            await song.setArtists([]);
            for (const name of artistList) {
                const [artistInstance] = await Artist.findOrCreate({ where: { name } });
                await song.addArtist(artistInstance);
            }
        }

        if (genreList.length > 0) {
            await song.setGenres([]);
            for (const name of genreList) {
                const [genreInstance] = await Genre.findOrCreate({ where: { name } });
                await song.addGenre(genreInstance);
            }
        }

        if (moodList.length > 0) {
            await song.setMoods([]);
            for (const name of moodList) {
                const [moodInstance] = await Mood.findOrCreate({ where: { name } });
                await song.addMood(moodInstance);
            }
        }

        if (directorList.length > 0) {
            await song.setMusicDirectors([]);
            for (const name of directorList) {
                const [dirInstance] = await Artist.findOrCreate({ where: { name } });
                await song.addMusicDirector(dirInstance);
            }
        }

        await song.save();

        const updatedSong = await Song.findByPk(song.id, {
            include: [
                { model: Artist, as: 'Artists' },
                { model: Artist, as: 'MusicDirectors' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ]
        });

        return res.status(200).json({ message: 'Song updated', song: updatedSong });

    } catch (err) {
        console.error('Error updating song:', err);
        res.status(500).json({ error: 'Update failed', details: err.message });
    }
};

// DELETE /api/auth/delete-song/:uid
const deleteSong = async (req, res) => {
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

        await song.setArtists([]);
        await song.setGenres([]);
        await song.setMoods([]);

        const audioPublicId = getPublicIdFromUrl(song.url);
        if (audioPublicId) {
            await cloudinary.uploader.destroy(audioPublicId, { resource_type: 'video' });
        }

        const imagePublicId = getPublicIdFromUrl(song.coverImage);
        if (imagePublicId) {
            await cloudinary.uploader.destroy(imagePublicId, { resource_type: 'image' });
        }

        await song.destroy();

        return res.status(200).json({ message: 'Song deleted successfully' });

    } catch (err) {
        console.error('Error deleting song:', err);
        return res.status(500).json({ error: 'Failed to delete song', details: err.message });
    }
};

// POST /api/songs/upload-multiple
const uploadMultipleSongs = async (req, res) => {
    try {
        const uploaderUid = req.user?.uid;

        let songsData;
        try {
            songsData = JSON.parse(req.body.songs);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid songs JSON format', details: err.message });
        }

        if (!Array.isArray(songsData) || songsData.length === 0) {
            return res.status(400).json({ error: 'No songs provided for upload' });
        }

        const results = {
            success: [],
            failed: [],
        };

        const findFileByOriginalName = (filename) => {
            for (const files of Object.values(req.files || {})) {
                const match = files.find(f => f.originalname === filename);
                if (match) return match;
            }
            return null;
        };

        for (const songData of songsData) {
            try {
                const {
                    title,
                    album,
                    duration,
                    year,
                    language,
                    parentUid,
                    audioUrl,
                    imageUrl,
                    artist,
                    genre,
                    mood,
                    musicDirector,
                    audioFileName,
                    imageFileName
                } = songData;

                const audioFile = findFileByOriginalName(audioFileName);
                const imageFile = findFileByOriginalName(imageFileName);

                if (!title || typeof title !== 'string') throw new Error('Title is required');
                if (!language || typeof language !== 'string') throw new Error('Language is required');
                if (!audioUrl && !audioFile) throw new Error('Audio file or audioUrl is required');

                const cleanList = (input) =>
                    typeof input === 'string'
                        ? [...new Set(input.split(',').map(i => i.trim()).filter(i => i))]
                        : Array.isArray(input) ? [...new Set(input.map(i => i.trim()).filter(i => i))] : [];

                const artistList = cleanList(artist);
                const genreList = cleanList(genre);
                const moodList = cleanList(mood);
                const directorList = cleanList(musicDirector);

                // Upload audio
                const finalAudioUrl = await handleUploadIfNoUrl(audioFile, audioUrl, 'songs', 'audio');

                // Get duration
                let finalDuration = duration;
                if (!finalDuration && audioFile) {
                    finalDuration = await getAudioDurationFromBuffer(audioFile.buffer);
                    if (!finalDuration) throw new Error('Could not determine audio duration');
                }

                // Upload image or fallback
                let coverImageUrl;
                try {
                    coverImageUrl = await handleUploadIfNoUrl(imageFile, imageUrl, 'covers', 'image');
                } catch {
                    const aiBuffer = await generateAIImage(`${title} ${artistList.join(' ')} ${album}`);
                    coverImageUrl = await uploadToCloudinaryStream(aiBuffer, {
                        resource_type: 'image',
                        folder: 'covers',
                        public_id: `cover-${Date.now()}-ai`
                    });
                }

                const song = await Song.create({
                    title: title.trim(),
                    album: album?.trim(),
                    url: finalAudioUrl,
                    duration: finalDuration,
                    coverImage: coverImageUrl,
                    artistUid: uploaderUid,
                    year: year ? parseInt(year) : null,
                    language: language.trim(),
                    parentUid: parentUid || null,
                });

                for (const name of artistList) {
                    const [artistInstance] = await Artist.findOrCreate({ where: { name } });
                    await song.addArtist(artistInstance);
                }

                for (const name of genreList) {
                    const [genreInstance] = await Genre.findOrCreate({ where: { name } });
                    await song.addGenre(genreInstance);
                }

                for (const name of moodList) {
                    const [moodInstance] = await Mood.findOrCreate({ where: { name } });
                    await song.addMood(moodInstance);
                }

                for (const name of directorList) {
                    const [directorInstance] = await Artist.findOrCreate({ where: { name } });
                    await song.addMusicDirector(directorInstance);
                }

                const fullSong = await Song.findByPk(song.id, {
                    include: [
                        { model: Artist, as: 'Artists' },
                        { model: Artist, as: 'MusicDirectors' },
                        { model: Genre, as: 'Genres' },
                        { model: Mood, as: 'Moods' },
                    ]
                });

                results.success.push({ title, song: fullSong });

            } catch (err) {
                console.error(`❌ Failed to upload song: ${songData?.title}`, err.message);
                results.failed.push({ title: songData?.title || 'Unknown', error: err.message });
            }
        }

        return res.status(207).json({
            message: 'Multiple song upload completed',
            results
        });

    } catch (err) {
        console.error('🔥 Error uploading multiple songs:', err);
        return res.status(500).json({ error: 'Batch upload failed', details: err.message });
    }
};


// GET /api/songs
const getAllSongs = async (req, res) => {
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
const getSongByUid = async (req, res) => {
    try {
        const { uid } = req.params;

        const song = await Song.findOne({
            where: { uid },
            include: [
                { model: Artist, as: 'Artists', through: { attributes: [] } },
                { model: Genre, as: 'Genres', through: { attributes: [] } },
                { model: Mood, as: 'Moods', through: { attributes: [] } },
            ]
        });

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        return res.status(200).json({ song });

    } catch (err) {
        console.error('Error fetching song by UID:', err.message);
        return res.status(500).json({ error: 'Failed to fetch song', details: err.message });
    }
};

// GET /api/songs/album/:albumName
// GET /api/songs/Bahubali?language=Telugu
//GET /api/songs/Bahubali
const getSongsByAlbum = async (req, res) => {
    const searchQuery = req.params.searchQuery;

    try {
        // Normalize input (to lowercase, remove extra spaces)
        const normalizedSearchQuery = searchQuery.trim().toLowerCase();

        // Fetch unique languages from the database (assuming 'language' is a column in the Song model)
        const availableLanguages = await Song.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('language')), 'language']],
            where: { language: { [Op.ne]: null } }, // Exclude null languages
            raw: true,
        });

        const supportedLanguages = availableLanguages.map((song) => song.language.toLowerCase());

        // Identify the language dynamically by looking for it in the search query
        let albumName = normalizedSearchQuery;
        let language = null;

        // Loop through available languages and check if the query ends with one
        for (let lang of supportedLanguages) {
            if (normalizedSearchQuery.endsWith(lang)) {
                albumName = normalizedSearchQuery.slice(0, -lang.length).trim(); // Remove the language part
                language = lang; // Set the identified language
                break;
            }
        }

        // Fuzzy match the album name and filter by language if provided
        const whereCondition = {
            album: {
                [Op.iLike]: `%${albumName}%`, // Fuzzy search album name
            },
        };

        if (language) {
            whereCondition.language = language; // Filter by identified language
        }

        // Fetch the songs based on the album name and language
        const songs = await Song.findAll({
            where: whereCondition,
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
            ],
            order: [['createdAt', 'DESC']],
        });

        if (songs.length === 0) {
            return res.status(404).json({ error: 'No songs found for this album name and language' });
        }

        res.status(200).json({ songs });
    } catch (err) {
        console.error('Error fetching songs by album:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// GET /api/songs/artist/:name
const getSongsByArtist = async (req, res) => {
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
const getSongsByGenre = async (req, res) => {
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
const getSongsByMood = async (req, res) => {
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

// GET /api/songs/director/:name
const getSongsByMusicDirector = async (req, res) => {
    try {
        const directorName = req.params.name;

        const directors = await Artist.findAll({
            where: {
                name: {
                    [Op.like]: `%${directorName}%`
                }
            }
        });

        if (directors.length === 0)
            return res.status(404).json({ error: 'No matching music director found' });

        const allSongs = [];

        for (const director of directors) {
            const songs = await director.getDirectedSongs({ // ✅ fixed here
                include: [
                    { model: Artist, as: 'Artists' },
                    { model: Artist, as: 'MusicDirectors' },
                    { model: Genre, as: 'Genres' },
                    { model: Mood, as: 'Moods' }
                ],
                order: [['createdAt', 'DESC']]
            });
            allSongs.push(...songs);
        }

        // Remove duplicates by song.id
        const deduplicated = Array.from(
            new Map(allSongs.map(s => [s.id, s])).values()
        );

        return res.json({ songs: deduplicated });

    } catch (err) {
        console.error('Error fetching songs by music director:', err);
        res.status(500).json({ error: 'Failed to fetch songs', details: err.message });
    }
};

// GET /api/songs/year/:year
const getSongsByYear = async (req, res) => {
    const { year } = req.params;

    try {
        const songs = await Song.findAll({
            where: { year: parseInt(year) },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' }
            ],
            order: [['createdAt', 'DESC']],
        });

        if (songs.length === 0) {
            return res.status(404).json({ error: `No songs found for year ${year}` });
        }

        res.status(200).json({ songs });
    } catch (err) {
        console.error('Error fetching songs by year:', err);
        res.status(500).json({ error: 'Failed to retrieve songs by year' });
    }
};

// GET /api/songs/language/:lang
const getSongsByLanguage = async (req, res) => {
    const { lang } = req.params;

    try {
        const songs = await Song.findAll({
            where: {
                language: {
                    [Op.like]: `%${lang}%`
                }
            },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' }
            ],
            order: [['createdAt', 'DESC']],
        });

        if (songs.length === 0) {
            return res.status(404).json({ error: `No songs found in language: ${lang}` });
        }

        res.status(200).json({ songs });
    } catch (err) {
        console.error('Error fetching songs by language:', err);
        res.status(500).json({ error: 'Failed to retrieve songs by language' });
    }
};

// GET /api/songs/filter-by-language-mood?language=...&mood=...
const getSongsByLanguageAndMood = async (req, res) => {
    const { language = '', mood = '' } = req.query;

    if (!language && !mood) {
        return res.status(400).json({ error: 'At least one of language or mood is required' });
    }

    // Normalize input
    const langKeywords = language.toLowerCase().split(' ').filter(Boolean);
    const moodKeywords = mood.toLowerCase().split(' ').filter(Boolean);

    try {
        const songs = await Song.findAll({
            where: {
                [Op.or]: langKeywords.map((word) => ({
                    language: { [Op.like]: `%${word}%` }
                }))
            },
            include: [
                {
                    model: Mood,
                    as: 'Moods',
                    required: true,
                    where: {
                        [Op.or]: moodKeywords.map((word) =>
                            where(fn('LOWER', col('Moods.name')), {
                                [Op.like]: `%${word}%`
                            })
                        )
                    }
                },
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Artist, as: 'MusicDirectors' }
            ],
            order: [['createdAt', 'DESC']]
        });

        if (!songs.length) {
            return res.status(404).json({
                error: `No songs found matching language '${language}' and mood '${mood}'`
            });
        }

        res.status(200).json({
            page: 1,
            totalPages: 1,
            totalSongs: songs.length,
            songs
        });
    } catch (err) {
        console.error('Error filtering songs by language and mood:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// GET /api/songs/filter?language=...&year=...&page=1&limit=10
const getSongsByLanguageAndYear = async (req, res) => {
    const { language, year, page = 1, limit = 10 } = req.query;

    if (!language || !year) {
        return res.status(400).json({ error: 'Both language and year are required' });
    }

    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows: songs } = await Song.findAndCountAll({
            where: {
                [Op.and]: [
                    where(fn('LOWER', col('language')), {
                        [Op.like]: `%${language.toLowerCase()}%`
                    }),
                    { year: parseInt(year) }
                ]
            },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' },
                { model: Artist, as: 'MusicDirectors' }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset,
            distinct: true
        });

        if (!songs.length) {
            return res.status(404).json({
                error: `No songs found with language '${language}' and year '${year}'`
            });
        }

        res.status(200).json({
            page: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalSongs: count,
            songs
        });

    } catch (err) {
        console.error('Error fetching songs by language and year:', err);
        res.status(500).json({ error: 'Failed to retrieve songs', details: err.message });
    }
};

//GET /api/songs/filter?language=hind&artist=arijit
//GET /api/songs/filter?album=love&genre=pop&language=hindi
//GET /api/songs/filter?language=hin&year=2023
const getSongsByFiltersIncludingLanguage = async (req, res) => {
    const {
        artist,
        genre,
        mood,
        director,
        title,
        album,
        language,
        year,
        page = 1,
        limit = 10,
    } = req.query;

    try {
        const whereConditions = [];

        if (title) {
            whereConditions.push(where(fn('LOWER', col('title')), {
                [Op.like]: `%${title.toLowerCase()}%`
            }));
        }

        if (album) {
            whereConditions.push(where(fn('LOWER', col('album')), {
                [Op.like]: `%${album.toLowerCase()}%`
            }));
        }

        if (language) {
            whereConditions.push(where(fn('LOWER', col('language')), {
                [Op.like]: `%${language.toLowerCase()}%`
            }));
        }

        if (year) {
            whereConditions.push({ year: parseInt(year) });
        }

        const include = [
            {
                model: Artist,
                as: 'Artists',
                ...(artist && {
                    where: where(fn('LOWER', col('Artists.name')), {
                        [Op.like]: `%${artist.toLowerCase()}%`
                    })
                })
            },
            {
                model: Genre,
                as: 'Genres',
                ...(genre && {
                    where: where(fn('LOWER', col('Genres.name')), {
                        [Op.like]: `%${genre.toLowerCase()}%`
                    })
                })
            },
            {
                model: Mood,
                as: 'Moods',
                ...(mood && {
                    where: where(fn('LOWER', col('Moods.name')), {
                        [Op.like]: `%${mood.toLowerCase()}%`
                    })
                })
            },
            {
                model: Artist,
                as: 'MusicDirectors',
                ...(director && {
                    where: where(fn('LOWER', col('MusicDirectors.name')), {
                        [Op.like]: `%${director.toLowerCase()}%`
                    })
                })
            }
        ];

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows: songs } = await Song.findAndCountAll({
            where: {
                [Op.and]: whereConditions
            },
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

// GET /api/songs/filter?artist=Arijit&genre=Romantic&language=Hindi&year=2023&limit=5&page=1
const getAllSongsFiltered = async (req, res) => {
    const {
        artist = '',
        genre = '',
        mood = '',
        director = '',
        title = '',
        album = '',
        language = '',
        year,
        page = 1,
        limit = 10,
    } = req.query;

    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const whereConditions = {};

        if (title) {
            const titleKeywords = title.toLowerCase().split(' ').filter(Boolean);
            whereConditions[Op.or] = titleKeywords.map(word =>
                where(fn('LOWER', col('title')), { [Op.like]: `%${word}%` })
            );
        }

        if (album) {
            const albumKeywords = album.toLowerCase().split(' ').filter(Boolean);
            whereConditions[Op.and] = (whereConditions[Op.and] || []).concat(
                albumKeywords.map(word =>
                    where(fn('LOWER', col('album')), { [Op.like]: `%${word}%` })
                )
            );
        }

        if (language) {
            const langKeywords = language.toLowerCase().split(' ').filter(Boolean);
            whereConditions[Op.and] = (whereConditions[Op.and] || []).concat(
                langKeywords.map(word =>
                    where(fn('LOWER', col('language')), { [Op.like]: `%${word}%` })
                )
            );
        }

        if (year) {
            whereConditions.year = parseInt(year); // strict match
        }

        const include = [
            {
                model: Artist,
                as: 'Artists',
                ...(artist && {
                    where: {
                        [Op.or]: artist.toLowerCase().split(' ').map(word =>
                            where(fn('LOWER', col('Artists.name')), {
                                [Op.like]: `%${word}%`
                            })
                        )
                    },
                    required: true
                })
            },
            {
                model: Genre,
                as: 'Genres',
                ...(genre && {
                    where: {
                        [Op.or]: genre.toLowerCase().split(' ').map(word =>
                            where(fn('LOWER', col('Genres.name')), {
                                [Op.like]: `%${word}%`
                            })
                        )
                    },
                    required: true
                })
            },
            {
                model: Mood,
                as: 'Moods',
                ...(mood && {
                    where: {
                        [Op.or]: mood.toLowerCase().split(' ').map(word =>
                            where(fn('LOWER', col('Moods.name')), {
                                [Op.like]: `%${word}%`
                            })
                        )
                    },
                    required: true
                })
            },
            {
                model: Artist,
                as: 'MusicDirectors',
                ...(director && {
                    where: {
                        [Op.or]: director.toLowerCase().split(' ').map(word =>
                            where(fn('LOWER', col('MusicDirectors.name')), {
                                [Op.like]: `%${word}%`
                            })
                        )
                    },
                    required: true
                })
            }
        ];

        const { count, rows: songs } = await Song.findAndCountAll({
            where: whereConditions,
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

// GET /api/songs/suggestions/:uid
// Suggest songs based on mood + language + genre of current song
const getSongSuggestions = async (req, res) => {
    const { uid } = req.params;

    try {
        const song = await Song.findOne({
            where: { uid },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' }
            ]
        });

        if (!song) return res.status(404).json({ error: 'Song not found' });

        const language = song.language;
        const moodNames = song.Moods.map(m => m.name);
        const genreNames = song.Genres.map(g => g.name);

        const suggestions = await Song.findAll({
            where: {
                uid: { [Op.ne]: uid },
                language,
                [Op.or]: [
                    { '$Moods.name$': { [Op.in]: moodNames } },
                    { '$Genres.name$': { [Op.in]: genreNames } }
                ]
            },
            include: [
                { model: Artist, as: 'Artists' },
                { model: Genre, as: 'Genres' },
                { model: Mood, as: 'Moods' }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10,
            subQuery: false, // required to avoid subquery aliasing issues in Sequelize
        });

        return res.status(200).json({ suggestions });

    } catch (err) {
        console.error('Suggestion error:', err);
        res.status(500).json({ error: 'Failed to fetch suggestions', details: err.message });
    }
};

// GET /api/songs/variations/2d18-abc3-8821
const getSongTranslations = async (req, res) => {
    try {
        const { uid } = req.params;

        // Find the base song first
        const parentSong = await Song.findOne({ where: { uid } });

        if (!parentSong) {
            return res.status(404).json({ error: 'Base song not found' });
        }

        // Get all songs that are either:
        // - the base song itself
        // - or have parentUid === uid
        const translations = await Song.findAll({
            where: {
                [Song.sequelize.Op.or]: [
                    { uid: parentSong.uid },
                    { parentUid: parentSong.uid }
                ]
            },
            order: [['language', 'ASC']]
        });

        return res.json(translations);
    } catch (err) {
        console.error('Error fetching song translations:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Parses decade-based queries like "90s", "2000s", etc.
 * @param {string} query - The search query to parse for a decade.
 * @returns {Array|null} - Returns the year range [startYear, endYear] or null.
 */
const parseDecadeQuery = (query) => {
    const decadeMatch = query.match(/(\d{2})s/i); // Matches "90s", "80s", etc.
    const fullDecadeMatch = query.match(/(19|20)\d{2}s/); // Matches "1990s", "2000s", etc.

    let yearRange = null;

    if (fullDecadeMatch) {
        const base = parseInt(fullDecadeMatch[0].substring(0, 4));
        yearRange = [base, base + 9];
    } else if (decadeMatch) {
        const shortDecade = parseInt(decadeMatch[1]);
        const currentYear = new Date().getFullYear();
        const century = shortDecade < 30 ? 2000 : 1900; // Default century assumption
        const startYear = century + shortDecade;
        yearRange = [startYear, startYear + 9];
    }

    return yearRange;
};

/**
 * Function to search songs with multiple filters (title, artist, mood, genre, decade).
 * @param {string} query - The search query entered by the user.
 * @param {string} [mood] - Optional filter for mood (e.g., "happy", "sad").
 * @param {string} [genre] - Optional filter for genre (e.g., "pop", "rock").
 * @param {string} [artist] - Optional filter for artist (e.g., "A.R. Rahman").
 * @param {string} [decade] - Optional filter for decade (e.g., "90s", "2000s").
 * @param {number} [page=1] - Page number for pagination (default is 1).
 * @param {number} [limit=20] - Number of results per page (default is 20).
 * @returns {Object} - The search results with songs, albums, artists, and pagination info.
 */
const searchSongs = async (query, { mood, genre, artist, decade, page = 1, limit = 20 }) => {
    if (!query) {
        throw new Error('Query is required');
    }

    // Calculate OFFSET for pagination
    const offset = (page - 1) * limit;

    // Step 1: Try to detect decade in query (e.g., "90s", "2000s")
    let yearRange = parseDecadeQuery(decade || query);

    // Step 2: Build dynamic WHERE condition for filtering songs
    const whereClause = {
        [Op.and]: [
            query && {
                title: { [Op.iLike]: `%${query}%` }, // Fuzzy title match
            },
            mood && {
                '$moods.name$': { [Op.iLike]: `%${mood}%` }, // Filter by mood (many-to-many relation)
            },
            genre && {
                '$genres.name$': { [Op.iLike]: `%${genre}%` }, // Filter by genre (many-to-many relation)
            },
            artist && {
                '$artist.name$': { [Op.iLike]: `%${artist}%` }, // Filter by artist
            },
            yearRange && {
                year: {
                    [Op.between]: yearRange, // If it's a decade query, add year range filter
                },
            },
        ].filter(Boolean), // Filter out any undefined conditions
    };

    try {
        // Step 3: Fetch songs with relevant filters
        const songs = await Song.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            include: [
                { model: Artist, as: 'artist', attributes: ['name'] }, // Include artist name
                { model: Genre, as: 'genres', attributes: ['name'] }, // Include genre name
                { model: Mood, as: 'moods', attributes: ['name'] }, // Include mood name
            ],
        });

        // Step 4: Fetch albums (if the query is related to an album or soundtrack)
        const albums = await Album.findAndCountAll({
            where: {
                title: { [Op.iLike]: `%${query}%` },
            },
            limit,
            offset,
        });

        // Step 5: Fetch artists (if the query is related to an artist)
        const artists = await Artist.findAndCountAll({
            where: {
                name: { [Op.iLike]: `%${query}%` },
            },
            limit,
            offset,
        });

        // Step 6: Return the results with pagination info
        return {
            songs: songs.rows,
            albums: albums.rows,
            artists: artists.rows,
            pagination: {
                totalSongs: songs.count,
                totalAlbums: albums.count,
                totalArtists: artists.count,
                currentPage: page,
                totalPages: Math.ceil(songs.count / limit),
            },
        };
    } catch (error) {
        console.error(error);
        throw new Error('An error occurred while searching');
    }
};



module.exports = {
    uploadSong,
    updateSong,
    deleteSong,
    uploadMultipleSongs,
    getAllSongs,
    getSongByUid,
    getSongsByAlbum,
    getSongsByArtist,
    getSongsByGenre,
    getSongsByMood,
    getSongsByMusicDirector,
    getSongsByYear,
    getSongsByLanguage,
    getSongsByLanguageAndMood,
    getSongsByLanguageAndYear,
    getAllSongsFiltered,
    getSongSuggestions,
    getSongTranslations,
    getSongsByFiltersIncludingLanguage,
    searchSongs,
};

