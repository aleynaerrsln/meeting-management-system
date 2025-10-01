const Meeting = require('../models/Meeting');
const User = require('../models/User');
const WorkReport = require('../models/WorkReport');
const { sendMeetingInvitation, sendMeetingUpdateNotification } = require('../services/emailService');

// @desc    Tüm toplantıları listele
// @route   GET /api/meetings
// @access  Private
exports.getAllMeetings = async (req, res) => {
  try {
    let query = {};

    if (req.user.role !== 'admin') {
      query.participants = req.user._id;
    }

    const meetings = await Meeting.find(query)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('attendance.user', 'firstName lastName email')
      .populate('notes.createdBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: meetings.length,
      data: meetings
    });
  } catch (error) {
    console.error('Toplantı listeleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Tek bir toplantıyı getir
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('attendance.user', 'firstName lastName email')
      .populate('attendance.markedBy', 'firstName lastName')
      .populate('notes.createdBy', 'firstName lastName');

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    if (req.user.role !== 'admin' && !meeting.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Bu toplantıyı görme yetkiniz yok' });
    }

    res.json(meeting);
  } catch (error) {
    console.error('Toplantı getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Yeni toplantı oluştur
// @route   POST /api/meetings
// @access  Private/Admin
exports.createMeeting = async (req, res) => {
  try {
    const { title, description, date, time, location, participants } = req.body;

    if (!title || !date || !time || !location) {
      return res.status(400).json({ message: 'Başlık, tarih, saat ve yer zorunludur' });
    }

    if (!participants || participants.length === 0) {
      return res.status(400).json({ message: 'En az bir katılımcı seçilmelidir' });
    }

    const users = await User.find({ _id: { $in: participants } });
    if (users.length !== participants.length) {
      return res.status(400).json({ message: 'Bazı katılımcılar bulunamadı' });
    }

    const meeting = await Meeting.create({
      title,
      description,
      date,
      time,
      location,
      participants,
      createdBy: req.user._id
    });

    await meeting.populate('participants', 'firstName lastName email');
    await meeting.populate('createdBy', 'firstName lastName');

    try {
      await sendMeetingInvitation(meeting, users);
    } catch (emailError) {
      console.error('E-posta gönderme hatası:', emailError);
    }

    res.status(201).json({
      message: 'Toplantı başarıyla oluşturuldu ve katılımcılara bildirim gönderildi',
      meeting
    });
  } catch (error) {
    console.error('Toplantı oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantı güncelle
// @route   PUT /api/meetings/:id
// @access  Private/Admin
exports.updateMeeting = async (req, res) => {
  try {
    const { title, description, date, time, location, participants, status } = req.body;

    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    meeting.title = title || meeting.title;
    meeting.description = description !== undefined ? description : meeting.description;
    meeting.date = date || meeting.date;
    meeting.time = time || meeting.time;
    meeting.location = location || meeting.location;
    meeting.status = status || meeting.status;

    if (participants && participants.length > 0) {
      const users = await User.find({ _id: { $in: participants } });
      if (users.length !== participants.length) {
        return res.status(400).json({ message: 'Bazı katılımcılar bulunamadı' });
      }
      meeting.participants = participants;

      meeting.attendance = participants.map(participantId => {
        const existing = meeting.attendance.find(a => a.user.toString() === participantId.toString());
        return existing || { user: participantId, status: 'pending' };
      });
    }

    await meeting.save();
    await meeting.populate('participants', 'firstName lastName email');
    await meeting.populate('createdBy', 'firstName lastName');

    try {
      const users = await User.find({ _id: { $in: meeting.participants } });
      await sendMeetingUpdateNotification(meeting, users);
    } catch (emailError) {
      console.error('Bildirim gönderme hatası:', emailError);
    }

    res.json({
      message: 'Toplantı başarıyla güncellendi',
      meeting
    });
  } catch (error) {
    console.error('Toplantı güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantı sil
// @route   DELETE /api/meetings/:id
// @access  Private/Admin
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    await meeting.deleteOne();

    res.json({ message: 'Toplantı başarıyla silindi' });
  } catch (error) {
    console.error('Toplantı silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Yoklama işaretle
// @route   PUT /api/meetings/:id/attendance
// @access  Private/Admin
exports.markAttendance = async (req, res) => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ message: 'Kullanıcı ID ve durum gereklidir' });
    }

    if (!['attended', 'not_attended'].includes(status)) {
      return res.status(400).json({ message: 'Geçersiz durum. attended veya not_attended olmalıdır' });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    if (!meeting.participants.some(p => p.toString() === userId)) {
      return res.status(400).json({ message: 'Bu kullanıcı toplantı katılımcısı değil' });
    }

    const attendanceIndex = meeting.attendance.findIndex(a => a.user.toString() === userId);
    
    if (attendanceIndex !== -1) {
      meeting.attendance[attendanceIndex].status = status;
      meeting.attendance[attendanceIndex].markedAt = new Date();
      meeting.attendance[attendanceIndex].markedBy = req.user._id;
    }

    await meeting.save();
    await meeting.populate('attendance.user', 'firstName lastName email');
    await meeting.populate('attendance.markedBy', 'firstName lastName');

    res.json({
      message: 'Yoklama başarıyla işaretlendi',
      attendance: meeting.attendance
    });
  } catch (error) {
    console.error('Yoklama işaretleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantıya not ekle
// @route   POST /api/meetings/:id/notes
// @access  Private/Admin
exports.addNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Başlık ve içerik gereklidir' });
    }

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    meeting.notes.push({
      title,
      content,
      createdBy: req.user._id,
      createdAt: new Date()
    });

    await meeting.save();
    await meeting.populate('notes.createdBy', 'firstName lastName');

    res.json({
      message: 'Not başarıyla eklendi',
      notes: meeting.notes
    });
  } catch (error) {
    console.error('Not ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantıdan not sil
// @route   DELETE /api/meetings/:id/notes/:noteId
// @access  Private/Admin
exports.deleteNote = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    const noteExists = meeting.notes.some(note => note._id.toString() === req.params.noteId);
    
    if (!noteExists) {
      return res.status(404).json({ message: 'Not bulunamadı' });
    }

    meeting.notes = meeting.notes.filter(note => note._id.toString() !== req.params.noteId);
    
    await meeting.save();

    res.json({
      message: 'Not başarıyla silindi',
      notes: meeting.notes
    });
  } catch (error) {
    console.error('Not silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantı raporunu getir
// @route   GET /api/meetings/:id/report
// @access  Private/Admin
exports.getMeetingReport = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('participants', 'firstName lastName email')
      .populate('attendance.user', 'firstName lastName email')
      .populate('notes.createdBy', 'firstName lastName');

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    const attendedCount = meeting.attendance.filter(a => a.status === 'attended').length;
    const notAttendedCount = meeting.attendance.filter(a => a.status === 'not_attended').length;
    const pendingCount = meeting.attendance.filter(a => a.status === 'pending').length;

    const report = {
      meeting: {
        title: meeting.title,
        description: meeting.description,
        date: meeting.date,
        time: meeting.time,
        location: meeting.location,
        status: meeting.status
      },
      attendance: {
        total: meeting.participants.length,
        attended: attendedCount,
        notAttended: notAttendedCount,
        pending: pendingCount,
        details: meeting.attendance
      },
      notes: {
        total: meeting.notes.length,
        details: meeting.notes
      }
    };

    res.json(report);
  } catch (error) {
    console.error('Rapor oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Toplantıdan Çalışma Raporu Oluştur
// @route   POST /api/meetings/:id/create-report
// @access  Private/Admin
exports.createReportFromMeeting = async (req, res) => {
  try {
    const { isPrivate, sharedWith, assignToUser } = req.body;
    
    console.log('📥 Gelen Rapor Verisi:', { isPrivate, sharedWith, assignToUser });
    
    const meeting = await Meeting.findById(req.params.id)
      .populate('notes.createdBy', 'firstName lastName');

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    if (meeting.status !== 'completed') {
      return res.status(400).json({ message: 'Sadece tamamlanmış toplantılardan rapor oluşturulabilir' });
    }

    const reportDescription = meeting.notes.length > 0
      ? meeting.notes.map((note, index) => 
          `${index + 1}. ${note.title}\n${note.content}\n---`
        ).join('\n\n')
      : 'Toplantı tamamlandı. Not eklenmedi.';

    const hoursWorked = 2;

    const workReport = await WorkReport.create({
      user: assignToUser || req.user._id,
      date: meeting.date,
      workDescription: `TOPLANTI RAPORU: ${meeting.title}\n\nYer: ${meeting.location}\nTarih: ${new Date(meeting.date).toLocaleDateString('tr-TR')} ${meeting.time}\n\n${reportDescription}`,
      hoursWorked,
      project: meeting.title,
      status: 'approved',
      notes: `Bu rapor "${meeting.title}" toplantısından otomatik olarak oluşturulmuştur.`,
      meeting: meeting._id,
      sharedWith: sharedWith || [],
      isPrivate: isPrivate || false,
      createdBy: req.user._id
    });

    await workReport.populate('user', 'firstName lastName email');
    await workReport.populate('sharedWith', 'firstName lastName email');
    await workReport.populate('meeting', 'title');

    console.log('✅ Çalışma raporu oluşturuldu:', workReport._id);

    res.status(201).json({
      message: 'Toplantıdan çalışma raporu başarıyla oluşturuldu',
      report: workReport
    });
  } catch (error) {
    console.error('❌ Toplantı raporu oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

module.exports = exports;