import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const BACKEND = "http://127.0.0.1:11150";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 11151,
    host: true,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/mcp": { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
