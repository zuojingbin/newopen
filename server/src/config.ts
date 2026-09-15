import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const PORT = Number(process.env.PORT ?? 4000);
export const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const OUTPUT_DIR = path.join(DATA_DIR, "outputs");

// A4/A3 geometry in PDF points (1pt = 1/72in), used to detect page sizes
// coming from scanned images or PDFs. Tolerance accounts for scanner/DPI drift.
export const A4 = { w: 595.28, h: 841.89 };
export const A3 = { w: 841.89, h: 1190.55 };
export const SIZE_TOLERANCE = 0.06; // 6% relative tolerance
