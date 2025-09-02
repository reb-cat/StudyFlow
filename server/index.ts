import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { jobScheduler } from "./lib/scheduler";
import { env } from "./env";

const app = express();

// Trust proxy for production deployment behind reverse proxy
app.set('trust proxy', 1);

// Use PostgreSQL session storage for production reliability
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  conString: env.databaseUrl,
  tableName: 'sessions',
  createTableIfMissing: true,
  ttl: 24 * 60 * 60, // 24 hours in seconds
});

// Session middleware for family authentication
app.use(session({
  store: sessionStore,
  secret: env.sessionSecret || env.familyPassword || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting for auth and write routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth routes
app.use('/api/unlock', authLimiter);
app.use('/api/login', authLimiter);

// Apply rate limiting to write operations
app.use('/api/assignments', writeLimiter);
app.use('/api/schedule', writeLimiter);
app.use('/api/bible', writeLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Production-safe error handler (non-verbose)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err); // Full stack server-side only
    res.status(500).json({ error: 'Something went wrong.' });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    console.log('[ready]', { env: env.appEnv, port });
    
    // Start the job scheduler for daily Canvas sync
    jobScheduler.start();
  });
})();
