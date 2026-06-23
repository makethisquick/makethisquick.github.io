import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Renter Passport builds to static assets served at the site root ("/")
// on its own Netlify site. SPA routing is handled by public/_redirects.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5180,
    host: true,
  },
});
