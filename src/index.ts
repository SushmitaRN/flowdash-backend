// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import employeeRoutes from "./routes/employees";
import taskRoutes from "./routes/tasks";
import commentRoutes from "./routes/Comment";
import projectManagerRoutes from "./routes/ProjectManager";
import leaveRoutes from "./routes/leaves";
import announcementRoutes from "./routes/announcement.routes";
import feedbackRoutes from "./routes/feedback.routes";
import overtimeRoutes from "./routes/overtime.routes";
import bonusRoutes from "./routes/bonus.routes";

const app = express();

/* ------------------ MIDDLEWARE ------------------ */
app.use(cookieParser());
app.use(express.json());

/* ✅ CORS — VERY IMPORTANT */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:8080",
      "https://flowdash-frontend.vercel.app",
      "https://flowdash-frontend-yiblucfnu-kails-projects-c0de5d48.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* Handle preflight properly */
app.options("*", cors());

/* ------------------ ROUTES ------------------ */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/projectManager", projectManagerRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/bonuses", bonusRoutes);

/* ------------------ START SERVER ------------------ */
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(` API running on port ${PORT}`);
});
