const express = require('express');
const router = express.Router();
const {
  exportWorkReports,
  exportMeetings,
  exportAttendance,
  exportProductivity
} = require('../controllers/exportController');
const { protect, adminOnly } = require('../middleware/auth');

// Tüm export route'ları admin yetkisi gerektirir
router.use(protect);
router.use(adminOnly);

// Export endpoints
router.get('/work-reports', exportWorkReports);
router.get('/meetings', exportMeetings);
router.get('/attendance/:meetingId', exportAttendance);
router.get('/productivity', exportProductivity);

module.exports = router;