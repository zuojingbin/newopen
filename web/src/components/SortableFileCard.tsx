import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BatchFile } from "../lib/types";
import { fileThumbUrl } from "../lib/api";

export function SortableFileCard({
  file,
  index,
  onToggleA3,
  onDelete,
}: {
  file: BatchFile;
  index: number;
  onToggleA3: (id: string, isA3: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
  });
  const isPdf = file.mime === "application/pdf";

  return (
    <div
      ref={setNodeRef}
      className={`file-card${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="file-card-drag" {...attributes} {...listeners}>
        <span className="file-order">{index + 1}</span>
        {isPdf ? (
          <div className="thumb thumb-pdf">PDF</div>
        ) : (
          <img className="thumb" src={fileThumbUrl(file.id)} alt={file.filename} loading="lazy" />
        )}
      </div>
      <div className="file-card-meta">
        <span className="file-name" title={file.filename}>
          {file.filename}
        </span>
        <label className="a3-toggle">
          <input
            type="checkbox"
            checked={file.isA3}
            onChange={(e) => onToggleA3(file.id, e.target.checked)}
          />
          标记为 A3（自动拆成两页 A4）
        </label>
        <button className="link-danger" onClick={() => onDelete(file.id)}>
          删除
        </button>
      </div>
    </div>
  );
}
