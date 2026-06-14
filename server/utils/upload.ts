import path from 'path';
import multer from 'multer';

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/receipts'));
  },
  filename: (req, file, cb) => {
    // Sanitize file names
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, suffix + path.extname(file.originalname));
  }
});

export const uploader = multer({ storage: fileStorage });
