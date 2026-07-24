import { Router } from "express";
import { incidentCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const incidentRouter = Router();

incidentRouter.post("/", auth, incidentCtrl.createIncident);
incidentRouter.get("/", auth, incidentCtrl.viewIncidents);
incidentRouter.get("/:id", auth, incidentCtrl.viewIncidentById);
incidentRouter.patch("/:id", auth, authEmployee, incidentCtrl.updateIncident);
incidentRouter.post("/:id/notes", auth, authEmployee, incidentCtrl.addIncidentNote);
incidentRouter.delete("/:id", auth, authEmployee, incidentCtrl.deleteIncident);

export default incidentRouter;
