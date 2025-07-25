// app.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));
app.use(cookieParser());

// Routes
const authRoutes = require('./routes/authRoutes');
const songRoutes = require('./routes/songRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);

app.get('/', (req, res) => {
    res.send('SoniQ Music API is running');
});

module.exports = app;
