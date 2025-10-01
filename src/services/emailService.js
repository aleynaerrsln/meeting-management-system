const nodemailer = require('nodemailer');

// E-posta transporter oluştur
const createTransporter = () => {
  // Gmail kullanıyorsanız
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // Veya özel SMTP ayarları
  // return nodemailer.createTransporter({
  //   host: process.env.SMTP_HOST,
  //   port: process.env.SMTP_PORT,
  //   secure: true,
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASSWORD
  //   }
  // });
};

// Toplantı daveti e-postası gönder
exports.sendMeetingInvitation = async (meeting, participants) => {
  try {
    const transporter = createTransporter();

    const mailPromises = participants.map(participant => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: participant.email,
        subject: `Yeni Toplantı Daveti: ${meeting.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Toplantı Daveti</h2>
            <p>Merhaba <strong>${participant.firstName} ${participant.lastName}</strong>,</p>
            <p>Yeni bir toplantıya davet edildiniz:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2c3e50;">${meeting.title}</h3>
              ${meeting.description ? `<p><strong>Açıklama:</strong> ${meeting.description}</p>` : ''}
              <p><strong>📅 Tarih:</strong> ${new Date(meeting.date).toLocaleDateString('tr-TR')}</p>
              <p><strong>🕐 Saat:</strong> ${meeting.time}</p>
              <p><strong>📍 Yer:</strong> ${meeting.location}</p>
            </div>
            
            <p>Lütfen toplantıya katılmayı unutmayın.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Bu e-posta otomatik olarak Toplantı Yönetim Sistemi tarafından gönderilmiştir.
            </p>
          </div>
        `
      };

      return transporter.sendMail(mailOptions);
    });

    await Promise.all(mailPromises);
    console.log(`✅ ${participants.length} katılımcıya e-posta gönderildi`);
    return true;
  } catch (error) {
    console.error('E-posta gönderme hatası:', error);
    throw error;
  }
};

// Toplantı güncelleme bildirimi
exports.sendMeetingUpdateNotification = async (meeting, participants) => {
  try {
    const transporter = createTransporter();

    const mailPromises = participants.map(participant => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: participant.email,
        subject: `Toplantı Güncellendi: ${meeting.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e67e22;">Toplantı Güncellendi</h2>
            <p>Merhaba <strong>${participant.firstName} ${participant.lastName}</strong>,</p>
            <p>Katılacağınız toplantı güncellendi:</p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2c3e50;">${meeting.title}</h3>
              ${meeting.description ? `<p><strong>Açıklama:</strong> ${meeting.description}</p>` : ''}
              <p><strong>📅 Tarih:</strong> ${new Date(meeting.date).toLocaleDateString('tr-TR')}</p>
              <p><strong>🕐 Saat:</strong> ${meeting.time}</p>
              <p><strong>📍 Yer:</strong> ${meeting.location}</p>
            </div>
            
            <p>Lütfen yeni detayları kontrol edin.</p>
          </div>
        `
      };

      return transporter.sendMail(mailOptions);
    });

    await Promise.all(mailPromises);
    console.log(`✅ Güncelleme bildirimi ${participants.length} katılımcıya gönderildi`);
    return true;
  } catch (error) {
    console.error('Güncelleme bildirimi gönderme hatası:', error);
    throw error;
  }
};

// Toplantı hatırlatma e-postası
exports.sendMeetingReminder = async (meeting, participants) => {
  try {
    const transporter = createTransporter();

    const mailPromises = participants.map(participant => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: participant.email,
        subject: `Hatırlatma: ${meeting.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">⏰ Toplantı Hatırlatması</h2>
            <p>Merhaba <strong>${participant.firstName} ${participant.lastName}</strong>,</p>
            <p>Yaklaşan toplantınızı hatırlatmak isteriz:</p>
            
            <div style="background: #ffe5e5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <h3 style="margin-top: 0; color: #2c3e50;">${meeting.title}</h3>
              <p><strong>📅 Tarih:</strong> ${new Date(meeting.date).toLocaleDateString('tr-TR')}</p>
              <p><strong>🕐 Saat:</strong> ${meeting.time}</p>
              <p><strong>📍 Yer:</strong> ${meeting.location}</p>
            </div>
            
            <p><strong>Lütfen toplantıya zamanında katılın!</strong></p>
          </div>
        `
      };

      return transporter.sendMail(mailOptions);
    });

    await Promise.all(mailPromises);
    console.log(`✅ Hatırlatma ${participants.length} katılımcıya gönderildi`);
    return true;
  } catch (error) {
    console.error('Hatırlatma gönderme hatası:', error);
    throw error;
  }
};