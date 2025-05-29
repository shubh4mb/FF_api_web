import multer from 'multer';

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images only
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only jpg, jpeg, png and gif image files are allowed.'), false);
    }
};

// Create multer instance with error handling
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max-limit
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
