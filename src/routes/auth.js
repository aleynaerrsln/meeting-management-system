const express = require('express');
const router = express.Router();
const { 
  login, 
  changePassword, 
  getProfile,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword); // 🆕 Şifre sıfırlama talebi
router.post('/reset-password/:token', resetPassword); // 🆕 Şifre sıfırlama

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;