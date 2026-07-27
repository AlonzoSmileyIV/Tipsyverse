// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from "crypto";

const env = (process.env.NODE_ENV || "development").toLowerCase();

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_IMAGE_SIZE_MB = 2;
const MAX_VIDEO_SIZE_MB = 50;

const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const validImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const validVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const validVideoMimeTypes = new Set([
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'
]);



const getFileSizeMB = (filePath) => {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024); // Convert bytes to MB
};

const readHeader = (filePath, length = 16) => {
    const fd = fs.openSync(filePath, "r");
    try {
        const header = Buffer.alloc(length);
        fs.readSync(fd, header, 0, length, 0);
        return header;
    } finally {
        fs.closeSync(fd);
    }
};

const hasImageSignature = (filePath) => {
    const header = readHeader(filePath);
    return (
        (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
        header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
        ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii")) ||
        (header.subarray(0, 4).toString("ascii") === "RIFF" &&
            header.subarray(8, 12).toString("ascii") === "WEBP")
    );
};

const hasVideoSignature = (filePath) => {
    const header = readHeader(filePath);
    const boxType = header.subarray(4, 12).toString("ascii");
    return (
        boxType.includes("ftyp") ||
        (header.subarray(0, 4).toString("ascii") === "RIFF" &&
            header.subarray(8, 12).toString("ascii") === "AVI ") ||
        header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    );
};

const rejectLocalFile = (filePath, message) => {
    try {
        fs.unlinkSync(filePath);
    } catch {
        // The periodic cleanup may already have removed it.
    }
    throw new Error(message);
};

// ========== IMAGE MULTER MIDDLEWARE ==========
const imageStorage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, `${crypto.randomUUID()}-${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    }
});


const imageFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validImageExtensions.includes(ext) || !validImageMimeTypes.has(file.mimetype)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
    fileFilter: imageFileFilter,
});

// ========== VIDEO MULTER MIDDLEWARE ==========
const videoStorage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, `${crypto.randomUUID()}-${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    }
});

const videoFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validVideoExtensions.includes(ext) || !validVideoMimeTypes.has(file.mimetype)) {
        return cb(new Error('Only video files are allowed!'), false);
    }
    cb(null, true);
};

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
    fileFilter: videoFileFilter,
});


// ========== CLOUDINARY UPLOAD FUNCTIONS ==========
// Direct upload handler for local file path (not using multer storage)
const handleImageUpload = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const sizeMB = getFileSizeMB(filePath);

    if (!validImageExtensions.includes(ext)) {
        rejectLocalFile(filePath, `Invalid image file type: ${ext}`);
    }
    if (!hasImageSignature(filePath)) {
        rejectLocalFile(filePath, "Uploaded image contents do not match a supported image format.");
    }

    if (sizeMB > MAX_IMAGE_SIZE_MB) {
        rejectLocalFile(filePath, `Image file is too large. Max size is ${MAX_IMAGE_SIZE_MB}MB`);
    }

    try {
        const res = await cloudinary.uploader.upload(filePath, {
            folder: `${env}/images`,
            resource_type: 'image'
        });
        return res;
    } catch (error) {
        rejectLocalFile(filePath, `Image upload failed: ${error.message}`);
    }
};

const handleVideoUpload = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const sizeMB = getFileSizeMB(filePath);

    if (!validVideoExtensions.includes(ext)) {
        rejectLocalFile(filePath, `Invalid video file type: ${ext}`);
    }
    if (!hasVideoSignature(filePath)) {
        rejectLocalFile(filePath, "Uploaded video contents do not match a supported video format.");
    }

    if (sizeMB > MAX_VIDEO_SIZE_MB) {
        rejectLocalFile(filePath, `Video file is too large. Max size is ${MAX_VIDEO_SIZE_MB}MB`);
    }
    try {
        const res = await cloudinary.uploader.upload(filePath, {
            folder: `${env}/videos`,
            resource_type: 'video'
        });
        return res;
    } catch (error) {
        rejectLocalFile(filePath, `Video upload failed: ${error.message}`);
    }
};

export {
    cloudinary,
    uploadImage,
    handleImageUpload,
    uploadVideo,
    handleVideoUpload,


};
