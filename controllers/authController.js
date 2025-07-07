const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sendEmail = require('../utils/sendEmail'); // utility to send email


// Generate Tokens
const generateAccessToken = (user) => {
    return jwt.sign({ uuid: user.uuid, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
    });
};

const generateRefreshToken = (user) => {
    return jwt.sign({ uuid: user.uuid }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    });
};

// POST /api/auth/register
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, avatarUrl } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            avatarUrl,
        });

        // 🔐 Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // 🍪 Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 🎯 Send back access token + user info
        res.status(200).json({
            message: 'Login successful',
            jwtAccessToken: accessToken,
            refreshToken: refreshToken, // ⬅️ Include refresh token here
            user: {
                uuid: user.uuid,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        });

    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};


// POST /api/auth/login
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Request body:', req.body);
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({
            message: 'Login successful',
            jwtAccessToken: accessToken,
            refreshToken: refreshToken,
            user: {
                id: user.id,
                uuid: user.uuid,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,

            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = req.user;
        res.status(200).json({
            id: user.id,
            uuid: user.uuid,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch {
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
};

// POST /api/auth/refresh
exports.refreshToken = (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'No refresh token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

        // 🔐 Generate new tokens
        const newAccessToken = jwt.sign(
            { uuid: decoded.uuid },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        );

        const newRefreshToken = jwt.sign(
            { uuid: decoded.uuid },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        // 🍪 Set new refresh token in cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 🎯 Send new access token in response
        res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });

    } catch (err) {
        console.error('Refresh token error:', err);
        res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
};

// POST /api/auth/logout
exports.logoutUser = (req, res) => {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    // Simple email format check
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Generate raw and hashed reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

        // Save hashed token and expiry to DB
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(tokenExpiry);
        await user.save();

        // Build reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        // Email content
        const message = `
You (or someone else) requested a password reset for your SoniQ account.

Please click the link below to reset your password. This link will expire in 15 minutes:

${resetUrl}

If you did not request this, please ignore this email.
        `.trim();

        await sendEmail(user.email, 'Reset Your SoniQ Password', message);

        // Optional: log reset URL during development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`🔗 Password reset URL (dev): ${resetUrl}`);
        }

        res.json({ message: 'Password reset email sent successfully' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    try {
        const user = await User.findOne({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { [Op.gt]: Date.now() },
            },
        });

        if (!user) return res.status(400).json({ error: 'Token is invalid or expired' });

        // Set new password
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        res.json({ message: 'Password has been reset successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

