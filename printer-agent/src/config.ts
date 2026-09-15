import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SERVER_URL = requireEnv("SERVER_URL"); // e.g. https://printer.example.com
export const PRINTER_URI = requireEnv("PRINTER_URI"); // e.g. ipp://192.168.1.50:631/ipp/print
export const AGENT_NAME = process.env.AGENT_NAME ?? os.hostname();
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 20_000);
export const CONFIG_PATH = process.env.AGENT_CONFIG_PATH ?? path.resolve("./agent-config.json");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}. See printer-agent/README.md.`);
    process.exit(1);
  }
  return v;
}

export interface AgentCredentials {
  agentId: string;
  token: string;
  printerId: string;
}

export function loadCredentials(): AgentCredentials | undefined {
  if (!fs.existsSync(CONFIG_PATH)) return undefined;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

export function saveCredentials(creds: AgentCredentials): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(creds, null, 2));
}
