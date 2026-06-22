const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
// Creer le dossier uploads s il n existe pas
const dossierUploads = path.join(__dirname, '../../uploads');
if (!fs.existsSync(dossierUploads)) {
  fs.mkdirSync(dossierUploads, { recursive: true });
}
// Formats autorises (RG-07)
const FORMATS_AUTORISES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/png',
  'image/jpeg',
];
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo en octets (RG-07)
// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dossierUploads);
  },
  filename: (req, file, cb) => {
    // Nom unique : timestamp + nom original
    const nomUnique = `${Date.now()}-${file.originalname}`;
    cb(null, nomUnique);
  },
});
// Filtre de validation du format (RG-07)
const fileFilter = (req, file, cb) => {
  if (FORMATS_AUTORISES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non autorise'), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: TAILLE_MAX },
});
module.exports = upload;