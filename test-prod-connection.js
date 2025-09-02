// Test production database connection with production-like settings
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const app = express();
const PgSession = connectPgSimple(session);

// Production database URL
const prodDatabaseUrl = "postgresql://neondb_owner:npg_OZch3Xa8GQps@ep-wispy-rain-a58t66kd.us-east-2.aws.neon.tech/neondb?sslmode=require";

const sessionStore = new PgSession({
  conString: prodDatabaseUrl,
  tableName: 'sessions',
  createTableIfMissing: true,
  ttl: 24 * 60 * 60,
});

// Production-like session configuration
app.use(session({
  store: sessionStore,
  secret: process.env.FAMILY_PASSWORD || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTPS simulation - we'll test this manually
    httpOnly: false, // Allow testing
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// CORS configuration matching production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://study-flow.replit.app', 'http://localhost:5000'];
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || 'https://study-flow.replit.app');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Test endpoints
app.post('/api/unlock', (req, res) => {
  const { password } = req.body;
  if (password === process.env.FAMILY_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ message: 'Invalid password' });
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Production simulation server running on port ${port}`);
  console.log(`Database: ${prodDatabaseUrl.split('@')[1]}`);
});
