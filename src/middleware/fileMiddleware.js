const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const multerStorage = multer.memoryStorage();

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Hanya mendukung file gambar.', 400), false);
    }
};

const multerUploadPhoto = multer({
    storage: multerStorage,
    fileFilter: multerFilter,
});

exports.uploadUserPhoto = multerUploadPhoto.single('photo');
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
    if (!req.file) return next();
    req.file.filename = `user-${req.user.id}-${Date.now()}.png`;
    // Path lengkap ke direktori target
    const targetDirectory = `public/img/users`;
    // Pastikan folder target ada, jika tidak, buat folder
    if (!fs.existsSync(targetDirectory)) {
        fs.mkdirSync(targetDirectory, { recursive: true });
    }
    const filePath = path.join(targetDirectory, req.file.filename);
    await sharp(req.file.buffer)
        .resize(256, 256)
        .toFormat('png')
        .png({
            quality: 90,
        })
        .toFile(filePath);
    next();
});

// Upload file PDF
// Filter hanya menerima file PDF
const multerFilterIPFS = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        console.log(file.mimetype);
        cb(new AppError('Hanya mendukung file PDF atau Gambar.', 400), false);
    }
};

// Konfigurasi multer dengan filter
const multerUploadFileIPFS = multer({
    storage: multerStorage,
    fileFilter: multerFilterIPFS,
});

exports.uploadFileIPFS = multerUploadFileIPFS.single('file');
