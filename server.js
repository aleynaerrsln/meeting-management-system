require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');

const app = express();

// Database bağlantısı
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/meetings', require('./src/routes/meetings'));
app.use('/api/work-reports', require('./src/routes/workReports'));
app.use('/api/export', require('./src/routes/export'));
app.use('/api/sponsorships', require('./src/routes/sponsorships'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/activity-points', require('./src/routes/activityPoints')); // 🆕 YENİ ROUTE

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Toplantı Yönetim API Çalışıyor' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Sunucu hatası!', error: err.message });
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`✅ Server ${PORT} portunda çalışıyor`);
});