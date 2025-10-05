const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

// JWT Token oluştur
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Kullanıcı girişi
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-posta ve şifre gereklidir' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Hesabınız aktif değil. Lütfen yöneticinizle iletişime geçin' });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' });
    }

    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user._id);

    const userResponse = user.toJSON();

    res.json({
      success: true,
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Şifre değiştirme
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mevcut şifre ve yeni şifre gereklidir' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalıdır' });
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mevcut şifre hatalı' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Profil bilgilerini getir
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Profil getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// 🆕 @desc    Profil fotoğrafı yükle
// @route   POST /api/auth/upload-profile-photo
// @access  Private
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.files || !req.files.photo) {
      return res.status(400).json({ message: 'Lütfen bir fotoğraf yükleyin' });
    }

    const photo = req.files.photo;

    // Dosya tipi kontrolü
    if (!photo.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'Lütfen sadece resim dosyası yükleyin' });
    }

    // Dosya boyutu kontrolü (5MB)
    if (photo.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Fotoğraf boyutu 5MB\'dan küçük olmalıdır' });
    }

    const user = await User.findById(req.user._id);

    user.profilePhoto = {
      data: photo.data,
      contentType: photo.mimetype,
      uploadedAt: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi',
      hasProfilePhoto: true
    });
  } catch (error) {
    console.error('Profil fotoğrafı yükleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// 🆕 @desc    Profil fotoğrafını getir
// @route   GET /api/auth/profile-photo/:userId
// @access  Public (herkes görebilsin)
exports.getProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user || !user.profilePhoto || !user.profilePhoto.data) {
      return res.status(404).json({ message: 'Profil fotoğrafı bulunamadı' });
    }

    res.set('Content-Type', user.profilePhoto.contentType);
    res.send(user.profilePhoto.data);
  } catch (error) {
    console.error('Profil fotoğrafı getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// 🆕 @desc    Profil fotoğrafını sil
// @route   DELETE /api/auth/profile-photo
// @access  Private
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.profilePhoto = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Profil fotoğrafı silindi'
    });
  } catch (error) {
    console.error('Profil fotoğrafı silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Şifre sıfırlama talebi
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'E-posta adresi gereklidir' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Bu e-posta adresine kayıtlı kullanıcı bulunamadı' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 saat
    await user.save();

    try {
      await sendPasswordResetEmail(user, resetToken);
      res.json({ message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi' });
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      console.error('E-posta gönderme hatası:', emailError);
      return res.status(500).json({ message: 'E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin' });
    }
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Şifre sıfırlama
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Yeni şifre gereklidir' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: 'Şifre başarıyla sıfırlandı. Artık giriş yapabilirsiniz' });
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};