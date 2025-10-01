const mongoose = require('mongoose');

const workReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Tarih zorunludur'],
    default: Date.now
  },
  workDescription: {
    type: String,
    required: [true, 'Çalışma açıklaması zorunludur'],
    trim: true
  },
  hoursWorked: {
    type: Number,
    required: [true, 'Çalışma saati zorunludur'],
    min: [0, 'Çalışma saati negatif olamaz'],
    max: [24, 'Çalışma saati 24 saati geçemez']
  },
  project: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'submitted'
  },
  notes: {
    type: String,
    trim: true
  },
  week: {
    type: Number
  },
  year: {
    type: Number
  },
  // 👇 YENİ ALANLAR - Toplantı İçin
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null
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
  }
}, {
  timestamps: true
});

workReportSchema.pre('save', function(next) {
  const date = new Date(this.date);
  this.year = date.getFullYear();
  const firstDayOfYear = new Date(this.year, 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  this.week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  next();
});

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