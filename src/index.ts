// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import taskRoutes from './routes/tasks';
import CommnetRoutes from "./routes/Comment";
import ProjectManagerRoutes from "./routes/ProjectManager";
import leaveRoutes from "./routes/leaves";
import cookieParser from "cookie-parser";
import announcementRoutes from "./routes/announcement.routes";
import feedbackRoutes from "./routes/feedback.routes";
import overtimeRoutes from "./routes/overtime.routes";
import bonusRoutes from "./routes/bonus.routes";

//import leaveRoutes from "./routes/leave.routes";

const app = express();

app.use(cookieParser());

//app.use("/api/leaves", leaveRoutes);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow any localhost origin
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }

      const allowedOrigins = ["https://flowbit.dotspeaks.com", "http://194.163.139.103:4001"];
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // Optional: For now, you might want to allow all for debugging if the above fails
      // return callback(null, true);

      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
  })
);
app.use(express.json());

app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options"); // you already had this
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' http://localhost:8082"
  );
  res.setHeader("Permissions-Policy", "geolocation=(self)");
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tasks', taskRoutes);
app.use("/api/comments", CommnetRoutes);
app.use("/api/projectManager", ProjectManagerRoutes);
app.use("/api/leaves", leaveRoutes); // Register leaves route
app.use("/api/announcements", announcementRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/bonuses", bonusRoutes);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
