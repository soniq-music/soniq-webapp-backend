const mm = require('music-metadata');
const fetch = require('node-fetch');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const Song = require('../models/Song');
const generateAIImage = require('../utils/generateAIImage');

async function getAudioDurationFromURL(url) {
    try {
        const response = await fetch(url);
        const stream = response.body;
        const metadata = await mm.parseStream(stream, null, { duration: true });
        return metadata.format.duration;
    } catch (err) {
        console.error('❌ Failed to calculate duration:', err.message);
        return null;
    }
}

exports.uploadSong = async (req, res) => {
    try {
        // ✅ Debug: Ensure req.body is parsed
        console.log('📥 req.body:', req.body);
        console.log('📁 req.files:', req.files);

        const { title, artist, mood, genre, album, duration } = req.body;
        const uploaderId = req.user?.id;

        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];

        console.log('🎵 audioFile:', audioFile?.originalname || 'None');
        console.log('🖼️ imageFile:', imageFile?.originalname || 'None');

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // ⏱️ Get duration if not provided
        let finalDuration = duration;
        if (!duration && audioFile.path) {
            finalDuration = await getAudioDurationFromURL(audioFile.path);
        }

        // 📸 Upload or generate cover image
        let coverImageUrl;
        if (imageFile?.path) {
            coverImageUrl = imageFile.path;
        } else {
            const aiImageBuffer = await generateAIImage(`${title} ${artist} ${album}`);
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

        // 💾 Save to DB
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

        console.log('✅ Song uploaded:', song.title);
        return res.status(201).json({ message: 'Song uploaded successfully', song });

    } catch (err) {
        console.error('❌ Error uploading song:', err);
        return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
};
