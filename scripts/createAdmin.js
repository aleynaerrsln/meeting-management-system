const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect("mongodb+srv://admin:admin123@cluster0.ydbf");
    console.log('MongoDB bağlantısı başarılı');

    // Admin kullanıcısı var mı kontrol et
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });

    if (existingAdmin) {
      console.log('Admin kullanıcısı zaten mevcut!');
      process.exit(0);
    }

    // Admin oluştur
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: '123456',
      role: 'admin'
    });

    console.log('✅ Admin kullanıcısı başarıyla oluşturuldu!');
    console.log('Email: admin@example.com');
    console.log('Şifre: 123456');
    
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error);
    process.exit(1);
  }
};

createAdmin();