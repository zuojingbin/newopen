import { Router } from "express";
import { db } from "../db/index.js";
import { genId } from "../services/ids.js";
import { discoverLanPrinters } from "../services/printing.js";

export const printersRouter = Router();

function printerRow(p: any) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    uri: p.uri,
    online: p.kind === "lan" ? true : isAgentOnline(p.last_seen_at),
  };
}

function isAgentOnline(lastSeenAt: number | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt < 2 * 60 * 1000; // agent polls at least every ~1min
}

// Scan the LAN for IPP printers (transient — not persisted until /printers/save).
printersRouter.get("/printers/lan/scan", async (_req, res) => {
  const found = await discoverLanPrinters();
  res.json({ printers: found });
});

// Persist a LAN printer discovered above (or entered manually by IP/URI).
printersRouter.post("/printers/lan", (req, res) => {
  const { name, uri } = req.body as { name: string; uri: string };
  if (!name || !uri) return res.status(400).json({ error: "name and uri are required" });
  const id = genId();
  db.prepare(
    "INSERT INTO printers (id, name, kind, uri, created_at) VALUES (?, ?, 'lan', ?, ?)"
  ).run(id, name, uri, Date.now());
  res.status(201).json({ id });
});

printersRouter.get("/printers", (_req, res) => {
  const printers = db.prepare("SELECT * FROM printers ORDER BY created_at DESC").all();
  res.json({ printers: printers.map(printerRow) });
});

printersRouter.delete("/printers/:id", (req, res) => {
  db.prepare("DELETE FROM printers WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
