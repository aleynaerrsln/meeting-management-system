const {
  exportWorkReportsToExcel,
  exportMeetingsToExcel,
  exportAttendanceToExcel,
  exportProductivityReport
} = require('../services/excelService');

// @desc    Çalışma raporlarını Excel'e aktar
// @route   GET /api/export/work-reports
// @access  Private/Admin
exports.exportWorkReports = async (req, res) => {
  try {
    const { userId, week, year, month, status } = req.query;
    
    let filters = {};
    
    if (userId) filters.user = userId;
    if (week) filters.week = parseInt(week);
    if (year) filters.year = parseInt(year);
    if (status) filters.status = status;
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filters.date = { $gte: startDate, $lte: endDate };
    }

    const buffer = await exportWorkReportsToExcel(filters);

    // Dosya adı oluştur
    const fileName = `calisma-raporlari-${new Date().getTime()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ message: 'Excel export hatası', error: error.message });
  }
};

// @desc    Toplantıları Excel'e aktar
// @route   GET /api/export/meetings
// @access  Private/Admin
exports.exportMeetings = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let filters = {};
    
    if (status) filters.status = status;
    
    if (startDate && endDate) {
      filters.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const buffer = await exportMeetingsToExcel(filters);

    const fileName = `toplantilar-${new Date().getTime()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ message: 'Excel export hatası', error: error.message });
  }
};

// @desc    Toplantı yoklamasını Excel'e aktar
// @route   GET /api/export/attendance/:meetingId
// @access  Private/Admin
exports.exportAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const buffer = await exportAttendanceToExcel(meetingId);

    const fileName = `yoklama-${meetingId}-${new Date().getTime()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ message: 'Excel export hatası', error: error.message });
  }
};

// @desc    Verimlilik raporunu Excel'e aktar
// @route   GET /api/export/productivity
// @access  Private/Admin
exports.exportProductivity = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Başlangıç ve bitiş tarihi gereklidir' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const buffer = await exportProductivityReport(start, end);

    const fileName = `verimlilik-raporu-${new Date().getTime()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ message: 'Excel export hatası', error: error.message });
  }
};