import { Router } from "express";
import { departmentCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel } from "../../middleware/index.js";

const departmentRouter = Router();

departmentRouter.post('/bulk', auth, authEmployee, uploadExcel.single('file'), departmentCtrl.bulkDepartmentHandler);

// -------- REGISTER / CREATE --------
departmentRouter.post('/create', auth, authEmployee, departmentCtrl.createDepartment);

// -------- READ --------
departmentRouter.get('/', auth, departmentCtrl.viewAllDepartments);
departmentRouter.get('/:id', auth, departmentCtrl.viewDepartment);

// -------- UPDATE --------
departmentRouter.put('/:id', auth, departmentCtrl.updateDepartment);

// -------- DELETE --------
departmentRouter.delete('/:id', auth, authEmployee, departmentCtrl.deleteDepartment);

export default departmentRouter;
