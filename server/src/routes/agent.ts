import { Router } from "express";
import path from "node:path";
import { db } from "../db/index.js";
import { genId, genToken } from "../services/ids.js";

export const agentRouter = Router();

function getAgentByToken(token: string | undefined) {
  if (!token) return undefined;
  return db.prepare("SELECT * FROM agents WHERE token = ?").get(token) as
    | { id: string; token: string; name: string }
    | undefined;
}

// Register a printer-agent (the small relay process running on a machine
// inside the printer's own LAN, used for printing across networks). Returns
// a bearer token the agent must send on every subsequent call.
agentRouter.post("/agent/register", (req, res) => {
  const { name, localPrinterUri } = req.body as { name: string; localPrinterUri?: string };
  if (!name) return res.status(400).json({ error: "name is required" });

  const agentId = genId();
  const token = genToken();
  const now = Date.now();
  db.prepare(
    "INSERT INTO agents (id, token, name, registered_at, last_poll_at) VALUES (?, ?, ?, ?, ?)"
  ).run(agentId, token, name, now, now);

  const printerId = genId();
  db.prepare(
    `INSERT INTO printers (id, name, kind, uri, agent_id, last_seen_at, created_at)
     VALUES (?, ?, 'remote', ?, ?, ?, ?)`
  ).run(printerId, name, localPrinterUri ?? null, agentId, now, now);

  res.status(201).json({ agentId, token, printerId });
});

// Long-poll-ish: the agent calls this every ~30-60s. Any pending job for a
// printer it owns is handed back and flipped to 'in_progress'.
agentRouter.get("/agent/jobs", (req, res) => {
  const agent = getAgentByToken(req.query.token as string | undefined);
  if (!agent) return res.status(401).json({ error: "invalid token" });

  db.prepare("UPDATE agents SET last_poll_at = ? WHERE id = ?").run(Date.now(), agent.id);
  db.prepare("UPDATE printers SET last_seen_at = ? WHERE agent_id = ?").run(Date.now(), agent.id);

  const jobs = db
    .prepare(
      `SELECT pj.* FROM print_jobs pj
       JOIN printers p ON p.id = pj.printer_id
       WHERE p.agent_id = ? AND pj.status = 'pending'`
    )
    .all(agent.id) as any[];

  const update = db.prepare("UPDATE print_jobs SET status = 'in_progress', updated_at = ? WHERE id = ?");
  const tx = db.transaction((rows: any[]) => rows.forEach((j) => update.run(Date.now(), j.id)));
  tx(jobs);

  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      pdfUrl: `/api/agent/jobs/${j.id}/pdf?token=${agent.token}`,
      createdAt: j.created_at,
    })),
  });
});

agentRouter.get("/agent/jobs/:jobId/pdf", (req, res) => {
  const agent = getAgentByToken(req.query.token as string | undefined);
  if (!agent) return res.status(401).json({ error: "invalid token" });
  const job = db
    .prepare(
      `SELECT pj.* FROM print_jobs pj JOIN printers p ON p.id = pj.printer_id
       WHERE pj.id = ? AND p.agent_id = ?`
    )
    .get(req.params.jobId, agent.id) as { pdf_path: string } | undefined;
  if (!job) return res.status(404).json({ error: "job not found" });
  res.sendFile(path.resolve(job.pdf_path));
});

agentRouter.post("/agent/jobs/:jobId/complete", (req, res) => {
  const { token, success, error } = req.body as { token: string; success: boolean; error?: string };
  const agent = getAgentByToken(token);
  if (!agent) return res.status(401).json({ error: "invalid token" });
  const job = db
    .prepare(
      `SELECT pj.* FROM print_jobs pj JOIN printers p ON p.id = pj.printer_id
       WHERE pj.id = ? AND p.agent_id = ?`
    )
    .get(req.params.jobId, agent.id) as { id: string } | undefined;
  if (!job) return res.status(404).json({ error: "job not found" });
  db.prepare("UPDATE print_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?").run(
    success ? "done" : "error",
    error ?? null,
    Date.now(),
    job.id
  );
  res.json({ ok: true });
});
