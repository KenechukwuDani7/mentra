-- Mentra core schema. Run in a Supabase SQL migration; extend to match your AI pipeline.
create extension if not exists vector;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country text,
  education_level text,
  class_name text,
  subjects text[] default '{}',
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  storage_path text not null,
  mime_type text,
  page_count integer,
  created_at timestamptz default now()
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.materials(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  page_number integer,
  embedding vector(1536)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  studied_on date not null default current_date
);

create table public.flashcards (
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

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  title text not null,
  question_types text[] not null default '{}',
  score numeric,
  created_at timestamptz default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  choices jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  question_type text not null
);

create table public.planner_items (
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

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique (owner_id, achievement_key)
);

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.document_chunks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.planner_items enable row level security;
alter table public.achievements enable row level security;

create policy "profiles belong to user" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "materials belong to user" on public.materials for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "chunks belong to user" on public.document_chunks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "sessions belong to user" on public.study_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "flashcards belong to user" on public.flashcards for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "quizzes belong to user" on public.quizzes for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "quiz questions belong to quiz owner" on public.quiz_questions for all using (exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.owner_id = auth.uid()));
create policy "planner items belong to user" on public.planner_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "achievements belong to user" on public.achievements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Private file storage used by the app and the Mentra AI gateway. Keeping this
-- in the migration prevents new environments from failing with "Bucket not found".
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
on conflict (id) do nothing;

create policy "users manage their study files" on storage.objects for all
  using (bucket_id = 'study-materials' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'study-materials' and auth.uid()::text = (storage.foldername(name))[1]);
