import fs from "node:fs/promises";
import { PDFDocument, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { A4 } from "../config.js";
import { classifyByPoints } from "./paperSize.js";

export interface LayoutFile {
  path: string;
  mime: string; // 'application/pdf' | 'image/*'
  /** User-confirmed or heuristically-guessed: this page is a full A3 sheet and
   *  must be split into two A4 pages (side-by-side spread convention). */
  isA3: boolean;
}

const A4_SIZE: [number, number] = [A4.w, A4.h];

/** Assemble ordered source files (images and/or PDFs) into one print-ready
 *  A4 PDF, splitting every page flagged/detected as A3 into two A4 pages. */
export async function buildPrintPdf(files: LayoutFile[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const file of files) {
    if (file.mime === "application/pdf") {
      await appendPdfSource(out, file);
    } else {
      await appendImageSource(out, file);
    }
  }
  return out.save();
}

function placeOnA4(out: PDFDocument): PDFPage {
  return out.addPage(A4_SIZE);
}

async function drawImagePage(out: PDFDocument, jpegBytes: Buffer) {
  const img = await out.embedJpg(jpegBytes);
  const page = placeOnA4(out);
  const { width: pw, height: ph } = page.getSize();
  const scale = Math.min(pw / img.width, ph / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
}

async function toJpeg(buf: Buffer | Uint8Array): Promise<Buffer> {
  return sharp(buf).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
}

async function appendImageSource(out: PDFDocument, file: LayoutFile) {
  const raw = await fs.readFile(file.path);
  const normalized = await toJpeg(raw);
  const meta = await sharp(normalized).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  if (file.isA3 && w > 0 && h > 0) {
    const landscape = w >= h;
    const base = sharp(normalized);
    if (landscape) {
      const half = Math.floor(w / 2);
      const left = await toJpeg(await base.clone().extract({ left: 0, top: 0, width: half, height: h }).toBuffer());
      const right = await toJpeg(await base.clone().extract({ left: half, top: 0, width: w - half, height: h }).toBuffer());
      await drawImagePage(out, left);
      await drawImagePage(out, right);
    } else {
      const half = Math.floor(h / 2);
      const top = await toJpeg(await base.clone().extract({ left: 0, top: 0, width: w, height: half }).toBuffer());
      const bottom = await toJpeg(await base.clone().extract({ left: 0, top: half, width: w, height: h - half }).toBuffer());
      await drawImagePage(out, top);
      await drawImagePage(out, bottom);
    }
  } else {
    await drawImagePage(out, normalized);
  }
}

function drawEmbeddedPage(out: PDFDocument, embedded: PDFEmbeddedPage) {
  const page = placeOnA4(out);
  const { width: pw, height: ph } = page.getSize();
  const scale = Math.min(pw / embedded.width, ph / embedded.height);
  const w = embedded.width * scale;
  const h = embedded.height * scale;
  page.drawPage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
}

async function appendPdfSource(out: PDFDocument, file: LayoutFile) {
  const raw = await fs.readFile(file.path);
  const src = await PDFDocument.load(raw);
  const pageCount = src.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const page = src.getPage(i);
    const { width, height } = page.getSize();
    const isA3Page = file.isA3 || classifyByPoints(width, height) === "A3";

    if (isA3Page) {
      const landscape = width >= height;
      if (landscape) {
        const half = width / 2;
        const left = await out.embedPage(page, { left: 0, bottom: 0, right: half, top: height });
        const right = await out.embedPage(page, { left: half, bottom: 0, right: width, top: height });
        drawEmbeddedPage(out, left);
        drawEmbeddedPage(out, right);
      } else {
        const half = height / 2;
        const top = await out.embedPage(page, { left: 0, bottom: half, right: width, top: height });
        const bottom = await out.embedPage(page, { left: 0, bottom: 0, right: width, top: half });
        drawEmbeddedPage(out, top);
        drawEmbeddedPage(out, bottom);
      }
    } else {
      const embedded = await out.embedPage(page);
      drawEmbeddedPage(out, embedded);
    }
  }
}
