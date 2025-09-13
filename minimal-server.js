#!/usr/bin/env node

// Minimal Express server to serve static assets while package management is fixed
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

console.log('🚀 Starting minimal server (degraded mode due to package management issue)...');

// Serve static assets from server/public
app.use(express.static(join(__dirname, 'server', 'public')));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'degraded', 
    message: 'Server running in minimal mode - package management issue being resolved',
    timestamp: new Date().toISOString()
  });
});

// All other API routes return 503 for security
app.all('/api/*', (req, res) => {
  res.status(503).json({ 
    error: 'Service temporarily unavailable',
    message: 'Full API functionality disabled pending infrastructure fix'
  });
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'server', 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`📱 Minimal server running on http://0.0.0.0:${port}`);
  console.log(`📁 Serving static files from: ${join(__dirname, 'server', 'public')}`);
  console.log(`🔧 Full functionality will be restored once package management is fixed`);
});