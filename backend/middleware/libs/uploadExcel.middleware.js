import multer from "multer";
import path from "path";

const storage = multer.memoryStorage(); // Store file in memory for XLSX parsing
const allowedExcelExtensions = new Set([".xlsx", ".xls"]);
const allowedExcelMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExcelExtensions.has(extension) || !allowedExcelMimeTypes.has(file.mimetype)) {
      return cb(new Error("Only Excel .xlsx or .xls files are allowed."));
    }
    return cb(null, true);
  },
});
