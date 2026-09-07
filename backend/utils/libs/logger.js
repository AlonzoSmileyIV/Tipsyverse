const serializeError = (error) =>
  error
    ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
      }
    : undefined;

const humanize = (message) =>
  message
    .replaceAll("_", " ")
    .replace(/^\w/, (character) => character.toUpperCase());

const formatContextValue = (value) =>
  typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : String(value);

const formatHumanReadableMessage = (level, message, context) => {
  switch (message) {
    case "database_connected":
      return `✅ Connected to ${context.environment || "development"} database...`;
    case "server_started":
      return `🚀 Server running on port ${context.port}...`;
    case "scheduled_job_leadership_acquired":
      return "✅ Scheduled job leadership acquired...";
    case "http_request": {
      const icon =
        context.status >= 500 ? "❌" : context.status >= 400 ? "⚠️" : "🌐";
      return `${icon} ${context.method} ${context.path} — ${context.status} (${context.durationMs} ms)`;
    }
    default:
      break;
  }

  const icon = {
    debug: "🔎",
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
  }[level];
  const error = context.error instanceof Error
    ? serializeError(context.error)
    : context.error;
  const details = Object.entries(context)
    .filter(([key, value]) => key !== "error" && value !== undefined)
    .map(([key, value]) => `${key}: ${formatContextValue(value)}`)
    .join(", ");
  const errorMessage = error?.message ? `: ${error.message}` : "";
  const stack = error?.stack ? `\n${error.stack}` : "";

  return `${icon} ${humanize(message)}${errorMessage}${details ? ` (${details})` : ""}${stack}`;
};

const write = (level, message, context = {}) => {
  if (["development", "staging"].includes(process.env.NODE_ENV)) {
    const output = formatHumanReadableMessage(level, message, context);
    (level === "error" ? process.stderr : process.stdout).write(`${output}\n`);
    return;
  }

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
