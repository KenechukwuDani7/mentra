-- Uploads were being rejected by storage for file types the app itself
-- accepts. Android document providers report application/octet-stream for
-- files whose name carries no extension, and OpenDocument, GIF, BMP and TSV
-- were never in the original allow-list at all.
--
-- The client still refuses video and audio before an upload starts, so
-- allowing octet-stream here widens the accepted set without opening the
-- bucket to media.
--
-- Keep in sync with MATERIAL_MIME_TYPES in supabase/functions/mentra-ai/index.ts
-- and mimeByExtension in src/services/upload.ts.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'application/octet-stream'
]::text[]
where id = 'study-materials';
