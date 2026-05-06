import React from "react";

export default function CleanImagePreview({ title, imageUrl, sourceLabel }) {
  return (
    <div className="editor-card">
      <div className="editor-head">
        <div>
          <h3>{title}</h3>
          <p>{sourceLabel}</p>
        </div>
      </div>

      <div className="clean-preview">
        {imageUrl ? (
          <img src={imageUrl} alt={title} />
        ) : (
          <div className="editor-empty">请先上传图片</div>
        )}
      </div>
    </div>
  );
}
