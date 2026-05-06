export const METRICS = ["比例", "结构", "动态", "线条", "造型", "完整度"];

export const KEYPOINTS = [
  { index: 0, name: "头部" },
  { index: 11, name: "左肩" },
  { index: 12, name: "右肩" },
  { index: 13, name: "左肘" },
  { index: 14, name: "右肘" },
  { index: 15, name: "左腕" },
  { index: 16, name: "右腕" },
  { index: 23, name: "左胯" },
  { index: 24, name: "右胯" },
  { index: 25, name: "左膝" },
  { index: 26, name: "右膝" },
  { index: 27, name: "左踝" },
  { index: 28, name: "右踝" }
];

export const IMPORTANT_INDEXES = KEYPOINTS.map((item) => item.index);

export const CONNECTIONS = [
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28]
];

export const SPECIAL_LINES = {
  shoulder: [11, 12],
  hip: [23, 24],
  axis: [33, 34]
};

export function makeEmptyLandmarks() {
  return Array.from({ length: 35 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1
  }));
}

export function makeDefaultLandmarks() {
  const points = makeEmptyLandmarks();

  const set = (index, x, y) => {
    points[index] = { x, y, z: 0, visibility: 1 };
  };

  set(0, 0.5, 0.12);

  set(11, 0.38, 0.27);
  set(12, 0.62, 0.27);

  set(13, 0.30, 0.43);
  set(14, 0.70, 0.43);

  set(15, 0.26, 0.58);
  set(16, 0.74, 0.58);

  set(23, 0.42, 0.53);
  set(24, 0.58, 0.53);

  set(25, 0.40, 0.73);
  set(26, 0.60, 0.73);

  set(27, 0.38, 0.92);
  set(28, 0.62, 0.92);

  return points;
}

export function copyLandmarks(landmarks) {
  const base = makeDefaultLandmarks();
  if (!landmarks?.length) return base;

  landmarks.forEach((p, index) => {
    if (p) {
      base[index] = {
        x: Number.isFinite(p.x) ? p.x : 0.5,
        y: Number.isFinite(p.y) ? p.y : 0.5,
        z: Number.isFinite(p.z) ? p.z : 0,
        visibility: p.visibility ?? 1
      };
    }
  });

  return base;
}

export function isVisible(point) {
  return point && (point.visibility ?? 1) > 0.18;
}

export function pointName(index) {
  return KEYPOINTS.find((item) => item.index === index)?.name || `点${index}`;
}
