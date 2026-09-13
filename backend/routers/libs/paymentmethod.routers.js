import { Router } from "express";
import {paymentMethodCtrl} from '../../controllers/index.js'
import { auth } from "../../middleware/index.js";

const paymentMethodRouter = Router();

// CREATE
paymentMethodRouter.post('/setup-intent', auth, paymentMethodCtrl.createSetupIntent);
paymentMethodRouter.post('/', auth, paymentMethodCtrl.createPaymentMethod);

// VIEW 
paymentMethodRouter.get('/', auth, paymentMethodCtrl.viewMyPaymentMethods);
paymentMethodRouter.get('/:userId', auth, paymentMethodCtrl.viewPaymentMethodsByUser);

// UPDATE
paymentMethodRouter.patch('/:id', auth, paymentMethodCtrl.updatePaymentMethod);
paymentMethodRouter.patch('/:id/set-default', auth, paymentMethodCtrl.setDefaultPaymentMethod);

// DELETE
paymentMethodRouter.delete('/:id', auth, paymentMethodCtrl.deletePaymentMethod);

export default paymentMethodRouter;
