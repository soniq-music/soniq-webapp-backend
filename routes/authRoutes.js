const express = require('express');
const cookieParser = require('cookie-parser');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(cookieParser());

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logoutUser);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
