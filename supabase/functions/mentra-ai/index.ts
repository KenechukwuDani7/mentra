import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.1.0';

type Material = {
  id: string;
  title: string;
  storage_path: string;
  mime_type: string | null;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

type PdfPage = {
  number: number;
  text: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// Keeps requests below Groq's free-tier token-per-minute allowance while
// leaving enough room for the system prompt and generated answer.
const MAX_CONTEXT_CHARACTERS = 18_000;
const MATERIAL_BUCKET = Deno.env.get('STUDY_MATERIALS_BUCKET')?.trim() || 'study-materials';
const MATERIAL_FILE_LIMIT = 25 * 1024 * 1024;
const MATERIAL_MIME_TYPES = [
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
  'image/heif',
];
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'before', 'being',
  'could', 'does', 'from', 'have', 'into', 'just', 'more', 'most', 'other',
  'should', 'some', 'than', 'that', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'through', 'very', 'what', 'when', 'where', 'which', 'while',
  'with', 'would', 'your',
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: corsHeaders });
}

function error(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
}

function parseJsonBlock(value: string) {
  return JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
}

async function callGroq(messages: ChatMessage[], jsonMode = false, options?: { model?: string; maxTokens?: number }) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured for Mentra AI.');

  const baseUrl = (Deno.env.get('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = options?.model ?? Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_completion_tokens: options?.maxTokens ?? (jsonMode ? 6_500 : 2_600),
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    const result = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      const providerMessage = result?.error?.message;
      if (response.status === 429) {
        throw new Error('Mentra AI reached its free testing limit. Please wait a moment and try again.');
      }
      throw new Error(typeof providerMessage === 'string' ? providerMessage : `Groq request failed (${response.status}).`);
    }

    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Groq returned an empty response.');
    }
    return content.trim();
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new Error('Mentra AI took too long to respond. Please try again.');
    }
    throw caught;
  } finally {
    clearTimeout(timeout);
  }
}

async function getOwnedMaterial(admin: ReturnType<typeof createClient>, materialId: string, userId: string) {
  const { data, error: lookupError } = await admin
    .from('materials')
    .select('id, title, storage_path, mime_type')
    .eq('id', materialId)
    .eq('owner_id', userId)
    .single();
  if (lookupError || !data) throw new Error('This study file was not found or you do not have access to it.');
  return data as Material;
}

function fileExtension(material: Material) {
  return material.storage_path.split('.').pop()?.toLowerCase() ?? '';
}

function decodeXml(value: string) {
  return value
    .replace(/<w:tab\s*\/?>/g, '\t')
    .replace(/<w:br\s*\/?>|<a:br\s*\/?>|<\/w:p>|<\/a:p>|<\/row>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 32_768;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function officeXmlPages(bytes: Uint8Array, extension: string): PdfPage[] {
  const archive = unzipSync(bytes);
  const decoder = new TextDecoder();
  if (extension === 'docx') {
    const document = archive['word/document.xml'];
    const text = document ? decodeXml(decoder.decode(document)) : '';
    return text ? [{ number: 1, text }] : [];
  }
  if (extension === 'pptx') {
    return Object.keys(archive)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
      .map((name, index) => ({ number: index + 1, text: decodeXml(decoder.decode(archive[name])) }))
      .filter((page) => page.text.length > 0);
  }
  if (extension === 'xlsx') {
    const shared = archive['xl/sharedStrings.xml'];
    const pages = Object.keys(archive)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()
      .map((name, index) => ({ number: index + 1, text: decodeXml(decoder.decode(archive[name])) }))
      .filter((page) => page.text.length > 0);
    if (shared) pages.unshift({ number: 1, text: `Workbook labels and text:\n${decodeXml(decoder.decode(shared))}` });
    return pages.map((page, index) => ({ ...page, number: index + 1 }));
  }
  return [];
}

async function extractOwnedPdf(admin: ReturnType<typeof createClient>, material: Material) {
  const { data, error: downloadError } = await admin.storage.from(MATERIAL_BUCKET).download(material.storage_path);
  if (downloadError || !data) throw new Error('Mentra could not read this study file from private storage.');

  const bytes = new Uint8Array(await data.arrayBuffer());
  const extension = fileExtension(material);
  const mimeType = material.mime_type?.toLowerCase() ?? '';
  let pages: PdfPage[] = [];
  let totalPages = 1;

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    const document = await getDocumentProxy(bytes);
    const extracted = await extractText(document, { mergePages: false });
    pages = extracted.text.map((page, index) => ({ number: index + 1, text: page.trim() })).filter((page) => page.text.length > 0);
    totalPages = extracted.totalPages;
    if (!pages.length) throw new Error('This PDF appears to be scanned and has no selectable text. Attach a clear page image in the solver while scanned-PDF OCR is being prepared.');
  } else if (['docx', 'pptx', 'xlsx'].includes(extension)) {
    pages = officeXmlPages(bytes, extension);
    totalPages = pages.length;
  } else if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension)) {
    if (bytes.length > 15 * 1024 * 1024) throw new Error('That image is too large for text recognition. Choose a smaller image.');
    const raw = await callGroq([
      { role: 'system', content: 'Read this study image carefully. Transcribe all useful academic text, equations, labels, and table content. Preserve headings and do not invent missing words.' },
      { role: 'user', content: [
        { type: 'text', text: 'Extract the study content from this image so it can be used to answer questions.' },
        { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${bytesToBase64(bytes)}` } },
      ] },
    ], false, { model: 'qwen/qwen3.6-27b', maxTokens: 3_500 });
    pages = [{ number: 1, text: raw }];
  } else if (mimeType.startsWith('text/') || ['txt', 'md', 'csv'].includes(extension)) {
    const text = new TextDecoder().decode(bytes).trim();
    pages = text ? [{ number: 1, text }] : [];
  } else if (extension === 'rtf' || mimeType === 'application/rtf') {
    const text = new TextDecoder().decode(bytes).replace(/\\'[0-9a-f]{2}/gi, ' ').replace(/\\[a-z]+-?\d* ?/gi, ' ').replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
    pages = text ? [{ number: 1, text }] : [];
  } else {
    throw new Error('Mentra can read PDF, DOCX, PPTX, XLSX, text, CSV, RTF, and common image files. Convert this older file format and upload it again.');
  }

  if (!pages.length) throw new Error('Mentra could not find readable content in this study file.');
  return { pages, totalPages };
}

function formatPages(pages: PdfPage[], maxCharacters = MAX_CONTEXT_CHARACTERS) {
  let context = '';
  for (const page of pages) {
    const marker = `[Page ${page.number}]\n`;
    const remaining = maxCharacters - context.length - marker.length - 2;
    if (remaining <= 0) break;
    context += `${marker}${page.text.slice(0, remaining)}\n\n`;
  }
  return context.trim();
}

function representativePages(pages: PdfPage[]) {
  if (pages.length <= 8) return formatPages(pages);
  const selected = new Map<number, PdfPage>();
  const sampleCount = 10;
  for (let index = 0; index < sampleCount; index += 1) {
    const pageIndex = Math.round((index * (pages.length - 1)) / (sampleCount - 1));
    selected.set(pageIndex, pages[pageIndex]);
  }
  return formatPages([...selected.entries()].sort(([a], [b]) => a - b).map(([, page]) => page));
}

function relevantPages(pages: PdfPage[], question: string) {
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])]
    .filter((term) => !STOP_WORDS.has(term));
  if (!terms.length) return representativePages(pages);

  const ranked = pages
    .map((page, index) => {
      const lower = page.text.toLowerCase();
      const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
      return { page, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 7);

  if (!ranked.some((entry) => entry.score > 0)) return representativePages(pages);
  return formatPages(ranked.sort((a, b) => a.index - b.index).map((entry) => entry.page));
}

function citations(material: Material, pageCount?: number) {
  const format = fileExtension(material).toUpperCase() || 'FILE';
  return [`${material.title} - ${format}${pageCount ? ` - ${pageCount} section${pageCount === 1 ? '' : 's'}` : ''}`];
}

function quizPrompt(questionTypes: string[], count: number, difficulty: string) {
  const types = questionTypes.length ? questionTypes.join(', ') : 'multiple choice';
  return `Create exactly ${count} varied, non-repeating, age-appropriate questions at ${difficulty} difficulty using these types where possible: ${types}. Cover a broad range of concepts rather than repeating one idea. Return valid JSON only with this exact shape: {"title":"string","questions":[{"id":"q1","prompt":"string","choices":["choice 1","choice 2","choice 3","choice 4"],"answer":0,"explanation":"string"}]}. For every question include exactly 4 plausible choices, make answer the zero-based correct-choice index, and give a concise teaching explanation.`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return error('Method not allowed.', 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return error('Unauthorized.', 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return error('Unauthorized.', 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json();
    const path = new URL(request.url).pathname;

    if (path.endsWith('/v1/storage/ensure')) {
      const { data: existing, error: lookupError } = await admin.storage.getBucket(MATERIAL_BUCKET);
      if (!existing) {
        const missing = lookupError?.message?.toLowerCase().includes('not found') || (lookupError as { statusCode?: string } | null)?.statusCode === '404';
        if (!missing && lookupError) throw lookupError;
        const { error: createError } = await admin.storage.createBucket(MATERIAL_BUCKET, {
          public: false,
          fileSizeLimit: MATERIAL_FILE_LIMIT,
          allowedMimeTypes: MATERIAL_MIME_TYPES,
        });
        if (createError && !createError.message.toLowerCase().includes('already exists')) throw createError;
      }
      return json({ bucket: MATERIAL_BUCKET, ready: true });
    }

    if (path.endsWith('/v1/chat')) {
      const question = String(body.question ?? '').trim();
      const materialIds = Array.isArray(body.materialIds) ? body.materialIds.map(String) : [];
      if (!question) return error('A question is required.');

      if (materialIds.length) {
        const material = await getOwnedMaterial(admin, materialIds[0], userData.user.id);
        const pdf = await extractOwnedPdf(admin, material);
        const context = relevantPages(pdf.pages, question);
        const answer = await callGroq([
          { role: 'system', content: 'You are Mentra, a clear and encouraging academic tutor. Answer only from the supplied study-file excerpts. Cite page or section numbers using the [Page N] markers. If the excerpts do not contain the answer, say so clearly.' },
          { role: 'user', content: `Study file: ${material.title}\n\n${context}\n\nStudent question: ${question}` },
        ]);
        return json({ answer, citations: citations(material, pdf.totalPages) });
      }

      const studyContext = body.studyContext && typeof body.studyContext === 'object' ? JSON.stringify(body.studyContext) : 'Not provided';
      const answer = await callGroq([
        { role: 'system', content: 'You are Mentra, an accurate and encouraging academic tutor for African students. Give direct, age-appropriate explanations with practical examples. Do not invent sources or facts, and say when you are uncertain.' },
        { role: 'user', content: `Student context: ${studyContext}\n\nQuestion: ${question}` },
      ]);
      return json({ answer, citations: [] });
    }

    if (path.endsWith('/v1/quiz')) {
      const subject = String(body.subject ?? '').trim();
      const educationLevel = String(body.educationLevel ?? 'student').trim();
      const difficulty = String(body.difficulty ?? 'Class level').trim();
      const count = Math.max(5, Math.min(30, Number(body.count) || 30));
      if (!subject) return error('Choose a subject before generating a quiz.');
      const raw = await callGroq([
        { role: 'system', content: 'You create accurate, age-appropriate academic quizzes. Return valid JSON only.' },
        { role: 'user', content: `${quizPrompt(['multiple choice'], count, difficulty)}\nSubject: ${subject}\nLearner level: ${educationLevel}` },
      ], true, { maxTokens: 8_000 });
      const quiz = parseJsonBlock(raw);
      if (!quiz?.title || !Array.isArray(quiz.questions)) throw new Error('Mentra AI returned an invalid quiz.');
      return json(quiz);
    }

    if (path.endsWith('/v1/materials/summarize')) {
      const material = await getOwnedMaterial(admin, String(body.materialId ?? ''), userData.user.id);
      const pdf = await extractOwnedPdf(admin, material);
      const context = representativePages(pdf.pages);
      const answer = await callGroq([
        { role: 'system', content: 'You are Mentra. Create a concise, accurate study summary in simple language using only the supplied study-file excerpts. Include key concepts, important definitions, short exam-focused notes, and cite important points with [Page N]. Mention that this is a representative overview when the source has more than eight sections.' },
        { role: 'user', content: `Study file: ${material.title}\nTotal sections: ${pdf.totalPages}\n\n${context}` },
      ]);
      return json({ answer, citations: citations(material, pdf.totalPages) });
    }

    if (path.endsWith('/v1/materials/quiz')) {
      const material = await getOwnedMaterial(admin, String(body.materialId ?? ''), userData.user.id);
      const pdf = await extractOwnedPdf(admin, material);
      const context = representativePages(pdf.pages);
      const questionTypes = Array.isArray(body.questionTypes) ? body.questionTypes.map(String) : [];
      const difficulty = String(body.difficulty ?? 'Class level').trim();
      const count = Math.max(5, Math.min(30, Number(body.count) || 30));
      const raw = await callGroq([
        { role: 'system', content: 'You create accurate quizzes grounded only in supplied study material. Return valid JSON only.' },
        { role: 'user', content: `${quizPrompt(questionTypes, count, difficulty)}\nStudy file: ${material.title}\n\n${context}` },
      ], true, { maxTokens: 8_000 });
      return json(parseJsonBlock(raw));
    }

    if (path.endsWith('/v1/materials/flashcards')) {
      const material = await getOwnedMaterial(admin, String(body.materialId ?? ''), userData.user.id);
      const pdf = await extractOwnedPdf(admin, material);
      const context = representativePages(pdf.pages);
      const count = Math.max(5, Math.min(30, Number(body.count) || 20));
      const raw = await callGroq([
        { role: 'system', content: 'You create accurate, concise flashcards grounded only in supplied study material. Return valid JSON only.' },
        { role: 'user', content: `Create exactly ${count} varied flashcards. Return {"cards":[{"id":"card-1","front":"question or key term","back":"clear answer or definition","subject":"material subject"}]}. Do not repeat concepts.\nStudy file: ${material.title}\n\n${context}` },
      ], true, { maxTokens: 5_000 });
      const result = parseJsonBlock(raw);
      if (!Array.isArray(result?.cards)) throw new Error('Mentra AI returned invalid flashcards.');
      return json({ cards: result.cards });
    }

    if (path.endsWith('/v1/solve')) {
      const question = String(body.question ?? '').trim();
      const image = body.image && typeof body.image === 'object' ? body.image as { mimeType?: unknown; data?: unknown } : null;
      const imageData = typeof image?.data === 'string' ? image.data : '';
      const mimeType = typeof image?.mimeType === 'string' && image.mimeType.startsWith('image/') ? image.mimeType : 'image/jpeg';
      const educationLevel = String(body.educationLevel ?? 'student').trim();
      if (!question && !imageData) return error('Enter or photograph a maths or science question first.');
      if (imageData.length > 20_000_000) return error('That image is too large. Please choose a smaller or cropped image.');
      const instructions = `Solve the problem accurately for a learner at this level: ${educationLevel}. First identify exactly what is being asked. Explain the method thoroughly in simple language, show every meaningful calculation with correct notation and units, and verify the result where possible. If an image is supplied, use OCR to read it and mention any unclear part instead of guessing. Return valid JSON only with this exact shape: {"answer":"a helpful overview of the method","steps":["detailed numbered step without the number prefix"],"finalAnswer":"the final result with units where relevant","check":"a short verification or reason the answer makes sense","tips":["common mistake or revision tip"],"videoQuery":"a concise YouTube search phrase for learning this exact topic","citations":[]}. Provide 4 to 12 steps when the problem needs them.`;
      const userContent: ChatMessage['content'] = imageData ? [
        { type: 'text', text: question || 'Read the problem in this image and solve it step by step.' },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } },
      ] : question;
      const raw = await callGroq([
        { role: 'system', content: instructions },
        { role: 'user', content: userContent },
      ], true, imageData ? { model: 'qwen/qwen3.6-27b', maxTokens: 5_000 } : { maxTokens: 5_000 });
      return json(parseJsonBlock(raw));
    }

    return error('Unknown Mentra AI route.', 404);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Mentra AI could not complete that request.';
    console.error('Mentra AI request failed:', message);
    return error(message, 500);
  }
});
