const User = require('../models/User');

// @desc    Tüm kullanıcıları listele
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Kullanıcı listeleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Tek bir kullanıcıyı getir
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  } catch (error) {
    console.error('Kullanıcı getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Yeni kullanıcı oluştur
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      role,
      birthDate,
      birthPlace,
      nationalId,
      iban
    } = req.body;

    // Validasyon
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Ad, soyad, e-posta ve şifre zorunludur' });
    }

    // E-posta kontrolü
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kayıtlı' });
    }

    // TC Kimlik No kontrolü (eğer girilmişse)
    if (nationalId) {
      const existingNationalId = await User.findOne({ nationalId });
      if (existingNationalId) {
        return res.status(400).json({ message: 'Bu TC Kimlik No zaten kayıtlı' });
      }
    }

    // IBAN kontrolü (eğer girilmişse)
    if (iban) {
      const existingIban = await User.findOne({ iban });
      if (existingIban) {
        return res.status(400).json({ message: 'Bu IBAN zaten kayıtlı' });
      }
    }

    // Yeni kullanıcı oluştur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'user',
      birthDate: birthDate || null,
      birthPlace: birthPlace || null,
      nationalId: nationalId || null,
      iban: iban || null
    });

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        birthDate: user.birthDate,
        birthPlace: user.birthPlace,
        nationalId: user.nationalId,
        iban: user.iban
      }
    });
  } catch (error) {
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Kullanıcı güncelle
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      role, 
      isActive,
      birthDate,
      birthPlace,
      nationalId,
      iban
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // E-posta değişiyorsa, başka birinde kullanılıyor mu kontrol et
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanılıyor' });
      }
    }

    // TC Kimlik No değişiyorsa kontrol et
    if (nationalId && nationalId !== user.nationalId) {
      const existingNationalId = await User.findOne({ nationalId });
      if (existingNationalId) {
        return res.status(400).json({ message: 'Bu TC Kimlik No zaten kayıtlı' });
      }
    }

    // IBAN değişiyorsa kontrol et
    if (iban && iban !== user.iban) {
      const existingIban = await User.findOne({ iban });
      if (existingIban) {
        return res.status(400).json({ message: 'Bu IBAN zaten kayıtlı' });
      }
    }

    // Güncelle
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.role = role || user.role;
    
    if (typeof isActive !== 'undefined') {
      user.isActive = isActive;
    }

    // Yeni alanları güncelle
    if (birthDate !== undefined) user.birthDate = birthDate || null;
    if (birthPlace !== undefined) user.birthPlace = birthPlace || null;
    if (nationalId !== undefined) user.nationalId = nationalId || null;
    if (iban !== undefined) user.iban = iban || null;

    await user.save();

    res.json({
      message: 'Kullanıcı başarıyla güncellendi',
      user
    });
  } catch (error) {
    console.error('Kullanıcı güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Kullanıcı sil
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Kendi hesabını silemesin
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Kendi hesabınızı silemezsiniz' });
    }

    await user.deleteOne();

    res.json({ message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    console.error('Kullanıcı silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};