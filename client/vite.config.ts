import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "full-reload-on-store-change",
      handleHotUpdate({ file, server }) {
        // Force full page reload when stores or shared logic change
        if (file.includes("/stores/") || file.includes("shared/src/")) {
          server.ws.send({ type: "full-reload" });
          return [];
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sd-prompt/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
