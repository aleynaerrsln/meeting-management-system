const nodemailer = require('nodemailer');

// E-posta transporter oluştur
const createTransporter = () => {
  return nodemailer.createTransport({
    host:  'smtp.gmail.com',
    port:  587,
    secure: false, // TLS kullan
    auth: {
      user: "spectraloop55@gmail.com",
      pass: "yhtusmgqkhuzrngd"
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Toplantı daveti e-postası gönder
exports.sendMeetingInvitation = async (meeting, participants) => {
  try {
    const transporter = createTransporter();

    const mailPromises = participants.map(participant => {
      const mailOptions = {
        from: `"Toplantı Yönetim Sistemi" <${"spectraloop55@gmail.com"||"spectraloop55@gmail.com"}>`,
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
        from: `"Toplantı Yönetim Sistemi" <${"spectraloop55@gmail.com" || "spectraloop55@gmail.com"}>`,
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

// Şifre sıfırlama e-postası
exports.sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `http://localhost:5174//reset-password/${resetToken}`;

    const mailOptions = {
      from: `"Toplantı Yönetim Sistemi" <${"spectraloop55@gmail.com"|| "spectraloop55@gmail.com"}>`,
      to: user.email,
      subject: 'Şifre Sıfırlama Talebi',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🔐 Şifre Sıfırlama</h2>
          <p>Merhaba <strong>${user.firstName} ${user.lastName}</strong>,</p>
          <p>Hesabınız için şifre sıfırlama talebinde bulunuldu.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin-bottom: 15px;">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Şifremi Sıfırla
            </a>
            <p style="color: #e74c3c; margin-top: 15px; font-size: 14px;">
              ⚠️ <strong>Bu bağlantı 1 saat geçerlidir.</strong>
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Bu bağlantıyı başkalarıyla paylaşmayın. Eğer buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırabilirsiniz:
          </p>
          <p style="color: #666; font-size: 11px; word-break: break-all;">
            ${resetUrl}
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Bu e-posta otomatik olarak Toplantı Yönetim Sistemi tarafından gönderilmiştir.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Şifre sıfırlama e-postası gönderildi: ${user.email}`);
    return true;
  } catch (error) {
    console.error('Şifre sıfırlama e-postası hatası:', error);
    throw error;
  }
};