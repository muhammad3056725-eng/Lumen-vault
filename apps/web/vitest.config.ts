import { defineConfig } from "vitest/config";

export default defineConfig({
  // Keep paths as written (no realpath): works on subst/mapped drives too.
  resolve: { preserveSymlinks: true },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
