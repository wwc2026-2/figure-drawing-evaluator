import { METRICS } from "./landmarks.js";

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

function relativeSimilarity(value, target, tolerance = 0.3) {
  const diff = Math.abs(value - target) / Math.max(Math.abs(target), 0.001);
  return clamp(1 - diff / tolerance, 0, 1);
}

function angleSimilarity(value, target, tolerance = 28) {
  let diff = Math.abs(value - target) % 360;
  if (diff > 180) diff = 360 - diff;
  if (diff > 90) diff = 180 - diff;
  return clamp(1 - diff / tolerance, 0, 1);
}

function getReferencePoseFeatures(referenceLandmarks = []) {
  if (!referenceLandmarks.length) {
    return {
      hasPose: false,
      shoulderHipRatio: 1.2,
      torsoLegRatio: 0.72,
      axisAngle: 90,
      shoulderAngle: 0,
      hipAngle: 0,
      spreadLevel: 0.55,
      dynamicLevel: 0.55
    };
  }

  const p = referenceLandmarks;
  const shoulderCenter = midpoint(p[11], p[12]);
  const hipCenter = midpoint(p[23], p[24]);

  const shoulderWidth = dist(p[11], p[12]);
  const hipWidth = dist(p[23], p[24]);
  const torso = dist(shoulderCenter, hipCenter);
  const leftLeg = dist(p[23], p[25]) + dist(p[25], p[27]);
  const rightLeg = dist(p[24], p[26]) + dist(p[26], p[28]);
  const avgLeg = (leftLeg + rightLeg) / 2;

  const shoulderAngle = angle(p[11], p[12]);
  const hipAngle = angle(p[23], p[24]);
  const axisAngle = angle(shoulderCenter, hipCenter);

  let twist = Math.abs(shoulderAngle - hipAngle);
  if (twist > 180) twist = 360 - twist;
  if (twist > 90) twist = 180 - twist;

  const spread = dist(p[15], p[16]) + dist(p[27], p[28]);
  const spreadLevel = clamp(spread / 1.6, 0, 1);
  const dynamicLevel = clamp(
    (twist / 40) * 0.45 +
      spreadLevel * 0.35 +
      Math.abs(shoulderCenter.x - hipCenter.x) * 0.8 * 0.20,
    0,
    1
  );

  return {
    hasPose: true,
    shoulderHipRatio: shoulderWidth / Math.max(hipWidth, 0.001),
    torsoLegRatio: torso / Math.max(avgLeg, 0.001),
    axisAngle,
    shoulderAngle,
    hipAngle,
    spreadLevel,
    dynamicLevel
  };
}

function getReferenceImageTargets(referenceImageFeatures = {}, refPose = {}) {
  const occupancy = referenceImageFeatures.imageOccupancy ?? 0.42;
  const aspect = referenceImageFeatures.aspect ?? 0.42;

  return {
    targetOccupancy: clamp(occupancy, 0.12, 0.78),
    targetAspect: clamp(aspect, 0.15, 1.2),
    targetDensity: clamp(0.14 + (refPose.dynamicLevel ?? 0.55) * 0.05, 0.10, 0.22),
    targetContinuity: 0.90,
    targetDynamicContour: clamp(0.52 + (refPose.dynamicLevel ?? 0.55) * 0.28, 0.42, 0.90)
  };
}

function makeIssue(severity, category, title, description, suggestion) {
  return { severity, category, title, description, suggestion };
}

function buildIssueCards(scores, details, lineAnalysis, refPose, refTargets) {
  const issues = [];
  const features = lineAnalysis?.features || {};
  const occupancy = features.imageOccupancy ?? refTargets.targetOccupancy;
  const aspect = features.aspect ?? refTargets.targetAspect;
  const density = features.density ?? refTargets.targetDensity;
  const brokenRatio = features.brokenRatio ?? 0.01;

  const occupancyGap = occupancy - refTargets.targetOccupancy;
  if (details.occupancySimilarity < 0.75) {
    if (occupancyGap < 0) {
      issues.push(
        makeIssue(
          details.occupancySimilarity < 0.45 ? "high" : "medium",
          "比例",
          "人物画得偏小",
          "线稿中的人物主体占画面比例低于参考图，整体显得偏小或留白过多。",
          "放大人物主体，减少无效空白，让人物在画面中的占比更接近参考图。"
        )
      );
    } else {
      issues.push(
        makeIssue(
          details.occupancySimilarity < 0.45 ? "high" : "medium",
          "比例",
          "人物画得偏大",
          "线稿中的人物主体占画面比例高于参考图，可能导致构图过满、动作空间不足。",
          "适当缩小人物主体或回收外轮廓，留出与参考图相近的画面呼吸空间。"
        )
      );
    }
  }

  const aspectGap = aspect - refTargets.targetAspect;
  if (details.aspectSimilarity < 0.75) {
    if (aspectGap > 0) {
      issues.push(
        makeIssue(
          details.aspectSimilarity < 0.45 ? "high" : "medium",
          "造型",
          "人物外轮廓偏宽",
          "线稿整体横向展开大于参考图，可能出现肩过宽、手臂张得过开，或纵向比例不足的问题。",
          "先从剪影入手压缩横向宽度，检查肩宽、手臂张开幅度和人物整体高宽比。"
        )
      );
    } else {
      issues.push(
        makeIssue(
          details.aspectSimilarity < 0.45 ? "high" : "medium",
          "造型",
          "人物外轮廓偏窄",
          "线稿整体横向展开小于参考图，可能存在四肢收得太紧、身体被压缩的问题。",
          "适当拉开四肢和躯干的横向关系，让人物外轮廓更接近参考图的大形。"
        )
      );
    }
  }

  if (details.dynamicContourSimilarity < 0.75) {
    const title = refPose.dynamicLevel > 0.65 ? "动作张力不足" : "动作趋势不够接近参考图";
    const desc = refPose.dynamicLevel > 0.65
      ? "参考图动作较强，但线稿的轮廓变化和展开感偏弱，容易显得动作发僵。"
      : "线稿的整体动作趋势与参考图仍有差异，表现力稍弱。";
    issues.push(
      makeIssue(
        details.dynamicContourSimilarity < 0.45 ? "high" : "medium",
        "动态",
        title,
        desc,
        "重点核对肩胯方向、四肢朝向和重心变化，强化动作线，让线稿更接近参考图的动态节奏。"
      )
    );
  }

  if (brokenRatio > 0.012) {
    issues.push(
      makeIssue(
        brokenRatio > 0.02 ? "high" : "medium",
        "线条",
        "线条碎且反复描线较多",
        "线稿中存在较多碎线、断线或来回描线，削弱了人体结构的清晰度。",
        "减少碎线和反复描摹，用更明确的长线概括主结构，再补充局部细节。"
      )
    );
  }

  if (density < 0.07) {
    issues.push(
      makeIssue(
        "medium",
        "结构",
        "结构线不足",
        "当前线稿信息量偏少，躯干转折、骨盆朝向或四肢主干线表达不够清楚。",
        "在不加骨架显示的前提下，建议你在草稿阶段先补充胸腔、骨盆和肢体主干的结构线。"
      )
    );
  }

  if ((lineAnalysis?.completenessByImage ?? 7) < 6.2) {
    issues.push(
      makeIssue(
        "medium",
        "完整度",
        "人物主体不够完整",
        "人物可能过小、被裁切，或主体与背景关系不够清晰，影响结构判断。",
        "确保人物主体完整入画，头部、四肢末端和主要身体体块尽量清晰可见。"
      )
    );
  }

  if (!issues.length) {
    issues.push(
      makeIssue(
        "low",
        "综合",
        "整体接近参考图",
        "从当前图像特征看，线稿与参考图的构图和动态趋势较为接近。",
        "可继续细化局部结构与线条质量，进一步提升完成度。"
      )
    );
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, 6);
}

function buildDiagnostics(scores, details, lineAnalysis, refPose, refTargets) {
  const notes = [];
  if (refPose.hasPose) {
    notes.push("当前评分以参考图为基准：比例、结构、动态分数优先反映线稿相对参考图的接近程度。");
  } else {
    notes.push("参考图骨架未识别成功，当前评分部分退回到基于构图和线条的估算。");
  }

  const weak = Object.entries(scores).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([key]) => key);
  const issueCards = buildIssueCards(scores, details, lineAnalysis, refPose, refTargets);

  return {
    mode: "参考图基准评分模式",
    notes,
    weak,
    details,
    issueCards
  };
}

function buildAdvice(scores, diagnostics) {
  const suggestions = [];

  diagnostics.issueCards.forEach((item) => {
    suggestions.push(`${item.title}：${item.suggestion}`);
  });

  if (diagnostics.weak.includes("比例")) {
    suggestions.push("比例复核：请优先比较线稿与参考图的人物高宽关系、主体占画面比例，以及头身总体长度关系。");
  }

  if (diagnostics.weak.includes("结构")) {
    suggestions.push("结构复核：建议在修改稿中先用肩线、胯线、躯干中轴复核人体结构，再回到正式线稿。");
  }

  if (diagnostics.weak.includes("动态")) {
    suggestions.push("动态复核：请重点比较四肢展开方向、重心变化和肩胯扭转。");
  }

  suggestions.push(...diagnostics.notes);

  return {
    summary: `当前采用“参考图基准评分模式”：分数围绕参考图的构图与姿态特征生成，优先改进“${diagnostics.weak.join("、")}”。`,
    suggestions: Array.from(new Set(suggestions)).slice(0, 10)
  };
}

export function evaluateLineartOnly({ referenceLandmarks, referenceImageFeatures, lineAnalysis }) {
  const features = lineAnalysis?.features || {};
  const refPose = getReferencePoseFeatures(referenceLandmarks);
  const refTargets = getReferenceImageTargets(referenceImageFeatures, refPose);

  const occupancySimilarity = relativeSimilarity(
    features.imageOccupancy ?? refTargets.targetOccupancy,
    refTargets.targetOccupancy,
    0.45
  );
  const aspectSimilarity = relativeSimilarity(
    features.aspect ?? refTargets.targetAspect,
    refTargets.targetAspect,
    0.45
  );
  const densitySimilarity = relativeSimilarity(
    features.density ?? refTargets.targetDensity,
    refTargets.targetDensity,
    0.55
  );
  const continuitySimilarity = clamp(
    (10 - ((features.brokenRatio ?? 0.01) * 360)) / 10,
    0,
    1
  );

  const axisSimilarity = refPose.hasPose
    ? angleSimilarity(refPose.axisAngle, 90, 65)
    : 0.65;

  const dynamicContourSimilarity = relativeSimilarity(
    features.edgeDensity ?? refTargets.targetDynamicContour,
    refTargets.targetDynamicContour,
    0.60
  );

  const proportion = clamp(
    (occupancySimilarity * 0.42 + aspectSimilarity * 0.38 + densitySimilarity * 0.20) * 10
  );

  const structure = clamp(
    (occupancySimilarity * 0.28 +
      aspectSimilarity * 0.28 +
      continuitySimilarity * 0.24 +
      axisSimilarity * 0.20) * 10
  );

  const refDynamicWeight = refPose.dynamicLevel;
  const dynamic = clamp(
    (dynamicContourSimilarity * (0.55 + refDynamicWeight * 0.10) +
      continuitySimilarity * 0.20 +
      aspectSimilarity * 0.15 +
      densitySimilarity * 0.10) * 10
  );

  const line = lineAnalysis?.lineScore ?? clamp(
    (continuitySimilarity * 0.45 + densitySimilarity * 0.20 + 0.35) * 10
  );
  const shape = lineAnalysis?.shapeScore ?? clamp(
    (occupancySimilarity * 0.40 + aspectSimilarity * 0.40 + dynamicContourSimilarity * 0.20) * 10
  );
  const completeness = lineAnalysis?.completenessByImage ?? clamp(
    (occupancySimilarity * 0.55 + continuitySimilarity * 0.45) * 10
  );

  const scores = {
    比例: round1(proportion),
    结构: round1(structure),
    动态: round1(dynamic),
    线条: round1(line),
    造型: round1(shape),
    完整度: round1(completeness),
  };

  const total = round1(
    scores.比例 * 0.24 +
      scores.结构 * 0.22 +
      scores.动态 * 0.18 +
      scores.线条 * 0.16 +
      scores.造型 * 0.14 +
      scores.完整度 * 0.06
  );

  const details = {
    occupancySimilarity: round1(occupancySimilarity * 10) / 10,
    aspectSimilarity: round1(aspectSimilarity * 10) / 10,
    densitySimilarity: round1(densitySimilarity * 10) / 10,
    continuitySimilarity: round1(continuitySimilarity * 10) / 10,
    dynamicContourSimilarity: round1(dynamicContourSimilarity * 10) / 10,
    referenceDynamicLevel: round1(refPose.dynamicLevel * 10) / 10,
  };

  const diagnostics = buildDiagnostics(scores, details, lineAnalysis, refPose, refTargets);

  return {
    total,
    scores,
    diagnostics,
    advice: buildAdvice(scores, diagnostics)
  };
}

export { METRICS };
