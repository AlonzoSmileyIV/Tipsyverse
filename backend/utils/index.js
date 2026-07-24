/*
UTILS — central barrel for helpers reused across the app.

Sections:
- Validation & Formatting
- Dates & Time (UTC / local)
- Auth Tokens
- Content & Identity Utilities
- Media (uploads / cloud)
- Notifications & Email
- Activity Logging & Audit
- Access Control & Bulk Ops
- Diffs & Snapshots (Auditing)
- Transactions & Errors
- Realtime (Sockets)
- Data Export
- Cleanup & Destructive Ops
*/

/////////////////////////////
// Validation & Formatting //
/////////////////////////////
import { formatSlug } from "./libs/formatSlug.js";
import { abbreviateNumber } from "./libs/abbreviateNumber.js";
import generateUsernameSuggestions from "./libs/generateUsernameSuggestions.js";
import validateDate from "./libs/validateDate.js";
import validateEmail from "./libs/validateEmail.js";
import validatePassword from "./libs/validatePassword.js";
import validatePhone from "./libs/validatePhone.js";
import ageHelper from "./libs/ageHelper.js";
import { renameUserAllergies } from "./libs/renameUserAllergies.js";
import { maskEventForBoard } from "./libs/maskEventForBoard.js";
import { normalizeContact } from "./libs/normalizeContact.js";
import { normalizeLocation } from "./libs/normalizeLocation.js";
import { calcTotals, calcDeposit } from "./libs/money.js";
import { isUrgentEvent } from "./libs/isUrgentEvent.js";
import {
  lookupCoupon,
  applyCouponToTotal,
  calcDepositWithCoupon,
} from "./libs/coupons.js";
import computeEventTotals from "./libs/pricing.js";
import { pmLabel } from "./libs/pmLabel.js";
import { actorFromReq } from "./libs/actorFromReq.js";
import {
  displayEventType,
  displayLabel,
  displayPaymentType,
  displayStatus,
} from "./libs/displayLabel.js";

//////////////////////
// Dates & Time UTC //
//////////////////////
// FIX: filename typo toLocateDateOnly -> toLocalDateOnly
import toLocalDateOnly from "./libs/toLocalDateOnly.js";
import { addMonthsUTC, formatUTC, startOfUTCDay } from "./libs/utcDate.js";
import { startOfToday } from "./libs/startOfToday.js";
import {
  calculateAgeFromDateOnly,
  formatDateTime,
  formatDateTimeWithZones,
  isAtLeastAge,
  isValidDateOnly,
  parseDateOnlyParts,
} from "./libs/dateTime.js";

///////////////
// Auth JWTs //
///////////////
import createAccessToken from "./libs/createAccessToken.js";
import createRefreshToken from "./libs/createRefreshToken.js";

/////////////////////////////
// Media (uploads / cloud) //
/////////////////////////////
import {
  cloudinary,
  handleImageUpload,
  handleVideoUpload,
  uploadImage,
  uploadVideo,
} from "../middleware/index.js";

//////////////////////////////
// Notifications & Email    //
//////////////////////////////
import sendEmail from "./libs/sendEmail.js";
import sendNotification from "./libs/sendNotification.js";
import {
  BARTENDER_REWARD_MILESTONES,
  buildRewardProgress,
  getCompletedBartenderEventsCount,
} from "./libs/bartenderRewards.js";
import { paymentReceiptHTML } from "./libs/paymentReceiptHTML.js";
import { generateInvoicePDF } from "./libs/generateInvoicePDF.js";
import buildEventUpdatedEmail from './libs/buildEventUpdatedEmail.js';

////////////////////////////////
// Activity Logging & Audit   //
////////////////////////////////
import { logActivity } from "./libs/logActivity.js";
import { makeBulkActivityLogger } from "./libs/makeBulkActivityLogger.js";

/////////////////////////////////////
// Access Control & Bulk Ops       //
/////////////////////////////////////
import {
  canManage,
  idxOf,
  rowHasStatusChange,
  validateOwnerReportTo,
} from "./libs/canManage.js";

////////////////////////////////////
// Diffs & Snapshots (Auditing)   //
////////////////////////////////////
import { diffFields } from "./libs/diffFields.js";
import { shallowDiff, setDiff } from "./libs/shallowDiff.js";
import { snapshotEmployeeForAudit } from "./libs/snapshotUserForAudit.js";
import { makeIdToEmailMap } from "./libs/makeIdToEmailMap.js";

/////////////////////////////
// Transactions & Errors   //
/////////////////////////////
import { withTxnRetry } from "./libs/withTxnRetry.js";
import errorHandler from "./libs/errorHandler.js";

/////////////////////////
// Realtime (Sockets)  //
/////////////////////////
import initializeSocket from "./libs/initializeSocket.js";

////////////////
// Data Export //
////////////////
import { exportErrorExcel } from "./libs/exportErrorExcel.js";

///////////////////////////////
// Cleanup & Destructive Ops //
///////////////////////////////
import clearUploadsFolder from "./libs/clearUploadsFolder.js";
import { deleteSingleCommentKeepChildren } from "./libs/deleteSingleCommentKeepChildren.js";
import { deleteUserHandler } from "./libs/deleteUserHandler.js";

///////////////////////////////////////
// Username Utilities (Identity)     //
///////////////////////////////////////
import {
  allocateUniqueUsername,
  findAvailableUsernames,
  baseUsernameSeeds,
  normalizeUsername,
} from "./libs/username.js";

///////////////////////////////////////
// Bartender profile                 //
///////////////////////////////////////
import { computeLicenseStatus } from "./libs/computeLicenseStatus.js";
import { formatLicenseForResponse } from "./libs/formatLicenseForResponse.js";

export { default as createAccessToken } from "./libs/createAccessToken.js";
export { default as createRefreshToken } from "./libs/createRefreshToken.js";
export {
  // Validation & Formatting
  ageHelper,
  abbreviateNumber,
  formatSlug,
  generateUsernameSuggestions,
  validateDate,
  validateEmail,
  validatePassword,
  validatePhone,
  renameUserAllergies,
  normalizeContact,
  normalizeLocation,
  isUrgentEvent,
  lookupCoupon,
  applyCouponToTotal,
  calcDepositWithCoupon,
  maskEventForBoard,

  // Money
  calcTotals,
  calcDeposit,

  // Dates & Time
  addMonthsUTC,
  calculateAgeFromDateOnly,
  formatDateTime,
  formatDateTimeWithZones,
  formatUTC,
  isAtLeastAge,
  isValidDateOnly,
  parseDateOnlyParts,
  startOfUTCDay,
  toLocalDateOnly,
  startOfToday,

  // Auth Tokens
  //createAccessToken,
  //createRefreshToken,

  // Media
  cloudinary,
  handleImageUpload,
  handleVideoUpload,
  uploadImage,
  uploadVideo,

  // Notifications & Email
  sendEmail,
  sendNotification,
  BARTENDER_REWARD_MILESTONES,
  buildRewardProgress,
  getCompletedBartenderEventsCount,
  paymentReceiptHTML,
  generateInvoicePDF,
  buildEventUpdatedEmail,

  // Activity Logging & Audit
  logActivity,
  makeBulkActivityLogger,

  // Access Control & Bulk Ops
  canManage,
  idxOf,
  rowHasStatusChange,
  validateOwnerReportTo,

  // Diffs & Snapshots
  diffFields,
  setDiff,
  shallowDiff,
  snapshotEmployeeForAudit,
  makeIdToEmailMap,
  computeEventTotals,

  // Transactions & Errors
  errorHandler,
  withTxnRetry,

  // Realtime
  initializeSocket,

  // Data Export
  exportErrorExcel,

  // Cleanup & Destructive Ops
  clearUploadsFolder,
  deleteSingleCommentKeepChildren,
  deleteUserHandler,

  // Identity / Username helpers
  allocateUniqueUsername,
  findAvailableUsernames,
  baseUsernameSeeds,
  normalizeUsername,
  pmLabel, 
  actorFromReq,
  displayEventType,
  displayLabel,
  displayPaymentType,
  displayStatus,

  // Bartender info
  computeLicenseStatus,
  formatLicenseForResponse
};
