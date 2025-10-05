const Sponsorship = require('../models/Sponsorship');

// @desc    Tüm sponsorlukları listele
// @route   GET /api/sponsorships
// @access  Private
exports.getAllSponsorships = async (req, res) => {
  try {
    const sponsorships = await Sponsorship.find()
      .populate('createdBy', 'firstName lastName email')
      .populate('statusHistory.changedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .select('-pdfReport.data -sentEmailScreenshot.data -responseEmailScreenshot.data');

    res.json({
      success: true,
      count: sponsorships.length,
      data: sponsorships
    });
  } catch (error) {
    console.error('Sponsorluk listeleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Tek sponsorluk getir
// @route   GET /api/sponsorships/:id
// @access  Private
exports.getSponsorshipById = async (req, res) => {
  try {
    const sponsorship = await Sponsorship.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('statusHistory.changedBy', 'firstName lastName')
      .select('-pdfReport.data -sentEmailScreenshot.data -responseEmailScreenshot.data');

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    res.json(sponsorship);
  } catch (error) {
    console.error('Sponsorluk getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// Otomatik durum belirleme fonksiyonu
const determineStatus = (hasPdf, hasSentEmail, hasResponseEmail) => {
  if (hasResponseEmail) {
    return 'responded'; // Dönüş maili varsa "Dönüş Sağlandı"
  }
  if (hasPdf && hasSentEmail) {
    return 'contacted'; // PDF + Gönderilen mail varsa "İletişim Kuruldu"
  }
  return 'pending'; // Sadece temel bilgiler varsa "Beklemede"
};

// @desc    Yeni sponsorluk talebi oluştur
// @route   POST /api/sponsorships
// @access  Private
exports.createSponsorship = async (req, res) => {
  try {
    const { companyName, companyEmail, requestDescription, notes } = req.body;

    if (!companyName || !companyEmail || !requestDescription) {
      return res.status(400).json({ 
        message: 'Firma adı, e-posta ve talep açıklaması zorunludur' 
      });
    }

    const sponsorshipData = {
      companyName,
      companyEmail,
      requestDescription,
      notes,
      createdBy: req.user._id
    };

    let hasPdf = false;
    let hasSentEmail = false;
    let hasResponseEmail = false;

    // PDF dosyası
    if (req.files && req.files.pdfReport) {
      const pdfFile = req.files.pdfReport;
      sponsorshipData.pdfReport = {
        filename: pdfFile.name,
        data: pdfFile.data,
        contentType: pdfFile.mimetype,
        uploadedAt: new Date()
      };
      hasPdf = true;
    }

    // Gönderilen email screenshot
    if (req.files && req.files.sentEmailScreenshot) {
      const imgFile = req.files.sentEmailScreenshot;
      sponsorshipData.sentEmailScreenshot = {
        filename: imgFile.name,
        data: imgFile.data,
        contentType: imgFile.mimetype,
        uploadedAt: new Date()
      };
      hasSentEmail = true;
    }

    // Dönüş email screenshot
    if (req.files && req.files.responseEmailScreenshot) {
      const imgFile = req.files.responseEmailScreenshot;
      sponsorshipData.responseEmailScreenshot = {
        filename: imgFile.name,
        data: imgFile.data,
        contentType: imgFile.mimetype,
        uploadedAt: new Date()
      };
      hasResponseEmail = true;
    }

    // Otomatik durum belirleme
    sponsorshipData.status = determineStatus(hasPdf, hasSentEmail, hasResponseEmail);

    const sponsorship = await Sponsorship.create(sponsorshipData);
    await sponsorship.populate('createdBy', 'firstName lastName email');

    const statusMessages = {
      pending: 'Sponsorluk talebi oluşturuldu - Beklemede',
      contacted: 'Sponsorluk talebi oluşturuldu - İletişim Kuruldu',
      responded: 'Sponsorluk talebi oluşturuldu - Dönüş Sağlandı'
    };

    res.status(201).json({
      message: statusMessages[sponsorship.status],
      sponsorship
    });
  } catch (error) {
    console.error('Sponsorluk oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Sponsorluk durumunu güncelle (Manuel - Onaylandı/Reddedildi)
// @route   PUT /api/sponsorships/:id/decision
// @access  Private
exports.updateSponsorshipDecision = async (req, res) => {
  try {
    const { decision } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Geçerli bir karar seçiniz (approved/rejected)' });
    }

    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    sponsorship.finalDecision = decision;
    sponsorship.status = decision;
    
    sponsorship.statusHistory.push({
      status: decision,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: decision === 'approved' ? 'Sponsorluk onaylandı' : 'Sponsorluk reddedildi'
    });

    await sponsorship.save();
    await sponsorship.populate('createdBy', 'firstName lastName email');
    await sponsorship.populate('statusHistory.changedBy', 'firstName lastName');

    res.json({
      message: decision === 'approved' ? 'Sponsorluk onaylandı' : 'Sponsorluk reddedildi',
      sponsorship
    });
  } catch (error) {
    console.error('Karar güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Sponsorluk güncelle
// @route   PUT /api/sponsorships/:id
// @access  Private
exports.updateSponsorship = async (req, res) => {
  try {
    const { companyName, companyEmail, requestDescription, notes } = req.body;

    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    // Tüm kullanıcılar güncelleyebilir - yetki kontrolü kaldırıldı

    sponsorship.companyName = companyName || sponsorship.companyName;
    sponsorship.companyEmail = companyEmail || sponsorship.companyEmail;
    sponsorship.requestDescription = requestDescription || sponsorship.requestDescription;
    sponsorship.notes = notes !== undefined ? notes : sponsorship.notes;

    let hasPdf = !!(sponsorship.pdfReport && sponsorship.pdfReport.data);
    let hasSentEmail = !!(sponsorship.sentEmailScreenshot && sponsorship.sentEmailScreenshot.data);
    let hasResponseEmail = !!(sponsorship.responseEmailScreenshot && sponsorship.responseEmailScreenshot.data);

    // PDF güncelleme
    if (req.files && req.files.pdfReport) {
      const pdfFile = req.files.pdfReport;
      sponsorship.pdfReport = {
        filename: pdfFile.name,
        data: pdfFile.data,
        contentType: pdfFile.mimetype,
        uploadedAt: new Date()
      };
      hasPdf = true;
    }

    // Gönderilen email screenshot güncelleme
    if (req.files && req.files.sentEmailScreenshot) {
      const imgFile = req.files.sentEmailScreenshot;
      sponsorship.sentEmailScreenshot = {
        filename: imgFile.name,
        data: imgFile.data,
        contentType: imgFile.mimetype,
        uploadedAt: new Date()
      };
      hasSentEmail = true;
    }

    // Dönüş email screenshot güncelleme
    if (req.files && req.files.responseEmailScreenshot) {
      const imgFile = req.files.responseEmailScreenshot;
      sponsorship.responseEmailScreenshot = {
        filename: imgFile.name,
        data: imgFile.data,
        contentType: imgFile.mimetype,
        uploadedAt: new Date()
      };
      hasResponseEmail = true;
    }

    // Otomatik durum güncelleme (sadece manuel karar verilmemişse)
    if (!sponsorship.finalDecision) {
      const newStatus = determineStatus(hasPdf, hasSentEmail, hasResponseEmail);
      if (newStatus !== sponsorship.status) {
        sponsorship.statusHistory.push({
          status: newStatus,
          changedBy: req.user._id,
          changedAt: new Date(),
          note: 'Dosya eklendi, durum otomatik güncellendi'
        });
        sponsorship.status = newStatus;
      }
    }

    await sponsorship.save();
    await sponsorship.populate('createdBy', 'firstName lastName email');

    res.json({
      message: 'Sponsorluk güncellendi',
      sponsorship
    });
  } catch (error) {
    console.error('Sponsorluk güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Sponsorluk sil
// @route   DELETE /api/sponsorships/:id
// @access  Private
exports.deleteSponsorship = async (req, res) => {
  try {
    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    if (sponsorship.createdBy.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Bu sponsorluğu silme yetkiniz yok' 
      });
    }

    await sponsorship.deleteOne();

    res.json({ message: 'Sponsorluk silindi' });
  } catch (error) {
    console.error('Sponsorluk silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    PDF dosyasını indir
// @route   GET /api/sponsorships/:id/pdf
// @access  Private
exports.downloadPdf = async (req, res) => {
  try {
    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    if (!sponsorship.pdfReport || !sponsorship.pdfReport.data) {
      return res.status(404).json({ message: 'PDF dosyası bulunamadı' });
    }

    res.setHeader('Content-Type', sponsorship.pdfReport.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sponsorship.pdfReport.filename}"`);
    res.send(sponsorship.pdfReport.data);
  } catch (error) {
    console.error('PDF indirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Gönderilen email screenshot'ı indir
// @route   GET /api/sponsorships/:id/sent-email
// @access  Private
exports.downloadSentEmail = async (req, res) => {
  try {
    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    if (!sponsorship.sentEmailScreenshot || !sponsorship.sentEmailScreenshot.data) {
      return res.status(404).json({ message: 'Gönderilen mail fotoğrafı bulunamadı' });
    }

    res.setHeader('Content-Type', sponsorship.sentEmailScreenshot.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${sponsorship.sentEmailScreenshot.filename}"`);
    res.send(sponsorship.sentEmailScreenshot.data);
  } catch (error) {
    console.error('Fotoğraf indirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Dönüş email screenshot'ı indir
// @route   GET /api/sponsorships/:id/response-email
// @access  Private
exports.downloadResponseEmail = async (req, res) => {
  try {
    const sponsorship = await Sponsorship.findById(req.params.id);

    if (!sponsorship) {
      return res.status(404).json({ message: 'Sponsorluk bulunamadı' });
    }

    if (!sponsorship.responseEmailScreenshot || !sponsorship.responseEmailScreenshot.data) {
      return res.status(404).json({ message: 'Dönüş mail fotoğrafı bulunamadı' });
    }

    res.setHeader('Content-Type', sponsorship.responseEmailScreenshot.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${sponsorship.responseEmailScreenshot.filename}"`);
    res.send(sponsorship.responseEmailScreenshot.data);
  } catch (error) {
    console.error('Fotoğraf indirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
};