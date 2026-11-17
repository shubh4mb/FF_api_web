import multer from 'multer';

// File filter
const fileFilter = (req, file, cb) => {
    // Accept standard web images, mobile camera formats (heic/heif), and PDFs
    const allowedMimes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
        'application/octet-stream', // Some mobile browsers send HEIC/camera blobs as octet-stream
        'application/pdf'
    ];
    
    // Also check extension if mimetype is ambiguous (like application/octet-stream)
    const isImageExt = /\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i.test(file.originalname || '');

    if (allowedMimes.includes(file.mimetype) || isImageExt) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images (jpg, jpeg, png, gif, webp, heic) and PDF files are allowed.'), false);
    }
};

// Create multer instance with error handling
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max-limit
        files: 11 // Maximum 11 files 
    }
});

// Error handling middleware
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        return res.status(400).json({
            message: `Upload error: ${err.message}`
        });
    } else if (err) {
        console.error("Unknown upload error:", err);
        return res.status(500).json({
            message: `Unknown upload error: ${err.message}`
        });
    }
    next();
};


export default upload;
