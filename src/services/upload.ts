import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedFile = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

export type UploadedMaterial = {
  id: string;
  storagePath: string;
};

export const MATERIAL_BUCKET = process.env.EXPO_PUBLIC_STUDY_MATERIALS_BUCKET?.trim() || 'study-materials';
export const MAX_STUDY_FILE_BYTES = 25 * 1024 * 1024;

const supportedExtensions = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'csv', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
]);

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', rtf: 'application/rtf', csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};

export const STUDY_FILE_PICKER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'text/*',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/*',
];

function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
}

function resolvedMimeType(file: PickedFile) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const reported = file.mimeType?.toLowerCase();
  // Android providers occasionally report non-standard aliases such as
  // image/jpg. Prefer the extension mapping so it agrees with the bucket's
  // allow-list, then fall back to the provider value for extensionless files.
  return mimeByExtension[extension] ?? (reported && reported !== 'application/octet-stream' ? reported : 'application/octet-stream');
}

function uploadErrorMessage(error: unknown) {
  const candidate = error as { message?: unknown; error?: unknown; statusCode?: unknown; status?: unknown } | null;
  const raw = candidate && typeof candidate === 'object'
    ? String(candidate.message ?? candidate.error ?? '')
    : String(error ?? '');
  const lowered = raw.toLowerCase();
  if (storageBucketIsMissing(error)) return 'Mentra storage is temporarily unavailable. Please update the app or try again shortly.';
  if (lowered.includes('row-level security') || String(candidate?.statusCode ?? candidate?.status) === '403') {
    return 'Mentra could not save this file to your account. Sign out, sign in again, and retry.';
  }
  if (lowered.includes('jwt') || lowered.includes('unauthorized') || String(candidate?.statusCode ?? candidate?.status) === '401') {
    return 'Your sign-in session expired. Sign in again before attaching a file.';
  }
  if (lowered.includes('mime') || lowered.includes('content type')) return 'That file format is not accepted by storage yet.';
  if (lowered.includes('network') || lowered.includes('fetch')) return 'The upload could not reach Mentra. Check your connection and try again.';
  return raw || 'Mentra could not attach that file. Please choose it again.';
}

function decodeBase64(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  // Writing in chunks avoids a very large spread/call stack for PDFs and
  // Office documents on lower-memory Android phones.
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function readFileForUpload(file: PickedFile) {
  try {
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    if (!base64) throw new Error('The selected file is empty.');
    return decodeBase64(base64);
  } catch (error) {
    throw new Error(error instanceof Error && error.message.includes('empty')
      ? error.message
      : 'Mentra could not read that file from your device. Choose it again and keep file access enabled.');
  }
}

function storageBucketIsMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; statusCode?: unknown; error?: unknown };
  const message = `${String(candidate.message ?? '')} ${String(candidate.error ?? '')}`.toLowerCase();
  return message.includes('bucket not found') || message.includes('bucket does not exist') || (candidate.statusCode === '404' && message.includes('bucket'));
}

function validateStudyFile(file: PickedFile) {
  const mimeType = resolvedMimeType(file);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType.startsWith('video/')) throw new Error('Videos are not supported. Choose a document, slide, spreadsheet, note, or image.');
  if (!supportedExtensions.has(extension) && !STUDY_FILE_PICKER_TYPES.some((type) => type.endsWith('/*') ? mimeType.startsWith(type.slice(0, -1)) : mimeType === type)) {
    throw new Error('That file type is not supported yet. Choose a PDF, Word file, PowerPoint, spreadsheet, text note, or image.');
  }
  if (file.size && file.size > MAX_STUDY_FILE_BYTES) throw new Error('That file is larger than 25 MB. Choose a smaller file.');
}

async function ensureMaterialBucket() {
  if (!supabase) throw new Error('Connect Supabase before uploading study materials.');
  const gateway = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, '');
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!gateway || !anonKey || !accessToken) {
    throw new Error('Study-file storage is not configured yet. Ask the Mentra administrator to create the private study-materials bucket.');
  }

  const response = await fetch(`${gateway}/v1/storage/ensure`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const reason = typeof result?.error === 'string' ? result.error : 'The private study-materials bucket could not be prepared.';
    throw new Error(reason);
  }
}

async function uploadFile(storagePath: string, binary: ArrayBuffer, contentType: string) {
  if (!supabase) throw new Error('Connect Supabase before uploading study materials.');
  const options = { contentType, upsert: false };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Your sign-in session expired. Sign in again before attaching a file.');
  let result = await supabase.storage.from(MATERIAL_BUCKET).upload(storagePath, binary, options);
  if (result.error && storageBucketIsMissing(result.error)) {
    await ensureMaterialBucket();
    result = await supabase.storage.from(MATERIAL_BUCKET).upload(storagePath, binary, options);
  }
  if (result.error) throw new Error(uploadErrorMessage(result.error));
}

/**
 * Uploads a source file to private storage and creates its metadata record.
 * Text extraction, chunking and embeddings must happen in a trusted Edge
 * Function after this call; never embed an LLM key in the mobile app.
 */
export async function uploadStudyMaterial({
  file,
  userId,
  subject,
}: {
  file: PickedFile;
  userId: string;
  subject?: string;
}): Promise<UploadedMaterial> {
  if (!supabase) throw new Error('Connect Supabase before uploading study materials.');
  validateStudyFile(file);

  const safeName = cleanFileName(file.name) || 'study-file';
  const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;
  // fetch(file:// / content://).arrayBuffer() is unreliable in Android release
  // builds. Expo FileSystem reads the cached picker URI consistently.
  const binary = await readFileForUpload(file);
  const contentType = resolvedMimeType(file);
  await uploadFile(storagePath, binary, contentType);

  const { data, error: materialError } = await supabase
    .from('materials')
    .insert({
      owner_id: userId,
      title: file.name.replace(/\.[^.]+$/, ''),
      subject: subject ?? null,
      storage_path: storagePath,
      mime_type: contentType,
    })
    .select('id')
    .single();

  if (materialError) {
    await supabase.storage.from(MATERIAL_BUCKET).remove([storagePath]);
    throw new Error(uploadErrorMessage(materialError));
  }

  return { id: data.id, storagePath };
}

export async function pickStudyFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: STUDY_FILE_PICKER_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!file) return null;
  const picked = { name: file.name, uri: file.uri, mimeType: file.mimeType, size: file.size };
  validateStudyFile(picked);
  return picked;
}

export async function pickChatAttachment(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: STUDY_FILE_PICKER_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!file) return null;
  const picked = { name: file.name, uri: file.uri, mimeType: file.mimeType, size: file.size };
  validateStudyFile(picked);
  return picked;
}

export async function pickQuestionImage(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access so Mentra can read your question.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { name: asset.fileName ?? 'study-question.jpg', uri: asset.uri, mimeType: asset.mimeType };
}
