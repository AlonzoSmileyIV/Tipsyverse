import { } from "dotenv/config";
import express from "express";
import morgan from "morgan";
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
import { attachLogActivity, ensureAnonId } from "./middleware/index.js";
import initializeScheduledJobs from "./jobs/index.js";
import { drinkCtrl } from "./controllers/index.js";


// ─── Configs ────────────────────────────────────────────
const api = process.env.API_URL;
const PORT = process.env.PORT ?? 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Express Setup ──────────────────────────────────────
const app = express();

// Static files (for image previews or temp uploads)
app.use("/temp", express.static(path.join(__dirname, "public/temp")));

app.use(morgan("tiny"));

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
app.options("*", cors(corsConfig), (req, res) => res.sendStatus(204));

// Body + cookies AFTER CORS
app.use(express.json());
app.use(cookieParser());
app.use(ensureAnonId);
app.use(express.urlencoded({ extended: true }));


//This code is part of a setup that uses Prerender.io — a service that helps Google, Facebook, Twitter, and other crawlers see your dynamic JavaScript pages.
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN); // from prerender.io (free tier ok)
prerender.whitelisted(['/drinks/.*']); // only those pages
app.use(prerender);

// app.use(
//   cors({
//     origin: allowedOrigins,
//     credentials: true,
//   })
// );

// Error Middleware (basic)
app.use((err, req, res, next) => {
  if (err) {
    res.status(500).json({ message: `Error in the server: ${err}` });
  }
});

app.use(attachLogActivity);

app.get(`${api}/health`, (req, res) => {
  const required = {
    mongo:
      !!process.env.MONGO_URI ||
      !!process.env.MONGO_DEV_URI ||
      !!process.env.MONGO_STAGING_URI ||
      !!process.env.MONGO_PROD_URI,
    auth: !!process.env.ACCESS_TOKEN_SECRET && !!process.env.REFRESH_TOKEN_SECRET,
    email: !!process.env.RESEND_EMAIL_KEY && !!process.env.FROM_EMAIL,
    cloudinary:
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET,
    frontend: !!process.env.FRONTEND_URL || !!process.env.PUBLIC_APP_URL,
  };

  res.json({
    success: true,
    status: "ok",
    environment: ENVIRONMENT,
    uptimeSeconds: Math.round(process.uptime()),
    checks: required,
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

// ─── WIPING IF NEED ───────────────────────────────────────
// IF YOU NEED TO WIPE DATABASE IT CLEAN AND ADD SEED, FOLLOW THESE STEPS:
// 1.) In the package.json file, go to scripts object and MAKE SURE the following is present:
// "wipe:collections": "NODE_ENV=development node scripts/libs/wipeAllCollections.script.js",
// "seed": "NODE_ENV=development node scripts/libs/seedInitialData.script.js"

// 2.) make sure you run the following first in terminal: CONFIRM_WIPE=yes npm run wipe:collections

// 3.) then run this in terminal: npm run seed 


// ─── Housekeeping ───────────────────────────────────────
// Optional clean-up on startup
clearUploadsFolder();
// Connect to DB
const ENVIRONMENT = process.env.NODE_ENV || "development";
connectDB(ENVIRONMENT);
// Schedule jobs
initializeScheduledJobs();

// Create HTTP server and integrate Socket.IO
// ─── Server + Socket.IO ─────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const connectedUsers = new Map();

initializeSocket(io); // 👈 Init Socket.IO listeners

//migrateCloudinaryUrls();

// Export for usage in notification system, etc.
export { io };


// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}...`);
});
