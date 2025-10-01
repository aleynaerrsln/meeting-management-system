const express = require('express');
const router = express.Router();
const { login, changePassword, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/login', login);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;