// middleware/anonId.js
import { randomUUID } from "crypto";

export function ensureAnonId(req, res, next) {
  const COOKIE = "anonId";
  let anonId = req.cookies?.[COOKIE];

  if (!anonId) {
    anonId = randomUUID(); // v4
    // 1 year, HTTP-only so JS can’t read it (privacy); SameSite=Lax is fine for your app
    res.cookie(COOKIE, anonId, {
      httpOnly: true,
      sameSite: "none",
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  req.anonId = anonId;
  next();
}
