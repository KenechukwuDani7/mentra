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
3. Enable Email, Google, and Apple providers in Supabase Auth. Register the `mentra://auth/callback` redirect URI with each provider.
4. Copy `.env.example` to `.env` and set the Supabase URL, anonymous key, and the Mentra Edge Function URL.
5. Set `OPENAI_API_KEY` and optional `OPENAI_MODEL` as Supabase Edge Function secrets, then deploy `mentra-ai`. The mobile app deliberately never receives an LLM API key.

The gateway contract used by the client is:

```
POST /v1/materials/summarize  { materialId }
POST /v1/chat                { question, materialIds }
POST /v1/materials/quiz      { materialId, questionTypes }
POST /v1/solve               { question, imageUri? }
```

All responses are wrapped as `{ data: ... }`. Chat and summaries should return `{ answer, citations }`, where citations contain human-readable page or slide references.

## Architecture

```
src/
  components/     Reusable app primitives and cards
  data/           Demo content and screen data
  lib/            Infrastructure clients (Supabase)
  screens/        Feature-level UI
  services/       API contracts, RAG client and file ingestion facade
  theme/          Semantic light/dark tokens
  types/          Shared domain types
```

## Production integration

- **Auth, profiles and files:** Supabase Auth, Postgres and Storage through `src/lib/supabase.ts`.
- **RAG:** upload the original file to private Storage; a secure server/edge function extracts text, chunks it, creates embeddings, stores them in a vector table and returns citations for each answer.
- **AI:** the app calls the protected AI gateway via `src/services/ai.ts`. The gateway verifies the signed-in user, applies rate limits, retrieves only the user's permitted chunks, and invokes OpenAI or Gemini.
- **Notifications:** connect the planner to Expo Notifications after notification permission and backend schedule endpoints are enabled.

The included SQL schema in `supabase/schema.sql` enables row-level security patterns suitable for that flow.
