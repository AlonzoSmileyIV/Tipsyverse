const serializeError = (error) =>
  error
    ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
      }
    : undefined;

const write = (level, message, context = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "tipsyverse-backend",
    environment: process.env.NODE_ENV || "development",
    release: process.env.APP_RELEASE || undefined,
    ...context,
  };
  if (payload.error instanceof Error) {
    payload.error = serializeError(payload.error);
  }
  const output = JSON.stringify(payload);
  (level === "error" ? process.stderr : process.stdout).write(`${output}\n`);
};

export const logger = {
  debug: (message, context) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, context);
  },
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};

export const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info("http_request", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?.id,
    });
  });
  next();
};
