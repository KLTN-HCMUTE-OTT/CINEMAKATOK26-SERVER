import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../../tmp');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = new Set([
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/matroska',
      'application/x-matroska',
      'video/webm',
      'video/mkv',
      'application/octet-stream',
    ]);
    const allowedExtensions = new Set([
      '.mp4',
      '.mpeg',
      '.mpg',
      '.mov',
      '.avi',
      '.mkv',
      '.webm',
    ]);

    const mimetype = (file.mimetype || '').toLowerCase();
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.has(mimetype) && allowedExtensions.has(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Only video files are allowed. Received mimetype=${mimetype}, extension=${extension}`,
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,
  },
};
