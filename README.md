# Mentra

Mentra is an AI study companion for African learners, from primary school through university. This Expo application contains the mobile client, a demo mode for immediate exploration, and typed boundaries for Supabase and a server-side RAG API.

## Start the app

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in the Supabase and AI gateway values when connecting real services.
3. Run `npm start`, then open the QR code with Expo Go or launch an emulator.

The app works without configuration in local demo mode. Real AI calls are intentionally routed through `EXPO_PUBLIC_AI_API_URL`; never place OpenAI or Gemini secrets in the mobile client.

## Connect production services

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Create a **private** Storage bucket called `study-materials` and apply the bucket policy included at the end of the schema.
3. Run every file in `supabase/migrations/` in order. These are not optional — see
   "Applying pending migrations" below.
4. Enable the Email and Google providers in Supabase Auth, and register the
   `mentra://auth/callback` redirect URI with each. Mentra does not offer Apple sign-in.
5. Copy `.env.example` to `.env` and set the Supabase URL, anonymous key, and the Mentra Edge Function URL.
6. Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`, `GROQ_BASE_URL`) as Supabase Edge Function
   secrets, then deploy `mentra-ai`. The mobile app deliberately never receives an LLM API key.

### Applying pending migrations

`supabase/migrations/20260816120000_widen_study_material_mime_types.sql` widens the
storage bucket's accepted MIME types. **Until it runs, uploads keep failing** for files
whose type was missing from the original allow-list — OpenDocument, GIF, BMP, TSV, and
anything an Android document provider reports as `application/octet-stream`, which is
what it returns for files with no extension.

Creating the bucket does not apply it: the edge function's `/v1/storage/ensure` route
only creates the bucket when it is absent and never updates an existing one. Run the SQL
directly, or `supabase db push` if you use the CLI.

Redeploy `mentra-ai` afterwards so its own copy of the allow-list matches.

The gateway contract used by the client is:

```
POST /v1/materials/summarize   { materialId }
POST /v1/chat                  { question, materialIds }
POST /v1/quiz                  { subject, educationLevel, difficulty, count }
POST /v1/materials/quiz        { materialId, questionTypes }
POST /v1/materials/flashcards  { materialId, count }
POST /v1/solve                 { question, image?, educationLevel }
POST /v1/storage/ensure        {}
```

All responses are wrapped as `{ data: ... }`. Chat and summaries should return `{ answer, citations }`, where citations contain human-readable page or slide references.

## Architecture

```
App.tsx           Every screen and sheet, plus the app shell
src/
  components/     Bottom nav, loading states, material row, UI primitives
  constants/      Subject catalogue, supported languages, interface strings
  content/        Static copy (privacy)
  data/           Demo content used as fallbacks
  lib/            Infrastructure clients (Supabase)
  services/       AI gateway client, auth, notifications, file upload
  shims/          Web-only stand-ins for native-only modules
  theme/          Design tokens: palette, type scale, spacing, elevation
  types/          Shared domain types
```

### Design language

`src/theme/tokens.ts` is the single source of truth. It is a Material 3 tonal system
seeded from Mentra's blue, with surface containers stepping through elevation instead of
white cards on grey outlines. Prefer `theme.surfaceContainer` over
`theme.surface` + `theme.line` for anything that is not a text input.

Use the `type` scale rather than ad-hoc font sizes, and reserve weights above 600 for
headings — uniformly tiny, ultra-bold text is what made the previous UI read as
machine-generated.

## Production integration

- **Auth, profiles and files:** Supabase Auth, Postgres and Storage through `src/lib/supabase.ts`. Email and Google only.
- **RAG:** upload the original file to private Storage; a secure server/edge function extracts text, chunks it, creates embeddings, stores them in a vector table and returns citations for each answer.
- **AI:** the app calls the protected AI gateway via `src/services/ai.ts`. The gateway verifies the signed-in user, applies rate limits, retrieves only the user's permitted chunks, and calls Groq.
- **Uploads:** files stream from disk via `FileSystem.uploadAsync`. Do not route them through base64 — a 25 MB PDF needs roughly 60 MB of JS heap that way and fails on lower-memory Android phones.
- **Notifications:** the planner schedules local reminders through `src/services/notifications.ts`. The Android small icon must stay a white-on-transparent silhouette (`assets/notification-icon.png`); Android masks it to its alpha channel, so a colour logo renders as a solid white square.

The included SQL schema in `supabase/schema.sql` enables row-level security patterns suitable for that flow.
