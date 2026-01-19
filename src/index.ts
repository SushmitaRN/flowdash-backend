// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import employeeRoutes from "./routes/employees";
import taskRoutes from "./routes/tasks";
import CommnetRoutes from "./routes/Comment";
import ProjectManagerRoutes from "./routes/ProjectManager";
import leaveRoutes from "./routes/leaves";
import announcementRoutes from "./routes/announcement.routes";
import feedbackRoutes from "./routes/feedback.routes";
import overtimeRoutes from "./routes/overtime.routes";
import bonusRoutes from "./routes/bonus.routes";

const app = express();

/* =========================================================
   CORS CONFIG
========================================================= */

const allowedOrigins = [
  // Local dev
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // ✅ YOUR VERCEL FRONTEND (IMPORTANT)
  "https://flowdash-frontend-yiblucfnu-kails-projects-c0de5d48.vercel.app",

  // Existing allowed domains
  "https://flowbit.dotspeaks.com",
  "http://194.163.139.103:4001",
];

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://10.23.46.69:8081",
      "https://flowdash-frontend-yiblucfnu-kails-projects-c0de5d48.vercel.app"
    ],
    credentials: true,
  })
);


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cookieParser());
app.use(express.json());

app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' http://localhost:8082"
  );
  res.setHeader("Permissions-Policy", "geolocation=(self)");
  next();
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* =========================================================
   ROUTES
========================================================= */

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", CommnetRoutes);
app.use("/api/projectManager", ProjectManagerRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/bonuses", bonusRoutes);

/* =========================================================
   START SERVER
========================================================= */

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
