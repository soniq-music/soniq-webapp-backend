const mm = require('music-metadata');
const fetch = require('node-fetch');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const Song = require('../models/Song');
const generateAIImage = require('../utils/generateAIImage'); // AI image generator

// Helper: Get duration from a Cloudinary URL
async function getAudioDurationFromURL(url) {
    try {
        const response = await fetch(url);
        const stream = response.body;
        const metadata = await mm.parseStream(stream, null, { duration: true });
        return metadata.format.duration; // seconds
    } catch (err) {
        console.error('Failed to calculate duration:', err.message);
        return null;
    }
}

// POST /api/songs/upload
exports.uploadSong = async (req, res) => {
    try {
        const { title, artist, mood, genre, album, duration } = req.body;
        const files = req.files;
        const uploaderId = req.user?.id;

        const audioFile = files?.audio?.[0];
        const imageFile = files?.image?.[0];

        if (!audioFile) return res.status(400).json({ error: 'No audio file uploaded' });

        // Auto-calculate duration if not provided
        let finalDuration = duration;
        if (!duration) {
            finalDuration = await getAudioDurationFromURL(audioFile.path);
        }

        // Handle image
        let coverImageUrl;
        if (imageFile) {
            coverImageUrl = imageFile.path; // Already on Cloudinary
        } else {
            // Generate AI image buffer
            const aiImageBuffer = await generateAIImage(`${title} ${artist} ${album}`);

            // Upload buffer to Cloudinary
            coverImageUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'covers',
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }
                );
                streamifier.createReadStream(aiImageBuffer).pipe(uploadStream);
            });
        }

        // Save song metadata in DB
        const song = await Song.create({
            title,
            artist,
            url: audioFile.path,
            mood,
            genre,
            album,
            duration: finalDuration,
            coverImage: coverImageUrl,
            artistId: uploaderId,
        });

        res.status(201).json({
            message: 'Song uploaded successfully',
            song,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
};
