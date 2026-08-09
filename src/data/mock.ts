import type { Flashcard, PlannerItem, QuizQuestion, StudyMaterial } from '@/types';

export const materials: StudyMaterial[] = [
  {
    id: 'mat-chemistry',
    title: 'Organic chemistry: alkanes',
    subject: 'Chemistry',
    kind: 'PDF',
    size: '2.4 MB',
    color: '#6F62E7',
    createdAt: 'Today',
    status: 'Ready',
  },
  {
    id: 'mat-calculus',
    title: 'Calculus I lecture notes',
    subject: 'Mathematics',
    kind: 'Note',
    size: '18 pages',
    color: '#F2994A',
    createdAt: 'Yesterday',
    status: 'Ready',
  },
  {
    id: 'mat-ecosystems',
    title: 'Ecosystems & food chains',
    subject: 'Biology',
    kind: 'PPTX',
    size: '6.8 MB',
    color: '#1AA36F',
    createdAt: 'Jun 18',
    status: 'Ready',
  },
  {
    id: 'mat-history',
    title: 'West African independence',
    subject: 'History',
    kind: 'DOCX',
    size: '1.1 MB',
    color: '#E05D70',
    createdAt: 'Jun 13',
    status: 'Ready',
  },
];

export const flashcards: Flashcard[] = [
  {
    id: 'flash-1',
    front: 'What is the functional group in an alkene?',
    back: 'A carbon–carbon double bond (C=C). It makes alkenes more reactive than alkanes.',
    subject: 'Chemistry',
    due: 'Due now',
  },
  {
    id: 'flash-2',
    front: 'State the first fundamental theorem of calculus.',
    back: 'If F(x) = ∫ₐˣ f(t)dt and f is continuous, then F′(x) = f(x).',
    subject: 'Mathematics',
    due: 'Due today',
  },
  {
    id: 'flash-3',
    front: 'Which organisms are producers in a food chain?',
    back: 'Autotrophs, such as green plants and algae, that make their own food using sunlight.',
    subject: 'Biology',
    due: 'Due tomorrow',
  },
];

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Which statement best describes an alkane?',
    choices: [
      'It contains a carbon-carbon double bond.',
      'It has only single carbon-carbon bonds.',
      'It contains an -OH functional group.',
      'It always dissolves in water.',
    ],
    answer: 1,
    explanation: 'Alkanes are saturated hydrocarbons, so all carbon-carbon bonds are single bonds.',
  },
  {
    id: 'q2',
    prompt: 'The general formula for an acyclic alkane is:',
    choices: ['CₙH₂ₙ', 'CₙH₂ₙ₊₂', 'CₙHₙ', 'CₙH₂ₙ₋₂'],
    answer: 1,
    explanation: 'For open-chain alkanes, the number of hydrogens is twice the number of carbons plus two.',
  },
];

export const plannerItems: PlannerItem[] = [
  {
    id: 'plan-1',
    title: 'Practice organic chemistry',
    subject: 'Chemistry',
    date: 'Today',
    time: '6:30 PM',
    type: 'Study session',
  },
  {
    id: 'plan-2',
    title: 'Calculus problem set',
    subject: 'Mathematics',
    date: 'Tomorrow',
    time: '4:00 PM',
    type: 'Revision',
  },
  {
    id: 'plan-3',
    title: 'Chemistry mid-term',
    subject: 'Chemistry',
    date: 'Fri, 28 Jun',
    time: '9:00 AM',
    type: 'Exam',
  },
];

export const days = [
  { label: 'M', date: '17', minutes: 45 },
  { label: 'T', date: '18', minutes: 70 },
  { label: 'W', date: '19', minutes: 35 },
  { label: 'T', date: '20', minutes: 85 },
  { label: 'F', date: '21', minutes: 20 },
  { label: 'S', date: '22', minutes: 0 },
  { label: 'S', date: '23', minutes: 0 },
];
