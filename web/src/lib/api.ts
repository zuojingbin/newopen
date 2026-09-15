import type { Batch, DiscoveredPrinter, Printer, PrintJobStatus } from "./types";

const SERVER_URL_KEY = "printer-app:server-url";
// Baked in at build time (e.g. Railway env var) so a deployed web app can
// ship pre-configured with its backend's URL instead of requiring every
// visitor to type it into Settings manually.
const BUILD_TIME_DEFAULT = import.meta.env.VITE_API_BASE_URL ?? "";

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? BUILD_TIME_DEFAULT;
}

export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ""));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `请求失败 (${res.status})`);
  }
  return res.json();
}

export function createBatch(): Promise<{ id: string; code: string }> {
  return api("/api/batches", { method: "POST" });
}

export function getBatch(code: string): Promise<Batch> {
  return api(`/api/batches/${code}`);
}

export async function uploadFiles(code: string, files: File[]): Promise<void> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch(`${getServerUrl()}/api/batches/${code}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `上传失败 (${res.status})`);
  }
}

export function autoOrderBatch(code: string): Promise<void> {
  return api(`/api/batches/${code}/auto-order`, { method: "POST" });
}

export function reorderBatch(code: string, fileIds: string[]): Promise<void> {
  return api(`/api/batches/${code}/order`, {
    method: "PATCH",
    body: JSON.stringify({ fileIds }),
  });
}

export function setFileA3(code: string, fileId: string, isA3: boolean): Promise<void> {
  return api(`/api/batches/${code}/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ isA3 }),
  });
}

export function deleteFile(code: string, fileId: string): Promise<void> {
  return api(`/api/batches/${code}/files/${fileId}`, { method: "DELETE" });
}

export function buildLayout(code: string): Promise<{ url: string; pages: number }> {
  return api(`/api/batches/${code}/layout`, { method: "POST" });
}

export function fileThumbUrl(fileId: string): string {
  return `${getServerUrl()}/api/files/${fileId}/thumb`;
}

export function printPdfUrl(code: string): string {
  return `${getServerUrl()}/api/batches/${code}/print.pdf`;
}

export function scanLanPrinters(): Promise<{ printers: DiscoveredPrinter[] }> {
  return api("/api/printers/lan/scan");
}

export function saveLanPrinter(name: string, uri: string): Promise<{ id: string }> {
  return api("/api/printers/lan", { method: "POST", body: JSON.stringify({ name, uri }) });
}

export function listPrinters(): Promise<{ printers: Printer[] }> {
  return api("/api/printers");
}

export function deletePrinter(id: string): Promise<void> {
  return api(`/api/printers/${id}`, { method: "DELETE" });
}

export function sendPrint(
  batchCode: string,
  printerId: string,
  copies: number
): Promise<{ jobId: string; status: string }> {
  return api("/api/print", {
    method: "POST",
    body: JSON.stringify({ batchCode, printerId, copies }),
  });
}

export function getPrintJob(jobId: string): Promise<PrintJobStatus> {
  return api(`/api/print/${jobId}`);
}
