import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite-plus";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = process.env.NODE_ENV === "production" ? "production" : "development";
const env = loadEnv(mode, process.cwd(), "");
const devAllowedHost = env.DEV_ALLOWED_HOST?.trim();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: devAllowedHost ? { allowedHosts: [devAllowedHost] } : {},
  plugins: [react(), tailwindcss()],
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
