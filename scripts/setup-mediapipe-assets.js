import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const sourceWasmDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const targetWasmDir = path.join(root, "public", "mediapipe", "wasm");
const targetModelDir = path.join(root, "public", "mediapipe", "models");
const targetModelFile = path.join(targetModelDir, "pose_landmarker_full.task");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[MediaPipe Setup] 未找到 wasm 源目录：${src}`);
    console.warn("[MediaPipe Setup] 请先执行 npm install。");
    return false;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name);
    const targetPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  return true;
}

fs.mkdirSync(targetWasmDir, { recursive: true });
fs.mkdirSync(targetModelDir, { recursive: true });

const copied = copyDir(sourceWasmDir, targetWasmDir);

if (copied) {
  console.log(`[MediaPipe Setup] 已复制 wasm 文件到：${targetWasmDir}`);
}

if (!fs.existsSync(targetModelFile)) {
  console.warn("");
  console.warn("[MediaPipe Setup] 尚未检测到本地 Pose 模型文件：");
  console.warn(`  ${targetModelFile}`);
  console.warn("");
  console.warn("请将模型文件命名为 pose_landmarker_full.task 并放到：");
  console.warn("  public/mediapipe/models/");
  console.warn("");
  console.warn("完成后，项目会优先从本地模型库加载：");
  console.warn("  /mediapipe/models/pose_landmarker_full.task");
  console.warn("");
} else {
  console.log(`[MediaPipe Setup] 已检测到本地模型文件：${targetModelFile}`);
}
