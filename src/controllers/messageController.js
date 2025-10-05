const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Gelen kutusu - Kullanıcıya gelen mesajlar
// @route   GET /api/messages/inbox
// @access  Private
exports.getInbox = async (req, res) => {
  try {
    const messages = await Message.find({ receiver: req.user._id })
      .populate('sender', 'firstName lastName email role')
      .sort({ createdAt: -1 });

    const unreadCount = await Message.countDocuments({ 
      receiver: req.user._id, 
      isRead: false 
    });

    res.json({
      success: true,
      count: messages.length,
      unreadCount,
      data: messages
    });
  } catch (error) {
    console.error('Gelen kutusu hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Dosya indir
// @route   GET /api/messages/:messageId/attachment/:attachmentId
// @access  Private
exports.downloadAttachment = async (req, res) => {
  try {
    const { messageId, attachmentId } = req.params;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Mesaj bulunamadı' });
    }

    // Yetki kontrolü
    if (message.sender.toString() !== req.user._id.toString() && 
        message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu dosyaya erişim yetkiniz yok' });
    }

    const attachment = message.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Dosya bulunamadı' });
    }

    res.set({
      'Content-Type': attachment.mimetype,
      'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
      'Content-Length': attachment.size
    });

    res.send(attachment.data);
  } catch (error) {
    console.error('Dosya indirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Giden kutusu - Kullanıcının gönderdiği mesajlar
// @route   GET /api/messages/sent
// @access  Private
exports.getSent = async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.user._id })
      .populate('receiver', 'firstName lastName email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Giden kutusu hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Konuşma geçmişi - İki kullanıcı arasındaki tüm mesajlar
// @route   GET /api/messages/conversation/:userId
// @access  Private
exports.getConversation = async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'firstName lastName email role')
      .populate('receiver', 'firstName lastName email role')
      .sort({ createdAt: 1 });

    // Gelen mesajları okundu olarak işaretle
    await Message.updateMany(
      { sender: otherUserId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: Date.now() }
    );

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Konuşma geçmişi hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Yeni mesaj gönder
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { receiver, subject, content } = req.body;

    if (!receiver || !content) {
      return res.status(400).json({ 
        message: 'Alıcı ve mesaj içeriği zorunludur' 
      });
    }

    // Alıcının var olup olmadığını kontrol et
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({ message: 'Alıcı kullanıcı bulunamadı' });
    }

    // Kendine mesaj gönderme kontrolü
    if (receiver === req.user._id.toString()) {
      return res.status(400).json({ message: 'Kendinize mesaj gönderemezsiniz' });
    }

    // Dosya ekleri
    const attachments = [];
    if (req.files && req.files.attachments) {
      const files = Array.isArray(req.files.attachments) 
        ? req.files.attachments 
        : [req.files.attachments];
      
      files.forEach(file => {
        // Dosya boyutu kontrolü (10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Dosya boyutu 10MB\'dan küçük olmalıdır');
        }
        
        attachments.push({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimetype: file.mimetype,
          size: file.size,
          data: file.data
        });
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver,
      subject: subject || 'Mesaj',
      content,
      attachments
    });

    await message.populate('sender', 'firstName lastName email role');
    await message.populate('receiver', 'firstName lastName email role');

    // Alıcıya bildirim gönder
    await Notification.create({
      user: receiver,
      type: 'message_received',
      title: 'Yeni Mesaj',
      message: `${req.user.firstName} ${req.user.lastName} size bir mesaj gönderdi${attachments.length > 0 ? ' (Dosya eki var)' : ''}`,
      relatedMessage: message._id
    });

    console.log(`✅ Mesaj gönderildi: ${req.user.firstName} → ${receiverUser.firstName}`);

    res.status(201).json({
      success: true,
      message: 'Mesaj başarıyla gönderildi',
      data: message
    });
  } catch (error) {
    console.error('Mesaj gönderme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Mesajı okundu olarak işaretle
// @route   PUT /api/messages/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      receiver: req.user._id
    });

    if (!message) {
      return res.status(404).json({ message: 'Mesaj bulunamadı' });
    }

    message.isRead = true;
    message.readAt = Date.now();
    await message.save();

    res.json({
      success: true,
      message: 'Mesaj okundu olarak işaretlendi'
    });
  } catch (error) {
    console.error('Mesaj güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Mesajı sil
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    });

    if (!message) {
      return res.status(404).json({ message: 'Mesaj bulunamadı' });
    }

    await message.deleteOne();

    res.json({
      success: true,
      message: 'Mesaj silindi'
    });
  } catch (error) {
    console.error('Mesaj silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Okunmamış mesaj sayısı
// @route   GET /api/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ 
      receiver: req.user._id, 
      isRead: false 
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Sayım hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Mesajlaşılabilecek kullanıcı listesi
// @route   GET /api/messages/users
// @access  Private
exports.getAvailableUsers = async (req, res) => {
  try {
    // Kendisi hariç tüm kullanıcılar
    const users = await User.find({ 
      _id: { $ne: req.user._id } 
    }).select('firstName lastName email role');

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Kullanıcı listesi hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};