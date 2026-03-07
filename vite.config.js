import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "circular-natal-horoscope-js": path.resolve(
        "node_modules/circular-natal-horoscope-js/dist/index.js",
      ),
    },
  },
  build: {
    outDir: "build",
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          tone: ["tone"],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
