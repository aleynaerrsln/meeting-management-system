const ActivityPoint = require('../models/ActivityPoint');
const User = require('../models/User');

// @desc    Yeni puan ekle (Admin)
// @route   POST /api/activity-points
// @access  Private/Admin
exports.addActivityPoint = async (req, res) => {
  try {
    const { userId, date, description, points } = req.body;

    // Validasyon
    if (!userId || !date || !description || !points) {
      return res.status(400).json({ 
        message: 'Kullanıcı, tarih, açıklama ve puan gereklidir' 
      });
    }

    // Kullanıcı kontrolü
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Puan oluştur
    const activityPoint = await ActivityPoint.create({
      user: userId,
      date,
      description,
      points: Number(points),
      addedBy: req.user._id
    });

    await activityPoint.populate('user', 'firstName lastName email');
    await activityPoint.populate('addedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Puan başarıyla eklendi',
      data: activityPoint
    });
  } catch (error) {
    console.error('Puan ekleme hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};

// @desc    Tüm kullanıcıların puan sıralaması (Herkes görebilir)
// @route   GET /api/activity-points/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res) => {
  try {
    // Her kullanıcının toplam puanını hesapla
    const leaderboard = await ActivityPoint.aggregate([
      {
        $group: {
          _id: '$user',
          totalPoints: { $sum: '$points' },
          activityCount: { $count: {} }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          _id: 1,
          totalPoints: 1,
          activityCount: 1,
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          email: '$userInfo.email',
          departments: '$userInfo.departments',
          // Profil fotoğrafı var mı kontrol et
          hasProfilePhoto: {
            $cond: {
              if: { $and: ['$userInfo.profilePhoto', '$userInfo.profilePhoto.data'] },
              then: true,
              else: false
            }
          }
        }
      },
      {
        $sort: { totalPoints: -1 } // En çok puandan en aza
      }
    ]);

    res.json({
      success: true,
      count: leaderboard.length,
      data: leaderboard
    });
  } catch (error) {
    console.error('Liderlik tablosu hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};

// @desc    Belirli bir kullanıcının puan geçmişi (Admin)
// @route   GET /api/activity-points/history/:userId
// @access  Private/Admin
exports.getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcı kontrolü
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Puan geçmişini getir
    const history = await ActivityPoint.find({ user: userId })
      .populate('addedBy', 'firstName lastName')
      .sort({ date: -1 });

    // Toplam puan
    const totalPoints = history.reduce((sum, item) => sum + item.points, 0);

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      totalPoints,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Geçmiş getirme hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};

// @desc    Puan sil (Admin)
// @route   DELETE /api/activity-points/:id
// @access  Private/Admin
exports.deleteActivityPoint = async (req, res) => {
  try {
    const activityPoint = await ActivityPoint.findById(req.params.id);

    if (!activityPoint) {
      return res.status(404).json({ message: 'Puan kaydı bulunamadı' });
    }

    await activityPoint.deleteOne();

    res.json({
      success: true,
      message: 'Puan kaydı başarıyla silindi'
    });
  } catch (error) {
    console.error('Puan silme hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};

// @desc    Puan güncelle (Admin)
// @route   PUT /api/activity-points/:id
// @access  Private/Admin
exports.updateActivityPoint = async (req, res) => {
  try {
    const { date, description, points } = req.body;

    const activityPoint = await ActivityPoint.findById(req.params.id);

    if (!activityPoint) {
      return res.status(404).json({ message: 'Puan kaydı bulunamadı' });
    }

    // Güncelle
    if (date) activityPoint.date = date;
    if (description) activityPoint.description = description;
    if (points) activityPoint.points = Number(points);

    await activityPoint.save();
    await activityPoint.populate('user', 'firstName lastName email');
    await activityPoint.populate('addedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Puan kaydı başarıyla güncellendi',
      data: activityPoint
    });
  } catch (error) {
    console.error('Puan güncelleme hatası:', error);
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message 
    });
  }
};