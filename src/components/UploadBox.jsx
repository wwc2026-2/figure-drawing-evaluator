import React, { useRef, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";

export default function UploadBox({ title, description, imageUrl, fileName, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请上传 PNG、JPG、JPEG、WEBP 等图片文件。");
      return;
    }

    onFile(file);
  };

  return (
    <div
      className={`upload-box ${dragging ? "dragging" : ""} ${imageUrl ? "has-image" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="upload-head">
        <div className="upload-title">
          <ImagePlus size={18} />
          <span>{title}</span>
        </div>

        {imageUrl && (
          <button type="button" className="icon-btn" onClick={onClear}>
            <X size={16} />
          </button>
        )}
      </div>

      {!imageUrl ? (
        <button type="button" className="upload-zone" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={36} />
          <strong>点击上传</strong>
          <span>{description}</span>
        </button>
      ) : (
        <div className="upload-preview" onClick={() => inputRef.current?.click()}>
          <img src={imageUrl} alt={title} />
          <p>{fileName}</p>
        </div>
      )}
    </div>
  );
}
