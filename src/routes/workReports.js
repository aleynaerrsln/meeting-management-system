const express = require('express');
const router = express.Router();
const {
  getAllWorkReports,
  getWorkReportById,
  createWorkReport,
  updateWorkReport,
  deleteWorkReport,
  getWeeklySummary,
  getMonthlySummary,
  getAllUsersSummary
} = require('../controllers/workReportController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

router.get('/summary/weekly', getWeeklySummary);
router.get('/summary/monthly', getMonthlySummary);
router.get('/summary/all-users', adminOnly, getAllUsersSummary);

router.route('/')
  .get(getAllWorkReports)
  .post(createWorkReport);

router.route('/:id')
  .get(getWorkReportById)
  .put(updateWorkReport)
  .delete(deleteWorkReport);

module.exports = router;