import React, { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BrainCircuit,
  CheckCircle2,
  FileDown,
  RefreshCcw,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import UploadBox from "./components/UploadBox.jsx";
import KeypointEditor from "./components/KeypointEditor.jsx";
import CleanImagePreview from "./components/CleanImagePreview.jsx";
import RadarChart from "./components/RadarChart.jsx";
import { detectPoseFromImage, getActiveModelSource } from "./lib/mediapipePose.js";
import { loadImageFromFile } from "./lib/imageUtils.js";
import { analyzeLineart } from "./lib/analyzeLineart.js";
import { evaluateLineartOnly } from "./lib/lineartOnlyScore.js";
import { copyLandmarks, makeDefaultLandmarks, METRICS } from "./lib/landmarks.js";

function buildReferenceImageFeatures(referenceLandmarks = []) {
  if (!referenceLandmarks.length) {
    return {
      imageOccupancy: 0.42,
      aspect: 0.42
    };
  }

  const xs = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    .map((index) => referenceLandmarks[index]?.x)
    .filter((value) => Number.isFinite(value));
  const ys = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    .map((index) => referenceLandmarks[index]?.y)
    .filter((value) => Number.isFinite(value));

  if (!xs.length || !ys.length) {
    return {
      imageOccupancy: 0.42,
      aspect: 0.42
    };
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);

  return {
    imageOccupancy: Math.min(0.95, width * height),
    aspect: width / height
  };
}


function ScoreCard({ label, value }) {
  const level = value >= 8 ? "优秀" : value >= 6.5 ? "良好" : value >= 5 ? "待提升" : "薄弱";

  return (
    <div className="score-card">
      <div className="score-card-top">
        <span>{label}</span>
        <em>{level}</em>
      </div>
      <strong>{value?.toFixed?.(1) ?? value}<i>/10</i></strong>
      <div className="score-bar">
        <b style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const [referenceFile, setReferenceFile] = useState(null);
  const [drawingFile, setDrawingFile] = useState(null);

  const [referenceUrl, setReferenceUrl] = useState("");
  const [drawingUrl, setDrawingUrl] = useState("");

  const [referenceLandmarks, setReferenceLandmarks] = useState([]);

  const [referenceStatus, setReferenceStatus] = useState("未上传参考照片");
  const [drawingStatus, setDrawingStatus] = useState("未上传线稿");

  const [referenceCalibrated, setReferenceCalibrated] = useState(false);

  const [result, setResult] = useState(null);
  const [lineAnalysis, setLineAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelSourceStatus, setModelSourceStatus] = useState("模型库尚未加载");
  const [calibrationNotice, setCalibrationNotice] = useState(
    "线稿区不会显示骨架线，也不会显示可拖动关键点。系统只显示原始线稿，但评分会根据参考图来生成。"
  );

  const canCompare = referenceFile && drawingFile;

  const orderedScores = useMemo(() => {
    if (!result?.scores) return [];
    return METRICS.map((key) => [key, result.scores[key]]);
  }, [result]);

  const setReference = (file) => {
    setReferenceFile(file);
    setReferenceUrl(URL.createObjectURL(file));
    setReferenceLandmarks([]);
    setReferenceStatus("已上传，等待识别或手动标注参考骨架");
    setReferenceCalibrated(false);
    setResult(null);
    setCalibrationNotice("参考照片已上传。参考照片可识别/校准骨架；线稿不会显示骨架或关键点。");
  };

  const setDrawing = (file) => {
    setDrawingFile(file);
    setDrawingUrl(URL.createObjectURL(file));
    setDrawingStatus("已上传线稿。线稿区仅显示原图，不显示骨架、不显示可拖动关键点。");
    setResult(null);
    setCalibrationNotice("线稿已上传。系统不会给线稿套用参考骨架，也不会在线稿上显示点位，但最终评分将以参考图为基准。");
  };

  const clearReference = () => {
    setReferenceFile(null);
    setReferenceUrl("");
    setReferenceLandmarks([]);
    setReferenceStatus("未上传参考照片");
    setReferenceCalibrated(false);
    setResult(null);
  };

  const clearDrawing = () => {
    setDrawingFile(null);
    setDrawingUrl("");
    setDrawingStatus("未上传线稿");
    setResult(null);
  };

  async function detectReferencePose() {
    try {
      const img = await loadImageFromFile(referenceFile);
      const pose = await detectPoseFromImage(img);

      if (pose.success) {
        const landmarks = copyLandmarks(pose.landmarks);
        setReferenceLandmarks(landmarks);
        setReferenceCalibrated(true);
        setReferenceStatus("参考照片已自动识别骨架；如有偏差，可拖动参考骨架修正。");

        const source = getActiveModelSource();
        if (source?.name) setModelSourceStatus(`当前模型源：${source.name}（${source.delegate}）`);

        return landmarks;
      }
    } catch (error) {
      console.warn("参考照片 MediaPipe 加载或检测失败，已切换为默认参考骨架：", error);
      setModelSourceStatus("MediaPipe 模型库未加载成功；参考照片可使用默认骨架手动校准");
    }

    const defaults = makeDefaultLandmarks();
    setReferenceLandmarks(defaults);
    setReferenceCalibrated(false);
    setReferenceStatus("参考照片未能自动识别骨架。已生成默认参考骨架，可拖动校准。");
    return defaults;
  }

  function computeScore(refPoints, line) {
    const evaluation = evaluateLineartOnly({
      referenceLandmarks: refPoints,
      referenceImageFeatures: buildReferenceImageFeatures(refPoints),
      lineAnalysis: line
    });
    setResult(evaluation);
    return evaluation;
  }

  async function runCompare() {
    if (!canCompare) {
      alert("请先上传参考照片和自己的线稿。");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const ref = referenceLandmarks.length ? referenceLandmarks : await detectReferencePose();
      const line = await analyzeLineart(drawingFile);
      setLineAnalysis(line);

      computeScore(ref, line);

      setDrawingStatus("线稿已完成图像评分：未套用参考骨架，未显示骨架线或关键点。");
      setCalibrationNotice(
        "已完成评分。注意：线稿没有显示或拖动关键点，但评分已根据参考图姿态与构图特征进行约束；比例、结构、动态分数优先反映线稿相对参考图的接近程度。"
      );
    } catch (error) {
      console.error("分析失败详细信息：", error);
      alert(
        "分析失败的常见原因：1）图片文件过大或损坏；2）浏览器读取图片失败；3）模型库未正确放置。请先换一张较小的 JPG/PNG 图片，或查看浏览器 Console 详细错误。"
      );
    } finally {
      setLoading(false);
    }
  }

  function updateReferenceLandmarks(nextReferenceLandmarks) {
    setReferenceLandmarks(nextReferenceLandmarks);
    setReferenceCalibrated(true);
    setReferenceStatus("参考骨架已手动校准。");

    if (lineAnalysis) {
      computeScore(nextReferenceLandmarks, lineAnalysis);
      setCalibrationNotice("参考骨架已更新，线稿图像评分已重新计算。线稿区仍只显示原图。");
    }
  }

  async function prepareReferenceManualMode() {
    if (!referenceFile) {
      alert("请先上传参考照片。");
      return;
    }

    const ref = referenceLandmarks.length ? referenceLandmarks : makeDefaultLandmarks();
    setReferenceLandmarks(ref);
    setReferenceStatus("已进入参考照片手动校准模式。");
    setReferenceCalibrated(Boolean(referenceLandmarks.length));
    setCalibrationNotice("请拖动参考照片上的骨架点校准参考姿态。线稿区不会出现任何点位或骨架。");
  }

  function downloadReport() {
    if (!result) return;

    const text = [
      "人物线稿结构评分报告",
      "",
      "评分模式：参考图基准评分模式（线稿不显示骨架、不显示可拖动关键点、不套用参考骨架，但评分根据参考图生成）",
      `综合分：${result.total}/10`,
      "",
      "分项评分：",
      ...METRICS.map((key) => `${key}：${result.scores[key]}/10`),
      "",
      "诊断概述：",
      result.advice.summary,
      "",
      "修改建议：",
      ...result.advice.suggestions.map((item, index) => `${index + 1}. ${item}`),
      "",
      "说明：本报告未对线稿进行可视化骨架标注，评分依据为线稿图像特征与参考图姿态/构图基准。"
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "人物线稿结构评分报告.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-badge">
          <BrainCircuit size={16} />
          参考照片 × 人物线稿结构评分
        </div>

        <div className="hero-grid">
          <div>
            <h1>上传参考照片和线稿，后台评分，不在线稿上显示骨架或关键点</h1>
            <p>
              本版取消线稿区的参考骨架套用、骨架连线和可拖动关键点。
              线稿只显示原图；系统会先读取参考图姿态与构图特征，再按参考图基准给线稿生成比例、结构、动态、线条、造型和完整度评分。
            </p>
          </div>

          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={runCompare} disabled={!canCompare || loading}>
              {loading ? "分析中..." : "开始评分"}
              <ArrowRightLeft size={18} />
            </button>

            <button type="button" className="secondary-btn" onClick={prepareReferenceManualMode} disabled={!referenceFile}>
              参考骨架校准
              <Sparkles size={18} />
            </button>

            <button type="button" className="secondary-btn" onClick={() => {
              setReferenceLandmarks([]);
              setReferenceCalibrated(false);
              setResult(null);
              setLineAnalysis(null);
              setReferenceStatus(referenceFile ? "已上传，等待识别或手动标注参考骨架" : "未上传参考照片");
              setDrawingStatus(drawingFile ? "已上传线稿。线稿区仅显示原图，不显示骨架、不显示可拖动关键点。" : "未上传线稿");
              setCalibrationNotice("已重置。线稿区仍不会显示骨架或关键点。");
            }}>
              <RefreshCcw size={18} />
              重置
            </button>
          </div>
        </div>
      </section>

      <div className="model-source-banner">
        {modelSourceStatus}
      </div>

      <div className={`calibration-banner ${result ? "ok" : "warn"}`}>
        {calibrationNotice}
      </div>

      <section className="upload-grid">
        <UploadBox
          title="上传参考照片"
          description="建议上传真实人体照片或清晰姿态参考图"
          imageUrl={referenceUrl}
          fileName={referenceFile?.name}
          onFile={setReference}
          onClear={clearReference}
        />

        <UploadBox
          title="上传自己的线稿"
          description="支持人物线稿、草图、角色结构稿"
          imageUrl={drawingUrl}
          fileName={drawingFile?.name}
          onFile={setDrawing}
          onClear={clearDrawing}
        />
      </section>

      <section className="editor-grid">
        <KeypointEditor
          title="参考照片骨架"
          imageUrl={referenceUrl}
          landmarks={referenceLandmarks}
          sourceLabel={referenceStatus}
          editable={Boolean(referenceUrl && referenceLandmarks.length)}
          onChange={updateReferenceLandmarks}
        />

        <CleanImagePreview
          title="线稿原图预览"
          imageUrl={drawingUrl}
          sourceLabel={drawingStatus}
        />
      </section>

      <section className="result-grid">
        <div className="result-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Evaluation Result</span>
              <h2>评分结果与问题指出</h2>
            </div>
            {result && (
              <button type="button" className="secondary-btn small" onClick={downloadReport}>
                <FileDown size={16} />
                导出报告
              </button>
            )}
          </div>

          {!result && (
            <div className="empty-result">
              <Sparkles size={42} />
              <p>上传参考照片和线稿后点击“开始评分”。线稿区只显示原图，不会出现骨架线、参考骨架或可拖动关键点。</p>
            </div>
          )}

          {result && (
            <>
              <div className="total-score">
                <div>
                  <span>综合分</span>
                  <strong>{result.total}</strong>
                  <em>/10</em>
                </div>
                <p>{result.advice.summary}</p>
              </div>

              <RadarChart scores={result.scores} />

              <div className="score-grid">
                {orderedScores.map(([label, value]) => (
                  <ScoreCard key={label} label={label} value={value} />
                ))}
              </div>

              {result.diagnostics && (
                <div className="problem-panel">
                  <h3>问题精确指出</h3>
                  <div className="problem-grid">
                    {(result.diagnostics.issueCards || []).map((item, index) => (
                      <div key={index} className={`issue-card severity-${item.severity}`}>
                        <span className="issue-tag">{item.category}</span>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                        <em>修改建议：{item.suggestion}</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="advice-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Teaching Feedback</span>
              <h2>诊断建议</h2>
            </div>
            {result ? <CheckCircle2 className="ok-icon" /> : <TriangleAlert className="warn-icon" />}
          </div>

          {!result ? (
            <div className="tips">
              <p>当前版本规则：</p>
              <ol>
                <li>线稿不套用参考骨架。</li>
                <li>线稿不显示骨架线。</li>
                <li>线稿不显示可拖动关键点。</li>
                <li>线稿评分依据图像特征、线条质量、主体完整度，并以参考图的姿态与构图为基准。</li>
              </ol>
            </div>
          ) : (
            <div className="advice-list">
              {result.advice.suggestions.map((item, index) => (
                <p key={index}>{index + 1}. {item}</p>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
