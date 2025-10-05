const mongoose = require('mongoose');

const sponsorshipSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Firma adı zorunludur'],
    trim: true
  },
  companyEmail: {
    type: String,
    required: [true, 'Firma e-postası zorunludur'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Geçerli bir e-posta adresi giriniz']
  },
  requestDescription: {
    type: String,
    required: [true, 'Talep açıklaması zorunludur'],
    trim: true
  },
  pdfReport: {
    filename: String,
    data: Buffer,
    contentType: String,
    uploadedAt: Date
  },
  sentEmailScreenshot: {
    filename: String,
    data: Buffer,
    contentType: String,
    uploadedAt: Date
  },
  responseEmailScreenshot: {
    filename: String,
    data: Buffer,
    contentType: String,
    uploadedAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'responded', 'approved', 'rejected'],
    default: 'pending'
  },
  finalDecision: {
    type: String,
    enum: ['approved', 'rejected', null],
    default: null
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'contacted', 'responded', 'approved', 'rejected']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Status değiştiğinde history'ye ekle
sponsorshipSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

module.exports = mongoose.model('Sponsorship', sponsorshipSchema);