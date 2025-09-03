import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { jobScheduler } from "./lib/scheduler";

// 🚀 Boot Log - Environment Configuration
console.log('🔧 StudyFlow Server Starting...');
console.log(`📊 Environment: NODE_ENV=${process.env.NODE_ENV}, APP_ENV=${process.env.APP_ENV || 'undefined'}, TZ=${process.env.TZ || 'system-default'}`);
console.log(`📚 School Timezone: America/New_York (for consistent weekday scheduling)`);

// School Year Configuration
import { getSchoolYearRange } from './lib/schoolYear';
console.log(`🎓 School Year: ${getSchoolYearRange()}`);

console.log(`🌐 Port: ${process.env.PORT || '5000'}`);

const app = express();

// Use PostgreSQL session storage for production reliability
const isDev = process.env.NODE_ENV !== 'production';
const sessionDbUrl = isDev 
  ? process.env.DATABASE_URL_DEV!
  : process.env.DATABASE_URL!;

if (!sessionDbUrl) {
  throw new Error(isDev 
    ? "DATABASE_URL_DEV is required for development sessions" 
    : "DATABASE_URL is required for production sessions");
}

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  conString: sessionDbUrl,
  tableName: 'sessions',
  createTableIfMissing: true,
  ttl: 24 * 60 * 60, // 24 hours in seconds
});

// Session middleware for family authentication
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || process.env.FAMILY_PASSWORD || (isDev ? 'dev-fallback-secret' : (() => { throw new Error('SESSION_SECRET or FAMILY_PASSWORD required in production'); })()),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Auto-secure in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CORS configuration for production session cookies
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
    
    // Start the job scheduler for daily Canvas sync
    jobScheduler.start();
  });
})();
