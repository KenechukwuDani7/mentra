import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

import type { PickedFile } from '@/services/upload';
import type { AiAnswer, GeneratedFlashcard, GeneratedQuiz, StudySolution } from '@/types';

const configuredGatewayUrl = process.env.EXPO_PUBLIC_AI_API_URL;
const gatewayUrl = configuredGatewayUrl?.includes('YOUR_API_DOMAIN') ? undefined : configuredGatewayUrl;

type GatewayResponse<T> = { data: T };

function safeGatewayMessage(message: string) {
  if (/insufficient_quota|billing|quota/i.test(message)) {
    return 'Mentra AI is temporarily unavailable. Please try again later.';
  }
  return message;
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!gatewayUrl) return null;

  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const accessToken = sessionResult?.data.session?.access_token;
  if (!accessToken) {
    throw new Error('Sign in to Mentra before using the AI tutor.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let response: Response;
  try {
    response = await fetch(`${gatewayUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new Error('Mentra AI took too long to respond. Please try again in a moment.');
    }
    throw caught;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof payload?.error === 'string' ? payload.error : '';
    if (response.status === 401) {
      throw new Error('Your Mentra session has expired. Please sign in again, then retry your question.');
    }
    throw new Error(safeGatewayMessage(message || 'Mentra AI is temporarily unavailable. Please try again.'));
  }
  return ((await response.json()) as GatewayResponse<T>).data;
}

function localAnswer(question: string, hasMaterial: boolean): AiAnswer {
  const normalized = question.trim().toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const asksAboutMaths = /\b(what is|define|meaning of)\s+(math|maths|mathematics)\b/.test(normalized);

  if (asksAboutMaths) {
    return {
      answer:
        'Mathematics is the study of numbers, quantities, shapes, patterns, and logical relationships. We use it in everyday life to manage money, measure things, compare quantities, plan journeys, understand data, and solve problems. Its main areas include arithmetic, algebra, geometry, calculus, and statistics.',
      citations: [],
    };
  }

  return {
    answer: hasMaterial
      ? 'Your PDF is available in demo mode. Connect the Mentra AI gateway to receive an answer grounded in its pages, including page citations.'
      : 'Mentra is ready for live academic questions. Connect the AI gateway to provide accurate, current explanations across subjects.',
    citations: [],
  };
}

export const ai = {
  async summarize(materialId: string): Promise<AiAnswer> {
    const remote = await post<AiAnswer>('/v1/materials/summarize', { materialId });
    return remote ?? {
      answer:
        'This demo summary shows the desired format: a plain-language overview, the most important ideas, and short exam-ready notes. Once the AI gateway is connected, Mentra extracts the PDF, retrieves relevant pages, and creates this from the actual document.',
      citations: [],
    };
  },

  async ask(question: string, materialIds: string[] = [], studyContext?: { subjects: string[]; subjectDescriptions: Record<string, string>; language: string }): Promise<AiAnswer> {
    const questionForAi = studyContext?.language && studyContext.language !== 'English' ? `${question}\n\nPlease answer in ${studyContext.language}.` : question;
    const remote = await post<AiAnswer>('/v1/chat', { question: questionForAi, materialIds, studyContext });
    return remote ?? localAnswer(question, materialIds.length > 0);
  },

  async generateSubjectQuiz(subject: string, educationLevel: string, difficulty = 'Class level', count = 30): Promise<GeneratedQuiz> {
    const remote = await post<GeneratedQuiz>('/v1/quiz', { subject, educationLevel, difficulty, count });
    if (!remote) throw new Error('Mentra AI is not configured for quiz generation yet.');
    return remote;
  },

  async generateQuiz(materialId: string, questionTypes: Array<'mcq' | 'short_answer' | 'true_false' | 'essay'>, difficulty = 'Class level', count = 30): Promise<GeneratedQuiz | null> {
    return post<GeneratedQuiz>('/v1/materials/quiz', { materialId, questionTypes, difficulty, count });
  },

  async generateFlashcards(materialId: string, count = 20): Promise<GeneratedFlashcard[]> {
    const remote = await post<{ cards: GeneratedFlashcard[] }>('/v1/materials/flashcards', { materialId, count });
    if (!remote) throw new Error('Mentra AI is not configured for flashcard generation yet.');
    return remote.cards;
  },

  async solve(question: string, image?: PickedFile, educationLevel = 'student'): Promise<StudySolution> {
    let encodedImage: { mimeType: string; data: string } | undefined;
    if (image) {
      const data = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
      encodedImage = { mimeType: image.mimeType ?? 'image/jpeg', data };
    }
    const remote = await post<StudySolution>('/v1/solve', { question, image: encodedImage, educationLevel });
    if (!remote) throw new Error('Mentra AI is not configured for calculations yet.');
    return remote;
  },
};
