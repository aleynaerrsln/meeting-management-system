const WorkReport = require('../models/WorkReport');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Tüm çalışma raporlarını listele
// @route   GET /api/work-reports
// @access  Private
const getAllWorkReports = async (req, res) => {
  try {
    let query = {};
    
    // Toplantılardan oluşturulan raporları hariç tut
    query.meeting = null;
    
    // Admin değilse sadece kendi raporları veya paylaşılanları görsün
    if (req.user.role !== 'admin') {
      query.$or = [
        { user: req.user._id, meeting: null },
        { sharedWith: req.user._id, meeting: null }
      ];
    }

    const { userId, week, year, month, status } = req.query;
    if (userId && req.user.role === 'admin') query.user = userId;
    if (week) query.week = parseInt(week);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    console.log('🔍 WorkReport Query:', query);

    const reports = await WorkReport.find(query)
      .populate('user', 'firstName lastName email')
      .populate('meeting', 'title')
      .populate('sharedWith', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ date: -1 });

    console.log('📊 Bulunan Rapor Sayısı:', reports.length);

    const totalHours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);

    res.json({
      success: true,
      count: reports.length,
      totalHours,
      data: reports
    });
  } catch (error) {
    console.error('Rapor listeleme hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};

// @desc    Tek bir raporu getir
// @route   GET /api/work-reports/:id
// @access  Private
const getWorkReportById = async (req, res) => {
  try {
    const report = await WorkReport.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('meeting', 'title')
      .populate('sharedWith', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    if (!report) {
      return res.status(404).json({ message: 'Rapor bulunamadı' });
    }

    // Yetki kontrolü
    const canView = req.user.role === 'admin' || 
                    report.user._id.toString() === req.user._id.toString() ||
                    report.sharedWith.some(u => u._id.toString() === req.user._id.toString());

    if (!canView) {
      return res.status(403).json({ message: 'Bu raporu görme yetkiniz yok' });
    }

    res.json(report);
  } catch (error) {
    console.error('Rapor getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Yeni rapor oluştur
// @route   POST /api/work-reports
// @access  Private
const createWorkReport = async (req, res) => {
  try {
    const { date, workDescription, startTime, endTime, project, notes } = req.body;

    if (!workDescription || !startTime || !endTime) {
      return res.status(400).json({ 
        message: 'Çalışma açıklaması, başlangıç ve bitiş saati zorunludur' 
      });
    }

    // Saat hesaplama
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }
    
    const hoursWorked = Number((diffMinutes / 60).toFixed(2));

    if (hoursWorked <= 0 || hoursWorked > 24) {
      return res.status(400).json({ 
        message: 'Geçersiz çalışma süresi. Bitiş saati başlangıç saatinden sonra olmalıdır.' 
      });
    }

    const report = await WorkReport.create({
      user: req.user._id,
      date: date || Date.now(),
      workDescription,
      startTime,
      endTime,
      hoursWorked,
      project,
      notes,
      meeting: null,
      sharedWith: [],
      isPrivate: false,
      createdBy: req.user._id,
      status: 'submitted'
    });

    await report.populate('user', 'firstName lastName email');

    res.status(201).json({
      message: 'Çalışma raporu başarıyla oluşturuldu',
      report
    });
  } catch (error) {
    console.error('Rapor oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Rapor güncelle
// @route   PUT /api/work-reports/:id
// @access  Private
const updateWorkReport = async (req, res) => {
  try {
    const { date, workDescription, startTime, endTime, project, notes, status, sharedWith, isPrivate, rejectionReason } = req.body;

    let report = await WorkReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Rapor bulunamadı' });
    }

    // Yetki kontrolü
    const canEdit = req.user.role === 'admin' || 
                    report.user.toString() === req.user._id.toString();

    if (!canEdit) {
      return res.status(403).json({ message: 'Bu raporu güncelleme yetkiniz yok' });
    }

    // Durum değişikliği sadece admin yapabilir
    if (status && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Rapor durumunu değiştirme yetkiniz yok' });
    }

    report.date = date || report.date;
    report.workDescription = workDescription || report.workDescription;
    report.project = project !== undefined ? project : report.project;
    report.notes = notes !== undefined ? notes : report.notes;

    // Saat güncellemesi
    if (startTime && endTime) {
      report.startTime = startTime;
      report.endTime = endTime;

      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }
      
      report.hoursWorked = Number((diffMinutes / 60).toFixed(2));
    }
    
    // 🆕 DURUM DEĞİŞİKLİĞİ VE BİLDİRİM
    if (status && req.user.role === 'admin' && status !== report.status) {
      const oldStatus = report.status;
      report.status = status;

      // Red durumunda sebep kaydet
      if (status === 'rejected' && rejectionReason) {
        report.rejectionReason = rejectionReason;
        console.log('📝 Red sebebi kaydedildi:', rejectionReason);
      }

      // Red veya onay durumunda bildirim oluştur
      if (status === 'rejected' || status === 'approved') {
        const notificationData = {
          user: report.user,
          type: status === 'rejected' ? 'report_rejected' : 'report_approved',
          title: status === 'rejected' ? 'Rapor Reddedildi' : 'Rapor Onaylandı',
          message: status === 'rejected' 
            ? `"${report.workDescription.substring(0, 50)}..." raporunuz reddedildi.${rejectionReason ? ' Sebep: ' + rejectionReason : ''}`
            : `"${report.workDescription.substring(0, 50)}..." raporunuz onaylandı.`,
          relatedReport: report._id
        };

        console.log('🔔 Bildirim oluşturuluyor:', notificationData);

        const notification = await Notification.create(notificationData);

        console.log('✅ Bildirim başarıyla oluşturuldu:', notification._id);
      }
    }

    // Admin paylaşım ayarlarını değiştirebilir
    if (req.user.role === 'admin') {
      if (sharedWith !== undefined) report.sharedWith = sharedWith;
      if (isPrivate !== undefined) report.isPrivate = isPrivate;
    }

    await report.save();
    await report.populate('user', 'firstName lastName email');
    await report.populate('sharedWith', 'firstName lastName email');

    console.log('💾 Rapor kaydedildi. Durum:', report.status, 'Red Sebebi:', report.rejectionReason);

    res.json({
      message: 'Rapor başarıyla güncellendi',
      report
    });
  } catch (error) {
    console.error('❌ Rapor güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Rapor sil
// @route   DELETE /api/work-reports/:id
// @access  Private
const deleteWorkReport = async (req, res) => {
  try {
    const report = await WorkReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Rapor bulunamadı' });
    }

    // Yetki kontrolü
    const canDelete = req.user.role === 'admin' || 
                      report.user.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({ message: 'Bu raporu silme yetkiniz yok' });
    }

    await report.deleteOne();
    res.json({ message: 'Rapor başarıyla silindi' });
  } catch (error) {
    console.error('Rapor silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Haftalık özet
// @route   GET /api/work-reports/summary/weekly
// @access  Private
const getWeeklySummary = async (req, res) => {
  try {
    const { week, year, userId } = req.query;

    if (!week || !year) {
      return res.status(400).json({ message: 'Hafta ve yıl parametreleri gereklidir' });
    }

    const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user._id;

    const summary = await WorkReport.getWeeklyHours(targetUserId, parseInt(week), parseInt(year));

    res.json({
      success: true,
      week: parseInt(week),
      year: parseInt(year),
      ...summary
    });
  } catch (error) {
    console.error('Haftalık özet hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Aylık özet
// @route   GET /api/work-reports/summary/monthly
// @access  Private
const getMonthlySummary = async (req, res) => {
  try {
    const { month, year, userId } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Ay ve yıl parametreleri gereklidir' });
    }

    const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user._id;

    const summary = await WorkReport.getMonthlyHours(targetUserId, parseInt(month), parseInt(year));

    res.json({
      success: true,
      month: parseInt(month),
      year: parseInt(year),
      ...summary
    });
  } catch (error) {
    console.error('Aylık özet hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Tüm kullanıcıların özeti (Admin)
// @route   GET /api/work-reports/summary/all-users
// @access  Private/Admin
const getAllUsersSummary = async (req, res) => {
  try {
    const { week, year, month } = req.query;
    const users = await User.find().select('firstName lastName email');
    
    const summaries = await Promise.all(users.map(async (user) => {
      let summary;
      
      if (week && year) {
        summary = await WorkReport.getWeeklyHours(user._id, parseInt(week), parseInt(year));
      } else if (month && year) {
        summary = await WorkReport.getMonthlyHours(user._id, parseInt(month), parseInt(year));
      } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        const firstDayOfYear = new Date(currentYear, 0, 1);
        const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
        const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        summary = await WorkReport.getWeeklyHours(user._id, currentWeek, currentYear);
      }

      return {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        ...summary
      };
    }));

    summaries.sort((a, b) => b.totalHours - a.totalHours);
    const grandTotal = summaries.reduce((sum, s) => sum + s.totalHours, 0);

    res.json({
      success: true,
      userCount: summaries.length,
      grandTotalHours: grandTotal,
      data: summaries
    });
  } catch (error) {
    console.error('Tüm kullanıcılar özet hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

module.exports = {
  getAllWorkReports,
  getWorkReportById,
  createWorkReport,
  updateWorkReport,
  deleteWorkReport,
  getWeeklySummary,
  getMonthlySummary,
  getAllUsersSummary
};