import { A3, A4, SIZE_TOLERANCE } from "../config.js";

function within(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) / target <= tolerance;
}

/** Classify a page given its size in PDF points (authoritative for real PDFs). */
export function classifyByPoints(wPt: number, hPt: number): "A3" | "A4" | "other" {
  const w = Math.min(wPt, hPt);
  const h = Math.max(wPt, hPt);
  if (within(w, A3.w, SIZE_TOLERANCE) && within(h, A3.h, SIZE_TOLERANCE)) return "A3";
  if (within(w, A4.w, SIZE_TOLERANCE) && within(h, A4.h, SIZE_TOLERANCE)) return "A4";
  return "other";
}

/**
 * Best-effort guess for a bare image (no embedded physical size): a photo/scan is
 * flagged as "likely A3" only when its aspect ratio matches the ISO A-series ratio
 * (~1.414) AND its long edge is large enough to plausibly be a full A3 scan/photo.
 * This is a heuristic default — the UI always lets the user override it per file,
 * which is the reliable path when the camera resolution doesn't reflect paper size.
 */
export function guessA3ByPixels(widthPx: number, heightPx: number): boolean {
  const short = Math.min(widthPx, heightPx);
  const long = Math.max(widthPx, heightPx);
  const ratio = long / short;
  const ratioMatchesA = Math.abs(ratio - Math.SQRT2) / Math.SQRT2 <= 0.08;
  const LONG_EDGE_A3_THRESHOLD_PX = 2800;
  return ratioMatchesA && long >= LONG_EDGE_A3_THRESHOLD_PX;
}
