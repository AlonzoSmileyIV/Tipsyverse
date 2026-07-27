import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import prerender from 'prerender-node';
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import * as routes from "./routers/index.js";
import path from "path";
import { fileURLToPath } from "url";
import clearUploadsFolder from "./utils/libs/clearUploadsFolder.js";
import initializeSocket from "./utils/libs/initializeSocket.js";
import { attachLogActivity, createRateLimit, ensureAnonId, validateWriteBody } from "./middleware/index.js";
import initializeScheduledJobs from "./jobs/index.js";
import { drinkCtrl, paymentCtrl } from "./controllers/index.js";
import errorHandler from "./utils/libs/errorHandler.js";
import helmet from "helmet";
import crypto from "crypto";
import {
  captureOperationalAlert,
  initializeMonitoring,
} from "./utils/libs/monitoring.js";
import validateRuntimeConfig from "./utils/libs/validateRuntimeConfig.js";
import { logger, requestLogger } from "./utils/libs/logger.js";


// Environment is validated immediately before startup. Keeping module import
// side effects minimal allows tests to import `app` without opening a port.
const api = process.env.API_URL;
const PORT = process.env.PORT ?? 3000;
const ENVIRONMENT = process.env.NODE_ENV || "development";
initializeMonitoring();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global request pipeline. Ordering is intentional: the Stripe webhook must
// receive its raw body, while all other JSON routes use the normal parser.
const app = express();
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY);
}
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use((req, res, next) => {
  req.id = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

app.use(requestLogger);

// CORS Setup
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsConfig = {
  origin(origin, cb) {
    // allow no-origin (e.g. curl/Postman) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsConfig));
app.options(/.*/, cors(corsConfig), (req, res) => res.sendStatus(204));

// Stripe verifies the signature against the exact request bytes. Never move
// this route below express.json(), which would make verification unreliable.
app.post(
  `${api}/payments/webhook`,
  express.raw({ type: "application/json", limit: "256kb" }),
  paymentCtrl.handleStripeWebhook
);

// Body + cookies AFTER CORS
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(ensureAnonId);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(validateWriteBody);
// This is a broad abuse-control ceiling. Sensitive endpoints also apply
// narrower domain-specific rate limits in their routers.
app.use(
  `${api}`,
  createRateLimit({
    keyPrefix: "api-global",
    windowMs: 15 * 60 * 1000,
    max: 600,
  })
);


// Render public drink pages for crawlers and social-link previews.
prerender.set("prerenderToken", process.env.PRERENDER_TOKEN);
prerender.whitelisted(["/drinks/.*"]);
app.use(prerender);

app.use(attachLogActivity);

app.get(`${api}/health`, (req, res) => {
  const required = {
    mongo: connectDB.isReady(),
    auth: !!process.env.ACCESS_TOKEN_SECRET && !!process.env.REFRESH_TOKEN_SECRET,
    email: !!process.env.RESEND_EMAIL_KEY && !!process.env.FROM_EMAIL,
    cloudinary:
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET,
    frontend: !!process.env.FRONTEND_URL || !!process.env.PUBLIC_APP_URL,
  };

  const healthy = Object.values(required).every(Boolean);
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "ok" : "degraded",
    environment: ENVIRONMENT,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get(`${api}/live`, (req, res) => {
  res.json({ success: true, status: "alive" });
});

app.get(`${api}/ready`, (req, res) => {
  const ready = connectDB.isReady();
  if (!ready) {
    captureOperationalAlert("readiness_failed", { requestId: req.id });
  }
  return res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "not_ready",
  });
});

// Rich link previews for drink shares. Crawlers read this plain HTML, then users are redirected to the React page.
app.get("/share/drinks/:slug", drinkCtrl.viewDrinkSharePreview);

// ─── API Routes ─────────────────────────────────────────
app.use(`${api}/contact-us`, routes.contactRouter);
app.use(`${api}/users`, routes.userRouter);
app.use(`${api}/hierarchies`, routes.hierarchyRouter);
app.use(`${api}/departments`, routes.departmentRouter);
app.use(`${api}/positions`, routes.positionRouter);
app.use(`${api}/liquors`, routes.liquorRouter);
app.use(`${api}/mixers`, routes.mixerRouter);
app.use(`${api}/glasses`, routes.glassRouter);
app.use(`${api}/drinks`, routes.drinkRouter);
app.use(`${api}/comments`, routes.commentRouter);
app.use(`${api}/notifications`, routes.notificationRouter);
app.use(`${api}/activitylogs`, routes.activityLogRouter);
app.use(`${api}/stats`, routes.statRouter);
app.use(`${api}/courses`, routes.courseRouter);
app.use(`${api}/course-progresses`, routes.courseProgressRouter);
app.use(`${api}/events`, routes.eventRouter);
app.use(`${api}/my-events`, routes.eventRouter);
app.use(`${api}/payment-methods`, routes.paymentMethodRouter);
app.use(`${api}/payment-requests`, routes.paymentRequestRouter);
app.use(`${api}/payments`, routes.paymentRouter);
app.use(`${api}/payouts`, routes.payoutRouter);
app.use(`${api}/bids`, routes.bidRouter);
app.use(`${api}/assignments`, routes.assignmentRouter);
app.use(`${api}/reviews`, routes.reviewRouter);
app.use(`${api}/incidents`, routes.incidentRouter);
app.use(`${api}/support-tickets`, routes.supportTicketRouter);
app.use(`${api}/attendance`, routes.attendanceRouter);
app.use(`${api}/rewards`, routes.rewardRouter);
app.use(`${api}/promo-codes`, routes.promoCodeRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});
app.use(errorHandler);

// Express and Socket.IO share the HTTP server so deployments expose one port
// and both transports use the same CORS origin list.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initializeSocket(io);

// Export for usage in notification system, etc.
export { app, io, server };

let shuttingDown = false;
let stopScheduledJobs = async () => {};
export const startServer = async () => {
  validateRuntimeConfig(ENVIRONMENT);
  clearUploadsFolder();
  await connectDB(ENVIRONMENT);
  stopScheduledJobs = initializeScheduledJobs();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => {
      server.off("error", reject);
      logger.info("server_started", { port: Number(PORT) });
      resolve();
    });
  });
  return server;
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("server_shutdown_started", { signal });
  // Stop producing background work before refusing new HTTP connections, then
  // release database resources after in-flight requests have drained.
  await stopScheduledJobs();
  await new Promise((resolve) => server.close(resolve));
  await connectDB.disconnect();
  process.exit(0);
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((error) => {
    logger.error("server_start_failed", { error });
    process.exit(1);
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
