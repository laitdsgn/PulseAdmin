import { serve } from "bun";
import index from "./index.html";
import { proxyToApi } from "./proxy";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const server = serve({
  port: Number(process.env.PORT ?? 3001),
  routes: {
    // The API is proxied so the panel stays same-origin: no CORS, and report photos load even
    // though the backend sends Cross-Origin-Resource-Policy: same-origin.
    "/v1/*": (req, srv) => proxyToApi(req, API_BASE_URL, srv.requestIP(req)?.address),
    // Serve index.html for all unmatched routes (client-side routing).
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Pulse admin running at ${server.url} (API: ${API_BASE_URL})`);
