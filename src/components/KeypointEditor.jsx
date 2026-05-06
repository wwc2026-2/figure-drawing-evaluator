import React, { useEffect, useMemo, useRef, useState } from "react";
import { CONNECTIONS, IMPORTANT_INDEXES, KEYPOINTS, isVisible, pointName } from "../lib/landmarks.js";

function getRenderedImageRect(img, canvasWidth, canvasHeight) {
  if (!img?.naturalWidth || !img?.naturalHeight) {
    return { offsetX: 0, offsetY: 0, width: canvasWidth, height: canvasHeight };
  }

  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = img.naturalWidth / img.naturalHeight;

  let width = canvasWidth;
  let height = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    height = canvasWidth / imageRatio;
    offsetY = (canvasHeight - height) / 2;
  } else {
    width = canvasHeight * imageRatio;
    offsetX = (canvasWidth - width) / 2;
  }

  return { offsetX, offsetY, width, height };
}

function toCanvasPoint(point, rect) {
  return {
    x: rect.offsetX + point.x * rect.width,
    y: rect.offsetY + point.y * rect.height
  };
}

function fromCanvasPoint(x, y, rect) {
  return {
    x: Math.max(0, Math.min(1, (x - rect.offsetX) / rect.width)),
    y: Math.max(0, Math.min(1, (y - rect.offsetY) / rect.height))
  };
}

export default function KeypointEditor({
  title,
  imageUrl,
  landmarks = [],
  onChange,
  editable = false,
  sourceLabel = "",
  compact = false,
  showSkeleton = true,
  showLabels = true
}) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const dragIndexRef = useRef(null);
  const rectRef = useRef(null);
  const [imageTick, setImageTick] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const importantPoints = useMemo(() => {
    return IMPORTANT_INDEXES.map((index) => ({
      index,
      point: landmarks[index],
      name: pointName(index)
    }));
  }, [landmarks]);

  useEffect(() => {
    const draw = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      const img = imgRef.current;

      if (!wrap || !canvas) return;

      const box = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
      canvas.style.width = `${box.width}px`;
      canvas.style.height = `${box.height}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);

      if (!imageUrl || !landmarks?.length) return;

      const rect = getRenderedImageRect(img, box.width, box.height);
      rectRef.current = rect;

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const x = rect.offsetX + (rect.width * i) / 3;
        const y = rect.offsetY + (rect.height * i) / 3;
        ctx.beginPath();
        ctx.moveTo(x, rect.offsetY);
        ctx.lineTo(x, rect.offsetY + rect.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rect.offsetX, y);
        ctx.lineTo(rect.offsetX + rect.width, y);
        ctx.stroke();
      }
      ctx.restore();

      const drawLine = (aIndex, bIndex, options = {}) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!isVisible(a) || !isVisible(b)) return;

        const pa = toCanvasPoint(a, rect);
        const pb = toCanvasPoint(b, rect);

        ctx.save();
        ctx.strokeStyle = options.color || "rgba(34, 211, 184, 0.94)";
        ctx.lineWidth = options.width || 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (options.dashed) ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.restore();
      };

      if (showSkeleton) {
        CONNECTIONS.forEach(([a, b]) => drawLine(a, b));

        drawLine(11, 12, { color: "rgba(255, 204, 73, 0.98)", width: 5 });
        drawLine(23, 24, { color: "rgba(255, 132, 88, 0.98)", width: 5 });

        if (isVisible(landmarks[11]) && isVisible(landmarks[12]) && isVisible(landmarks[23]) && isVisible(landmarks[24])) {
          const shoulderCenter = {
            x: (landmarks[11].x + landmarks[12].x) / 2,
            y: (landmarks[11].y + landmarks[12].y) / 2
          };
          const hipCenter = {
            x: (landmarks[23].x + landmarks[24].x) / 2,
            y: (landmarks[23].y + landmarks[24].y) / 2
          };

          const ps = toCanvasPoint(shoulderCenter, rect);
          const ph = toCanvasPoint(hipCenter, rect);

          ctx.save();
          ctx.strokeStyle = "rgba(126, 140, 255, 0.98)";
          ctx.lineWidth = 5;
          ctx.setLineDash([10, 8]);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ps.x, ps.y);
          ctx.lineTo(ph.x, ph.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      importantPoints.forEach(({ index, point }) => {
        if (!isVisible(point)) return;
        const p = toCanvasPoint(point, rect);

        ctx.save();
        ctx.fillStyle = selectedIndex === index ? "rgba(255, 204, 73, 1)" : "rgba(255, 255, 255, 0.96)";
        ctx.strokeStyle = "rgba(19, 27, 52, 0.98)";
        ctx.lineWidth = selectedIndex === index ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, selectedIndex === index ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (!compact && showLabels) {
          ctx.font = "700 12px system-ui, sans-serif";
          ctx.fillStyle = "rgba(19, 27, 52, 0.95)";
          ctx.strokeStyle = "rgba(255,255,255,0.88)";
          ctx.lineWidth = 4;
          const label = pointName(index);
          ctx.strokeText(label, p.x + 9, p.y - 8);
          ctx.fillText(label, p.x + 9, p.y - 8);
        }
        ctx.restore();
      });
    };

    draw();

    const resizeObserver = new ResizeObserver(draw);
    if (wrapRef.current) resizeObserver.observe(wrapRef.current);
    window.addEventListener("resize", draw);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [imageUrl, landmarks, selectedIndex, imageTick, compact, importantPoints, showSkeleton, showLabels]);

  const updatePoint = (event) => {
    if (!editable || dragIndexRef.current == null || !rectRef.current || !wrapRef.current) return;

    const box = wrapRef.current.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const next = landmarks.map((p) => ({ ...p }));
    const normalized = fromCanvasPoint(x, y, rectRef.current);

    next[dragIndexRef.current] = {
      ...next[dragIndexRef.current],
      ...normalized,
      visibility: 1
    };

    onChange?.(next);
  };

  const findNearestPoint = (event) => {
    if (!rectRef.current || !wrapRef.current) return null;

    const box = wrapRef.current.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;

    let nearest = null;
    let minDistance = Infinity;

    IMPORTANT_INDEXES.forEach((index) => {
      const point = landmarks[index];
      if (!isVisible(point)) return;
      const p = toCanvasPoint(point, rectRef.current);
      const d = Math.hypot(p.x - x, p.y - y);

      if (d < minDistance) {
        minDistance = d;
        nearest = index;
      }
    });

    return minDistance <= 24 ? nearest : null;
  };

  return (
    <div className="editor-card">
      <div className="editor-head">
        <div>
          <h3>{title}</h3>
          <p>{sourceLabel}</p>
        </div>
        {editable && <span className="edit-pill">可拖动修正</span>}
      </div>

      <div
        className={`keypoint-editor ${editable ? "editable" : ""}`}
        ref={wrapRef}
        onPointerDown={(event) => {
          if (!editable) return;
          const index = findNearestPoint(event);
          if (index == null) return;
          dragIndexRef.current = index;
          setSelectedIndex(index);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={updatePoint}
        onPointerUp={(event) => {
          dragIndexRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={() => {
          dragIndexRef.current = null;
        }}
      >
        {imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={title}
            onLoad={() => setImageTick((value) => value + 1)}
          />
        ) : (
          <div className="editor-empty">请先上传图片</div>
        )}

        <canvas ref={canvasRef} />
      </div>

      {editable && (
        <div className="point-list">
          {KEYPOINTS.map((item) => (
            <button
              type="button"
              key={item.index}
              className={selectedIndex === item.index ? "active" : ""}
              onClick={() => setSelectedIndex(item.index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
