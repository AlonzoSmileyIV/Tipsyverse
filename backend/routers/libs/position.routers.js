import { Router } from "express";
import { positionCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel } from "../../middleware/index.js";

const positionRouter = Router();

positionRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), positionCtrl.bulkPositionHandler);

// CREATE
positionRouter.post('/create', auth, authEmployee, positionCtrl.createPosition);

// READ
positionRouter.get('/', positionCtrl.viewAllPositions);
positionRouter.get('/:id', positionCtrl.viewPosition);

// UPDATE
positionRouter.put('/:id', auth, authEmployee, positionCtrl.updatePosition);

// DELETE
positionRouter.delete('/:id', auth, authEmployee, positionCtrl.deletePosition);

export default positionRouter;