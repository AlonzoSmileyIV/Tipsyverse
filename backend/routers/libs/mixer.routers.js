import { Router } from "express";
import { mixerCtrl } from "../../controllers/index.js";
import { auth, authEmployee, uploadExcel } from "../../middleware/index.js";

const mixerRouter = Router();

mixerRouter.post('/bulk',auth, authEmployee, uploadExcel.single('file'), mixerCtrl.bulkMixerHandler);

mixerRouter.post('/create', auth, authEmployee, mixerCtrl.createMixer);
mixerRouter.put('/photo/:id', mixerCtrl.addMixerPhoto);

mixerRouter.get('/', mixerCtrl.viewAllMixers);
mixerRouter.get('/:id', mixerCtrl.viewMixer);

mixerRouter.put('/:id', auth, authEmployee, mixerCtrl.updateMixer);

mixerRouter.delete('/:id', auth, authEmployee, mixerCtrl.deleteMixer);


export default mixerRouter;