import type { OcrPage, OcrWord } from './timetable-parser.js';

/** A document Google Vision could not read (corrupted, unsupported, or unreadable PDF). */
export class TimetableDocumentError extends Error {
  constructor() { super('The timetable document could not be read.'); }
}

type Vertex = { x?: number | null; y?: number | null };
type Annotation = {
  text?: string | null;
  pages?: { blocks?: { paragraphs?: { words?: { symbols?: { text?: string | null }[] | null; boundingBox?: { vertices?: Vertex[] | null; normalizedVertices?: Vertex[] | null } | null }[] | null }[] | null }[] | null }[] | null;
} | null | undefined;

/**
 * Turns a Vision full-text annotation into page text plus word boxes. Images use
 * pixel vertices and PDFs use normalized ones; the parser only compares positions
 * on the same page, so either works. Each word keeps its block so cells stay together.
 */
export function pagesFromAnnotation(annotation: Annotation): OcrPage[] {
  if (!annotation) return [];
  const pages: OcrPage[] = [];
  let block = 0;
  for (const page of annotation.pages ?? []) {
    const words: OcrWord[] = [];
    for (const visionBlock of page.blocks ?? []) {
      block += 1;
      for (const paragraph of visionBlock.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          const text = (word.symbols ?? []).map((symbol) => symbol.text ?? '').join('');
          const vertices = word.boundingBox?.vertices?.length ? word.boundingBox.vertices : word.boundingBox?.normalizedVertices ?? [];
          if (!text || !vertices.length) continue;
          const xs = vertices.map((vertex) => vertex.x ?? 0);
          const ys = vertices.map((vertex) => vertex.y ?? 0);
          words.push({ text, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), block });
        }
      }
    }
    pages.push({ text: '', words });
  }
  // Vision gives one text string per annotation; with a single page it belongs to that page.
  if (pages.length === 1) pages[0]!.text = annotation.text ?? '';
  else if (!pages.length && annotation.text) pages.push({ text: annotation.text, words: [] });
  return pages;
}

type VisionClient = {
  documentTextDetection: (request: { image: { content: Buffer } }) => Promise<[{ fullTextAnnotation?: Annotation; error?: unknown }]>;
  batchAnnotateFiles: (request: unknown) => Promise<[{ responses?: { responses?: { fullTextAnnotation?: Annotation; error?: { code?: number | null } | null }[] | null; totalPages?: number | null; error?: { code?: number | null } | null }[] | null }]>;
};

/**
 * Reads a timetable image or PDF with Google Vision, entirely in memory. PDFs go
 * to Vision's file API inline (Vision uses embedded text or renders pages itself),
 * so no page image or upload is ever written to disk here.
 */
export async function readTimetableWithVision(client: VisionClient, file: Buffer, kind: 'image' | 'pdf'): Promise<{ pages: OcrPage[]; totalPages: number }> {
  if (kind === 'image') {
    const [result] = await client.documentTextDetection({ image: { content: file } });
    if (result.error) throw new Error('Vision detection failed.');
    return { pages: pagesFromAnnotation(result.fullTextAnnotation), totalPages: 1 };
  }
  let response;
  try {
    [response] = await client.batchAnnotateFiles({
      requests: [{ inputConfig: { content: file, mimeType: 'application/pdf' }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
    });
  } catch (error) {
    // INVALID_ARGUMENT means Vision could not open the PDF (for example it is corrupted).
    if ((error as { code?: number }).code === 3) throw new TimetableDocumentError();
    throw error;
  }
  const fileResponse = response.responses?.[0];
  if (!fileResponse || fileResponse.error?.code) throw new TimetableDocumentError();
  const pages = (fileResponse.responses ?? []).flatMap((pageResponse) => {
    if (pageResponse.error?.code) return [];
    const annotation = pageResponse.fullTextAnnotation;
    const mapped = pagesFromAnnotation(annotation);
    // Each PDF page response describes one page; keep its own text with its words.
    if (mapped.length === 1) mapped[0]!.text = annotation?.text ?? '';
    return mapped;
  });
  return { pages, totalPages: fileResponse.totalPages ?? pages.length };
}
