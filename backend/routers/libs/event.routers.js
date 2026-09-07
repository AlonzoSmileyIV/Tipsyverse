import { Router } from "express";
import { eventCtrl } from "../../controllers/index.js";
import {
  auth,
  authBartender,
  authEmployee,
  createRateLimit,
  dedupeSuccessfulRequests,
  optionalAuth,
  uploadImage,
} from "../../middleware/index.js";

const eventRouter = Router();
const publicBookingLimit = createRateLimit({
  keyPrefix: "events:create",
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many event requests. Please wait a few minutes and try again.",
});
const sensitiveActionDedupe = dedupeSuccessfulRequests({ ttlMs: 45 * 1000 });
const timezoneLookupLimit = createRateLimit({
  keyPrefix: "events:timezone",
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many timezone lookups. Please wait a moment and try again.",
});

// Public/new submission (keep requireAuth if your flow needs it)
eventRouter.post('/', publicBookingLimit, optionalAuth, sensitiveActionDedupe, eventCtrl.submitRequest);
eventRouter.get('/timezone', timezoneLookupLimit, eventCtrl.resolveVenueTimezone);

eventRouter.get('/', auth, authEmployee, eventCtrl.viewAllEvents);

// Staff/bartender (protected)
eventRouter.get('/available', auth, authBartender, eventCtrl.viewAvailableEvents);

eventRouter.get('/assigned', auth, authBartender, eventCtrl.viewMyAssignedEvents);

eventRouter.get('/mine', auth, eventCtrl.viewMyEvents);

eventRouter.get('/counts', optionalAuth, eventCtrl.getEventCounts);
eventRouter.post('/reminders/run', auth, authEmployee, eventCtrl.sendDueEventReminders);

// Lookups
eventRouter.get('/:id', auth, eventCtrl.viewEventById);
// Mutations (staff-only)
eventRouter.patch('/:id', auth, authEmployee, eventCtrl.updateEvent);
eventRouter.post('/:id/send-invoice', auth, authEmployee, sensitiveActionDedupe, eventCtrl.sendCurrentInvoice);
eventRouter.post('/:id/procurement-receipt', auth, authEmployee, uploadImage.single('photo'), eventCtrl.uploadProcurementReceipt);
eventRouter.post('/:id/contact-attempts', auth, authEmployee, eventCtrl.logContactAttempt);
eventRouter.post('/:id/send-to-assign', auth, authEmployee, sensitiveActionDedupe, eventCtrl.sendToAssign);
eventRouter.post('/:id/payment-policy/resolve', auth, authEmployee, sensitiveActionDedupe, eventCtrl.resolvePaymentPolicy);
eventRouter.post('/:id/assign-bartenders', auth, authEmployee, sensitiveActionDedupe, eventCtrl.assignSelectedBartenders);
eventRouter.post('/:id/remove-bartenders', auth, authEmployee, eventCtrl.removeAssignedBartenders);
eventRouter.post('/:id/cancel', auth, sensitiveActionDedupe, eventCtrl.cancelRequest);

export default eventRouter;
