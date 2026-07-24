// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import dotenv from "dotenv";

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
const validVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];



const getFileSizeMB = (filePath) => {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024); // Convert bytes to MB
};

// ========== IMAGE MULTER MIDDLEWARE ==========
const imageStorage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});


const imageFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validImageExtensions.includes(ext)) {
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
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const videoFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validVideoExtensions.includes(ext)) {
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
        throw new Error(`Invalid image file type: ${ext}`);
    }

    if (sizeMB > MAX_IMAGE_SIZE_MB) {
        throw new Error(`Image file is too large. Max size is ${MAX_IMAGE_SIZE_MB}MB`);
    }

    try {
        const res = await cloudinary.uploader.upload(filePath, {
            folder: `${env}/images`,
            resource_type: 'image'
        });
        return res;
    } catch (error) {
        throw new Error(`Image upload failed: ${error.message}`);
    }
};

const handleVideoUpload = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const sizeMB = getFileSizeMB(filePath);

    if (!validVideoExtensions.includes(ext)) {
        throw new Error(`Invalid video file type: ${ext}`);
    }

    if (sizeMB > MAX_VIDEO_SIZE_MB) {
        throw new Error(`Video file is too large. Max size is ${MAX_VIDEO_SIZE_MB}MB`);
    }
    try {
        const res = await cloudinary.uploader.upload(filePath, {
            folder: `${env}/videos`,
            resource_type: 'video'
        });
        return res;
    } catch (error) {
        throw new Error(`Video upload failed: ${error.message}`);
    }
};

export {
    cloudinary,
    uploadImage,
    handleImageUpload,
    uploadVideo,
    handleVideoUpload,


};
