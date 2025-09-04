import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Extend session types to include our custom properties
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    userId?: string;
  }
}
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { jobScheduler } from "./lib/scheduler";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrations";
import { connectionManager } from "./lib/db-connection";
import { seedAbigailThursdayTemplate, getTemplateStatus } from "./lib/seed-schedule-templates";
import { startResourceMonitoring } from "./lib/resource-monitoring";
import { validateRequiredEnvironment } from "./lib/env-validation";
import { setupSecurityHeaders } from "./lib/security-headers";

const app = express();

// CRITICAL: Trust proxy for production (enables secure cookies)
app.set('trust proxy', 1);
console.log('✅ PROXY TRUST ENABLED: Server will recognize HTTPS behind Replit proxy');

// Production-ready session configuration  
// FIXED: Detect production via Replit deployment environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';

// Require SESSION_SECRET for session management
if (!process.env.SESSION_SECRET) {
  console.log('⚠️  SESSION_SECRET not found, falling back to FAMILY_PASSWORD');
}
const sessionSecret = process.env.SESSION_SECRET || process.env.FAMILY_PASSWORD;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET or FAMILY_PASSWORD environment variable is required');
}

// Log production environment detection
console.log('🔍 SESSION DEBUG:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction,
  willUseSecureCookies: isProduction,
  willUseSameSiteNone: isProduction
});

// Session store - PostgreSQL for production stability with fallback
const PgStore = connectPg(session);
let sessionStore;

// Only use PostgreSQL store if we have a valid connection
if (process.env.DATABASE_URL) {
  try {
    sessionStore = new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'sessions',
      ttl: 24 * 60 * 60, // 24 hours
      schemaName: 'public'
    });
    console.log('✅ CONFIGURED POSTGRESQL SESSION STORE');
  } catch (error: any) {
    console.warn('⚠️  PostgreSQL session store setup failed, using memory fallback:', error.message);
    sessionStore = undefined;
  }
} else {
  console.warn('⚠️  No DATABASE_URL found, using memory session store');
  sessionStore = undefined;
}

// Session middleware - MUST be before all other middleware and routes  
app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  cookie: {
    secure: isProduction, // HTTPS required in production
    httpOnly: true, // Prevent XSS
    sameSite: isProduction ? 'none' : 'lax', // Production-safe: SameSite=None
    path: '/', // Explicit path for whole app
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: undefined // Let browser handle domain
  }
}));
console.log('✅ SESSION MIDDLEWARE MOUNTED: One shared session system for login and all /api/* routes');

// Security middleware for production
if (isProduction) {
  // HTTPS enforcement
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });

  // Security headers (Replit-compatible)
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Step 7: X-Frame-Options REMOVED to prevent breaking Replit iframe preview
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session debugging middleware (for troubleshooting auth issues)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Step 6 Evidence: Log first line of schedule handlers
  if (req.path.startsWith('/api/schedule/') || req.path.startsWith('/api/assignments')) {
    console.log('✅ SCHEDULE HIT:', { 
      sessionId: req.sessionID, 
      hasUserId: !!req.session.userId,
      path: req.path
    });
  }
  next();
});

// Production-ready request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.api(req.method, req.path, res.statusCode, duration, capturedJsonResponse);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Production-ready error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details (but don't expose sensitive info in production)
    logger.error('Express', `${req.method} ${req.path} - ${message}`, isProduction ? undefined : { stack: err.stack });

    // Send appropriate response
    res.status(status).json({ 
      message: isProduction && status === 500 ? "Internal Server Error" : message 
    });

    // Don't throw in production to prevent crashes
    if (!isProduction) {
      throw err;
    }
  });

  // CRITICAL: Mount frontend AFTER API routes to prevent catch-all interference
  // Use our production detection (not Express env) for proper Replit deployment handling
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Environment-specific server startup
  logger.info('Server', `Starting StudyFlow server in ${isProduction ? 'production' : 'development'} mode`);
  logger.info('Server', `Canvas configuration loaded`, {
    hasAbigailToken: !!process.env.ABIGAIL_CANVAS_TOKEN,
    hasAbigailToken2: !!process.env.ABIGAIL_CANVAS_TOKEN_2,
    hasKhalilToken: !!process.env.KHALIL_CANVAS_TOKEN,
    hasBaseUrl: !!process.env.CANVAS_BASE_URL,
    hasBaseUrl2: !!process.env.CANVAS_BASE_URL_2
  });

  // Validate environment before starting services
  try {
    validateRequiredEnvironment();
    logger.info('Server', 'Environment validation passed');
  } catch (error: any) {
    logger.error('Server', 'Environment validation failed', { error: error.message });
    // Don't exit in development for easier debugging
    if (isProduction) {
      process.exit(1);
    }
  }

  // Database connection validation and migrations
  logger.info('Server', '🔌 Validating database connection...');
  
  const dbConnected = await connectionManager.validateConnection();
  if (!dbConnected) {
    logger.error('Server', '❌ Database connection failed - server will start in degraded mode');
    // Don't exit - allow server to start for health checks
  } else {
    logger.info('Server', '✅ Database connection established');
    
    // Only run migrations if we have a stable connection
    logger.info('Server', '🔄 Running database migrations...');
    const migrationResult = await runMigrations();
    
    if (migrationResult.success) {
      logger.info('Server', 'Database migrations completed successfully', migrationResult);
    } else {
      logger.warn('Server', 'Database migrations completed with issues - server will continue', migrationResult);
    }
  }

  // Database fingerprinting for production parity verification
  try {
    const abigailThursdayStatus = await getTemplateStatus('Abigail', 'Thursday');
    logger.info('Database', 'Database fingerprint', {
      environment: process.env.NODE_ENV || 'development',
      abigailThursdayBlocks: abigailThursdayStatus.count,
      isProduction: process.env.REPLIT_DEPLOYMENT === '1',
      databaseHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown' : 'unknown'
    });
  } catch (error: any) {
    logger.warn('Database', 'Failed to generate fingerprint', { error: error.message });
  }

  // Controlled seeding for production safety
  const seedControl = process.env.RUN_SEEDS || 'off'; // FIXED! Lock it down
  
  if (seedControl === 'off') {
    logger.info('Server', '🚫 Database seeding DISABLED (RUN_SEEDS=off)');
  } else if (seedControl === 'once') {
    logger.info('Server', '🌱 Running database seeds (ONE-SHOT MODE)...');
    try {
      // Seed schedule templates
      const scheduleResult = await seedAbigailThursdayTemplate();
      logger.info('Server', 'Schedule template seeding completed', scheduleResult);
      
      // Seed Bible curriculum
      const { seedBibleCurriculum } = await import('./lib/seed-bible-curriculum');
      const curriculumResult = await seedBibleCurriculum();
      logger.info('Server', 'Bible curriculum seeding completed', curriculumResult);
      
      logger.warn('Server', '⚠️  ONE-SHOT SEEDING COMPLETE - SET RUN_SEEDS=off IMMEDIATELY');
      
    } catch (error: any) {
      logger.error('Server', 'Database seeding failed', { error: error.message });
      if (isProduction) {
        process.exit(1);
      }
    }
  } else {
    // Default behavior for development
    try {
      logger.info('Server', '🌱 Running database seeds...');
      
      // Seed schedule templates
      const scheduleResult = await seedAbigailThursdayTemplate();
      logger.info('Server', 'Schedule template seeding completed', scheduleResult);
      
      // Seed Bible curriculum
      const { seedBibleCurriculum } = await import('./lib/seed-bible-curriculum');
      const curriculumResult = await seedBibleCurriculum();
      logger.info('Server', 'Bible curriculum seeding completed', curriculumResult);
      
    } catch (error: any) {
      logger.error('Server', 'Database seeding failed', { error: error.message });
      if (isProduction) {
        process.exit(1);
      }
    }
  }

  // Start resource monitoring in production
  if (isProduction) {
    startResourceMonitoring(60000); // Monitor every minute
    logger.info('Server', 'Resource monitoring started');
  }

  // Start job scheduler
  logger.info('Server', '🚀 Starting job scheduler...');
  jobScheduler.start();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info('Server', `serving on port ${port}`);
  });
})();
