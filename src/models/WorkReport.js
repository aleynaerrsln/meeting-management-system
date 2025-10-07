const mongoose = require('mongoose');

const workReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  workDescription: {
    type: String,
    required: true,
    trim: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  hoursWorked: {
    type: Number,
    required: true,
    min: 0
  },
  project: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'submitted'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  week: {
    type: Number,
    min: 1,
    max: 53
  },
  year: {
    type: Number
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 🆕 YENİ EKLENEN: Dosya ekleri (PDF ve Resimler)
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    data: {
      type: Buffer,
      required: true
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image'],
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
workReportSchema.index({ user: 1, date: -1 });
workReportSchema.index({ week: 1, year: 1 });
workReportSchema.index({ meeting: 1 });
workReportSchema.index({ status: 1 });

// Hafta ve yıl otomatik hesaplama
workReportSchema.pre('save', function(next) {
  const date = new Date(this.date);
  this.year = date.getFullYear();
  
  // ISO 8601 hafta hesaplama
  const firstDayOfYear = new Date(this.year, 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  this.week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  
  this.updatedAt = Date.now();
  next();
});

// Haftalık çalışma saati hesaplama
workReportSchema.statics.getWeeklyHours = async function(userId, week, year) {
  const reports = await this.find({
    user: userId,
    week: week,
    year: year,
    status: { $in: ['submitted', 'approved'] }
  });
  
  const totalHours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);
  return {
    totalHours,
    reportCount: reports.length,
    reports
  };
};

// Aylık çalışma saati hesaplama
workReportSchema.statics.getMonthlyHours = async function(userId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const reports = await this.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
    status: { $in: ['submitted', 'approved'] }
  });
  
  const totalHours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);
  return {
    totalHours,
    reportCount: reports.length,
    reports
  };
};

module.exports = mongoose.model('WorkReport', workReportSchema);