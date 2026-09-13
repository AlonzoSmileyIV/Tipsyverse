import { UserModel as User } from "../../models/index.js";
import { idxOf } from "../../utils/libs/canManage.js";

export const authManager = async (req, res, next) => {
  try {
    if (!["admin", "employee"].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: "Manager access denied." });
    }
    const actor = await User.findById(req.user.id).populate({
      path: "employeeDetails.position",
      populate: { path: "hierarchy", select: "name" },
    });
    if (actor?.role === "admin") {
      req.manager = actor;
      return next();
    }
    const hierarchy = actor?.employeeDetails?.position?.hierarchy?.name;
    const actorIndex = idxOf(hierarchy);
    const supervisorIndex = idxOf("Supervisor");
    if (actorIndex < 0 || actorIndex > supervisorIndex) {
      return res.status(403).json({ success: false, message: "Manager access denied." });
    }
    req.manager = actor;
    return next();
  } catch (error) {
    return next(error);
  }
};
