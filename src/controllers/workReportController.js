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

    // 🆕 attachments.data'yı exclude etmek için projection kullan
    const reports = await WorkReport.find(query, { 'attachments.data': 0 })
      .populate('user', 'firstName lastName email')
      .populate('meeting', 'title')
      .populate('sharedWith', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ date: -1 });

    console.log('📊 Bulunan Rapor Sayısı:', reports.length);

    const totalHours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);

    // 🆕 Her rapora dosya sayısı bilgisi ekle
    const reportsWithAttachmentInfo = reports.map(report => {
      const reportObj = report.toObject();
      reportObj.attachmentCount = report.attachments?.length || 0;
      reportObj.hasAttachments = report.attachments?.length > 0;
      // Attachment bilgilerini data olmadan gönder
      if (reportObj.attachments) {
        reportObj.attachments = reportObj.attachments.map(att => ({
          _id: att._id,
          filename: att.filename,
          originalName: att.originalName,
          mimetype: att.mimetype,
          size: att.size,
          fileType: att.fileType,
          uploadedAt: att.uploadedAt
        }));
      }
      return reportObj;
    });

    res.json({
      success: true,
      count: reports.length,
      totalHours,
      data: reportsWithAttachmentInfo
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
    // 🆕 attachments.data'yı exclude et
    const report = await WorkReport.findById(req.params.id, { 'attachments.data': 0 })
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

    // 🆕 Attachment bilgilerini data olmadan gönder
    const reportObj = report.toObject();
    if (reportObj.attachments) {
      reportObj.attachments = reportObj.attachments.map(att => ({
        _id: att._id,
        filename: att.filename,
        originalName: att.originalName,
        mimetype: att.mimetype,
        size: att.size,
        fileType: att.fileType,
        uploadedAt: att.uploadedAt
      }));
    }

    res.json(reportObj);
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

    // 🆕 Dosya ekleri işleme
    const attachments = [];
    if (req.files) {
      const files = Array.isArray(req.files.attachments) 
        ? req.files.attachments 
        : req.files.attachments ? [req.files.attachments] : [];
      
      for (const file of files) {
        // Dosya tipi kontrolü (sadece PDF ve resimler)
        const isPdf = file.mimetype === 'application/pdf';
        const isImage = file.mimetype.startsWith('image/');
        
        if (!isPdf && !isImage) {
          return res.status(400).json({ 
            message: 'Sadece PDF ve resim dosyaları yüklenebilir' 
          });
        }

        // Dosya boyutu kontrolü (10MB)
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ 
            message: 'Dosya boyutu 10MB\'dan küçük olmalıdır' 
          });
        }

        attachments.push({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimetype: file.mimetype,
          size: file.size,
          data: file.data,
          fileType: isPdf ? 'pdf' : 'image',
          uploadedAt: new Date()
        });
      }
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
      status: 'submitted',
      attachments // 🆕 Dosya eklerini kaydet
    });

    await report.populate('user', 'firstName lastName email');

    // 🆕 Response'da data'yı exclude et
    const reportObj = report.toObject();
    if (reportObj.attachments) {
      reportObj.attachments = reportObj.attachments.map(att => ({
        _id: att._id,
        filename: att.filename,
        originalName: att.originalName,
        mimetype: att.mimetype,
        size: att.size,
        fileType: att.fileType,
        uploadedAt: att.uploadedAt
      }));
    }

    res.status(201).json({
      message: 'Çalışma raporu başarıyla oluşturuldu',
      report: reportObj
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

    // 🆕 Yeni dosya ekleri varsa ekle
    if (req.files) {
      const files = Array.isArray(req.files.attachments) 
        ? req.files.attachments 
        : req.files.attachments ? [req.files.attachments] : [];
      
      for (const file of files) {
        const isPdf = file.mimetype === 'application/pdf';
        const isImage = file.mimetype.startsWith('image/');
        
        if (!isPdf && !isImage) {
          return res.status(400).json({ 
            message: 'Sadece PDF ve resim dosyaları yüklenebilir' 
          });
        }

        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ 
            message: 'Dosya boyutu 10MB\'dan küçük olmalıdır' 
          });
        }

        report.attachments.push({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimetype: file.mimetype,
          size: file.size,
          data: file.data,
          fileType: isPdf ? 'pdf' : 'image',
          uploadedAt: new Date()
        });
      }
    }

    if (status && req.user.role === 'admin') {
      report.status = status;
      
      if (status === 'rejected' && rejectionReason) {
        report.rejectionReason = rejectionReason;
        
        await Notification.create({
          user: report.user,
          type: 'report_rejected',
          title: 'Rapor Reddedildi',
          message: `Raporunuz reddedildi. Sebep: ${rejectionReason}`,
          relatedReport: report._id
        });
      } else if (status === 'approved') {
        report.rejectionReason = '';
        
        await Notification.create({
          user: report.user,
          type: 'report_approved',
          title: 'Rapor Onaylandı',
          message: 'Çalışma raporunuz onaylandı.',
          relatedReport: report._id
        });
      }
    }

    if (sharedWith !== undefined) {
      report.sharedWith = sharedWith;
    }

    if (isPrivate !== undefined) {
      report.isPrivate = isPrivate;
    }

    await report.save();
    await report.populate('user', 'firstName lastName email');
    await report.populate('sharedWith', 'firstName lastName email');
    await report.populate('meeting', 'title');

    console.log('✅ Rapor güncellendi:', report._id);
    console.log('📌 Durum:', report.status, 'Red Sebebi:', report.rejectionReason);

    // 🆕 Response'da data'yı exclude et
    const reportObj = report.toObject();
    if (reportObj.attachments) {
      reportObj.attachments = reportObj.attachments.map(att => ({
        _id: att._id,
        filename: att.filename,
        originalName: att.originalName,
        mimetype: att.mimetype,
        size: att.size,
        fileType: att.fileType,
        uploadedAt: att.uploadedAt
      }));
    }

    res.json({
      message: 'Rapor başarıyla güncellendi',
      report: reportObj
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

// 🆕 @desc    Dosya eki indir
// @route   GET /api/work-reports/:id/attachment/:attachmentId
// @access  Private
const downloadAttachment = async (req, res) => {
  try {
    const report = await WorkReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Rapor bulunamadı' });
    }

    // Yetki kontrolü
    const canView = req.user.role === 'admin' || 
                    report.user.toString() === req.user._id.toString() ||
                    report.sharedWith.some(u => u.toString() === req.user._id.toString());

    if (!canView) {
      return res.status(403).json({ message: 'Bu dosyaya erişim yetkiniz yok' });
    }

    const attachment = report.attachments.id(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }

    res.set('Content-Type', attachment.mimetype);
    res.set('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.send(attachment.data);
  } catch (error) {
    console.error('Dosya indirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// 🆕 @desc    Dosya eki sil
// @route   DELETE /api/work-reports/:id/attachment/:attachmentId
// @access  Private
const deleteAttachment = async (req, res) => {
  try {
    const report = await WorkReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Rapor bulunamadı' });
    }

    // Yetki kontrolü
    const canEdit = req.user.role === 'admin' || 
                    report.user.toString() === req.user._id.toString();

    if (!canEdit) {
      return res.status(403).json({ message: 'Bu dosyayı silme yetkiniz yok' });
    }

    const attachment = report.attachments.id(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }

    attachment.deleteOne();
    await report.save();

    res.json({ message: 'Dosya başarıyla silindi' });
  } catch (error) {
    console.error('Dosya silme hatası:', error);
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

// @desc    Tüm kullanıcıların çalışma özeti (Admin)
// @route   GET /api/work-reports/summary/all-users
// @access  Private/Admin
const getAllUsersSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Başlangıç ve bitiş tarihleri gereklidir' 
      });
    }

    const users = await User.find({ role: 'user' });
    
    const summaries = await Promise.all(users.map(async (user) => {
      const reports = await WorkReport.find({
        user: user._id,
        date: { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        },
        status: { $in: ['submitted', 'approved'] }
      });

      const totalHours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);

      return {
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        totalHours,
        reportCount: reports.length
      };
    }));

    summaries.sort((a, b) => b.totalHours - a.totalHours);

    res.json({
      success: true,
      startDate,
      endDate,
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
  downloadAttachment, // 🆕
  deleteAttachment, // 🆕
  getWeeklySummary,
  getMonthlySummary,
  getAllUsersSummary
};