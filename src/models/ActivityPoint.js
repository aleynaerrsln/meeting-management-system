const mongoose = require('mongoose');

const activityPointSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Kullanıcı ID gereklidir']
  },
  date: {
    type: Date,
    required: [true, 'Tarih gereklidir']
  },
  description: {
    type: String,
    required: [true, 'Açıklama gereklidir'],
    trim: true,
    maxlength: [500, 'Açıklama 500 karakterden uzun olamaz']
  },
  points: {
    type: Number,
    required: [true, 'Puan gereklidir'],
    min: [1, 'Puan en az 1 olmalıdır']
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index'ler
activityPointSchema.index({ user: 1, date: -1 });
activityPointSchema.index({ addedBy: 1 });

module.exports = mongoose.model('ActivityPoint', activityPointSchema);