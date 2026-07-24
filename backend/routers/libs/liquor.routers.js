import { Router } from "express";
import { liquorCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel, uploadImage } from "../../middleware/index.js";

const liquorRouter = Router();


liquorRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), liquorCtrl.bulkLiquorHandler);

liquorRouter.post('/create', auth, authEmployee, liquorCtrl.createLiquor);
liquorRouter.put('/update-photo/:id', auth, authEmployee, uploadImage.single('photo'),liquorCtrl.updateLiquorPhoto);

liquorRouter.get('/', liquorCtrl.viewAllLiquors);
liquorRouter.get('/:id', liquorCtrl.viewLiquor);

liquorRouter.put('/:id', auth, authEmployee, liquorCtrl.updateLiquor);

liquorRouter.delete('/:id', auth, authEmployee, liquorCtrl.deleteLiquor);

export default liquorRouter;