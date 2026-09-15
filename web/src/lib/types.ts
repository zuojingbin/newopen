export interface BatchFile {
  id: string;
  filename: string;
  mime: string;
  order: number;
  isA3: boolean;
  createdAt: number;
}

export interface Batch {
  id: string;
  code: string;
  status: string;
  files: BatchFile[];
}

export interface Printer {
  id: string;
  name: string;
  kind: "lan" | "remote";
  uri: string | null;
  online: boolean;
}

export interface DiscoveredPrinter {
  name: string;
  host: string;
  port: number;
  uri: string;
}

export interface PrintJobStatus {
  id: string;
  status: "pending" | "in_progress" | "done" | "error";
  error: string | null;
}
