import { useRef, useState } from "react";

export function UploadZone({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`upload-zone${dragOver ? " drag-over" : ""}${busy ? " busy" : ""}`}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (busy) return;
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <p className="upload-title">{busy ? "正在上传…" : "点击选择图片/PDF，或拖拽到此处"}</p>
      <p className="upload-hint">
        电脑端支持批量拖拽；手机端点击后从相册/文件选择老师发的图片或 PDF。
      </p>
    </div>
  );
}
