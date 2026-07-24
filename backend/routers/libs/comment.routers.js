import { Router } from "express";
import { commentCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const commentRouter = Router();

commentRouter.post('/create', auth, commentCtrl.addComment);

commentRouter.patch('/:id', auth, commentCtrl.editComment);

commentRouter.get("/:commentId/report", auth, commentCtrl.getCommentReport);

commentRouter.patch('/:commentId/like', auth, commentCtrl.toggleLikeComment);

commentRouter.get('/reported', auth, authEmployee, commentCtrl.getReportedComments);

commentRouter.post('/:commentId/report', auth, commentCtrl.addReportToComment);

commentRouter.post('/:commentId/reportAction', auth, authEmployee, commentCtrl.handleReportAction);

commentRouter.post('/:parentId/reply', auth, commentCtrl.replyToComment);

commentRouter.delete('/:id', auth, commentCtrl.deleteComment);

// ✅ Move this last to avoid swallowing /reported or others
commentRouter.get('/:drinkId', auth, commentCtrl.getCommentsByDrink);


export default commentRouter;

