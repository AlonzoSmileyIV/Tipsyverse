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

supportTicketRouter.post("/", auth, supportTicketLimit, supportDedupe, supportTicketCtrl.createTicket);
supportTicketRouter.post("/upload-images", auth, supportTicketLimit, uploadImage.array("photos", 8), supportTicketCtrl.uploadImages);
supportTicketRouter.get("/", auth, supportTicketCtrl.viewTickets);
supportTicketRouter.get("/:id", auth, supportTicketCtrl.viewTicketById);
supportTicketRouter.patch("/:id/my", auth, supportTicketCtrl.updateMyTicket);
supportTicketRouter.patch("/:id/cancel", auth, supportTicketCtrl.cancelMyTicket);
supportTicketRouter.patch("/:id/reopen", auth, supportTicketCtrl.reopenMyTicket);
supportTicketRouter.patch("/:id/assign", auth, authEmployee, supportTicketCtrl.assignTicket);
supportTicketRouter.patch("/:id", auth, authEmployee, supportTicketCtrl.updateTicket);
supportTicketRouter.post("/:id/messages", auth, supportTicketLimit, supportDedupe, supportTicketCtrl.addMessage);
supportTicketRouter.delete("/:id", auth, authEmployee, supportTicketCtrl.deleteTicket);

export default supportTicketRouter;
