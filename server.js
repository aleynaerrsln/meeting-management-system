const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5174', 'http://192.168.1.4:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Bağlantısı
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas bağlantısı başarılı');
  })
  .catch((err) => console.error('❌ MongoDB bağlantı hatası:', err));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/meetings', require('./src/routes/meetings'));
app.use('/api/work-reports', require('./src/routes/workReports'));
app.use('/api/export', require('./src/routes/export'));
app.use('/api/sponsorships', require('./src/routes/sponsorships')); // 🆕 YENİ ROUTE

// Test Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Toplantı ve Çalışma Yönetim Sistemi API',
    version: '1.0.0',
    status: 'Çalışıyor ✅',
    features: {
      auth: '✅',
      users: '✅',
      meetings: '✅',
      workReports: '✅',
      export: '✅',
      sponsorships: '✅' // 🆕 YENİ ÖZELLIK
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route bulunamadı' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Sunucu hatası',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`📱 Telefon: http://192.168.1.4:${PORT}`);
});