const XLSX = require('xlsx');
const WorkReport = require('../models/WorkReport');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

// Çalışma raporlarını Excel'e aktar
exports.exportWorkReportsToExcel = async (filters = {}) => {
  try {
    const reports = await WorkReport.find(filters)
      .populate('user', 'firstName lastName email')
      .sort({ date: -1 });

    // Excel için veri hazırla
    const excelData = reports.map(report => ({
      'Tarih': new Date(report.date).toLocaleDateString('tr-TR'),
      'Kullanıcı': `${report.user.firstName} ${report.user.lastName}`,
      'Email': report.user.email,
      'Proje': report.project || '-',
      'Çalışma Açıklaması': report.workDescription,
      'Saat': report.hoursWorked,
      'Durum': report.status,
      'Notlar': report.notes || '-',
      'Hafta': report.week,
      'Yıl': report.year
    }));

    // Toplam saat hesapla
    const totalHours = reports.reduce((sum, r) => sum + r.hoursWorked, 0);
    
    // Özet satırı ekle
    excelData.push({
      'Tarih': '',
      'Kullanıcı': 'TOPLAM',
      'Email': '',
      'Proje': '',
      'Çalışma Açıklaması': '',
      'Saat': totalHours,
      'Durum': '',
      'Notlar': '',
      'Hafta': '',
      'Yıl': ''
    });

    // Workbook oluştur
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Çalışma Raporları');

    // Sütun genişlikleri ayarla
    ws['!cols'] = [
      { wch: 12 }, // Tarih
      { wch: 20 }, // Kullanıcı
      { wch: 25 }, // Email
      { wch: 20 }, // Proje
      { wch: 40 }, // Açıklama
      { wch: 8 },  // Saat
      { wch: 12 }, // Durum
      { wch: 30 }, // Notlar
      { wch: 8 },  // Hafta
      { wch: 8 }   // Yıl
    ];

    // Buffer olarak dön
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Excel export hatası:', error);
    throw error;
  }
};

// Toplantıları Excel'e aktar
exports.exportMeetingsToExcel = async (filters = {}) => {
  try {
    const meetings = await Meeting.find(filters)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ date: 1 });

    const excelData = meetings.map(meeting => ({
      'Toplantı Adı': meeting.title,
      'Açıklama': meeting.description || '-',
      'Tarih': new Date(meeting.date).toLocaleDateString('tr-TR'),
      'Saat': meeting.time,
      'Yer': meeting.location,
      'Durum': meeting.status,
      'Oluşturan': `${meeting.createdBy.firstName} ${meeting.createdBy.lastName}`,
      'Katılımcı Sayısı': meeting.participants.length,
      'Katılımcılar': meeting.participants.map(p => `${p.firstName} ${p.lastName}`).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Toplantılar');

    ws['!cols'] = [
      { wch: 30 }, // Toplantı Adı
      { wch: 40 }, // Açıklama
      { wch: 12 }, // Tarih
      { wch: 8 },  // Saat
      { wch: 20 }, // Yer
      { wch: 12 }, // Durum
      { wch: 20 }, // Oluşturan
      { wch: 12 }, // Katılımcı Sayısı
      { wch: 50 }  // Katılımcılar
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Excel export hatası:', error);
    throw error;
  }
};

// Yoklama raporunu Excel'e aktar
exports.exportAttendanceToExcel = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId)
      .populate('attendance.user', 'firstName lastName email')
      .populate('attendance.markedBy', 'firstName lastName');

    if (!meeting) {
      throw new Error('Toplantı bulunamadı');
    }

    const excelData = meeting.attendance.map(att => ({
      'Katılımcı': `${att.user.firstName} ${att.user.lastName}`,
      'Email': att.user.email,
      'Durum': att.status === 'attended' ? 'Katıldı' : att.status === 'not_attended' ? 'Katılmadı' : 'Beklemede',
      'İşaretlenme Tarihi': att.markedAt ? new Date(att.markedAt).toLocaleString('tr-TR') : '-',
      'İşaretleyen': att.markedBy ? `${att.markedBy.firstName} ${att.markedBy.lastName}` : '-'
    }));

    // Başlık bilgisi ekle
    const headerData = [
      { 'Katılımcı': 'TOPLANTI BİLGİLERİ' },
      { 'Katılımcı': `Toplantı: ${meeting.title}` },
      { 'Katılımcı': `Tarih: ${new Date(meeting.date).toLocaleDateString('tr-TR')} - ${meeting.time}` },
      { 'Katılımcı': `Yer: ${meeting.location}` },
      { 'Katılımcı': '' }
    ];

    const ws = XLSX.utils.json_to_sheet([...headerData, ...excelData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Yoklama');

    ws['!cols'] = [
      { wch: 25 }, // Katılımcı
      { wch: 30 }, // Email
      { wch: 15 }, // Durum
      { wch: 20 }, // İşaretlenme Tarihi
      { wch: 20 }  // İşaretleyen
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Excel export hatası:', error);
    throw error;
  }
};

// Kullanıcı bazlı verimlilik raporu
exports.exportProductivityReport = async (startDate, endDate) => {
  try {
    const users = await User.find({ isActive: true }).select('firstName lastName email');
    
    const reportData = await Promise.all(users.map(async (user) => {
      const reports = await WorkReport.find({
        user: user._id,
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['submitted', 'approved'] }
      });

      const totalHours = reports.reduce((sum, r) => sum + r.hoursWorked, 0);
      const workDays = reports.length;
      const avgHoursPerDay = workDays > 0 ? (totalHours / workDays).toFixed(2) : 0;

      return {
        'Kullanıcı': `${user.firstName} ${user.lastName}`,
        'Email': user.email,
        'Toplam Saat': totalHours,
        'Çalışma Günü': workDays,
        'Günlük Ortalama': avgHoursPerDay,
        'Rapor Sayısı': reports.length
      };
    }));

    // Toplam saate göre sırala
    reportData.sort((a, b) => b['Toplam Saat'] - a['Toplam Saat']);

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Verimlilik Raporu');

    ws['!cols'] = [
      { wch: 25 }, // Kullanıcı
      { wch: 30 }, // Email
      { wch: 12 }, // Toplam Saat
      { wch: 12 }, // Çalışma Günü
      { wch: 15 }, // Günlük Ortalama
      { wch: 12 }  // Rapor Sayısı
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Verimlilik raporu export hatası:', error);
    throw error;
  }
};

// 👇 YENİ FONKSİYON: Toplantı notlarını rapor olarak Excel'e aktar
exports.exportMeetingNotesReport = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('notes.createdBy', 'firstName lastName')
      .populate('attendance.user', 'firstName lastName email');

    if (!meeting) {
      throw new Error('Toplantı bulunamadı');
    }

    // Toplantı başlık bilgileri
    const headerData = [
      { 'Bölüm': 'TOPLANTI RAPORU' },
      { 'Bölüm': '' },
      { 'Bölüm': 'Toplantı Bilgileri:' },
      { 'Bölüm': `Toplantı Adı: ${meeting.title}` },
      { 'Bölüm': `Tarih: ${new Date(meeting.date).toLocaleDateString('tr-TR')} - ${meeting.time}` },
      { 'Bölüm': `Yer: ${meeting.location}` },
      { 'Bölüm': `Durum: ${meeting.status === 'scheduled' ? 'Planlandı' : meeting.status === 'completed' ? 'Tamamlandı' : 'İptal Edildi'}` },
      { 'Bölüm': `Oluşturan: ${meeting.createdBy.firstName} ${meeting.createdBy.lastName}` },
      { 'Bölüm': '' }
    ];

    // Katılım istatistikleri
    const attendedCount = meeting.attendance.filter(a => a.status === 'attended').length;
    const notAttendedCount = meeting.attendance.filter(a => a.status === 'not_attended').length;
    const pendingCount = meeting.attendance.filter(a => a.status === 'pending').length;

    const statsData = [
      { 'Bölüm': 'Katılım İstatistikleri:' },
      { 'Bölüm': `Toplam Katılımcı: ${meeting.participants.length}` },
      { 'Bölüm': `✅ Katılan: ${attendedCount}` },
      { 'Bölüm': `❌ Katılmayan: ${notAttendedCount}` },
      { 'Bölüm': `⏳ Bekleyen: ${pendingCount}` },
      { 'Bölüm': '' }
    ];

    // Notlar bölümü
    const notesHeader = [
      { 'Bölüm': 'TOPLANTI NOTLARI' },
      { 'Bölüm': `Toplam Not Sayısı: ${meeting.notes.length}` },
      { 'Bölüm': '' }
    ];

    let notesData = [];
    if (meeting.notes.length > 0) {
      meeting.notes.forEach((note, index) => {
        notesData.push({ 'Bölüm': `${index + 1}. NOT` });
        notesData.push({ 'Bölüm': `Başlık: ${note.title}` });
        notesData.push({ 'Bölüm': `İçerik: ${note.content}` });
        notesData.push({ 
          'Bölüm': `Oluşturan: ${note.createdBy.firstName} ${note.createdBy.lastName}` 
        });
        notesData.push({ 
          'Bölüm': `Tarih: ${new Date(note.createdAt).toLocaleString('tr-TR')}` 
        });
        notesData.push({ 'Bölüm': '' });
      });
    } else {
      notesData.push({ 'Bölüm': 'Bu toplantı için henüz not eklenmemiş.' });
    }

    // Tüm verileri birleştir
    const allData = [...headerData, ...statsData, ...notesHeader, ...notesData];

    // Workbook oluştur
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Toplantı Raporu');

    // Sütun genişliğini ayarla
    ws['!cols'] = [{ wch: 80 }];

    // Buffer olarak dön
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('Not raporu export hatası:', error);
    throw error;
  }
};

module.exports = exports;