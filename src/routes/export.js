const express = require('express');
const router = express.Router();
const {
  exportWorkReports,
  exportMeetings,
  exportAttendance,
  exportProductivity,
  exportMeetingNotes  // 👈 YENİ EKLENEN
} = require('../controllers/exportController');
const { protect, adminOnly } = require('../middleware/auth');

// Tüm route'lar admin yetkisi gerektirir
router.use(protect);
router.use(adminOnly);

// Export route'ları
router.get('/work-reports', exportWorkReports);
router.get('/meetings', exportMeetings);
router.get('/attendance/:meetingId', exportAttendance);
router.get('/productivity', exportProductivity);
router.get('/meeting-notes/:meetingId', exportMeetingNotes);  // 👈 YENİ ROUTE

module.exports = router;