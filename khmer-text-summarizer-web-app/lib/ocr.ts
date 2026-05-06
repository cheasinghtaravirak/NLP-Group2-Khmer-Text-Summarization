"use client";

export type ProgressFn = (info: { phase: string; progress: number }) => void;

type PdfjsModule = typeof import("pdfjs-dist");
type PdfjsPage = Awaited<ReturnType<Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>["getPage"]>>;
type TesseractWorker = import("tesseract.js").Worker;

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") {
    throw new Error("pdfjs-dist is only available in the browser.");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsPromise;
}

let workerPromise: Promise<TesseractWorker> | null = null;

async function getKhmerWorker(onProgress?: ProgressFn): Promise<TesseractWorker> {
  if (typeof window === "undefined") {
    throw new Error("tesseract.js is only available in the browser.");
  }
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("khm", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (onProgress) onProgress({ phase: m.status, progress: m.progress ?? 0 });
        },
      });
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function ocrImage(file: File | Blob, onProgress?: ProgressFn): Promise<string> {
  const worker = await getKhmerWorker(onProgress);
  const url = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(url);
    return (data.text ?? "").trim();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderPdfPageToCanvas(
  page: PdfjsPage,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressFn,
): Promise<string> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const textParts: string[] = [];
  let directTextChars = 0;

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.({ phase: `extracting page ${i}/${pageCount}`, progress: i / pageCount });
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) {
      textParts.push(pageText);
      directTextChars += pageText.length;
    }
  }

  const directText = textParts.join("\n\n").trim();
  const directTextDensity = pageCount > 0 ? directTextChars / pageCount : 0;

  if (directTextDensity >= 100) {
    return directText;
  }

  const ocrParts: string[] = directText ? [directText] : [];
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.({ phase: `OCR page ${i}/${pageCount}`, progress: i / pageCount });
    const page = await pdf.getPage(i);
    const canvas = await renderPdfPageToCanvas(page, 2);
    const blob = await canvasToBlob(canvas);
    const text = await ocrImage(blob, (m) =>
      onProgress?.({ phase: `OCR page ${i}/${pageCount}: ${m.phase}`, progress: m.progress }),
    );
    if (text) ocrParts.push(text);
  }

  return ocrParts.join("\n\n").trim();
}
