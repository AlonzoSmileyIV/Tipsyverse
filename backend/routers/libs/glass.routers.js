import { Router } from "express";
import { glassCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel } from "../../middleware/index.js";

const glassRouter = Router();

glassRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), glassCtrl.bulkGlassHandler);

glassRouter.post('/create', auth, authEmployee, glassCtrl.createGlass);

glassRouter.get('/', glassCtrl.viewAllGlasses);
glassRouter.get('/:id', glassCtrl.viewGlass);

glassRouter.put('/:id', auth, authEmployee, glassCtrl.updateGlass);

glassRouter.delete('/:id', auth, authEmployee, glassCtrl.deleteGlass);

export default glassRouter;