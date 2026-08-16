export type ThemeMode = 'light' | 'dark';

export type MaterialKind = 'PDF' | 'DOCX' | 'PPTX' | 'Image' | 'Note';

export type StudyMaterial = {
  id: string;
  title: string;
  subject: string;
  kind: MaterialKind;
  size: string;
  color: string;
  createdAt: string;
  status?: 'Ready' | 'Processing';
  uri?: string;
  mimeType?: string;
  subjectDescription?: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  subject: string;
  due: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
};

export type PlannerItem = {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string;
  type: 'Study session' | 'Exam' | 'Revision';
  scheduledAt?: string;
  notes?: string;
  notificationId?: string;
};

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  citations?: string[];
};

export type AiAnswer = {
  answer: string;
  citations: string[];
};

/** A summary of one study material. Every field is drawn from that file. */
export type StudySummary = AiAnswer & {
  keyPoints: string[];
  examNote?: string;
};

export type GeneratedQuiz = {
  title: string;
  questions: QuizQuestion[];
};

export type StudySolution = AiAnswer & {
  steps: string[];
  finalAnswer: string;
  check?: string;
  tips?: string[];
  videoQuery?: string;
};

export type GeneratedFlashcard = {
  id: string;
  front: string;
  back: string;
  subject: string;
};

export type PracticeActivity = {
  id: string;
  type: 'Quiz' | 'Flashcards' | 'Solver';
  title: string;
  subject: string;
  detail: string;
  createdAt: string;
};

export type RootTab = 'Home' | 'Library' | 'Practice' | 'Planner' | 'Settings';
