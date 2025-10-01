const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Toplantı başlığı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Toplantı tarihi zorunludur']
  },
  time: {
    type: String,
    required: [true, 'Toplantı saati zorunludur']
  },
  location: {
    type: String,
    required: [true, 'Toplantı yeri zorunludur'],
    trim: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['planned', 'completed', 'cancelled'],
    default: 'planned'
  },
  attendance: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['attended', 'not_attended', 'pending'],
      default: 'pending'
    },
    markedAt: Date,
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Toplantı oluşturulduğunda katılımcıları otomatik attendance'a ekle
meetingSchema.pre('save', function(next) {
  if (this.isNew && this.participants.length > 0) {
    this.attendance = this.participants.map(participantId => ({
      user: participantId,
      status: 'pending'
    }));
  }
  next();
});

module.exports = mongoose.model('Meeting', meetingSchema);