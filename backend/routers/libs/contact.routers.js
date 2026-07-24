
// /routes/email.js
import express from "express";
import {contactCtrl} from "../../controllers/index.js";

const contactRouter = express.Router();

contactRouter.post("/contact", contactCtrl.sendContactUsEmail);

export default contactRouter;
