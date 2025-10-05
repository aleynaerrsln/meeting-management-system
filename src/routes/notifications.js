const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// Tüm route'lar için koruma
router.use(protect);

// Bildirim listesi ve okunmamış sayısı
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

// Tüm bildirimleri okundu yap
router.put('/read-all', markAllAsRead);

// Tekil bildirim işlemleri
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;