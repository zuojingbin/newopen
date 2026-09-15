import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { db } from "../db/index.js";
import { UPLOAD_DIR } from "../config.js";
import { genBatchCode, genId } from "../services/ids.js";
import { autoOrder } from "../services/ordering.js";
import { guessA3ByPixels } from "../services/paperSize.js";
import { buildPrintPdf } from "../services/layout.js";
import { MIME_TO_EXT, resolveMime } from "../services/mime.js";
import { OUTPUT_DIR } from "../config.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    cb(null, !!resolveMime(file.originalname, file.mimetype));
  },
});

export const batchesRouter = Router();

function getBatchByCode(code: string) {
  return db
    .prepare("SELECT * FROM batches WHERE code = ?")
    .get(code.toUpperCase()) as
    | { id: string; code: string; created_at: number; status: string }
    | undefined;
}

function fileRow(f: any) {
  return {
    id: f.id,
    filename: f.filename,
    mime: f.mime,
    order: f.order_index,
    isA3: !!(f.a3_override ?? f.is_a3),
    createdAt: f.created_at,
  };
}

// Create a new batch. Returns a short code the WeChat mini program (or a
// second device) can use to upload into the same batch.
batchesRouter.post("/batches", (_req, res) => {
  const id = genId();
  let code = genBatchCode();
  while (getBatchByCode(code)) code = genBatchCode();
  db.prepare("INSERT INTO batches (id, code, created_at, status) VALUES (?, ?, ?, 'open')").run(
    id,
    code,
    Date.now()
  );
  res.status(201).json({ id, code });
});

batchesRouter.get("/batches/:code", async (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const files = db
    .prepare("SELECT * FROM files WHERE batch_id = ? ORDER BY order_index ASC")
    .all(batch.id);
  res.json({ id: batch.id, code: batch.code, status: batch.status, files: files.map(fileRow) });
});

batchesRouter.post("/batches/:code/upload", upload.array("files", 50), async (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const uploaded = (req.files as Express.Multer.File[]) ?? [];
  if (uploaded.length === 0) return res.status(400).json({ error: "no valid files" });

  const batchDir = path.join(UPLOAD_DIR, batch.id);
  await fs.mkdir(batchDir, { recursive: true });

  const existing = db
    .prepare("SELECT MAX(order_index) as maxOrder FROM files WHERE batch_id = ?")
    .get(batch.id) as { maxOrder: number | null };
  let nextOrder = (existing.maxOrder ?? -1) + 1;

  const insert = db.prepare(
    `INSERT INTO files (id, batch_id, filename, mime, ext, path, order_index, is_a3, created_at)
     VALUES (@id, @batchId, @filename, @mime, @ext, @path, @order, @isA3, @createdAt)`
  );

  const inserted: any[] = [];
  const skipped: string[] = [];
  for (const file of uploaded) {
    const mime = resolveMime(file.originalname, file.mimetype);
    if (!mime) {
      // Shouldn't normally happen (fileFilter already checked), but a
      // multi-file request can mix valid and unrecognizable files.
      skipped.push(file.originalname);
      continue;
    }
    const id = genId();
    const ext = MIME_TO_EXT[mime];
    const storedPath = path.join(batchDir, `${id}.${ext}`);
    await fs.writeFile(storedPath, file.buffer);

    let isA3 = 0;
    if (mime.startsWith("image/")) {
      try {
        const meta = await sharp(file.buffer).metadata();
        if (meta.width && meta.height) {
          isA3 = guessA3ByPixels(meta.width, meta.height) ? 1 : 0;
        }
      } catch {
        // Unreadable/corrupt image: keep default (not A3), user can override.
      }
    }

    const createdAt = Date.now();
    insert.run({
      id,
      batchId: batch.id,
      filename: file.originalname || `${id}.${ext}`,
      mime,
      ext,
      path: storedPath,
      order: nextOrder++,
      isA3,
      createdAt,
    });
    inserted.push({ id, filename: file.originalname, mime, createdAt });
  }

  res.status(201).json({ uploaded: inserted.length, skipped });
});

// Re-sort all files in the batch using natural filename order (falls back to
// upload time), overwriting whatever order they currently have.
batchesRouter.post("/batches/:code/auto-order", (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const files = db.prepare("SELECT * FROM files WHERE batch_id = ?").all(batch.id) as any[];
  const ordered = autoOrder(files.map((f) => ({ ...f, createdAt: f.created_at })));
  const update = db.prepare("UPDATE files SET order_index = ? WHERE id = ?");
  const tx = db.transaction((rows: any[]) => {
    rows.forEach((f, i) => update.run(i, f.id));
  });
  tx(ordered);
  res.json({ ok: true });
});

// Persist an explicit order (drag-to-reorder in the web app).
batchesRouter.patch("/batches/:code/order", (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const { fileIds } = req.body as { fileIds: string[] };
  if (!Array.isArray(fileIds)) return res.status(400).json({ error: "fileIds required" });
  const update = db.prepare("UPDATE files SET order_index = ? WHERE id = ? AND batch_id = ?");
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, i) => update.run(i, id, batch.id));
  });
  tx(fileIds);
  res.json({ ok: true });
});

// Manually mark/unmark a page as A3 (overrides the automatic guess).
batchesRouter.patch("/batches/:code/files/:fileId", (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const { isA3 } = req.body as { isA3: boolean };
  db.prepare("UPDATE files SET a3_override = ? WHERE id = ? AND batch_id = ?").run(
    isA3 ? 1 : 0,
    req.params.fileId,
    batch.id
  );
  res.json({ ok: true });
});

batchesRouter.delete("/batches/:code/files/:fileId", async (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const file = db
    .prepare("SELECT * FROM files WHERE id = ? AND batch_id = ?")
    .get(req.params.fileId, batch.id) as { path: string } | undefined;
  if (!file) return res.status(404).json({ error: "file not found" });
  db.prepare("DELETE FROM files WHERE id = ?").run(req.params.fileId);
  await fs.rm(file.path, { force: true });
  res.json({ ok: true });
});

// Build (or rebuild) the print-ready A4 PDF for this batch: files are
// combined in order, and every page flagged/detected as A3 is split into
// two A4 pages.
batchesRouter.post("/batches/:code/layout", async (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const files = db
    .prepare("SELECT * FROM files WHERE batch_id = ? ORDER BY order_index ASC")
    .all(batch.id) as any[];
  if (files.length === 0) return res.status(400).json({ error: "batch has no files" });

  const pdfBytes = await buildPrintPdf(
    files.map((f) => ({
      path: f.path,
      mime: f.mime,
      isA3: !!(f.a3_override ?? f.is_a3),
    }))
  );

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${batch.id}.pdf`);
  await fs.writeFile(outPath, pdfBytes);

  const built = await PDFDocument.load(pdfBytes);
  res.json({
    ok: true,
    url: `/api/batches/${batch.code}/print.pdf`,
    pages: built.getPageCount(),
  });
});

batchesRouter.get("/batches/:code/print.pdf", async (req, res) => {
  const batch = getBatchByCode(req.params.code);
  if (!batch) return res.status(404).json({ error: "batch not found" });
  const outPath = path.join(OUTPUT_DIR, `${batch.id}.pdf`);
  try {
    await fs.access(outPath);
  } catch {
    return res.status(404).json({ error: "run /layout first" });
  }
  res.sendFile(outPath);
});

batchesRouter.get("/files/:fileId/raw", async (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(req.params.fileId) as
    | { path: string; mime: string }
    | undefined;
  if (!file) return res.status(404).json({ error: "file not found" });
  res.type(file.mime);
  res.sendFile(path.resolve(file.path));
});

batchesRouter.get("/files/:fileId/thumb", async (req, res) => {
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(req.params.fileId) as
    | { path: string; mime: string }
    | undefined;
  if (!file) return res.status(404).json({ error: "file not found" });
  if (!file.mime.startsWith("image/")) {
    return res.status(415).json({ error: "no thumbnail for this file type" });
  }
  try {
    const buf = await sharp(file.path).rotate().resize({ width: 320 }).jpeg({ quality: 80 }).toBuffer();
    res.type("image/jpeg").send(buf);
  } catch {
    res.status(500).json({ error: "failed to render thumbnail" });
  }
});
