import * as Sentry from "@sentry/node";

export const initializeMonitoring = () => {
  if (!process.env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.APP_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
  });
  return true;
};

export const captureServerError = (error, req) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag("request_id", req?.id || "unknown");
    scope.setContext("request", {
      method: req?.method,
      path: req?.originalUrl,
      userId: req?.user?.id,
    });
    Sentry.captureException(error);
  });
};

const lastOperationalAlertAt = new Map();

export const captureOperationalAlert = (
  name,
  context = {},
  throttleMs = 5 * 60 * 1000
) => {
  if (!process.env.SENTRY_DSN) return;
  const now = Date.now();
  if (now - (lastOperationalAlertAt.get(name) || 0) < throttleMs) return;
  lastOperationalAlertAt.set(name, now);
  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("operational_alert", name);
    scope.setContext("details", context);
    Sentry.captureMessage(`Operational alert: ${name}`);
  });
};
