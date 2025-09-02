const bool = (v?: string, d=false) => v ? ['1','true','yes','on'].includes(v.toLowerCase()) : d;

export const env = {
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  familyPassword: process.env.FAMILY_PASSWORD || '',
  cookieSecure: bool(process.env.COOKIE_SECURE, true),
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax'|'strict'|'none',

  // Canvas / email (optional)
  canvas: {
    baseUrl: process.env.CANVAS_BASE_URL || '',
    baseUrl2: process.env.CANVAS_BASE_URL_2 || '',
    abigail: process.env.ABIGAIL_CANVAS_TOKEN || '',
    abigail2: process.env.ABIGAIL_CANVAS_TOKEN_2 || '',
    khalil: process.env.KHALIL_CANVAS_TOKEN || '',
  },
  resendKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || '',
  parentEmail: process.env.PARENT_EMAIL || '',
};

const required = [
  ['DATABASE_URL', env.databaseUrl],
  ['SESSION_SECRET', env.sessionSecret],
];

const missing = required.filter(([,v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('[env] Missing required vars:', missing.join(', '));
  process.exit(1);
}

console.log('[env] Loaded', {
  APP_ENV: env.appEnv,
  DATABASE_URL: !!env.databaseUrl,
  SESSION_SECRET: !!env.sessionSecret,
  FAMILY_PASSWORD: !!env.familyPassword,
  COOKIE_SECURE: env.cookieSecure,
  COOKIE_SAMESITE: env.cookieSameSite,
  CANVAS: {
    baseUrl: !!env.canvas.baseUrl,
    baseUrl2: !!env.canvas.baseUrl2,
    abigail: !!env.canvas.abigail,
    abigail2: !!env.canvas.abigail2,
    khalil: !!env.canvas.khalil,
  },
  RESEND: !!env.resendKey,
});