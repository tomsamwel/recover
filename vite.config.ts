import { defineConfig } from "vite";

function normalizeBasePath(basePath?: string) {
  const raw = (basePath ?? "/").trim();
  if (!raw || raw === "/") return "/";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return `/${trimmed}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.PAGES_BASE_PATH),
});
