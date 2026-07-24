 import XLSX from "xlsx";

/**
 * Generates an Excel file buffer from error rows for immediate download.
 * @param {Array} errorRows - The array of error objects to convert.
 * @returns {Buffer} - Excel file buffer.
 */
export const exportErrorExcel = (errorRows) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(errorRows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Errors");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};
