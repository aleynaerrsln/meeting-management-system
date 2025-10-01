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
  getMeetingReport,
  createReportFromMeeting
} = require('../controllers/meetingController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

router.get('/', getAllMeetings);
router.get('/:id', getMeetingById);
router.post('/', adminOnly, createMeeting);
router.put('/:id', adminOnly, updateMeeting);
router.delete('/:id', adminOnly, deleteMeeting);

router.put('/:id/attendance', adminOnly, markAttendance);

router.post('/:id/notes', adminOnly, addNote);
router.delete('/:id/notes/:noteId', adminOnly, deleteNote);

router.get('/:id/report', adminOnly, getMeetingReport);
router.post('/:id/create-report', adminOnly, createReportFromMeeting);

module.exports = router;