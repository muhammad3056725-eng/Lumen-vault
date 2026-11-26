import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * LUMEN VAULT web app (Blueprint §6/§7).
 * Production: the built app deploys statically with the dataset
 * (public/data/v1) copied beside it — see .github/workflows/pages.yml —
 * matching the blueprint's static edge architecture (Cloudflare
 * Pages + R2 in production; GitHub Pages for the current deployment).
 * Development: the plugin below mounts the repo's public/ directory
 * at /__data so `vite dev` reads the same dataset files in place.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".bin": "application/octet-stream",
};

function dataMount(): Plugin {
  return {
    name: "lumen-data-mount",
    configureServer(server) {
      server.middlewares.use("/__data", (req, res, next) => {
        const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const path = join(repoRoot, "public", urlPath);
        if (!existsSync(path) || !statSync(path).isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", MIME[extname(path)] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Mount-agnostic: "./" makes every built asset URL relative, so the
  // same dist/ works at a domain root, on a GitHub Pages project URL,
  // and under a subpath (e.g. deepwell.games/lumen-vault/). Override
  // with VITE_BASE=/lumen-vault/ at build time if absolute URLs are
  // preferred.
  base: process.env.VITE_BASE ?? "./",
  publicDir: false,
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5174, fs: { allow: [repoRoot] } },
  plugins: [dataMount()],
});
