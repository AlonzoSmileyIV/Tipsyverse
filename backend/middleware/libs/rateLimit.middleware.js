import crypto from "crypto";
import mongoose from "mongoose";

const getClientKey = (req) =>
  req.user?.id ||
  req.ip ||
  "anonymous";

export const createRateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyPrefix = "default",
  message = "Too many requests. Please try again shortly.",
} = {}) => {
  return async (req, res, next) => {
    const now = Date.now();
    const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
    const rawKey = `${keyPrefix}:${getClientKey(req)}:${resetAt}`;
    const key = crypto.createHash("sha256").update(rawKey).digest("hex");
    let count;

    try {
      if (mongoose.connection.readyState !== 1) {
        return next();
      }
      const bucket = await mongoose.connection.db
        .collection("rate_limit_buckets")
        .findOneAndUpdate(
          { _id: key },
          {
            $inc: { count: 1 },
            $setOnInsert: {
              keyPrefix,
              expiresAt: new Date(resetAt + windowMs),
            },
          },
          { upsert: true, returnDocument: "after" }
        );
      count = bucket.count;
    } catch (error) {
      return next(error);
    }

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
};
