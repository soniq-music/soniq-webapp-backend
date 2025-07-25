const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware: Verify JWT token and attach user to request
exports.authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find user from token's uid
        const user = await User.findOne({ where: { uid: decoded.uid } });
        if (!user) return res.status(401).json({ error: 'Invalid token' });

        // Attach user to request
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
};

// Allow both admin and artist
exports.authorizeArtistOrAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role !== 'artist' && role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Artists or admins only.' });
    }
    next();
};

// Allow only admin
exports.authorizeAdminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admins only' });
    }
    next();
};
