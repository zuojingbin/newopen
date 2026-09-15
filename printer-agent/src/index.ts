// printer-agent: run this on any machine that sits on the SAME LAN as the
// physical printer. It registers itself with the backend once, then polls
// for print jobs addressed to it and forwards them to the local printer over
// IPP. This is what makes "print to a printer across the internet" possible
// without exposing the printer itself to the internet.
import "dotenv/config";
// @ts-expect-error no bundled types for the `ipp` package
import ipp from "ipp";
import {
  AGENT_NAME,
  PRINTER_URI,
  POLL_INTERVAL_MS,
  SERVER_URL,
  loadCredentials,
  saveCredentials,
  type AgentCredentials,
} from "./config.js";

async function register(): Promise<AgentCredentials> {
  const res = await fetch(`${SERVER_URL}/api/agent/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: AGENT_NAME, localPrinterUri: PRINTER_URI }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const creds = (await res.json()) as AgentCredentials;
  saveCredentials(creds);
  console.log(`Registered as agent ${creds.agentId} (printer ${creds.printerId}).`);
  return creds;
}

async function pollOnce(creds: AgentCredentials): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/agent/jobs?token=${creds.token}`);
  if (!res.ok) throw new Error(`poll failed: ${res.status} ${await res.text()}`);
  const { jobs } = (await res.json()) as { jobs: { id: string; pdfUrl: string }[] };

  for (const job of jobs) {
    console.log(`Printing job ${job.id} -> ${PRINTER_URI}`);
    try {
      const pdfRes = await fetch(`${SERVER_URL}${job.pdfUrl}`);
      if (!pdfRes.ok) throw new Error(`download failed: ${pdfRes.status}`);
      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
      await printLocally(pdfBytes, job.id);
      await report(creds, job.id, true);
      console.log(`Job ${job.id} done.`);
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      await report(creds, job.id, false, String((err as Error)?.message ?? err));
    }
  }
}

function printLocally(pdfBytes: Buffer, jobName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const printer = new ipp.Printer(PRINTER_URI);
    const msg = {
      "operation-attributes-tag": {
        "requesting-user-name": "printer-agent",
        "job-name": jobName,
        "document-format": "application/pdf",
      },
      data: pdfBytes,
    };
    printer.execute("Print-Job", msg, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

async function report(
  creds: AgentCredentials,
  jobId: string,
  success: boolean,
  error?: string
): Promise<void> {
  await fetch(`${SERVER_URL}/api/agent/jobs/${jobId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: creds.token, success, error }),
  });
}

async function main() {
  const creds = loadCredentials() ?? (await register());
  console.log(`printer-agent running. Server: ${SERVER_URL}. Printer: ${PRINTER_URI}.`);
  console.log(`Polling every ${POLL_INTERVAL_MS}ms.`);

  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));

  while (!stopping) {
    try {
      await pollOnce(creds);
    } catch (err) {
      console.error("Poll error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
