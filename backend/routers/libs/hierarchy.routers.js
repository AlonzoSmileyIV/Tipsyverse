import { Router } from "express";
import { hierarchyCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel } from "../../middleware/index.js";

const hierarchyRouter = Router();

hierarchyRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), hierarchyCtrl.bulkHierarchyHandler);

// CREATE
hierarchyRouter.post('/create', auth, authEmployee, hierarchyCtrl.createHierarchy);

// READ
hierarchyRouter.get('/', hierarchyCtrl.viewAllHierarchies);
hierarchyRouter.get('/:id', hierarchyCtrl.viewHierarchy);
// UPDATE
hierarchyRouter.put('/:id', auth, authEmployee, hierarchyCtrl.updateHierarchy);

// DELETE
hierarchyRouter.delete('/:id', auth, authEmployee, hierarchyCtrl.deleteHierarchy);

export default hierarchyRouter;
