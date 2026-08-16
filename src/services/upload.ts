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
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'odt', 'odp', 'ods', 'txt', 'md', 'rtf', 'csv', 'tsv', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp',
]);

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  txt: 'text/plain', md: 'text/markdown', rtf: 'application/rtf', csv: 'text/csv', tsv: 'text/tab-separated-values',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp',
};

export const STUDY_FILE_PICKER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/*',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/*',
];

function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
}

function extensionOf(name: string) {
  const parts = name.split('.');
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? '') : '';
}

function resolvedMimeType(file: PickedFile) {
  const extension = extensionOf(file.name);
  const reported = file.mimeType?.toLowerCase().split(';')[0]?.trim();
  // Android providers occasionally report non-standard aliases such as
  // image/jpg, or a generic octet-stream. Prefer the extension mapping so it
  // agrees with the bucket's allow-list, then fall back to the provider value.
  return mimeByExtension[extension] ?? (reported && reported !== 'application/octet-stream' ? reported : 'application/octet-stream');
}

function uploadErrorMessage(error: unknown) {
  const candidate = error as { message?: unknown; error?: unknown; statusCode?: unknown; status?: unknown; code?: unknown } | null;
  const raw = candidate && typeof candidate === 'object'
    ? String(candidate.message ?? candidate.error ?? '')
    : String(error ?? '');
  const lowered = raw.toLowerCase();
  const status = String(candidate?.statusCode ?? candidate?.status ?? '');
  const code = String(candidate?.code ?? '');

  // PGRST205: the table is missing from PostgREST's schema cache, which in
  // practice means the project's schema was never applied. Nothing the student
  // can do about it, so name the cause rather than echoing the raw error.
  if (code === 'PGRST205' || lowered.includes('schema cache')) {
    return 'Mentra’s library is not set up on the server yet. Your file was not saved. Please contact Mentra support — the database schema needs to be applied.';
  }
  if (code === '42P01' || lowered.includes('does not exist')) {
    return 'Mentra’s library is unavailable right now. Your file was not saved. Please try again later.';
  }

  if (storageBucketIsMissing(error)) return 'Mentra storage is being set up. Please try again in a moment.';
  if (lowered.includes('row-level security') || status === '403') {
    return 'Mentra could not save this file to your account. Sign out, sign in again, and retry.';
  }
  if (lowered.includes('jwt') || lowered.includes('unauthorized') || status === '401') {
    return 'Your sign-in session expired. Sign in again before attaching a file.';
  }
  if (lowered.includes('mime') || lowered.includes('content type') || status === '415') {
    return 'Storage rejected this file type. Try converting it to PDF and uploading again.';
  }
  if (lowered.includes('too large') || lowered.includes('exceeded') || status === '413') {
    return 'That file is larger than 25 MB. Choose a smaller file.';
  }
  if (lowered.includes('duplicate') || lowered.includes('already exists')) {
    return 'That file is already in your library.';
  }
  if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('timeout')) {
    return 'The upload could not reach Mentra. Check your connection and try again.';
  }
  return raw || 'Mentra could not attach that file. Please choose it again.';
}

function storageBucketIsMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; statusCode?: unknown; error?: unknown };
  const message = `${String(candidate.message ?? '')} ${String(candidate.error ?? '')}`.toLowerCase();
  return message.includes('bucket not found') || message.includes('bucket does not exist') || (candidate.statusCode === '404' && message.includes('bucket'));
}

async function validateStudyFile(file: PickedFile) {
  const mimeType = resolvedMimeType(file);
  const extension = extensionOf(file.name);

  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v', 'wmv', 'flv'].includes(extension)) {
    throw new Error('Videos are not supported. Choose a document, slide, spreadsheet, note, or image.');
  }
  if (mimeType.startsWith('audio/')) {
    throw new Error('Audio files are not supported. Choose a document, slide, spreadsheet, note, or image.');
  }

  const matchesPickerType = STUDY_FILE_PICKER_TYPES.some((type) =>
    type.endsWith('/*') ? mimeType.startsWith(type.slice(0, -1)) : mimeType === type,
  );
  if (!supportedExtensions.has(extension) && !matchesPickerType) {
    throw new Error('That file type is not supported yet. Choose a PDF, Word file, PowerPoint, spreadsheet, text note, or image.');
  }

  // The picker does not always report a size, so confirm against the file
  // itself before spending a round trip on an upload that storage will reject.
  let size = file.size;
  if (size === undefined) {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (!info.exists) throw new Error('Mentra could not find that file on your device. Choose it again.');
    size = info.size;
  }
  if (size !== undefined && size > MAX_STUDY_FILE_BYTES) {
    throw new Error('That file is larger than 25 MB. Choose a smaller file.');
  }
  if (size === 0) throw new Error('That file is empty. Choose a different file.');
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

/**
 * Streams the picked file straight from disk to Supabase Storage.
 *
 * Reading a 25 MB PDF through base64 costs roughly 60 MB of JS heap and used
 * to fail outright on lower-memory Android phones, so the binary upload is the
 * primary path and the in-memory one is only a fallback.
 */
async function uploadBinary(storagePath: string, file: PickedFile, contentType: string, accessToken: string) {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('Mentra is not connected to Supabase yet.');

  const result = await FileSystem.uploadAsync(
    `${baseUrl}/storage/v1/object/${MATERIAL_BUCKET}/${encodeURI(storagePath)}`,
    file.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
    },
  );

  if (result.status >= 200 && result.status < 300) return;

  const payload = (() => {
    try {
      return JSON.parse(result.body) as { message?: string; error?: string; statusCode?: string };
    } catch {
      return null;
    }
  })();
  throw { message: payload?.message ?? payload?.error ?? result.body, statusCode: String(result.status) };
}

function decodeBase64(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

/** Fallback for platforms where a streamed binary upload is unavailable. */
async function uploadInMemory(storagePath: string, file: PickedFile, contentType: string) {
  if (!supabase) throw new Error('Connect Supabase before uploading study materials.');
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  if (!base64) throw new Error('That file is empty. Choose a different file.');
  const { error } = await supabase.storage.from(MATERIAL_BUCKET).upload(storagePath, decodeBase64(base64), {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

async function uploadFile(storagePath: string, file: PickedFile, contentType: string, accessToken: string) {
  const attempt = async () => {
    try {
      await uploadBinary(storagePath, file, contentType, accessToken);
    } catch (error) {
      if (storageBucketIsMissing(error)) throw error;
      // A streamed upload can fail for transport reasons the in-memory client
      // handles, so give the smaller path one chance before surfacing an error.
      await uploadInMemory(storagePath, file, contentType);
    }
  };

  try {
    await attempt();
  } catch (error) {
    if (!storageBucketIsMissing(error)) throw new Error(uploadErrorMessage(error));
    await ensureMaterialBucket();
    try {
      await attempt();
    } catch (retryError) {
      throw new Error(uploadErrorMessage(retryError));
    }
  }
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
  await validateStudyFile(file);

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Your sign-in session expired. Sign in again before attaching a file.');

  const safeName = cleanFileName(file.name) || 'study-file';
  const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;
  const contentType = resolvedMimeType(file);
  await uploadFile(storagePath, file, contentType, accessToken);

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

async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: STUDY_FILE_PICKER_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!file) return null;
  const picked = { name: file.name, uri: file.uri, mimeType: file.mimeType, size: file.size ?? undefined };
  await validateStudyFile(picked);
  return picked;
}

export async function pickStudyFile(): Promise<PickedFile | null> {
  return pickDocument();
}

export async function pickChatAttachment(): Promise<PickedFile | null> {
  return pickDocument();
}

export async function pickQuestionImage(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access so Mentra can read your question.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { name: asset.fileName ?? 'study-question.jpg', uri: asset.uri, mimeType: asset.mimeType, size: asset.fileSize };
}

/** Square-cropped photo for the profile avatar. */
export async function pickAvatarPhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access so Mentra can set your picture.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { name: asset.fileName ?? 'avatar.jpg', uri: asset.uri, mimeType: asset.mimeType, size: asset.fileSize };
}
