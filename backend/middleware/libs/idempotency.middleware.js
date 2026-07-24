const recentResponses = new Map();
const stableStringify = (value) => {
  if (!value || typeof value !== "object") return String(value ?? "");
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${key}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const defaultKey = (req) =>
  [
    req.method,
    req.originalUrl,
    req.user?.id || req.ip || "anonymous",
    req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || "",
  ].join(":");

export const requireIdempotencyKey = ({
  ttlMs = 10 * 60 * 1000,
  keyFactory = defaultKey,
  message = "This action needs an Idempotency-Key header to prevent duplicate submissions.",
} = {}) => {
  return (req, res, next) => {
    const providedKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    if (!providedKey) {
      return res.status(400).json({ success: false, message });
    }

    const cacheKey = keyFactory(req);
    const cached = recentResponses.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(cached.status).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        recentResponses.set(cacheKey, {
          status: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return originalJson(body);
    };

    return next();
  };
};

export const dedupeSuccessfulRequests = ({
  ttlMs = 30 * 1000,
  keyFactory,
} = {}) => {
  return (req, res, next) => {
    const cacheKey = keyFactory
      ? keyFactory(req)
      : [
          req.method,
          req.originalUrl,
          req.user?.id || req.ip || "anonymous",
          stableStringify(req.body),
        ].join(":");

    const cached = recentResponses.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(cached.status).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        recentResponses.set(cacheKey, {
          status: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return originalJson(body);
    };

    return next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of recentResponses.entries()) {
    if (value.expiresAt <= now) recentResponses.delete(key);
  }
}, 10 * 60 * 1000).unref?.();
