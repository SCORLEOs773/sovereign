import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In development, forward /api calls to the local Worker
      "/api": "http://localhost:8787",
    },
  },
});
