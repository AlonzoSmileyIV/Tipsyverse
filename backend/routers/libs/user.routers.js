import { Router } from "express";
import { userCtrl } from "../../controllers/index.js";
import { uploadImage } from "../../utils/index.js";
import {
  auth,
  authEmployee,
  createRateLimit,
  dedupeSuccessfulRequests,
  optionalAuth,
  uploadExcel,
} from "../../middleware/index.js";


const userRouter = Router();
const authLimit = createRateLimit({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: "Too many sign-in or account requests. Please wait a few minutes and try again.",
});
const passwordResetLimit = createRateLimit({
  keyPrefix: "password-reset",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests. Please wait a few minutes and try again.",
});
const bookingEligibilityLimit = createRateLimit({
  keyPrefix: "booking-eligibility",
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many booking eligibility checks. Please wait a few minutes and try again.",
});
const userActionDedupe = dedupeSuccessfulRequests({ ttlMs: 30 * 1000 });

// -------- BULK --------
userRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), userCtrl.bulkEmployeeBulker);


userRouter.get('/me', auth, userCtrl.getMyInfo);
userRouter.get("/me/bartender-info", auth, userCtrl.getMyBartendingInfo);
userRouter.get("/me/requirements", auth, userCtrl.getMyRoleRequirements);
userRouter.get("/bartenders", auth, authEmployee, userCtrl.viewAllBartenders);
// 🔹 BARTENDER LICENSES (admin/employee view)
userRouter.get(
  "/admin/licenses",
  auth,
  authEmployee,
  userCtrl.listBartenderLicensesForAdmin
);

// -------- BARTENDER LICENSES --------

// Bartender: create new license
userRouter.post("/me/licenses", auth, userCtrl.createMyLicense);

// Bartender: view ONE of their own licenses
userRouter.get("/me/licenses/:licenseId", auth, userCtrl.getLicenseById);

// Bartender: update own license
userRouter.patch("/me/licenses/:licenseId", auth, userCtrl.updateMyLicense);

// Bartender: get current location
userRouter.patch("/me/bartender/location", auth, userCtrl.updateCurrentLocation);
userRouter.patch("/me/bartender/payout-links", auth, userCtrl.updateMyPayoutLinks);
userRouter.patch("/me/bartender/contact-info", auth, userCtrl.updateMyBartenderContactInfo);

// Bartender: delete own license
userRouter.delete("/me/licenses/:licenseId", auth, userCtrl.deleteMyLicense);

// Employee/Admin: view ANY license
userRouter.get(
  "/licenses/:licenseId",
  auth, authEmployee,
  userCtrl.getLicenseById
);

// Employee/Admin: view ANY bartenders info
userRouter.get(
  "/bartenders/:bartenderId",
  auth, authEmployee,
  userCtrl.viewBartenderById
);

// Employee/Admin: update approved or denied status to Bartender profile
userRouter.post("/bartenders/:userId/profile/decision", auth, authEmployee, userCtrl.reviewBartenderProfileForAdmin);
userRouter.patch(
  "/bartenders/:userId/compensation",
  auth,
  authEmployee,
  userCtrl.updateBartenderCompensationForAdmin
);

// Employee/Admin: onboarding document tracking and request email
userRouter.patch(
  "/bartenders/:userId/documents/:documentKey",
  auth,
  authEmployee,
  userCtrl.updateBartenderOnboardingDocumentForAdmin
);
userRouter.post(
  "/bartenders/:userId/documents/send-all",
  auth,
  authEmployee,
  userCtrl.sendBartenderOnboardingDocumentsForAdmin
);
userRouter.post(
  "/bartenders/:userId/documents/request-email",
  auth,
  authEmployee,
  userCtrl.sendBartenderOnboardingDocumentsForAdmin
);




// Employee/Admin: approve/deny license
userRouter.patch(
  "/:userId/licenses/:licenseId/decision",
  auth,
  authEmployee,
  userCtrl.reviewLicenseForAdmin
);


// -------- AUTH --------
userRouter.post('/login', authLimit, userCtrl.login);
userRouter.post('/logout', optionalAuth, userCtrl.logout);
userRouter.post('/refresh-token', userCtrl.refreshToken);



// -------- CREATE --------
userRouter.post('/register', authLimit, optionalAuth, userCtrl.registerUser);



// -------- PASSWORD RESET --------
userRouter.post('/forgot-password', passwordResetLimit, userCtrl.forgotPassword);
userRouter.post('/reset-password', passwordResetLimit, userCtrl.resetPassword);
userRouter.put('/update-password', auth, userCtrl.updatePassword);
userRouter.patch("/me/username", auth, userCtrl.updateMyUsername);



// -------- READ --------
userRouter.get('/', userCtrl.viewAllUsers);
userRouter.get('/regulars', userCtrl.viewAllRegulars);
userRouter.get('/employees', userCtrl.viewAllEmployees);
userRouter.get('/employees/not-reporting', userCtrl.viewEmployeesNotReporting);
userRouter.get('/booking-eligibility', bookingEligibilityLimit, userCtrl.checkBookingEligibility);
userRouter.get('/:id', userCtrl.viewUser);



// -------- UPDATE --------
userRouter.put('/update-profile', auth, userCtrl.updateProfile);
userRouter.put('/update-preferences', auth, userCtrl.updatePreferences);
userRouter.post('/deactivate', auth, userCtrl.deactivateUser);
userRouter.patch('/me/turn-off-tutorial', auth, userCtrl.turnOffTutorial);
userRouter.post('/me/delete', auth, userCtrl.deleteMyAccount);

userRouter.put('/:id', auth, userCtrl.updateUser);
userRouter.post('/upload-image', uploadImage.single('photo'), auth, userCtrl.uploadUserPhoto);
userRouter.post('/:id/suspend', auth, authEmployee, userActionDedupe, userCtrl.suspendUser);
userRouter.post('/:id/unsuspend', auth, authEmployee, userActionDedupe, userCtrl.unsuspendUser);
userRouter.put('/:id/terminate', auth, authEmployee, userCtrl.terminateEmployee);



// -------- DELETE --------
userRouter.delete("/:id/delete", auth, userCtrl.deleteUserPermanently);


export default userRouter;
