const express = require('express');
const router = express.Router();
const {
  addActivityPoint,
  getLeaderboard,
  getUserHistory,
  deleteActivityPoint,
  updateActivityPoint
} = require('../controllers/activityPointController');
const { protect, adminOnly } = require('../middleware/auth');

// Leaderboard - Tüm kullanıcılar görebilir
router.get('/leaderboard', protect, getLeaderboard);

// Admin-only routes
router.post('/', protect, adminOnly, addActivityPoint);
router.get('/history/:userId', protect, adminOnly, getUserHistory);
router.put('/:id', protect, adminOnly, updateActivityPoint);
router.delete('/:id', protect, adminOnly, deleteActivityPoint);

module.exports = router;