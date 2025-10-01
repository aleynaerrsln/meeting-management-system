const cron = require('node-cron');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { sendMeetingReminder } = require('./emailService');

// Her gün saat 09:00'da yarın için toplantı hatırlatması gönder
exports.scheduleDailyReminders = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('📅 Günlük toplantı hatırlatması kontrolü başladı...');

      // Yarının tarihi
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Yarın olan toplantıları bul
      const upcomingMeetings = await Meeting.find({
        date: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: 'planned'
      }).populate('participants', 'firstName lastName email');

      console.log(`📧 ${upcomingMeetings.length} toplantı için hatırlatma gönderiliyor...`);

      // Her toplantı için hatırlatma gönder
      for (const meeting of upcomingMeetings) {
        if (meeting.participants && meeting.participants.length > 0) {
          try {
            await sendMeetingReminder(meeting, meeting.participants);
            console.log(`✅ "${meeting.title}" toplantısı için hatırlatma gönderildi`);
          } catch (error) {
            console.error(`❌ "${meeting.title}" için hatırlatma gönderilemedi:`, error.message);
          }
        }
      }

      console.log('✅ Günlük hatırlatma görevi tamamlandı');
    } catch (error) {
      console.error('❌ Hatırlatma görevi hatası:', error);
    }
  });

  console.log('⏰ Günlük hatırlatma planı aktif edildi (Her gün 09:00)');
};

// Her saat başı yaklaşan toplantıları kontrol et (1 saat kala)
exports.scheduleHourlyReminders = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('⏰ Saatlik toplantı hatırlatması kontrolü...');

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // 1-2 saat içinde başlayacak toplantıları bul
      const upcomingMeetings = await Meeting.find({
        date: {
          $gte: now,
          $lt: twoHoursLater
        },
        status: 'planned'
      }).populate('participants', 'firstName lastName email');

      console.log(`🔔 ${upcomingMeetings.length} yaklaşan toplantı bulundu`);

      for (const meeting of upcomingMeetings) {
        const meetingDateTime = new Date(meeting.date);
        const [hours, minutes] = meeting.time.split(':');
        meetingDateTime.setHours(parseInt(hours), parseInt(minutes));

        const timeDiff = meetingDateTime - now;
        const hoursUntilMeeting = timeDiff / (1000 * 60 * 60);

        // 1 saat içinde başlayacaksa hatırlatma gönder
        if (hoursUntilMeeting > 0 && hoursUntilMeeting <= 1.5) {
          if (meeting.participants && meeting.participants.length > 0) {
            try {
              await sendMeetingReminder(meeting, meeting.participants);
              console.log(`⏰ "${meeting.title}" için acil hatırlatma gönderildi`);
            } catch (error) {
              console.error(`❌ Hatırlatma gönderilemedi:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Saatlik hatırlatma hatası:', error);
    }
  });

  console.log('⏰ Saatlik hatırlatma planı aktif edildi (Her saat başı)');
};

// Test için manuel hatırlatma (İsteğe bağlı)
exports.sendTestReminder = async () => {
  try {
    const upcomingMeetings = await Meeting.find({
      status: 'planned'
    })
      .populate('participants', 'firstName lastName email')
      .limit(1);

    if (upcomingMeetings.length > 0) {
      const meeting = upcomingMeetings[0];
      await sendMeetingReminder(meeting, meeting.participants);
      console.log('✅ Test hatırlatma gönderildi');
      return true;
    } else {
      console.log('❌ Hatırlatma göndermek için toplantı bulunamadı');
      return false;
    }
  } catch (error) {
    console.error('❌ Test hatırlatma hatası:', error);
    return false;
  }
};