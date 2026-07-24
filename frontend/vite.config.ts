import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local dev: talk to the .NET backend without CORS friction.
      "/api": { target: "http://localhost:5080", changeOrigin: true },
    },
  },
});
