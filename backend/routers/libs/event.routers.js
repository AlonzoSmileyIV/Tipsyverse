import { Router } from "express";
import { eventCtrl } from "../../controllers/index.js";
import { auth, authBartender, authEmployee, optionalAuth, uploadImage } from "../../middleware/index.js";

const eventRouter = Router();

// Public/new submission (keep requireAuth if your flow needs it)
eventRouter.post('/', optionalAuth, eventCtrl.submitRequest);

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
eventRouter.post('/:id/send-invoice', auth, authEmployee, eventCtrl.sendCurrentInvoice);
eventRouter.post('/:id/procurement-receipt', auth, authEmployee, uploadImage.single('photo'), eventCtrl.uploadProcurementReceipt);
eventRouter.post('/:id/contact-attempts', auth, authEmployee, eventCtrl.logContactAttempt);
eventRouter.post('/:id/send-to-assign', auth, authEmployee, eventCtrl.sendToAssign);
eventRouter.post('/:id/assign-bartenders', auth, authEmployee, eventCtrl.assignSelectedBartenders);
eventRouter.post('/:id/remove-bartenders', auth, eventCtrl.removeAssignedBartenders);
eventRouter.post('/:id/cancel', auth, eventCtrl.cancelRequest);

export default eventRouter;
