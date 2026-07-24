const buckets = new Map();

const getClientKey = (req) =>
  req.user?.id ||
  req.ip ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  "anonymous";

export const createRateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyPrefix = "default",
  message = "Too many requests. Please try again shortly.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const bucket = buckets.get(key) || { resetAt: now + windowMs, count: 0 };

    if (bucket.resetAt <= now) {
      bucket.resetAt = now + windowMs;
      bucket.count = 0;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref?.();
