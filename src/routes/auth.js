const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const { 
  login, 
  changePassword, 
  getProfile,
  forgotPassword,
  resetPassword,
  uploadProfilePhoto, // 🆕
  getProfilePhoto,    // 🆕
  deleteProfilePhoto  // 🆕
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// File upload middleware
router.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true,
  responseOnLimit: 'Dosya boyutu 5MB\'ı geçemez'
}));

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// 🆕 Public - Profil fotoğrafını getir (herkes görebilsin)
router.get('/profile-photo/:userId', getProfilePhoto);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);

// 🆕 Profil fotoğrafı yönetimi
router.post('/upload-profile-photo', protect, uploadProfilePhoto);
router.delete('/profile-photo', protect, deleteProfilePhoto);

module.exports = router;