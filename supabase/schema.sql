-- Mentra core schema.
--
-- Safe to run repeatedly, and safe to run against a project where Storage was
-- already set up. The Supabase SQL editor executes a script in one transaction,
-- so a single "already exists" error rolls the whole thing back and leaves you
-- with nothing — every statement here is therefore idempotent.

create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country text,
  education_level text,
  class_name text,
  subjects text[] default '{}',
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  storage_path text not null,
  mime_type text,
  page_count integer,
  created_at timestamptz default now()
);

create table if not exists public.document_chunks (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.materials(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  page_number integer,
  embedding vector(1536)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  studied_on date not null default current_date
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  subject text,
  front text not null,
  back text not null,
  due_at timestamptz default now(),
  interval_days integer not null default 0,
  ease_factor numeric not null default 2.5,
  created_at timestamptz default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  title text not null,
  question_types text[] not null default '{}',
  score numeric,
  created_at timestamptz default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  choices jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  question_type text not null
);

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  item_type text not null check (item_type in ('study_session', 'revision', 'exam')),
  reminder_minutes integer,
  completed boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique (owner_id, achievement_key)
);

create index if not exists materials_owner_idx on public.materials (owner_id, created_at desc);
create index if not exists document_chunks_material_idx on public.document_chunks (material_id);
create index if not exists planner_items_owner_idx on public.planner_items (owner_id, starts_at);

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.document_chunks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.planner_items enable row level security;
alter table public.achievements enable row level security;

drop policy if exists "profiles belong to user" on public.profiles;
create policy "profiles belong to user" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "materials belong to user" on public.materials;
create policy "materials belong to user" on public.materials for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "chunks belong to user" on public.document_chunks;
create policy "chunks belong to user" on public.document_chunks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "sessions belong to user" on public.study_sessions;
create policy "sessions belong to user" on public.study_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "flashcards belong to user" on public.flashcards;
create policy "flashcards belong to user" on public.flashcards for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "quizzes belong to user" on public.quizzes;
create policy "quizzes belong to user" on public.quizzes for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "quiz questions belong to quiz owner" on public.quiz_questions;
create policy "quiz questions belong to quiz owner" on public.quiz_questions for all using (exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.owner_id = auth.uid()));

drop policy if exists "planner items belong to user" on public.planner_items;
create policy "planner items belong to user" on public.planner_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "achievements belong to user" on public.achievements;
create policy "achievements belong to user" on public.achievements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Private file storage used by the app and the Mentra AI gateway. Keeping this
-- in the migration prevents new environments from failing with "Bucket not found".
-- The MIME list must match MATERIAL_MIME_TYPES in the mentra-ai edge function
-- and mimeByExtension in src/services/upload.ts.
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
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users manage their study files" on storage.objects;
create policy "users manage their study files" on storage.objects for all
  using (bucket_id = 'study-materials' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'study-materials' and auth.uid()::text = (storage.foldername(name))[1]);

-- PostgREST caches the schema. Without this, newly created tables keep failing
-- with PGRST205 "Could not find the table ... in the schema cache" until the
-- API restarts on its own.
notify pgrst, 'reload schema';
