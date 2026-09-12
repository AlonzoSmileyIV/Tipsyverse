// Middleware import barrel. Ordering in a router matters: authenticate before
// authorizing, validate before side effects, and apply idempotency before a
// retryable mutation reaches its controller.

import { auth } from "./libs/auth.middleware.js";
import { optionalAuth } from "./libs/optionalAuth.middleware.js";
import { authEmployee } from "./libs/authEmployee.middleware.js";
import { authBartender } from "./libs/authBartender.middleware.js";
import { authManager } from "./libs/authManager.middleware.js";
import { uploadExcel } from "./libs/uploadExcel.middleware.js";
import { ensureAnonId } from "./libs/anonId.middleware.js";
import { attachLogActivity } from "./libs/attachLogActivity.middleware.js";
import { createRateLimit } from "./libs/rateLimit.middleware.js";
import { dedupeSuccessfulRequests, requireIdempotencyKey } from "./libs/idempotency.middleware.js";
import { handleImageUpload, handleVideoUpload, uploadComplianceDocument, uploadImage, uploadVideo, cloudinary } from "./libs/cloudinary.middleware.js";
import {
  schemas,
  validateBody,
  validateWriteBody,
} from "./libs/validateRequest.middleware.js";


export { auth, optionalAuth, authEmployee, authManager, authBartender, ensureAnonId, attachLogActivity, createRateLimit, dedupeSuccessfulRequests, requireIdempotencyKey, handleImageUpload, handleVideoUpload, uploadComplianceDocument, uploadImage, uploadVideo, cloudinary, uploadExcel, schemas, validateBody, validateWriteBody };
