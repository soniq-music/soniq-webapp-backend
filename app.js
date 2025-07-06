const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser'); // ✅ Added

// Load .env variables
dotenv.config();

// Create app
const app = express();

// Middleware
app.use(cors({
    origin: true, // or specify origin if needed
    credentials: true // ✅ Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser()); // ✅ Added here

// Routes
const authRoutes = require('./routes/authRoutes');
const songRoutes = require('./routes/songRoutes');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);

// Root route (optional)
app.get('/', (req, res) => {
    res.send('VibeMind Music API is running');
});

module.exports = app;
