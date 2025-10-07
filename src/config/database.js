const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://admin:admin123@cluster0.ydbfpjh.mongodb.net/meeting_management?retryWrites=true&w=majority&appName=Cluster0");

    console.log(`✅ MongoDB Bağlantısı Başarılı: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB Bağlantı Hatası:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;