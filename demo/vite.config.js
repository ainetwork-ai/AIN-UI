import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom", "@a2ui/web_core", "@a2ui/react"] },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:3000", "/catalog.json": "http://127.0.0.1:3000" } },
});
