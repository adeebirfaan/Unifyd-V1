import type { ImagePickerAsset } from 'expo-image-picker';
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

import { ocrBaseUrl } from '@/lib/receiptOcr';
import { supabase } from '@/lib/supabase';
import type { ImportCandidate } from '@/lib/timetable';

export type TimetableImportResult = { candidates: ImportCandidate[]; warnings: string[]; pagesProcessed: number; totalPages: number };
export type TimetableImportErrorCode = 'notConfigured' | 'unsupported' | 'tooLarge' | 'protected' | 'invalidDocument' | 'authRequired' | 'unavailable';
export class TimetableImportError extends Error {
  constructor(public readonly code: TimetableImportErrorCode) { super(code); }
}

export const TIMETABLE_MAX_BYTES = 5 * 1024 * 1024;
export const TIMETABLE_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;

/** A chosen timetable file, from Files (document picker) or Photos (image picker). */
export type TimetableFile = { uri: string; name: string; mimeType?: string | null; size?: number | null; file?: Blob };

export function fromPhoto(asset: ImagePickerAsset): TimetableFile {
  const mimeType = asset.mimeType ?? asset.file?.type ?? null;
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return { uri: asset.uri, name: asset.fileName || `timetable.${extension}`, mimeType, size: asset.fileSize ?? asset.file?.size ?? null, file: asset.file };
}

function mimeOf(asset: TimetableFile): string | null {
  const declared = asset.mimeType ?? asset.file?.type ?? '';
  if ((TIMETABLE_TYPES as readonly string[]).includes(declared)) return declared;
  if (declared === 'image/jpg') return 'image/jpeg';
  const extension = /\.([a-z]+)$/i.exec(asset.name)?.[1]?.toLowerCase();
  return extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'pdf' ? 'application/pdf' : null;
}

const optionalString = (value: unknown) => value === null || typeof value === 'string';
function isCandidate(value: unknown): value is ImportCandidate {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && optionalString(c.courseCode) && optionalString(c.courseName)
    && (c.dayOfWeek === null || typeof c.dayOfWeek === 'number') && optionalString(c.startTime) && optionalString(c.endTime)
    && optionalString(c.location) && optionalString(c.sectionLabel) && (c.confidence === 'high' || c.confidence === 'medium' || c.confidence === 'low');
}
function isResult(value: unknown): value is TimetableImportResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.candidates) && result.candidates.every(isCandidate)
    && Array.isArray(result.warnings) && result.warnings.every((warning) => typeof warning === 'string')
    && typeof result.pagesProcessed === 'number' && typeof result.totalPages === 'number';
}

async function errorCode(status: number, readBody: () => Promise<unknown>): Promise<TimetableImportErrorCode> {
  if (status === 401) return 'authRequired';
  if (status === 413) return 'tooLarge';
  if (status === 415 || status === 400) return 'unsupported';
  if (status === 422) {
    const body = await readBody().catch(() => null) as { error?: { code?: string } } | null;
    return body?.error?.code === 'PDF_PROTECTED' ? 'protected' : 'invalidDocument';
  }
  return 'unavailable';
}

/**
 * Sends the chosen file to the Unifyd server for text extraction and returns an
 * editable draft. Nothing is saved here: the student must review the draft first.
 * The file is sent once and is not kept by the app or the server.
 */
export async function importTimetable(asset: TimetableFile): Promise<TimetableImportResult> {
  const baseUrl = ocrBaseUrl();
  if (!baseUrl) throw new TimetableImportError('notConfigured');
  const mime = mimeOf(asset);
  if (!mime) throw new TimetableImportError('unsupported');
  if ((asset.size ?? asset.file?.size ?? 0) > TIMETABLE_MAX_BYTES) throw new TimetableImportError('tooLarge');

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new TimetableImportError('authRequired');
  const url = `${baseUrl}/api/timetable/import`;
  const headers = { Authorization: `Bearer ${data.session.access_token}` };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    let status: number;
    let readBody: () => Promise<unknown>;
    if (Platform.OS === 'web') {
      const form = new FormData();
      const blob: Blob = asset.file ? asset.file : await (await fetch(asset.uri)).blob();
      if (blob.size > TIMETABLE_MAX_BYTES) throw new TimetableImportError('tooLarge');
      form.append('file', blob, asset.name);
      const response = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal });
      status = response.status;
      readBody = () => response.json();
    } else {
      const file = new File(asset.uri);
      if (!file.exists || file.size === 0) throw new TimetableImportError('unsupported');
      if (file.size > TIMETABLE_MAX_BYTES) throw new TimetableImportError('tooLarge');
      const upload = await file.upload(url, { httpMethod: 'POST', uploadType: UploadType.MULTIPART, fieldName: 'file', mimeType: mime, headers, signal: controller.signal });
      status = upload.status;
      readBody = async () => JSON.parse(upload.body) as unknown;
    }
    if (status < 200 || status >= 300) throw new TimetableImportError(await errorCode(status, readBody));
    const body = await readBody();
    if (!isResult(body)) throw new TimetableImportError('unavailable');
    return body;
  } catch (caught) {
    if (caught instanceof TimetableImportError) throw caught;
    throw new TimetableImportError('unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
