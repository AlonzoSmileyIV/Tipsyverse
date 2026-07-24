import multer from "multer";

const storage = multer.memoryStorage(); // Store file in memory for XLSX parsing
export const uploadExcel = multer({ storage });
