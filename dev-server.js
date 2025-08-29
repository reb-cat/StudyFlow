#!/usr/bin/env node

// Development server script with auto-restart
// This runs nodemon with proper configuration for file watching

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting development server with auto-restart...');

// Run nodemon with tsx
const nodemon = spawn('nodemon', [
  '--config', 'nodemon.json',
  '--exec', 'tsx', 
  'server/index.ts'
], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { 
    ...process.env, 
    NODE_ENV: 'development' 
  }
});

nodemon.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
  process.exit(code);
});

nodemon.on('error', (err) => {
  console.error('Failed to start development server:', err);
  process.exit(1);
});