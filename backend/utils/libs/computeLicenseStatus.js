import { startOfToday } from "../index.js";

export function computeLicenseStatus(license) {
  // Prefer stored status if present
  if (license.status) return license.status;

  const today = startOfToday();

  if (license.verified) {
    if (license.expiresAt && new Date(license.expiresAt) < today) {
      return "expired";
    }
    return "active";
  }

  // no explicit denied flag in older docs => treat as pending
  return "pending";
}
