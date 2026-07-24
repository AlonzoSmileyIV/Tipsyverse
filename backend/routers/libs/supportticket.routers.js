import { Router } from "express";
import { supportTicketCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadImage } from "../../middleware/index.js";

const supportTicketRouter = Router();

supportTicketRouter.post("/", auth, supportTicketCtrl.createTicket);
supportTicketRouter.post("/upload-images", auth, uploadImage.array("photos", 8), supportTicketCtrl.uploadImages);
supportTicketRouter.get("/", auth, supportTicketCtrl.viewTickets);
supportTicketRouter.get("/:id", auth, supportTicketCtrl.viewTicketById);
supportTicketRouter.patch("/:id/my", auth, supportTicketCtrl.updateMyTicket);
supportTicketRouter.patch("/:id/cancel", auth, supportTicketCtrl.cancelMyTicket);
supportTicketRouter.patch("/:id/reopen", auth, supportTicketCtrl.reopenMyTicket);
supportTicketRouter.patch("/:id/assign", auth, authEmployee, supportTicketCtrl.assignTicket);
supportTicketRouter.patch("/:id", auth, authEmployee, supportTicketCtrl.updateTicket);
supportTicketRouter.post("/:id/messages", auth, supportTicketCtrl.addMessage);
supportTicketRouter.delete("/:id", auth, authEmployee, supportTicketCtrl.deleteTicket);

export default supportTicketRouter;
