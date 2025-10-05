const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const {
  getAllSponsorships,
  getSponsorshipById,
  createSponsorship,
  updateSponsorship,
  updateSponsorshipDecision,
  deleteSponsorship,
  downloadPdf,
  downloadSentEmail,
  downloadResponseEmail
} = require('../controllers/sponsorshipController');
const { protect } = require('../middleware/auth');

// File upload middleware
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: 'Dosya boyutu 10MB\'ı geçemez'
}));

// Tüm route'lar giriş yapmış kullanıcılar için
router.use(protect);

// Dosya indirme route'ları
router.get('/:id/pdf', downloadPdf);
router.get('/:id/sent-email', downloadSentEmail);
router.get('/:id/response-email', downloadResponseEmail);

// CRUD route'ları
router.route('/')
  .get(getAllSponsorships)
  .post(createSponsorship);

router.route('/:id')
  .get(getSponsorshipById)
  .put(updateSponsorship)
  .delete(deleteSponsorship);

// Karar güncelleme (Onaylandı/Reddedildi)
router.put('/:id/decision', updateSponsorshipDecision);

module.exports = router;