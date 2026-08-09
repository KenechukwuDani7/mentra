-- Mentra's private study-file storage. The path always starts with the
-- authenticated user's id, and row-level policies prevent cross-user access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-materials',
  'study-materials',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/rtf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users manage their study files" on storage.objects;

create policy "users manage their study files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'study-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'study-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
);
