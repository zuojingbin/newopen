import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import {
  autoOrderBatch,
  buildLayout,
  createBatch,
  deleteFile,
  getBatch,
  printPdfUrl,
  reorderBatch,
  setFileA3,
  uploadFiles,
} from "../lib/api";
import type { Batch } from "../lib/types";
import { useLocalStorage } from "../lib/useLocalStorage";
import { SortableFileCard } from "./SortableFileCard";
import { UploadZone } from "./UploadZone";

export function BatchScreen({ onGoPrint }: { onGoPrint: (code: string) => void }) {
  const [code, setCode] = useLocalStorage("printer-app:batch-code", "");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [layoutInfo, setLayoutInfo] = useState<{ pages: number } | null>(null);

  const refresh = useCallback(async (c: string) => {
    if (!c) return;
    try {
      const b = await getBatch(c);
      setBatch(b);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!code) {
      createBatch()
        .then((b) => setCode(b.code))
        .catch((err) => setError((err as Error).message));
    }
  }, [code, setCode]);

  useEffect(() => {
    if (code) refresh(code);
  }, [code, refresh]);

  // Poll while this screen is open so files uploaded from the WeChat mini
  // program (a different device/app) show up without a manual refresh.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => refresh(code), 4000);
    return () => clearInterval(t);
  }, [code, refresh]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleUpload(files: File[]) {
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      await uploadFiles(code, files);
      await refresh(code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!batch) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = batch.files.findIndex((f) => f.id === active.id);
    const newIndex = batch.files.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(batch.files, oldIndex, newIndex);
    setBatch({ ...batch, files: reordered });
    await reorderBatch(code, reordered.map((f) => f.id));
  }

  async function handleAutoOrder() {
    await autoOrderBatch(code);
    await refresh(code);
  }

  async function handleToggleA3(fileId: string, isA3: boolean) {
    if (!batch) return;
    setBatch({ ...batch, files: batch.files.map((f) => (f.id === fileId ? { ...f, isA3 } : f)) });
    await setFileA3(code, fileId, isA3);
  }

  async function handleDelete(fileId: string) {
    if (!batch) return;
    setBatch({ ...batch, files: batch.files.filter((f) => f.id !== fileId) });
    await deleteFile(code, fileId);
  }

  async function handleBuildLayout() {
    setBusy(true);
    setError("");
    try {
      const res = await buildLayout(code);
      setLayoutInfo({ pages: res.pages });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleNewBatch() {
    setLayoutInfo(null);
    setBatch(null);
    const b = await createBatch();
    setCode(b.code);
  }

  async function handleJoin() {
    const c = joinInput.trim().toUpperCase();
    if (!c) return;
    setLayoutInfo(null);
    setCode(c);
    setJoinInput("");
  }

  return (
    <div className="panel">
      <div className="batch-code-bar">
        <div>
          <div className="batch-code-label">批次码</div>
          <div className="batch-code-value">{code || "…"}</div>
        </div>
        <p className="hint">
          在微信小程序里输入这个批次码，即可把从聊天记录里选的图片/文件直接上传到这里。
        </p>
        <div className="field-row">
          <button onClick={handleNewBatch}>新建批次</button>
          <input
            placeholder="输入已有批次码加入"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
          />
          <button onClick={handleJoin}>加入</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <UploadZone onFiles={handleUpload} busy={busy} />

      {batch && batch.files.length > 0 && (
        <>
          <div className="toolbar">
            <button onClick={handleAutoOrder}>自动排序（按文件名/上传时间）</button>
            <button className="primary" onClick={handleBuildLayout} disabled={busy}>
              生成打印 PDF（A3 自动拆 A4）
            </button>
            {layoutInfo && (
              <>
                <span className="hint">共 {layoutInfo.pages} 页</span>
                <a href={printPdfUrl(code)} target="_blank" rel="noreferrer">
                  预览/下载 PDF
                </a>
                <button className="primary" onClick={() => onGoPrint(code)}>
                  去打印
                </button>
              </>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={batch.files.map((f) => f.id)} strategy={rectSortingStrategy}>
              <div className="file-grid">
                {batch.files.map((f, i) => (
                  <SortableFileCard
                    key={f.id}
                    file={f}
                    index={i}
                    onToggleA3={handleToggleA3}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
