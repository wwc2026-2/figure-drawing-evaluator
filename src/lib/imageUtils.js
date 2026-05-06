export function loadImageFromFile(file) {
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

export function canvasToImage(canvas) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL("image/png");
  });
}

export async function preprocessLineArtForPose(file) {
  const img = await loadImageFromFile(file);

  const maxSize = 1000;
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

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const threshold = 226;

    if (gray < threshold) {
      data[i] = 10;
      data[i + 1] = 10;
      data[i + 2] = 10;
    } else {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }

    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // 线条加粗，提升线稿被姿态模型读到的概率。
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(canvas, -1, 0);
  ctx.drawImage(canvas, 1, 0);
  ctx.drawImage(canvas, 0, -1);
  ctx.drawImage(canvas, 0, 1);
  ctx.globalCompositeOperation = "source-over";

  return canvasToImage(canvas);
}
