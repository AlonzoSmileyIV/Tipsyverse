/**
 * Load SheetJS only when a user starts an import or export.
 *
 * Centralizing this dynamic import gives Vite one reusable spreadsheet chunk
 * instead of including the library in every admin screen.
 */
export const loadSpreadsheet = () => import("xlsx");
