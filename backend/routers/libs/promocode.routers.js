import { Router } from "express";
import { promoCodeCtrl } from "../../controllers/index.js";
import { auth, authEmployee } from "../../middleware/index.js";

const promoCodeRouter = Router();

const authPromoManager = (req, res, next) => {
  const position = req.user?.positionName;
  const hierarchy = req.user?.positionHierarchy;
  const department = req.user?.positionDepartment;
  if (
    hierarchy !== "Owner" &&
    position !== "Owner" &&
    !["Technology", "Finance"].includes(department)
  ) {
    return res.status(403).json({
      success: false,
      message: "Only Owners, Technology, and Finance can manage promo codes.",
    });
  }
  return next();
};

promoCodeRouter.get("/", auth, authEmployee, promoCodeCtrl.list);
promoCodeRouter.post("/", auth, authEmployee, authPromoManager, promoCodeCtrl.create);
promoCodeRouter.patch("/:id", auth, authEmployee, authPromoManager, promoCodeCtrl.update);
promoCodeRouter.delete("/:id", auth, authEmployee, authPromoManager, promoCodeCtrl.remove);

export default promoCodeRouter;
