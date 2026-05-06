import React from "react";
import { METRICS } from "../lib/landmarks.js";

export default function RadarChart({ scores = {} }) {
  const size = 420;
  const center = size / 2;
  const maxRadius = 150;
  const levels = 5;
  const angleStep = (Math.PI * 2) / METRICS.length;
  const values = METRICS.map((key) => scores[key] ?? 0);

  const point = (index, value) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const radius = (value / 10) * maxRadius;
    return [
      center + Math.cos(angle) * radius,
      center + Math.sin(angle) * radius
    ];
  };

  const polygon = (value) => {
    return METRICS.map((_, index) => point(index, value).join(",")).join(" ");
  };

  const scorePolygon = values.map((value, index) => point(index, value).join(",")).join(" ");

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="radar">
        {Array.from({ length: levels }, (_, index) => (
          <polygon
            key={index}
            points={polygon(((index + 1) / levels) * 10)}
            className="radar-grid"
          />
        ))}

        {METRICS.map((label, index) => {
          const [x, y] = point(index, 10);
          return (
            <line
              key={`axis-${label}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              className="radar-axis"
            />
          );
        })}

        <polygon points={scorePolygon} className="radar-area" />

        {values.map((value, index) => {
          const [x, y] = point(index, value);
          return <circle key={index} cx={x} cy={y} r="5" className="radar-dot" />;
        })}

        {METRICS.map((label, index) => {
          const angle = -Math.PI / 2 + index * angleStep;
          const x = center + Math.cos(angle) * (maxRadius + 42);
          const y = center + Math.sin(angle) * (maxRadius + 42);
          return (
            <g key={`label-${label}`}>
              <text x={x} y={y - 8} textAnchor="middle" className="radar-label">
                {label}
              </text>
              <text x={x} y={y + 14} textAnchor="middle" className="radar-value">
                {(scores[label] ?? 0).toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
