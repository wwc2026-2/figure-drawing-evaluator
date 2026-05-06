import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { getEnabledModelSources } from "./modelSources.js";

let poseLandmarker = null;
let activeModelSource = null;

async function createPoseLandmarkerFromSource(source, delegate) {
  const vision = await FilesetResolver.forVisionTasks(source.wasmPath);

  return await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: source.poseModelPath,
      delegate
    },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.25,
    minPosePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25
  });
}

/**
 * 初始化 MediaPipe Pose Landmarker。
 *
 * 新版采用“模型源数据库”：
 * 1. 优先尝试 .env 自定义源；
 * 2. 再尝试项目本地模型库 /mediapipe；
 * 3. 最后可选尝试 Google 官方源；
 * 4. 所有源失败时抛出错误，由上层切换为手动骨架标注模式。
 */
export async function initPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  const sources = getEnabledModelSources();
  const errors = [];

  for (const source of sources) {
    for (const delegate of ["GPU", "CPU"]) {
      try {
        console.info(`[MediaPipe] 尝试加载模型源：${source.name}，模式：${delegate}`);
        poseLandmarker = await createPoseLandmarkerFromSource(source, delegate);
        activeModelSource = {
          ...source,
          delegate
        };
        console.info(`[MediaPipe] 已加载模型源：${source.name}，模式：${delegate}`);
        return poseLandmarker;
      } catch (error) {
        errors.push({
          source: source.name,
          delegate,
          message: error?.message || String(error)
        });
        console.warn(`[MediaPipe] 模型源加载失败：${source.name}，模式：${delegate}`, error);
      }
    }
  }

  const detail = errors.map((item) => `${item.source}/${item.delegate}: ${item.message}`).join("\n");
  throw new Error(`MediaPipe 所有模型源均加载失败。\n${detail}`);
}

export function getActiveModelSource() {
  return activeModelSource;
}

export async function detectPoseFromImage(imageElement) {
  const model = await initPoseLandmarker();
  const result = model.detect(imageElement);

  if (!result.landmarks || result.landmarks.length === 0) {
    return {
      success: false,
      message: "未检测到稳定人体骨架。",
      modelSource: activeModelSource
    };
  }

  return {
    success: true,
    landmarks: result.landmarks[0],
    worldLandmarks: result.worldLandmarks?.[0] || null,
    modelSource: activeModelSource
  };
}
