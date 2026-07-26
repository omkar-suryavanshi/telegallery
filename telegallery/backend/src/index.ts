import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiters";

import authRoutes from "./routes/auth";
import fileRoutes from "./routes/files";
import albumRoutes from "./routes/albums";
import statsRoutes from "./routes/stats";
import settingsRoutes from "./routes/settings";

const app = express();

// Render (and most PaaS platforms) put a reverse proxy in front of the app. Without
// this, Express can't tell the original request was HTTPS, and secure cookies
// (required for cross-domain auth in production) would silently fail to be set.
app.set("trust proxy", 1);


app.use(
  helmet({
    // Images/thumbnails are fetched from the frontend's origin (a different port),
    // which counts as cross-origin. Helmet's default CORP policy ("same-origin")
    // blocks that at the browser level regardless of CORS — this widens it back open.
    // The routes themselves remain protected by requireAuth's session cookie check.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests (curl, server-to-server, Render's own health checks) don't
      // send an Origin header at all — always allow those through.
      if (!origin) return callback(null, true);

      const normalized = origin.trim().replace(/\/+$/, "");
      if (env.CORS_ORIGINS.includes(normalized)) {
        callback(null, true);
      } else {
        logger.warn(
          `Blocked CORS request — origin "${normalized}" is not in the allowed list: ` +
            JSON.stringify(env.CORS_ORIGINS)
        );
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);
app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/files", fileRoutes);
app.use("/albums", albumRoutes);
app.use("/stats", statsRoutes);
app.use("/settings", settingsRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`TeleGallery backend listening on port ${env.PORT}`);
});
