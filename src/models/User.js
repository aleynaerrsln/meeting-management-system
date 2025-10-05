const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Ad alanı zorunludur'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Soyad alanı zorunludur'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'E-posta alanı zorunludur'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Geçerli bir e-posta adresi giriniz']
  },
  password: {
    type: String,
    required: [true, 'Şifre alanı zorunludur'],
    minlength: [6, 'Şifre en az 6 karakter olmalıdır']
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  // 🆕 BİRİMLER (Birden fazla seçilebilir)
  departments: [{
    type: String,
    enum: [
      'Yazılım Birimi',
      'Elektrik Birimi',
      'Makine Birimi',
      'Tasarım Birimi',
      'Yönetim Birimi',
      'Pazarlama Birimi'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  // Profil Fotoğrafı
  profilePhoto: {
    data: Buffer,
    contentType: String,
    uploadedAt: Date
  },
  // Kişisel Bilgiler
  birthDate: {
    type: Date,
    default: null
  },
  birthPlace: {
    type: String,
    trim: true,
    default: null
  },
  nationalId: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function(v) {
        return !v || /^\d{11}$/.test(v);
      },
      message: 'TC Kimlik No 11 haneli olmalıdır'
    }
  },
  iban: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function(v) {
        return !v || /^TR\d{24}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Geçerli bir Türk IBAN numarası giriniz (TR + 24 hane)'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  // Şifre Sıfırlama
  resetPasswordToken: {
    type: String,
    default: undefined
  },
  resetPasswordExpire: {
    type: Date,
    default: undefined
  }
}, {
  timestamps: true
});

// Şifre hashleme
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Şifre karşılaştırma metodu
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// JSON'da şifreyi gizle
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  // Profil fotoğrafı data'sını gizle
  if (user.profilePhoto && user.profilePhoto.data) {
    user.hasProfilePhoto = true;
    delete user.profilePhoto.data;
  }
  return user;
};

module.exports = mongoose.model('User', userSchema);