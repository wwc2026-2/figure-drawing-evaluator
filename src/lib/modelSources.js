/**
 * MediaPipe 模型源数据库
 * ------------------------------------------------------------
 * GitHub Pages 版关键点：
 * - public 目录中的资源最终会部署到 BASE_URL 下；
 * - 项目站点路径通常是 https://用户名.github.io/仓库名/；
 * - 因此不能写死 /mediapipe/...，必须使用 import.meta.env.BASE_URL。
 */

function joinBase(path) {
  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}

export const MODEL_SOURCES = [
  {
    id: "env-custom",
    name: "环境变量自定义模型库",
    wasmPath: import.meta.env.VITE_MEDIAPIPE_WASM_PATH,
    poseModelPath: import.meta.env.VITE_MEDIAPIPE_POSE_MODEL_PATH,
    enabled: Boolean(import.meta.env.VITE_MEDIAPIPE_WASM_PATH && import.meta.env.VITE_MEDIAPIPE_POSE_MODEL_PATH)
  },
  {
    id: "local-project",
    name: "项目本地模型库",
    wasmPath: joinBase("mediapipe/wasm"),
    poseModelPath: joinBase("mediapipe/models/pose_landmarker_full.task"),
    enabled: true
  },
  {
    id: "official-google",
    name: "Google 官方兜底源",
    wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
    poseModelPath:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    enabled: import.meta.env.VITE_ALLOW_GOOGLE_MEDIAPIPE_FALLBACK !== "false"
  }
];

export function getEnabledModelSources() {
  return MODEL_SOURCES.filter((source) => source.enabled && source.wasmPath && source.poseModelPath);
}
