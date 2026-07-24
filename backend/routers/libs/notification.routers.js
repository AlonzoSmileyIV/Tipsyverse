import { Router } from "express";
import { notificationCtrl } from "../../controllers/index.js";
import { auth } from "../../middleware/index.js";

const notificationRouter = Router();

notificationRouter.get('/', auth, notificationCtrl.findNotificationsByUserId);
notificationRouter.get('/:id', auth, notificationCtrl.findNotificationById);
notificationRouter.patch('/:id/read', auth, notificationCtrl.toggleReadStatus);
notificationRouter.patch('/mark-all', auth, notificationCtrl.toggleMarkAllAsReadOrUnread);
notificationRouter.delete('/:id', auth, notificationCtrl.deleteNotificationForUser);
notificationRouter.delete("/", auth, notificationCtrl.deleteAllNotificationsForUser);


export default notificationRouter;