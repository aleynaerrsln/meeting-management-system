const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const {
  getInbox,
  getSent,
  getConversation,
  sendMessage,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  getUnreadByUser, // 🆕 YENİ EKLENEN FUNCTION
  getAvailableUsers,
  downloadAttachment
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// File upload middleware
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: 'Dosya boyutu 10MB\'ı geçemez'
}));

// Tüm route'lar için koruma
router.use(protect);

// Mesaj listeleri
router.get('/inbox', getInbox);
router.get('/sent', getSent);
router.get('/unread-count', getUnreadCount);
router.get('/unread-by-user', getUnreadByUser); // 🆕 YENİ EKLENEN ROUTE
router.get('/users', getAvailableUsers);
router.get('/conversation/:userId', getConversation);

// Dosya indirme
router.get('/:messageId/attachment/:attachmentId', downloadAttachment);

// Mesaj işlemleri
router.post('/', sendMessage);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteMessage);

module.exports = router;