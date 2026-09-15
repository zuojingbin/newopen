import cors from "cors";
import express from "express";
import "./db/index.js"; // ensures schema is created before routes are wired up
import { PORT } from "./config.js";
import { batchesRouter } from "./routes/batches.js";
import { printersRouter } from "./routes/printers.js";
import { agentRouter } from "./routes/agent.js";
import { printRouter } from "./routes/print.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", batchesRouter);
app.use("/api", printersRouter);
app.use("/api", agentRouter);
app.use("/api", printRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err?.message ?? "internal error" });
});

app.listen(PORT, () => {
  console.log(`printer-server listening on http://localhost:${PORT}`);
});
