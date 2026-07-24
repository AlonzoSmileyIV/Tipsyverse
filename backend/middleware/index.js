/* 
MIDDLEWARE - Holds middleware functions, which process requests between the client and the server.

Contents:
-Middleware for authentication (e.g., verifying JWT tokens).
-Error-handling middleware to catch and format errors.
-Middleware for request validation (e.g., validating input data).
*/

import { auth } from "./libs/auth.middleware.js";
import { optionalAuth } from "./libs/optionalAuth.middleware.js";
import { authEmployee } from "./libs/authEmployee.middleware.js";
import { authBartender } from "./libs/authBartender.middleware.js";
import { uploadExcel } from "./libs/uploadExcel.middleware.js";
import { ensureAnonId } from "./libs/anonId.middleware.js";
import { attachLogActivity } from "./libs/attachLogActivity.middleware.js";
import { handleImageUpload, handleVideoUpload, uploadImage, uploadVideo, cloudinary } from "./libs/cloudinary.middleware.js";


export { auth, optionalAuth, authEmployee, authBartender, ensureAnonId, attachLogActivity, handleImageUpload, handleVideoUpload, uploadImage, uploadVideo, cloudinary, uploadExcel };