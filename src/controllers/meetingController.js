const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { sendMeetingInvitation, sendMeetingUpdateNotification } = require('../services/emailService');

// @desc    Tüm toplantıları listele
// @route   GET /api/meetings
// @access  Private
exports.getAllMeetings = async (req, res) => {
  try {
    let query = {};

    // Admin değilse sadece kendi toplantılarını görsün
    if (req.user.role !== 'admin') {
      query.participants = req.user._id;
    }

    const meetings = await Meeting.find(query)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('attendance.user', 'firstName lastName email')
      .sort({ date: 1 });

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
      .populate('attendance.markedBy', 'firstName lastName');

    if (!meeting) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }

    // Admin değilse ve katılımcı değilse gösterme
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

    // Validasyon
    if (!title || !date || !time || !location) {
      return res.status(400).json({ message: 'Başlık, tarih, saat ve yer zorunludur' });
    }

    // Katılımcıları kontrol et
    if (!participants || participants.length === 0) {
      return res.status(400).json({ message: 'En az bir katılımcı seçilmelidir' });
    }

    // Katılımcıların var olup olmadığını kontrol et
    const users = await User.find({ _id: { $in: participants } });
    if (users.length !== participants.length) {
      return res.status(400).json({ message: 'Bazı katılımcılar bulunamadı' });
    }

    // Toplantı oluştur
    const meeting = await Meeting.create({
      title,
      description,
      date,
      time,
      location,
      participants,
      createdBy: req.user._id
    });

    // Populate et
    await meeting.populate('participants', 'firstName lastName email');
    await meeting.populate('createdBy', 'firstName lastName');

    // E-posta gönder (hata olsa bile toplantı oluşturulur)
    try {
      await sendMeetingInvitation(meeting, users);
    } catch (emailError) {
      console.error('E-posta gönderme hatası:', emailError);
      // E-posta hatası olsa bile toplantı oluşturuldu
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

    // Güncelle
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

      // Attendance listesini güncelle
      meeting.attendance = participants.map(participantId => {
        const existing = meeting.attendance.find(a => a.user.toString() === participantId.toString());
        return existing || { user: participantId, status: 'pending' };
      });
    }

    await meeting.save();
    await meeting.populate('participants', 'firstName lastName email');
    await meeting.populate('createdBy', 'firstName lastName');

    // Güncelleme bildirimi gönder
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

    // Katılımcı listesinde var mı kontrol et
    if (!meeting.participants.some(p => p.toString() === userId)) {
      return res.status(400).json({ message: 'Bu kullanıcı toplantı katılımcısı değil' });
    }

    // Yoklama durumunu güncelle
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