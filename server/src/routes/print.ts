import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db/index.js";
import { OUTPUT_DIR } from "../config.js";
import { genId } from "../services/ids.js";
import { sendIppPrintJob } from "../services/printing.js";

export const printRouter = Router();

// Send the batch's already-built print PDF (POST /batches/:code/layout must
// have run first) to a chosen printer. LAN printers are sent to directly over
// IPP; remote printers are queued for their printer-agent to pick up.
printRouter.post("/print", async (req, res) => {
  const { batchCode, printerId, copies } = req.body as {
    batchCode: string;
    printerId: string;
    copies?: number;
  };
  if (!batchCode || !printerId) {
    return res.status(400).json({ error: "batchCode and printerId are required" });
  }

  const batch = db.prepare("SELECT * FROM batches WHERE code = ?").get(batchCode.toUpperCase()) as
    | { id: string; code: string }
    | undefined;
  if (!batch) return res.status(404).json({ error: "batch not found" });

  const printer = db.prepare("SELECT * FROM printers WHERE id = ?").get(printerId) as
    | { id: string; name: string; kind: string; uri: string | null }
    | undefined;
  if (!printer) return res.status(404).json({ error: "printer not found" });

  const pdfPath = path.join(OUTPUT_DIR, `${batch.id}.pdf`);
  try {
    await fs.access(pdfPath);
  } catch {
    return res.status(400).json({ error: "build the batch PDF first (POST /batches/:code/layout)" });
  }

  const jobId = genId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO print_jobs (id, batch_id, printer_id, pdf_path, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).run(jobId, batch.id, printer.id, pdfPath, now, now);

  if (printer.kind === "lan") {
    if (!printer.uri) return res.status(400).json({ error: "printer has no IPP uri" });
    try {
      const pdfBytes = await fs.readFile(pdfPath);
      await sendIppPrintJob(printer.uri, pdfBytes, `batch-${batch.code}`, copies ?? 1);
      db.prepare("UPDATE print_jobs SET status = 'done', updated_at = ? WHERE id = ?").run(
        Date.now(),
        jobId
      );
    } catch (err: any) {
      db.prepare("UPDATE print_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?").run(
        String(err?.message ?? err),
        Date.now(),
        jobId
      );
      return res.status(502).json({ error: "failed to reach LAN printer", jobId });
    }
  }
  // kind === 'remote': left as 'pending' for the printer-agent to poll and print.

  res.status(201).json({ jobId, status: printer.kind === "lan" ? "done" : "pending" });
});

printRouter.get("/print/:jobId", (req, res) => {
  const job = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(req.params.jobId) as
    | { id: string; status: string; error: string | null }
    | undefined;
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json({ id: job.id, status: job.status, error: job.error });
});
