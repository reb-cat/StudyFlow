// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // ✅ replace import.meta.dirname
const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // ✅ only use in dev
  const isProd = (process.env.APP_ENV || process.env.NODE_ENV) === "production";
  if (isProd) return;

  const serverOptions = { middlewareMode: true, hmr: { server }, allowedHosts: true as const };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html"); // ✅
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Helper: try common dist locations and pick the first that exists
function resolveClientDist(): string {
  const candidates = [
    path.resolve(__dirname, "..", "client", "dist"),         // most common
    path.resolve(__dirname, "..", "public"),                 // your previous path
    path.resolve(__dirname, "..", "dist", "client"),         // alternative builds
  ];
  const hit = candidates.find(p => fs.existsSync(p));
  if (!hit) {
    throw new Error(`Could not find client build. Tried:\n${candidates.join("\n")}\nDid you run 'npm --prefix client run build'?`);
  }
  return hit;
}

/** Prod: serve built SPA + fallback (call only in production, after API routes). */
export function serveStatic(app: Express) {
  const distPath = resolveClientDist();                      // ✅ choose existing folder
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}