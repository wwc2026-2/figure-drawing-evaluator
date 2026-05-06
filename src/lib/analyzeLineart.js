const clamp = (value, min = 0, max = 10) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;

function scoreFromDistance(value, target, tolerance, minScore = 3) {
  const d = Math.abs(value - target);
  const normalized = Math.min(1, d / tolerance);
  return clamp(10 - normalized * (10 - minScore), minScore, 10);
}

async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}

export async function analyzeLineart(file) {
  const img = await loadImage(file);
  const maxSize = 900;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;
  const total = width * height;
  const gray = new Uint8ClampedArray(total);

  let avg = 0;
  for (let i = 0; i < total; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[i] = v;
    avg += v;
  }
  avg /= total;

  const threshold = Math.min(245, Math.max(150, avg - 8));
  const ink = new Uint8Array(total);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let inkCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (gray[index] < threshold) {
        ink[index] = 1;
        inkCount++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (inkCount < total * 0.001) {
    return {
      lineScore: 4,
      shapeScore: 4,
      completenessByImage: 4,
      notes: ["线稿信息较少，建议上传更清晰的人物线稿。"]
    };
  }

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const bboxArea = Math.max(1, bboxW * bboxH);
  const density = inkCount / bboxArea;
  const imageOccupancy = bboxArea / total;
  const aspect = bboxW / Math.max(1, bboxH);

  let edgeCount = 0;
  let edgeStrengthSum = 0;
  let isolated = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const index = y * width + x;
      const gx = Math.abs(gray[index + 1] - gray[index - 1]);
      const gy = Math.abs(gray[index + width] - gray[index - width]);
      const edge = gx + gy;

      if (edge > 20) {
        edgeCount++;
        edgeStrengthSum += edge;
      }

      if (ink[index]) {
        const n =
          ink[index - 1] +
          ink[index + 1] +
          ink[index - width] +
          ink[index + width] +
          ink[index - width - 1] +
          ink[index - width + 1] +
          ink[index + width - 1] +
          ink[index + width + 1];

        if (n <= 1) isolated++;
      }
    }
  }

  const edgeDensity = edgeCount / ((width * height) / 4);
  const edgeStrength = edgeCount ? edgeStrengthSum / edgeCount : 0;
  const brokenRatio = isolated / Math.max(1, inkCount);

  const lineClarity = clamp(edgeStrength / 22, 3, 10);
  const lineDensity = scoreFromDistance(edgeDensity, 0.08, 0.08, 4);
  const lineContinuity = clamp(10 - brokenRatio * 360, 3, 10);

  const lineScore = round1(lineClarity * 0.35 + lineDensity * 0.30 + lineContinuity * 0.35);

  const silhouetteScore = scoreFromDistance(aspect, 0.42, 0.52, 4);
  const densityScore = scoreFromDistance(density, 0.18, 0.16, 4);
  const occupancyScore = scoreFromDistance(imageOccupancy, 0.48, 0.45, 5);

  const shapeScore = round1(silhouetteScore * 0.35 + densityScore * 0.25 + occupancyScore * 0.40);
  const completenessByImage = round1(occupancyScore * 0.65 + lineContinuity * 0.35);

  const notes = [];
  if (brokenRatio > 0.012) notes.push("线稿碎线或孤立线段较多，建议减少反复描线。");
  if (imageOccupancy < 0.18) notes.push("人物主体占画面比例偏小，结构判断可能不够充分。");
  if (density < 0.06) notes.push("线条偏淡或信息量不足，可适当增强结构线。");

  return {
    lineScore,
    shapeScore,
    completenessByImage,
    features: {
      density,
      edgeDensity,
      edgeStrength,
      brokenRatio,
      imageOccupancy,
      aspect
    },
    notes
  };
}
