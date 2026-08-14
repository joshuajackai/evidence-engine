import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  /* GitHub Pages serves the site from /<repo>/, so the asset paths need that
     prefix there and nowhere else. The workflow sets GITHUB_PAGES=true; local
     dev, Netlify and any custom domain keep the plain root. */
  base: process.env.GITHUB_PAGES === "true" ? "/evidence-engine/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
  },
});
