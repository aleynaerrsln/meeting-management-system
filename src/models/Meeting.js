const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Toplantı başlığı gereklidir'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Toplantı tarihi gereklidir']
  },
  time: {
    type: String,
    required: [true, 'Toplantı saati gereklidir']
  },
  location: {
    type: String,
    required: [true, 'Toplantı yeri gereklidir'],
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
      enum: ['pending', 'attended', 'not_attended'],
      default: 'pending'
    },
    markedAt: {
      type: Date
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Toplantı oluşturulduğunda attendance listesini otomatik oluştur
meetingSchema.pre('save', function(next) {
  if (this.isNew) {
    this.attendance = this.participants.map(participantId => ({
      user: participantId,
      status: 'pending'
    }));
  }
  next();
});

module.exports = mongoose.model('Meeting', meetingSchema);