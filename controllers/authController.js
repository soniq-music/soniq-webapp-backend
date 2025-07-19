const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const { Op } = require('sequelize');
const sendEmail = require('../utils/sendEmail'); // utility to send email

// Generate Tokens
const generateAccessToken = (user) => {
    return jwt.sign({ uid: user.uid, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
    });
};

const generateRefreshToken = (user) => {
    return jwt.sign({ uid: user.uid }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    });
};

// POST /api/auth/register
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, avatarUrl, deviceId, deviceOS } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            avatarUrl,
            firstDeviceId: deviceId || null,
            firstDeviceOS: deviceOS || null,
        });


        // Send welcome email
        await sendEmail(
            user.email,
            'Welcome to SoniQ 🎧',
            `Hi ${user.name},\n\nThanks for registering on SoniQ! Your account has been created successfully.\n\nEnjoy the music,\nThe SoniQ Team`
        );

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Send back access token + user info
        res.status(200).json({
            message: 'Registration successful',
            jwtAccessToken: accessToken,
            refreshToken: refreshToken,
            user: {
                uid: user.uid,
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

        const jwtAccessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({
            message: 'Login successful',
            jwtAccessToken,
            refreshToken,
            user: {
                id: user.id,
                uid: user.uid, // ✅ Add this
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/auth/profile
exports.getMe = async (req, res) => {
    try {
        const user = req.user;
        res.status(200).json({
            id: user.id,
            uid: user.uid,
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

        // Generate new tokens
        const newAccessToken = jwt.sign(
            { uid: decoded.uid },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        );

        const newRefreshToken = jwt.sign(
            { uid: decoded.uid },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        // Set new refresh token in cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Send new access token in response
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




// controllers/admin
// GET /api/admin/users
// Admin: Get all users (with optional filtering by role/email)
exports.getAllUsers = async (req, res) => {
    try {
        const { role, email } = req.query;
        const where = {};

        if (role) where.role = role;
        if (email) where.email = { [Op.like]: `%${email}%` };

        const users = await User.findAll({
            where,
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
        });

        res.status(200).json({ users });
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// PATCH /api/admin/users/:uid/ban
// Admin: Ban a user by setting a "banned" flag
exports.banUser = async (req, res) => {
    try {
        const { uid } = req.params;

        const user = await User.findOne({ where: { uid } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.banned = true;
        await user.save();

        res.status(200).json({ message: `User ${user.email} has been banned.` });
    } catch (err) {
        console.error('Ban user error:', err);
        res.status(500).json({ error: 'Failed to ban user' });
    }
};

// PATCH /api/admin/users/:uid/unban
// Admin: Unban a user
exports.unbanUser = async (req, res) => {
    try {
        const { uid } = req.params;

        const user = await User.findOne({ where: { uid } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.banned = false;
        await user.save();

        res.status(200).json({ message: `User ${user.email} has been unbanned.` });
    } catch (err) {
        console.error('Unban user error:', err);
        res.status(500).json({ error: 'Failed to unban user' });
    }
};

// DELETE /api/admin/users/:uid
// Admin: Permanently delete a user
exports.deleteUser = async (req, res) => {
    try {
        const { uid } = req.params;

        const deletedCount = await User.destroy({ where: { uid } });
        if (deletedCount === 0) {
            return res.status(404).json({ error: 'User not found or already deleted' });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// PATCH /api/admin/users/:uid
// Admin: Update user or artist profile fields
// Admin can update self or other users
exports.updateUser = async (req, res) => {
    try {
        const { uid } = req.params;

        // Only allow self-edit or require admin role
        if (req.user.uid !== uid && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = req.body; // e.g., name, avatarUrl, role, etc.
        const user = await User.findOne({ where: { uid } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        await user.update(updates);

        res.status(200).json({ message: 'User updated successfully', user });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
};




// PATCH /api/user/profile
// User or artist: Update their own profile (not role)
// Requires current password if changing email
exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findOne({ where: { uid: req.user.uid } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const allowedFields = ['name', 'avatarUrl', 'email'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        // If email is being changed, require password verification
        if (updates.email && updates.email !== user.email) {
            const { currentPassword } = req.body;
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required to change email' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect current password' });
            }
        }

        await user.update(updates);

        res.status(200).json({ message: 'Profile updated', user });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// DELETE /api/user/profile
// User or artist: Delete their own account
exports.deleteProfile = async (req, res) => {
    try {
        const deletedCount = await User.destroy({ where: { uid: req.user.uid } });

        if (deletedCount === 0) {
            return res.status(404).json({ error: 'User not found or already deleted' });
        }

        res.clearCookie('refreshToken');
        res.status(200).json({ message: 'Your account has been deleted.' });
    } catch (err) {
        console.error('Delete profile error:', err);
        res.status(500).json({ error: 'Failed to delete profile' });
    }
};
