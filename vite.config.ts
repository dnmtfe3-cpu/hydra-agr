import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const appVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
let buildRevision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local";
if (buildRevision === "local") {
  try { buildRevision = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* Source archive build. */ }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __HYDRA_VERSION__: JSON.stringify(appVersion),
    __HYDRA_BUILD__: JSON.stringify(buildRevision.slice(0, 7)),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    css: true,
  },
});
