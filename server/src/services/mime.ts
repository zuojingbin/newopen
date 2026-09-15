import path from "node:path";

export const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
};

/**
 * Resolve the real file type from a multer upload. Mobile clients — the
 * WeChat mini program's wx.uploadFile in particular — often send a generic
 * `application/octet-stream` Content-Type regardless of the actual file, so
 * the declared mimetype is only trusted when it's already one we accept;
 * otherwise we fall back to the filename extension.
 */
export function resolveMime(originalname: string, declaredMime: string): string | undefined {
  if (ACCEPTED_MIME.has(declaredMime)) return declaredMime;
  const ext = path.extname(originalname || "").slice(1).toLowerCase();
  return EXT_TO_MIME[ext];
}
