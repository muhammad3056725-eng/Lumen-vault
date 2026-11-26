import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

/**
 * LUMEN VAULT web app.
 * Production: the built app deploys statically with the dataset
 * (public/data/v1) copied beside it — see .github/workflows/pages.yml.
 * Development: the plugin below mounts the repo's public/ directory at
 * /__data so `vite dev` reads the same dataset files in place. Requests
 * that try to climb out of public/ (../, %2e%2e) are refused.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const publicRoot = resolve(repoRoot, "public");

const MIME: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
};

function dataMount(): Plugin {
  return {
    name: "lumen-data-mount",
    configureServer(server) {
      server.middlewares.use("/__data", (req, res, next) => {
        let urlPath: string;
        try {
          urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const path = resolve(publicRoot, "." + urlPath);
        if (path !== publicRoot && !path.startsWith(publicRoot + sep)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!existsSync(path) || !statSync(path).isFile()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", MIME[extname(path)] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // "./" makes every built asset URL relative, so the same dist/ works at a
  // domain root, on a GitHub Pages project URL, and under any subpath.
  base: process.env.VITE_BASE ?? "./",
  publicDir: false,
  // Keep paths as written (no realpath) so mapped/subst drives work in dev.
  resolve: { preserveSymlinks: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2020", cssTarget: "chrome100" },
  server: { port: 5174, fs: { allow: [repoRoot] } },
  plugins: [dataMount()],
});
