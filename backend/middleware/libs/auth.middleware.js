// middleware/auth.js
import jwt from "jsonwebtoken";
import { UserModel as User } from "../../models/index.js";
import {
  clearRefreshCookie,
  getAccountAccessBlock,
  reactivateExpiredSuspension,
} from "../../utils/libs/accountAccess.js";

export const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Missing or malformed token" });
  }

  const token = authHeader.slice(7); // after "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const sessionStartedAt = Number(
      decoded.sessionStartedAt || Number(decoded.iat) * 1000
    );
    const absoluteSessionLimitMs = 8 * 60 * 60 * 1000;
    if (
      Number.isFinite(sessionStartedAt) &&
      Date.now() - sessionStartedAt >= absoluteSessionLimitMs
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: "SESSION_ABSOLUTE_EXPIRED",
        forceLogout: true,
        message: "Your 8-hour session ended. Please sign in again.",
      });
    }

    const user = await User.findById(decoded.id)
      .select("accountStatus role")
      .exec();

    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        forceLogout: true,
        message: "Your session is no longer valid. Please sign in again.",
      });
    }

    await reactivateExpiredSuspension(user);
    const block = getAccountAccessBlock(user);

    if (block) {
      clearRefreshCookie(res);
      return res.status(block.status).json({
        success: false,
        ...block,
      });
    }

    // Role changes (for example, completing bartender onboarding) should take
    // effect immediately instead of waiting for the access token to expire.
    req.user = { ...decoded, role: user.role };
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
