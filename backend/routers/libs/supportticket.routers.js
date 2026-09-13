import { Router } from "express";
import { supportTicketCtrl } from "../../controllers/index.js";
import {
  auth,
  authEmployee,
  createRateLimit,
  dedupeSuccessfulRequests,
  uploadImage,
} from "../../middleware/index.js";

const supportTicketRouter = Router();
const supportTicketLimit = createRateLimit({
  keyPrefix: "support-tickets",
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many support ticket actions. Please wait a few minutes and try again.",
});
const supportDedupe = dedupeSuccessfulRequests({ ttlMs: 30 * 1000 });
const anonymousErrorReportLimit = createRateLimit({
  keyPrefix: "anonymous-error-reports",
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many error reports. Please wait before trying again.",
});

supportTicketRouter.post("/error-report", anonymousErrorReportLimit, supportTicketCtrl.createAnonymousErrorTicket);
supportTicketRouter.post("/", auth, supportTicketLimit, supportDedupe, supportTicketCtrl.createTicket);
supportTicketRouter.post("/upload-images", auth, supportTicketLimit, uploadImage.array("photos", 8), supportTicketCtrl.uploadImages);
supportTicketRouter.get("/", auth, supportTicketCtrl.viewTickets);
supportTicketRouter.get("/:id", auth, supportTicketCtrl.viewTicketById);
supportTicketRouter.patch("/:id/my", auth, supportTicketCtrl.updateMyTicket);
supportTicketRouter.patch("/:id/cancel", auth, supportTicketCtrl.cancelMyTicket);
supportTicketRouter.patch("/:id/reopen", auth, supportTicketCtrl.reopenMyTicket);
supportTicketRouter.patch("/:id/assign", auth, authEmployee, supportTicketCtrl.assignTicket);
supportTicketRouter.post("/:id/notes", auth, authEmployee, supportTicketCtrl.addNote);
supportTicketRouter.patch("/:id/notes/:noteId", auth, authEmployee, supportTicketCtrl.updateNote);
supportTicketRouter.delete("/:id/notes/:noteId", auth, authEmployee, supportTicketCtrl.deleteNote);
supportTicketRouter.patch("/:id", auth, authEmployee, supportTicketCtrl.updateTicket);
supportTicketRouter.post("/:id/messages", auth, supportTicketLimit, supportDedupe, supportTicketCtrl.addMessage);
supportTicketRouter.delete("/:id", auth, authEmployee, supportTicketCtrl.deleteTicket);

export default supportTicketRouter;
