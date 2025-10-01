const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token doğrulama middleware
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Token'ı header'dan al
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Erişim reddedildi. Lütfen giriş yapın.' });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcıyı bul
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Kullanıcı bulunamadı' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Hesap deaktif' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware hatası:', error);
    return res.status(401).json({ message: 'Geçersiz token' });
  }
};

// Admin kontrolü middleware
exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Bu işlem için admin yetkisi gereklidir' });
  }
};