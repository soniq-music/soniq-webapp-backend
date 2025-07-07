require('dotenv').config(); // Load .env

const { cloudinary } = require('./config/cloudinary');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');


// --- SETUP ---
const API_URL = 'http://localhost:5000/api/songs/upload';
const AUDIO_PATH = './uploads/songs/Chikni_Chameli.mp3';
const IMAGE_PATH = './uploads/images/agneepath.jpeg';

// 🔐 Replace this with your real JWT token from login API
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiYWFhNjdiMzUtMTk0OS00NGQwLTg0YzYtNjAzZjkyOTRmNzNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUxODI0ODYzLCJleHAiOjE3NTE4MjU3NjN9.QXsLDArjynia9gnxjatYFpXylKihIsy1yjE1eLl1MC0'; // ⛔ not the ACCESS_TOKEN_SECRET

// Manual Upload to Cloudinary (Optional)
const uploadAudioToCloudinary = async () => {
    try {
        const res = await cloudinary.uploader.upload(path.join(__dirname, 'sample.mp3'), {
            resource_type: 'video',
            folder: 'songs',
            public_id: `test-audio-${Date.now()}`
        });
        console.log('✅ Cloudinary Audio Uploaded:', res.secure_url);
    } catch (err) {
        console.error('❌ Cloudinary Audio Upload Error:', err.message);
    }
};

const uploadImageToCloudinary = async () => {
    try {
        const res = await cloudinary.uploader.upload(path.join(__dirname, 'cover.jpg'), {
            resource_type: 'image',
            folder: 'covers',
            public_id: `test-cover-${Date.now()}`
        });
        console.log('✅ Cloudinary Image Uploaded:', res.secure_url);
    } catch (err) {
        console.error('❌ Cloudinary Image Upload Error:', err.message);
    }
};

// Use only if you want to test direct upload to Cloudinary
// uploadAudioToCloudinary();
// uploadImageToCloudinary();

const uploadViaAPI = async () => {
    try {
        const form = new FormData();

        form.append('title', 'Chikni Chameli');
        form.append('artist', 'Ajay-Atul, Shreya Ghoshal');
        form.append('album', 'Agneepath');
        form.append('genre', 'Bollywood');
        form.append('mood', 'Dance, Party');
        form.append('audio', fs.createReadStream(AUDIO_PATH));
        form.append('image', fs.createReadStream(IMAGE_PATH));

        const response = await axios.post(API_URL, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${TOKEN}`,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        console.log('✅ Upload via API successful!');
        console.log(response.data);
    } catch (error) {
        console.error('❌ Upload via API failed');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
};

uploadViaAPI();
