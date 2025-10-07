const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const {
  getAllWorkReports,
  getWorkReportById,
  createWorkReport,
  updateWorkReport,
  deleteWorkReport,
  downloadAttachment, // 🆕
  deleteAttachment, // 🆕
  getWeeklySummary,
  getMonthlySummary,
  getAllUsersSummary
} = require('../controllers/workReportController');
const { protect, adminOnly } = require('../middleware/auth');

// 🆕 File upload middleware - PDF ve resimler için
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: 'Dosya boyutu 10MB\'ı geçemez'
}));

// Tüm route'lar için koruma
router.use(protect);

// Özet route'ları (özel route'lar önce gelir)
router.get('/summary/weekly', getWeeklySummary);
router.get('/summary/monthly', getMonthlySummary);
router.get('/summary/all-users', adminOnly, getAllUsersSummary);

// 🆕 Dosya indirme ve silme route'ları
router.get('/:id/attachment/:attachmentId', downloadAttachment);
router.delete('/:id/attachment/:attachmentId', deleteAttachment);

// CRUD route'ları
router.route('/')
  .get(getAllWorkReports)
  .post(createWorkReport);

router.route('/:id')
  .get(getWorkReportById)
  .put(updateWorkReport)
  .delete(deleteWorkReport);

module.exports = router;