import jwt from "jsonwebtoken";
import { UserModel as User } from "../../models/index.js";

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

 if (authHeader?.startsWith("Bearer ")) {
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user) req.user = user;
  } catch (err) {
    console.warn("Optional auth: invalid token →", err.message);
  }
}
  next(); // Always continue
};

export { optionalAuth };
