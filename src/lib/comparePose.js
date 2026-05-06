import { IMPORTANT_INDEXES, makeDefaultLandmarks, pointName } from "./landmarks.js";

const clamp = (value, min = 0, max = 10) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;

function dist(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a, b) {
  if (!a || !b) return 0;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function midpoint(a, b) {
  return {
    x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2,
    y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2
  };
}

function safeLandmarks(points) {
  return points?.length ? points : makeDefaultLandmarks();
}

function angleDiff(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  if (diff > 90) diff = 180 - diff;
  return Math.abs(diff);
}

function normalizeLandmarks(points) {
  const landmarks = safeLandmarks(points);
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const center = {
    x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
    y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4
  };

  const shoulderWidth = dist(leftShoulder, rightShoulder);
  const torsoLeft = dist(leftShoulder, leftHip);
  const torsoRight = dist(rightShoulder, rightHip);
  const scale = Math.max(shoulderWidth, torsoLeft, torsoRight, 0.001);

  return landmarks.map((p) => ({
    x: ((p?.x ?? center.x) - center.x) / scale,
    y: ((p?.y ?? center.y) - center.y) / scale,
    visibility: p?.visibility ?? 1
  }));
}

function getMetrics(points) {
  const p = safeLandmarks(points);

  const shoulderCenter = midpoint(p[11], p[12]);
  const hipCenter = midpoint(p[23], p[24]);

  const leftUpperArm = dist(p[11], p[13]);
  const rightUpperArm = dist(p[12], p[14]);
  const leftLowerArm = dist(p[13], p[15]);
  const rightLowerArm = dist(p[14], p[16]);

  const leftUpperLeg = dist(p[23], p[25]);
  const rightUpperLeg = dist(p[24], p[26]);
  const leftLowerLeg = dist(p[25], p[27]);
  const rightLowerLeg = dist(p[26], p[28]);

  const leftArm = leftUpperArm + leftLowerArm;
  const rightArm = rightUpperArm + rightLowerArm;
  const leftLeg = leftUpperLeg + leftLowerLeg;
  const rightLeg = rightUpperLeg + rightLowerLeg;

  const shoulderWidth = dist(p[11], p[12]);
  const hipWidth = dist(p[23], p[24]);
  const torso = dist(shoulderCenter, hipCenter);

  const shoulderAngle = angle(p[11], p[12]);
  const hipAngle = angle(p[23], p[24]);
  const axisAngle = angle(shoulderCenter, hipCenter);
  const shoulderHipTwist = angleDiff(shoulderAngle, hipAngle);
  const limbSpread = dist(p[15], p[16]) + dist(p[27], p[28]);
  const bodyAxisOffset = Math.abs(shoulderCenter.x - hipCenter.x);

  return {
    shoulderWidth,
    hipWidth,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftUpperArm,
    rightUpperArm,
    leftLowerArm,
    rightLowerArm,
    leftUpperLeg,
    rightUpperLeg,
    leftLowerLeg,
    rightLowerLeg,
    shoulderHipRatio: shoulderWidth / Math.max(hipWidth, 0.001),
    torsoLegRatio: torso / Math.max((leftLeg + rightLeg) / 2, 0.001),
    armLegRatio: ((leftArm + rightArm) / 2) / Math.max((leftLeg + rightLeg) / 2, 0.001),
    leftRightArmRatio: leftArm / Math.max(rightArm, 0.001),
    leftRightLegRatio: leftLeg / Math.max(rightLeg, 0.001),
    shoulderAngle,
    hipAngle,
    axisAngle,
    shoulderHipTwist,
    limbSpread,
    bodyAxisOffset
  };
}

function scoreByRelativeDiff(diff, factor) {
  return clamp(10 - diff * factor, 0, 10);
}

function relativeDiff(refValue, drawValue) {
  return Math.abs((drawValue ?? 0) - (refValue ?? 0)) / Math.max(Math.abs(refValue ?? 0), 0.001);
}

function averagePointDistance(reference, drawing, indexes) {
  const ref = normalizeLandmarks(reference);
  const draw = normalizeLandmarks(drawing);

  let total = 0;
  let count = 0;
  const details = [];

  indexes.forEach((index) => {
    const d = dist(ref[index], draw[index]);
    total += d;
    count++;
    details.push({ index, name: pointName(index), diff: d });
  });

  details.sort((a, b) => b.diff - a.diff);

  return {
    avg: total / Math.max(count, 1),
    details
  };
}

function makeRatioDetail(label, refValue, drawValue, factor, directionText) {
  const diff = relativeDiff(refValue, drawValue);
  const score = scoreByRelativeDiff(diff, factor);

  return {
    label,
    refValue,
    drawValue,
    diff,
    score,
    direction: drawValue > refValue ? `${label}偏大` : `${label}偏小`,
    text:
      drawValue > refValue
        ? `${label}比参考图偏大，${directionText || "建议压缩该部分长度或宽度。"}`
        : `${label}比参考图偏小，${directionText || "建议适当拉开该部分长度或宽度。"}`
  };
}

function makeAngleDetail(label, refValue, drawValue, factor, teachingText) {
  const diff = angleDiff(refValue, drawValue);
  const score = clamp(10 - diff * factor, 0, 10);

  return {
    label,
    refValue,
    drawValue,
    diff,
    score,
    direction: `${label}角度偏差 ${round1(diff)}°`,
    text: `${label}与参考图相差约 ${round1(diff)}°，${teachingText}`
  };
}

function scoreAverage(items) {
  return clamp(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1));
}

export function comparePoseScore(referenceLandmarks, drawingLandmarks, lineAnalysis) {
  const refMetrics = getMetrics(referenceLandmarks);
  const drawMetrics = getMetrics(drawingLandmarks);

  const proportionDetails = [
    makeRatioDetail("肩胯比例", refMetrics.shoulderHipRatio, drawMetrics.shoulderHipRatio, 8.5, "建议重新检查肩宽与骨盆宽度的关系。"),
    makeRatioDetail("躯干/腿部比例", refMetrics.torsoLegRatio, drawMetrics.torsoLegRatio, 8.0, "建议核对胸腔、骨盆与腿部长度关系。"),
    makeRatioDetail("手臂/腿部比例", refMetrics.armLegRatio, drawMetrics.armLegRatio, 7.5, "建议核对手臂长度和腿部长度是否对应参考动作。"),
    makeRatioDetail("左右手臂长度", refMetrics.leftRightArmRatio, drawMetrics.leftRightArmRatio, 7.2, "建议分别检查左右上臂、前臂长度。"),
    makeRatioDetail("左右腿部长度", refMetrics.leftRightLegRatio, drawMetrics.leftRightLegRatio, 7.2, "建议分别检查左右大腿、小腿长度。")
  ];

  const proportion = scoreAverage(proportionDetails);

  const structureAngleDetails = [
    makeAngleDetail("肩线", refMetrics.shoulderAngle, drawMetrics.shoulderAngle, 0.22, "建议对照参考图调整左右肩的高低关系。"),
    makeAngleDetail("胯线", refMetrics.hipAngle, drawMetrics.hipAngle, 0.22, "建议对照参考图调整骨盆倾斜方向。"),
    makeAngleDetail("人体中轴", refMetrics.axisAngle, drawMetrics.axisAngle, 0.18, "建议调整胸腔中心到骨盆中心的连线方向。")
  ];

  const structurePoint = averagePointDistance(referenceLandmarks, drawingLandmarks, [11, 12, 13, 14, 23, 24, 25, 26]);
  const structurePointScore = clamp(10 - structurePoint.avg * 6.2, 0, 10);
  const structure = clamp(scoreAverage(structureAngleDetails) * 0.48 + structurePointScore * 0.52);

  const dynamicDetails = [
    makeAngleDetail("肩胯扭转", refMetrics.shoulderHipTwist, drawMetrics.shoulderHipTwist, 0.18, "建议观察肩线与胯线是否形成与参考图一致的扭转关系。"),
    makeRatioDetail("四肢展开幅度", refMetrics.limbSpread, drawMetrics.limbSpread, 5.4, "建议核对手腕、脚踝向外展开的位置。"),
    makeRatioDetail("重心偏移", refMetrics.bodyAxisOffset, drawMetrics.bodyAxisOffset, 5.8, "建议检查肩部中心与胯部中心是否对应参考图的重心变化。")
  ];

  const dynamicPoint = averagePointDistance(referenceLandmarks, drawingLandmarks, [15, 16, 27, 28, 13, 14, 25, 26]);
  const dynamicPointScore = clamp(10 - dynamicPoint.avg * 5.8, 0, 10);
  const dynamic = clamp(scoreAverage(dynamicDetails) * 0.50 + dynamicPointScore * 0.50);

  const shapePoint = averagePointDistance(referenceLandmarks, drawingLandmarks, IMPORTANT_INDEXES);
  const shapePointScore = clamp(10 - shapePoint.avg * 5.0, 0, 10);

  const visibleCount = IMPORTANT_INDEXES.filter((index) => {
    const p = drawingLandmarks?.[index];
    return p && (p.visibility ?? 1) > 0.18;
  }).length;

  const keypointCompleteness = clamp((visibleCount / IMPORTANT_INDEXES.length) * 10);
  const imageCompleteness = lineAnalysis?.completenessByImage ?? 7;
  const completeness = clamp(keypointCompleteness * 0.55 + imageCompleteness * 0.45);

  const lineScore = lineAnalysis?.lineScore ?? 7;
  const shape = clamp(shapePointScore * 0.68 + (lineAnalysis?.shapeScore ?? 7) * 0.32);

  const scores = {
    比例: round1(proportion),
    结构: round1(structure),
    动态: round1(dynamic),
    线条: round1(lineScore),
    造型: round1(shape),
    完整度: round1(completeness)
  };

  const total = round1(
    scores.比例 * 0.25 +
      scores.结构 * 0.25 +
      scores.动态 * 0.20 +
      scores.线条 * 0.15 +
      scores.造型 * 0.10 +
      scores.完整度 * 0.05
  );

  const diagnostics = {
    proportionDetails: proportionDetails.sort((a, b) => a.score - b.score),
    structureAngleDetails: structureAngleDetails.sort((a, b) => a.score - b.score),
    dynamicDetails: dynamicDetails.sort((a, b) => a.score - b.score),
    structurePointDetails: structurePoint.details.slice(0, 4),
    dynamicPointDetails: dynamicPoint.details.slice(0, 4),
    shapePointDetails: shapePoint.details.slice(0, 5),
    lineNotes: lineAnalysis?.notes || []
  };

  return {
    total,
    scores,
    diagnostics,
    debug: { refMetrics, drawMetrics },
    advice: buildAdvice(scores, diagnostics)
  };
}

function buildAdvice(scores, diagnostics) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const weak = sorted.slice(0, 2).map(([key]) => key);
  const strong = sorted.slice(-2).reverse().map(([key]) => key);

  const suggestions = [];

  if (weak.includes("比例")) {
    const main = diagnostics.proportionDetails[0];
    suggestions.push(`比例问题重点：${main.text}`);
    const second = diagnostics.proportionDetails[1];
    if (second) suggestions.push(`比例次要问题：${second.text}`);
  }

  if (weak.includes("结构")) {
    const angleProblem = diagnostics.structureAngleDetails[0];
    suggestions.push(`结构问题重点：${angleProblem.text}`);
    const pointNames = diagnostics.structurePointDetails.slice(0, 3).map((item) => item.name).join("、");
    if (pointNames) suggestions.push(`结构偏差较大的关键点集中在：${pointNames}。建议优先核对这些关节与参考图的位置。`);
  }

  if (weak.includes("动态")) {
    const main = diagnostics.dynamicDetails[0];
    suggestions.push(`动态问题重点：${main.text}`);
    const pointNames = diagnostics.dynamicPointDetails.slice(0, 3).map((item) => item.name).join("、");
    if (pointNames) suggestions.push(`动态偏差较大的部位集中在：${pointNames}。建议重新观察动作线和四肢展开方向。`);
  }

  if (weak.includes("线条")) {
    if (diagnostics.lineNotes.length) {
      suggestions.push(`线条问题重点：${diagnostics.lineNotes[0]}`);
    } else {
      suggestions.push("线条问题重点：建议减少碎线和反复描线，用更明确的长线表达人体主要结构。");
    }
  }

  if (weak.includes("造型")) {
    const pointNames = diagnostics.shapePointDetails.slice(0, 4).map((item) => item.name).join("、");
    suggestions.push(`造型问题重点：线稿与参考图的大形偏差主要体现在 ${pointNames || "头部、肩部、四肢端点"}，建议从剪影关系重新校正外轮廓。`);
  }

  if (weak.includes("完整度")) {
    suggestions.push("完整度问题重点：请确认头、肩、肘、腕、胯、膝、踝等关键点都已经准确标注，且人物主体没有被裁切。");
  }

  if (suggestions.length < 4) {
    const p = diagnostics.proportionDetails[0];
    const s = diagnostics.structureAngleDetails[0];
    const d = diagnostics.dynamicDetails[0];
    suggestions.push(`比例复核：${p.text}`);
    suggestions.push(`结构复核：${s.text}`);
    suggestions.push(`动态复核：${d.text}`);
  }

  if (diagnostics.lineNotes.length) suggestions.push(...diagnostics.lineNotes.slice(0, 2));

  return {
    summary: `对比结果：线稿在“${strong.join("、")}”方面相对较好，优先改进“${weak.join("、")}”。`,
    suggestions: Array.from(new Set(suggestions)).slice(0, 8)
  };
}
