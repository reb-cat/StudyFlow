import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Global error listeners to catch what breaks
window.addEventListener('error', e => {
  console.error('[window.error]', e.message, e.error?.stack);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[unhandledrejection]', e.reason);
});

// Log client environment for debugging
console.log('[client env]', {
  VITE_API_URL: import.meta.env.VITE_API_URL ?? '(empty = same-origin)',
  BASE_URL: import.meta.env.BASE_URL,
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
