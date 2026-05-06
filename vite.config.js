import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 项目站点通常路径为：/<仓库名>/
// GitHub Actions 会自动传入 VITE_BASE_PATH="/仓库名/"
// 本地开发时使用 "/"
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/"
});
