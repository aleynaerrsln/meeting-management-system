const express = require('express');
const router = express.Router();
const {
  getAllMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  markAttendance,
  addNote,
  deleteNote,
  getMeetingReport
} = require('../controllers/meetingController');
const { protect, adminOnly } = require('../middleware/auth');

// Tüm route'lar authentication gerektirir
router.use(protect);

// Toplantı CRUD işlemleri
router.get('/', getAllMeetings);
router.get('/:id', getMeetingById);
router.post('/', adminOnly, createMeeting);
router.put('/:id', adminOnly, updateMeeting);
router.delete('/:id', adminOnly, deleteMeeting);

// Yoklama işlemleri
router.put('/:id/attendance', adminOnly, markAttendance);

// Not işlemleri
router.post('/:id/notes', adminOnly, addNote);
router.delete('/:id/notes/:noteId', adminOnly, deleteNote);

// Rapor
router.get('/:id/report', adminOnly, getMeetingReport);

module.exports = router;