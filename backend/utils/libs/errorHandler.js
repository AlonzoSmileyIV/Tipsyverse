import multer from "multer";
import { captureServerError } from "./monitoring.js";
import { logger } from "./logger.js";

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const isUploadError = err instanceof multer.MulterError;
  const status = Number(err?.status || err?.statusCode) || (isUploadError ? 400 : 500);
  const exposeMessage = status < 500 || process.env.NODE_ENV !== "production";

  if (status >= 500) {
    logger.error("unhandled_request_error", {
      error: err,
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status,
      userId: req.user?.id,
    });
    captureServerError(err, req);
  }

  return res.status(status).json({
    success: false,
    message: exposeMessage ? err?.message || "Request failed." : "Internal server error.",
  });
};

export default errorHandler;
