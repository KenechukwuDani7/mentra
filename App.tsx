import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Pdf from 'react-native-pdf';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as NativeText,
  type TextProps,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_CLEARANCE, BottomNav } from '@/components/bottom-nav';
import { HomeSkeleton, SplashScreen } from '@/components/loading';
import { MaterialRow } from '@/components/material-row';
import { EmptyState, IconButton, Pill, ProgressBar, SectionHeader } from '@/components/ui';
import { privacyReviewNote, privacySections } from '@/content/privacy';
import { subjectCatalog, supportedLanguages } from '@/constants/study';
import { getInterfaceCopy } from '@/constants/language';
import { translateInterfaceText } from '@/constants/interface-strings';
import { materials, quizQuestions } from '@/data/mock';
import { parseMessageBlocks, splitInline, stripMarkers } from '@/lib/markdown';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { auth } from '@/services/auth';
import { ai } from '@/services/ai';
import { cancelStudyTaskNotification, scheduleStudyTaskNotification } from '@/services/notifications';
import { pickChatAttachment, pickQuestionImage, pickStudyFile, uploadStudyMaterial, type PickedFile } from '@/services/upload';
import { elevation, radius, spacing, themes, type, type AppTheme } from '@/theme/tokens';
import type { AiAnswer, ChatMessage, GeneratedFlashcard, GeneratedQuiz, PlannerItem, PracticeActivity, RootTab, StudyMaterial, StudySolution, StudySummary, ThemeMode } from '@/types';

type AppStage = 'loading' | 'welcome' | 'auth' | 'verifyEmail' | 'onboarding' | 'app';
type Sheet = 'none' | 'actions' | 'upload' | 'practiceCreate' | 'flashcards' | 'chat' | 'solver' | 'reader' | 'summary' | 'quiz' | 'language' | 'privacy';
type ThemePreference = ThemeMode | 'system';

const logo = require('./assets/mentra-mark.png');
const welcomeStudy = require('./assets/welcome-study-phone.jpg');
const SESSION_ACTIVITY_KEY = 'mentra_last_active_at';
const SESSION_IDLE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;
const MATERIALS_STORAGE_KEY = 'mentra_study_materials';
const LANGUAGE_STORAGE_KEY = 'mentra_learning_language';
const PRACTICE_HISTORY_KEY = 'mentra_practice_history';
const PLANNER_STORAGE_KEY = 'mentra_planner_items';
const THEME_PREFERENCE_STORAGE_KEY = 'mentra_theme_preference';
const InterfaceLanguageContext = createContext('English');

function Text({ children, ...props }: TextProps) {
  const language = useContext(InterfaceLanguageContext);
  const content = typeof children === 'string' ? translateInterfaceText(language, children) : children;
  return <NativeText {...props}>{content}</NativeText>;
}

function materialKindForFile(file: PickedFile): StudyMaterial['kind'] {
  const type = file.mimeType?.toLowerCase() ?? '';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (type === 'application/pdf' || extension === 'pdf') return 'PDF';
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extension)) return 'Image';
  if (type.includes('powerpoint') || type.includes('presentation') || ['ppt', 'pptx'].includes(extension)) return 'PPTX';
  if (type.includes('word') || type.includes('document') || ['doc', 'docx'].includes(extension)) return 'DOCX';
  return 'Note';
}

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  return <SafeAreaProvider><MentraApp /></SafeAreaProvider>;
}

function MentraApp() {
  const insets = useSafeAreaInsets();
  const systemTheme = useColorScheme();
  const [stage, setStage] = useState<AppStage>('loading');
  // Light is the default look. Students can switch to dark, or hand control
  // back to the device, from Settings — a saved choice always wins over this.
  const [themePreference, setThemePreference] = useState<ThemePreference>('light');
  const [themePreferenceReady, setThemePreferenceReady] = useState(false);
  const [activeTab, setActiveTab] = useState<RootTab>('Home');
  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [chatMaterialIds, setChatMaterialIds] = useState<string[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial>(materials[0]!);
  const [userName, setUserName] = useState('');
  const [focusSubjects, setFocusSubjects] = useState<string[]>([]);
  const [subjectDescriptions, setSubjectDescriptions] = useState<Record<string, string>>({});
  const [learningLevel, setLearningLevel] = useState('');
  const [studentMaterials, setStudentMaterials] = useState<StudyMaterial[]>([]);
  const [materialsReady, setMaterialsReady] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [language, setLanguage] = useState('English');
  const [practiceHistory, setPracticeHistory] = useState<PracticeActivity[]>([]);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<GeneratedFlashcard[]>([]);
  const [quizMaterialId, setQuizMaterialId] = useState<string | null>(null);
  const [studyPlan, setStudyPlan] = useState<PlannerItem[]>([]);
  const [studyPlanReady, setStudyPlanReady] = useState(false);
  const themeMode: ThemeMode = themePreference === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : themePreference;
  const theme = themes[themeMode];
  const withInterfaceLanguage = (content: React.ReactNode) => <InterfaceLanguageContext.Provider value={language}>{content}</InterfaceLanguageContext.Provider>;

  const changeThemePreference = (preference: ThemePreference) => {
    setThemePreference(preference);
    void AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  };

  const markSessionActive = async () => {
    await AsyncStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  };

  useEffect(() => {
    const restoreThemePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
        if (savedPreference === 'light' || savedPreference === 'dark' || savedPreference === 'system') {
          setThemePreference(savedPreference);
        }
      } finally {
        setThemePreferenceReady(true);
      }
    };
    void restoreThemePreference();
  }, []);

  useEffect(() => {
    const restoreLocalLearningData = async () => {
      try {
        const [savedMaterials, savedLanguage, savedPracticeHistory] = await Promise.all([
          AsyncStorage.getItem(MATERIALS_STORAGE_KEY),
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(PRACTICE_HISTORY_KEY),
        ]);
        if (savedMaterials) {
          const parsed = JSON.parse(savedMaterials) as StudyMaterial[];
          if (Array.isArray(parsed)) setStudentMaterials(parsed);
        }
        if (savedLanguage && supportedLanguages.includes(savedLanguage)) setLanguage(savedLanguage);
        if (savedPracticeHistory) {
          const parsed = JSON.parse(savedPracticeHistory) as PracticeActivity[];
          if (Array.isArray(parsed)) setPracticeHistory(parsed);
        }
      } catch {
        // Local study data remains optional if it cannot be restored.
      } finally {
        setMaterialsReady(true);
      }
    };
    void restoreLocalLearningData();
  }, []);

  useEffect(() => {
    if (materialsReady) void AsyncStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(studentMaterials));
  }, [materialsReady, studentMaterials]);

  useEffect(() => {
    if (materialsReady) void AsyncStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(practiceHistory));
  }, [materialsReady, practiceHistory]);

  useEffect(() => {
    void AsyncStorage.getItem(PLANNER_STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as PlannerItem[];
        if (Array.isArray(parsed)) setStudyPlan(parsed.filter((item) => item.scheduledAt));
      } catch {
        // Ignore invalid legacy planner data.
      }
    }).finally(() => setStudyPlanReady(true));
  }, []);

  useEffect(() => {
    if (studyPlanReady) void AsyncStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(studyPlan));
  }, [studyPlan, studyPlanReady]);

  const upcomingStudyTasks = [...studyPlan]
    .filter((item) => new Date(item.scheduledAt ?? 0).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
  const nextStudyTask = upcomingStudyTasks[0];
  // Badge the Planner tab when something is scheduled within the next day.
  const plannerHasDueTask = Boolean(nextStudyTask && new Date(nextStudyTask.scheduledAt ?? 0).getTime() - Date.now() <= 24 * 60 * 60 * 1000);

  const addPracticeActivity = (activity: Omit<PracticeActivity, 'id' | 'createdAt'>) => {
    setPracticeHistory((current) => [{ ...activity, id: `practice-${Date.now()}`, createdAt: 'Just now' }, ...current].slice(0, 50));
  };

  const completeAuthRedirect = async (url: string) => {
    if (!supabase || !url.startsWith('mentra://auth/')) return null;
    const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const code = params.get('code');

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
      return data.session;
    }
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    }
    return null;
  };

  useEffect(() => {
    if (!themePreferenceReady) return;
    let active = true;
    const restoreSession = async () => {
      let nextStage: AppStage = 'welcome';
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await completeAuthRedirect(initialUrl);
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const lastActiveAt = Number(await AsyncStorage.getItem(SESSION_ACTIVITY_KEY));
        const sessionIsRecent = session && Number.isFinite(lastActiveAt) && Date.now() - lastActiveAt <= SESSION_IDLE_LIMIT_MS;
        if (session && sessionIsRecent) {
          const metadata = session.user.user_metadata ?? {};
          setUserName(String(metadata.full_name ?? metadata.name ?? metadata.given_name ?? session.user.email?.split('@')[0] ?? 'Student'));
          if (Array.isArray(metadata.subjects)) setFocusSubjects(metadata.subjects.map(String));
          if (metadata.subject_descriptions && typeof metadata.subject_descriptions === 'object') setSubjectDescriptions(metadata.subject_descriptions as Record<string, string>);
          setLearningLevel(String(metadata.education_level ?? ''));
          await markSessionActive();
          nextStage = metadata.onboarding_completed ? 'app' : 'onboarding';
        } else if (session) {
          await auth.signOut();
          await AsyncStorage.removeItem(SESSION_ACTIVITY_KEY);
        }
      } catch {
        nextStage = 'welcome';
      }
      setTimeout(() => { if (active) setStage(nextStage); }, 1100);
    };
    void restoreSession();
    return () => { active = false; };
  }, [themePreferenceReady]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void completeAuthRedirect(url).then(async (session) => {
        if (!session) return;
        const metadata = session.user.user_metadata ?? {};
        setUserName(String(metadata.full_name ?? metadata.name ?? metadata.given_name ?? session.user.email?.split('@')[0] ?? 'Student'));
        if (Array.isArray(metadata.subjects)) setFocusSubjects(metadata.subjects.map(String));
        if (metadata.subject_descriptions && typeof metadata.subject_descriptions === 'object') setSubjectDescriptions(metadata.subject_descriptions as Record<string, string>);
        setLearningLevel(String(metadata.education_level ?? ''));
        await markSessionActive();
        setStage(metadata.onboarding_completed ? 'app' : 'onboarding');
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const syncUserName = async () => {
    const result = supabase ? await supabase.auth.getUser() : null;
    const user = result?.data.user;
    const metadata = user?.user_metadata ?? {};
    const profileName = metadata.full_name ?? metadata.name ?? metadata.given_name ?? user?.email?.split('@')[0] ?? 'Student';
    setUserName(String(profileName));
    if (Array.isArray(metadata.subjects)) setFocusSubjects(metadata.subjects.map(String));
    if (metadata.subject_descriptions && typeof metadata.subject_descriptions === 'object') setSubjectDescriptions(metadata.subject_descriptions as Record<string, string>);
    setLearningLevel(String(metadata.education_level ?? ''));
  };

  const addStudentMaterial = async (file: PickedFile, subject: string, subjectDescription?: string) => {
    if (!supabase) throw new Error('Mentra is not connected to Supabase yet.');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in to Mentra before uploading a study material.');

    const uploaded = await uploadStudyMaterial({ file, userId: user.id, subject });
    const title = file.name.replace(/\.[^.]+$/, '');
    setStudentMaterials((current) => current.some((material) => material.title === title && material.subject === subject) ? current : [{
      id: uploaded.id,
      title,
      subject,
      kind: materialKindForFile(file),
      size: file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'New upload',
      color: '#6F62E7',
      createdAt: 'Just now',
      status: 'Ready',
      uri: file.uri,
      mimeType: file.mimeType,
      subjectDescription: subjectDescription?.trim() || undefined,
    }, ...current]);
    return uploaded.id;
  };

  const deleteStudentMaterial = (material: StudyMaterial) => {
    setStudentMaterials((current) => current.filter((item) => item.id !== material.id));
  };

  const openMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
    setSheet('reader');
  };

  const chooseLanguage = async (nextLanguage: string) => {
    setLanguage(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setSheet('none');
  };

  if (stage === 'loading') {
    return withInterfaceLanguage(<LoadingScreen theme={theme} />);
  }
  if (stage === 'welcome') {
    return withInterfaceLanguage(<WelcomeScreen theme={theme} onContinue={() => setStage('auth')} />);
  }
  if (stage === 'auth') {
    return withInterfaceLanguage(<AuthScreen theme={theme} onBack={() => setStage('welcome')} onEmailConfirmationRequired={(email) => { setPendingVerificationEmail(email); setStage('verifyEmail'); }} onAuthenticated={(isNewUser) => { void syncUserName(); void markSessionActive(); setStage(isNewUser ? 'onboarding' : 'app'); }} />);
  }
  if (stage === 'verifyEmail') {
    return withInterfaceLanguage(<VerifyEmailScreen theme={theme} email={pendingVerificationEmail} onBack={() => setStage('auth')} />);
  }
  if (stage === 'onboarding') {
    return withInterfaceLanguage(<OnboardingScreen theme={theme} onDone={({ name, subjects, educationLevel, subjectDescriptions: descriptions }) => { setUserName(name); setFocusSubjects(subjects); setSubjectDescriptions(descriptions); setLearningLevel(educationLevel); void markSessionActive(); setStage('app'); }} />);
  }

  return withInterfaceLanguage(
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.appShell}>
        {!profileOpen && activeTab === 'Home' && !materialsReady ? <HomeSkeleton theme={theme} /> : null}
        {!profileOpen && activeTab === 'Home' && materialsReady ? (
          <HomeScreen
            theme={theme}
            userName={userName}
            language={language}
            focusSubjects={focusSubjects}
            recentMaterials={studentMaterials}
            nextTask={nextStudyTask}
            onOpenChat={() => { setChatMaterialIds([]); setSheet('chat'); }}
            onOpenActions={() => setSheet('actions')}
            onOpenSummary={openMaterial}
            onOpenPractice={() => setActiveTab('Practice')}
            onOpenPlanner={() => setActiveTab('Planner')}
            onOpenLibrary={() => setActiveTab('Library')}
            onOpenProfile={() => setProfileOpen(true)}
          />
        ) : null}
        {!profileOpen && activeTab === 'Library' ? (
          <LibraryScreen theme={theme} materials={studentMaterials} focusSubjects={focusSubjects} onUpload={() => setSheet('upload')} onOpenSummary={openMaterial} onDelete={deleteStudentMaterial} />
        ) : null}
        {!profileOpen && activeTab === 'Practice' ? (
          <PracticeScreen theme={theme} focusSubjects={focusSubjects} history={practiceHistory} onAdd={() => setSheet('practiceCreate')} onOpenQuiz={() => { setQuizMaterialId(null); setSheet('quiz'); }} onOpenSolver={() => setSheet('solver')} />
        ) : null}
        {!profileOpen && activeTab === 'Planner' ? <PlannerScreen theme={theme} focusSubjects={focusSubjects} items={studyPlan} onChangeItems={setStudyPlan} /> : null}
        {!profileOpen && activeTab === 'Settings' ? (
          <SettingsScreen
            theme={theme}
            darkMode={themeMode === 'dark'}
            followsDevice={themePreference === 'system'}
            language={language}
            onChangeMode={(enabled) => changeThemePreference(enabled ? 'dark' : 'light')}
            onFollowDevice={(enabled) => changeThemePreference(enabled ? 'system' : (themeMode === 'dark' ? 'dark' : 'light'))}
            onOpenLanguage={() => setSheet('language')}
            onOpenPrivacy={() => setSheet('privacy')}
            onOpenProfile={() => setProfileOpen(true)}
            onSignOut={() => { void auth.signOut(); void AsyncStorage.removeItem(SESSION_ACTIVITY_KEY); setProfileOpen(false); setStage('welcome'); }}
          />
        ) : null}
        {profileOpen ? (
          <ProfileScreen
            theme={theme}
            userName={userName}
            focusSubjects={focusSubjects}
            subjectDescriptions={subjectDescriptions}
            onChangeName={setUserName}
            onChangeSubjects={setFocusSubjects}
            onChangeSubjectDescriptions={setSubjectDescriptions}
            onBack={() => setProfileOpen(false)}
          />
        ) : null}
      </View>
      {sheet === 'none' && !profileOpen && activeTab === 'Home' ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create or ask Mentra"
        onPress={() => setSheet('actions')}
        android_ripple={{ color: 'rgba(255,255,255,0.22)', borderless: false }}
        style={({ pressed }) => [styles.fab, elevation(3, theme.shadow), { backgroundColor: theme.brand, bottom: BOTTOM_NAV_CLEARANCE + insets.bottom + 12, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      >
        <Ionicons name="add" size={28} color={theme.onBrand} />
      </Pressable> : null}
      {sheet === 'none' ? <BottomNav active={activeTab} onChange={(tab) => { setProfileOpen(false); setActiveTab(tab); }} theme={theme} badges={{ Planner: plannerHasDueTask }} /> : null}

      <ActionSheet
        visible={sheet === 'actions'}
        theme={theme}
        onClose={() => setSheet('none')}
        onUpload={() => setSheet('upload')}
        onChat={() => { setChatMaterialIds([]); setSheet('chat'); }}
        onSolver={() => setSheet('solver')}
        onQuiz={() => setSheet('quiz')}
      />
      <UploadSheet visible={sheet === 'upload'} theme={theme} subjects={focusSubjects} onClose={() => setSheet('none')} onUploaded={async (file, subject, description) => { await addStudentMaterial(file, subject, description); }} />
      <PracticeCreateSheet visible={sheet === 'practiceCreate'} theme={theme} subjects={focusSubjects} onClose={() => setSheet('none')} onUploaded={addStudentMaterial} onBuildQuiz={(materialId) => { setQuizMaterialId(materialId); setSheet('quiz'); }} onFlashcards={(cards, title, subject) => { setGeneratedFlashcards(cards); addPracticeActivity({ type: 'Flashcards', title, subject, detail: `${cards.length} cards generated` }); setSheet('flashcards'); }} />
      <FlashcardSheet visible={sheet === 'flashcards'} theme={theme} cards={generatedFlashcards} onClose={() => setSheet('none')} />
      <ReaderSheet visible={sheet === 'reader'} material={selectedMaterial} theme={theme} onClose={() => setSheet('none')} onOpenStudyTools={() => setSheet('summary')} />
      <ChatSheet visible={sheet === 'chat'} theme={theme} focusSubjects={focusSubjects} subjectDescriptions={subjectDescriptions} language={language} materialIds={chatMaterialIds} onAttach={addStudentMaterial} onClose={() => setSheet('none')} />
      <SolverSheet visible={sheet === 'solver'} theme={theme} learningLevel={learningLevel} onSolved={(question) => addPracticeActivity({ type: 'Solver', title: 'Solved question', subject: 'Maths & science', detail: question || 'Solved from an image' })} onClose={() => setSheet('none')} />
      <SummarySheet
        visible={sheet === 'summary'}
        material={selectedMaterial}
        theme={theme}
        onClose={() => setSheet('reader')}
        onChat={() => { setChatMaterialIds([selectedMaterial.id]); setSheet('chat'); }}
      />
      <QuizSheet visible={sheet === 'quiz'} theme={theme} focusSubjects={focusSubjects} learningLevel={learningLevel} materialId={quizMaterialId} onComplete={(title, subject, score, total) => addPracticeActivity({ type: 'Quiz', title, subject, detail: `${score}/${total} correct` })} onClose={() => { setQuizMaterialId(null); setSheet('none'); }} />
      <LanguageSheet visible={sheet === 'language'} theme={theme} language={language} onClose={() => setSheet('none')} onSelect={chooseLanguage} />
      <PrivacySheet visible={sheet === 'privacy'} theme={theme} onClose={() => setSheet('none')} />
    </SafeAreaView>
  );
}

function WelcomeScreen({
  theme,
  onContinue,
}: {
  theme: AppTheme;
  onContinue: () => void;
}) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <ImageBackground source={welcomeStudy} resizeMode="cover" imageStyle={styles.welcomeBackground} style={styles.welcome}>
        <View style={styles.welcomeOverlay} pointerEvents="none" />
        <View style={styles.welcomeTop}>
          <View style={[styles.logoCrop, { backgroundColor: '#FFFFFF' }]}>
            <Image source={logo} resizeMode="contain" style={styles.logoImage} />
          </View>
          <Pill theme={theme} color="rgba(255,255,255,0.78)" textColor={theme.brand} style={styles.welcomePill}>
            Built for African learners
          </Pill>
          <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>Study smarter.{`\n`}Achieve more.</Text>
          <Text style={[styles.heroBody, { color: 'rgba(255,255,255,0.86)' }]}>Your materials, an AI tutor, and a plan that keeps you moving forward.</Text>
        </View>
        <View style={[styles.welcomePanel, { backgroundColor: theme.surface }]}>
          <Text style={[styles.welcomeTitle, { color: theme.text }]}>Your learning, in one place.</Text>
          <FeatureLine icon="book-outline" text="Understand any topic in simple language" theme={theme} />
          <FeatureLine icon="documents-outline" text="Turn notes into flashcards and quizzes" theme={theme} />
          <FeatureLine icon="calendar-outline" text="Stay ready for your next exam" theme={theme} />
          <Pressable onPress={onContinue} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.brand, opacity: pressed ? 0.82 : 1 }]}>
            <Text style={styles.primaryButtonText}>Dive into Mentra</Text>
            <Ionicons name="arrow-forward" color="#FFF" size={19} />
          </Pressable>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

function AuthScreen({
  theme,
  onBack,
  onEmailConfirmationRequired,
  onAuthenticated,
}: {
  theme: AppTheme;
  onBack: () => void;
  onEmailConfirmationRequired: (email: string) => void;
  onAuthenticated: (isNewUser: boolean) => void;
}) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
    { label: 'One symbol (for example: !, @, #)', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const passwordIsValid = passwordChecks.every((check) => check.met);
  const formIsValid = emailIsValid && (mode === 'signIn' ? password.length > 0 : passwordIsValid && name.trim().length >= 2);

  useEffect(() => {
    setAuthError(null);
    const clearAutofill = setTimeout(() => {
      setName('');
      setEmail('');
      setPassword('');
    }, 450);
    return () => clearTimeout(clearAutofill);
  }, [mode]);

  const withError = async (task: () => Promise<void>) => {
    if (busy) return;
    try {
      setAuthError(null);
      setBusy(true);
      await task();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Please try again.';
      setAuthError(/password should contain|password.*weak|password.*character/i.test(message) ? 'Choose a password that meets all of the requirements below.' : message);
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () => withError(async () => {
    if (!emailIsValid) throw new Error('Enter a valid email address.');
    if (mode === 'signUp' && !passwordIsValid) throw new Error('Choose a password that meets all of the requirements below.');
    if (mode === 'signIn' && !password) throw new Error('Enter your password.');
    if (mode === 'signUp') {
      if (name.trim().length < 2) throw new Error('Enter your full name.');
      const result = await auth.signUp(email.trim(), password, name.trim(), Linking.createURL('auth/callback'));
      if (!result.session) {
        onEmailConfirmationRequired(email.trim());
        return;
      }
      onAuthenticated(true);
      return;
    }
    const result = await auth.signInWithPassword(email.trim(), password);
    onAuthenticated(!result.user.user_metadata?.onboarding_completed);
  });

  const submitProvider = (provider: 'google') => withError(async () => {
    if (!supabase) throw new Error('Supabase is not configured on this device yet.');
    const redirectTo = Linking.createURL('auth/callback');
    const url = await auth.signInWithProvider(provider, redirectTo);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
    if (result.type !== 'success') {
      if (result.type !== 'cancel') throw new Error('The sign-in window could not be completed.');
      return;
    }

    const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const code = params.get('code');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      throw new Error('Mentra did not receive a session from the sign-in provider.');
    }
    const signedInUser = (await supabase.auth.getUser()).data.user;
    onAuthenticated(!signedInUser?.user_metadata?.onboarding_completed);
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.authScreen} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={[styles.authBack, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.authMark}><Image source={logo} resizeMode="cover" style={styles.authLogo} /></View>
        <Pill theme={theme}>Welcome to Mentra</Pill>
        <Text style={[styles.authTitle, { color: theme.text }]}>{mode === 'signIn' ? 'Continue your learning journey.' : 'Create your Mentra account.'}</Text>
        <Text style={[styles.authBody, { color: theme.textMuted }]}>Study smarter with an AI tutor that understands your goals.</Text>

        {!isSupabaseConfigured ? <View style={[styles.authWarning, { backgroundColor: '#FFF4DE' }]}><Ionicons name="information-circle-outline" size={18} color={theme.warning} /><Text style={[styles.authWarningText, { color: '#805809' }]}>Add your Supabase publishable key to enable sign-in.</Text></View> : null}

        <View style={styles.authForm}>
          {mode === 'signUp' ? <TextInput key={`name-${mode}`} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.textMuted} style={[styles.authInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} autoCapitalize="words" autoComplete="off" importantForAutofill="noExcludeDescendants" /> : null}
          <TextInput key={`email-${mode}`} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={theme.textMuted} style={[styles.authInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="noExcludeDescendants" />
          <TextInput key={`password-${mode}`} value={password} onChangeText={(value) => { setPassword(value); setAuthError(null); }} placeholder={mode === 'signUp' ? 'Create a password' : 'Password'} placeholderTextColor={theme.textMuted} style={[styles.authInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]} secureTextEntry autoCapitalize="none" autoComplete="new-password" importantForAutofill="noExcludeDescendants" />
          {mode === 'signUp' ? <View style={[styles.passwordChecklist, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.passwordChecklistTitle, { color: theme.text }]}>Password requirements</Text>{passwordChecks.map((check) => <View key={check.label} style={styles.passwordCheck}><Ionicons name={check.met ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={check.met ? theme.success : theme.textMuted} /><Text style={[styles.passwordCheckText, { color: check.met ? theme.success : theme.textMuted }]}>{check.label}</Text></View>)}</View> : null}
          {email.length > 0 && !emailIsValid ? <Text style={[styles.authFieldHint, { color: theme.danger }]}>Enter a valid email address.</Text> : null}
          {authError ? <View style={[styles.authError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.authErrorText, { color: theme.danger }]}>{authError}</Text></View> : null}
          <Pressable disabled={busy || !isSupabaseConfigured || !formIsValid} onPress={submitEmail} style={[styles.primaryButton, { backgroundColor: busy || !isSupabaseConfigured || !formIsValid ? theme.line : theme.brand }]}>
            {busy ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>{mode === 'signIn' ? 'Sign in with email' : 'Create account'}</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></>}
          </Pressable>
        </View>

        <View style={styles.authDivider}><View style={[styles.authRule, { backgroundColor: theme.line }]} /><Text style={[styles.authDividerText, { color: theme.textMuted }]}>or continue with</Text><View style={[styles.authRule, { backgroundColor: theme.line }]} /></View>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !isSupabaseConfigured}
          onPress={() => submitProvider('google')}
          android_ripple={{ color: `${theme.brand}18` }}
          style={({ pressed }) => [styles.authProvider, { borderColor: theme.line, backgroundColor: theme.surface, opacity: busy || !isSupabaseConfigured ? 0.5 : pressed ? 0.86 : 1 }]}
        >
          <Ionicons name="logo-google" size={20} color={theme.text} />
          <Text style={[styles.socialText, { color: theme.text }]}>Continue with Google</Text>
        </Pressable>
        <Pressable onPress={() => setMode((current) => current === 'signIn' ? 'signUp' : 'signIn')} style={styles.authModeButton}><Text style={[styles.authModeText, { color: theme.brand }]}>{mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function VerifyEmailScreen({
  theme,
  email,
  onBack,
}: {
  theme: AppTheme;
  email: string;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (busy) return;
    try {
      setBusy(true);
      setError(null);
      await auth.resendEmailConfirmation(email, Linking.createURL('auth/callback'));
      setNotice('A new confirmation link has been sent. Check your inbox and spam folder.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not send another code. Please try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.authScreen} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={onBack} style={[styles.authBack, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.authMark}><Image source={logo} resizeMode="cover" style={styles.authLogo} /></View>
        <Pill theme={theme}>One more step</Pill>
        <Text style={[styles.authTitle, { color: theme.text }]}>Confirm your email</Text>
        <Text style={[styles.authBody, { color: theme.textMuted }]}>We sent a confirmation link to {email}. Open your email and tap the link to activate your Mentra account.</Text>
        <View style={styles.authForm}>
          {error ? <View style={[styles.authError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.authErrorText, { color: theme.danger }]}>{error}</Text></View> : null}
          {notice ? <View style={[styles.authNotice, { backgroundColor: theme.mode === 'dark' ? '#16382F' : '#E8F8F0' }]}><Ionicons name="checkmark-circle-outline" size={17} color={theme.success} /><Text style={[styles.authErrorText, { color: theme.success }]}>{notice}</Text></View> : null}
          <Pressable onPress={onBack} style={[styles.primaryButton, { backgroundColor: theme.brand }]}>
            <Text style={styles.primaryButtonText}>I’ve confirmed — sign in</Text><Ionicons name="arrow-forward" color="#FFF" size={18} />
          </Pressable>
        </View>
        <View style={styles.verifyHelp}>
          <Text style={[styles.verifyHelpText, { color: theme.textMuted }]}>Didn’t receive the email?</Text>
          <Pressable disabled={busy} onPress={resend} accessibilityRole="button"><Text style={[styles.verifyResend, { color: busy ? theme.textMuted : theme.brand }]}>Send a new link</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingScreen({ theme }: { theme: AppTheme }) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SplashScreen theme={theme} />
    </SafeAreaView>
  );
}

function OnboardingScreen({ theme, onDone }: { theme: AppTheme; onDone: (profile: { name: string; subjects: string[]; educationLevel: string; subjectDescriptions: Record<string, string> }) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [level, setLevel] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [customSubjectDescription, setCustomSubjectDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = ['About you', 'Your age', 'Your level', 'Your class', 'Subjects'];
  const classOptions =
    level === 'Primary school'
      ? ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6']
      : level === 'Secondary school'
        ? ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3']
        : level === 'University'
          ? ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', '600 Level', 'Postgraduate']
          : ['Foundation', 'Intermediate', 'Final stage', 'Other'];
  const options =
    step === 0
      ? ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other']
      : step === 1
        ? ['0–9 years', '10–15 years', '16+ years']
        : step === 2
          ? ['Primary school', 'Secondary school', 'University', 'Professional exams']
          : step === 3
            ? classOptions
            : subjectCatalog;
  const titles = ['Let’s make Mentra feel like yours.', 'How old are you?', 'Where are you in your journey?', 'What class or year are you in?', 'What are you learning?'];
  const descriptions = [
    'Your country helps us use the right curriculum context and study examples.',
    'This helps Mentra explain topics at the right pace and level.',
    'We’ll tune explanations, revision notes, and practice questions for you.',
    'Choose the class or year you are currently studying in.',
    'Pick the subjects you want to focus on first. You can change these anytime.',
  ];
  const finalSubjects = customSubject.trim() ? Array.from(new Set([...subjects, customSubject.trim()])) : subjects;
  const selected = step === 0 ? (country ? [country] : []) : step === 1 ? (ageBand ? [ageBand] : []) : step === 2 ? (level ? [level] : []) : step === 3 ? (classLevel ? [classLevel] : []) : finalSubjects;

  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => {
      const savedName = data.user?.user_metadata?.full_name;
      if (savedName) setName(String(savedName));
    });
  }, []);
  const toggle = (option: string) => {
    if (step === 0) setCountry(option);
    else if (step === 1) setAgeBand(option);
    else if (step === 2) { setLevel(option); setClassLevel(''); }
    else if (step === 3) setClassLevel(option);
    else setSubjects((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  };
  const canContinue =
    step === 0 ? name.trim().length >= 2 && Boolean(country) :
      step === 1 ? Boolean(ageBand) :
        step === 2 ? Boolean(level) :
          step === 3 ? Boolean(classLevel) : finalSubjects.length > 0;
  const proceed = async () => {
    if (step < steps.length - 1) {
      setError(null);
      setStep((value) => value + 1);
      return;
    }
    if (busy) return;
    try {
      setBusy(true);
      setError(null);
      await auth.completeOnboarding({ fullName: name.trim(), country, ageBand, educationLevel: level, classLevel, subjects: finalSubjects, subjectDescriptions: customSubject.trim() && customSubjectDescription.trim() ? { [customSubject.trim()]: customSubjectDescription.trim() } : undefined });
      onDone({ name: name.trim(), subjects: finalSubjects, educationLevel: level, subjectDescriptions: customSubject.trim() && customSubjectDescription.trim() ? { [customSubject.trim()]: customSubjectDescription.trim() } : {} });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not save your learning profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.onboarding}>
        <View style={styles.onboardingHeader}>
          <Pressable onPress={() => (step === 0 ? undefined : setStep((value) => value - 1))} hitSlop={10}>
            <Ionicons name={step === 0 ? 'close' : 'arrow-back'} color={theme.text} size={23} />
          </Pressable>
          <Text style={[styles.wordmark, { color: theme.brand }]}>mentra</Text>
          <Text style={[styles.stepCount, { color: theme.textMuted }]}>{step + 1} of {steps.length}</Text>
        </View>
        <View style={styles.stepper}>
          {steps.map((item, index) => (
            <View key={item} style={[styles.stepLine, { backgroundColor: index <= step ? theme.brand : theme.line }]} />
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.onboardingContent}>
          <Pill theme={theme}>{steps[step]}</Pill>
          <Text style={[styles.onboardingTitle, { color: theme.text }]}>{titles[step]}</Text>
          <Text style={[styles.onboardingBody, { color: theme.textMuted }]}>{descriptions[step]}</Text>
          {step === 0 ? (
            <View style={[styles.nameInputWrap, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                placeholderTextColor={theme.textMuted}
                style={[styles.nameInput, { color: theme.text }]}
              />
            </View>
          ) : null}
          <View style={styles.optionGrid}>
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => toggle(option)}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: isSelected ? theme.brandSoft : theme.surface, borderColor: isSelected ? theme.brand : theme.line, opacity: pressed ? 0.72 : 1 },
                  ]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? theme.brand : theme.text }]}>{option}</Text>
                  {isSelected ? <Ionicons name="checkmark-circle" color={theme.brand} size={19} /> : null}
                </Pressable>
              );
            })}
          </View>
          {step === 4 ? <View style={styles.customSubjectForm}>
            <Text style={[styles.profileFieldLabel, { color: theme.textMuted }]}>Can’t find a subject? Add your own</Text>
            <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="Subject name, e.g. Fashion design" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surface }]} />
            <TextInput value={customSubjectDescription} onChangeText={setCustomSubjectDescription} placeholder="Briefly describe what you study in it so Mentra can help accurately" placeholderTextColor={theme.textMuted} multiline style={[styles.profileDescriptionInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surface }]} />
          </View> : null}
          {error ? <View style={[styles.authError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0', marginTop: 14 }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.authErrorText, { color: theme.danger }]}>{error}</Text></View> : null}
        </ScrollView>
        <Pressable
          disabled={!canContinue || busy}
          onPress={proceed}
          style={[styles.primaryButton, { backgroundColor: canContinue && !busy ? theme.brand : theme.line, marginHorizontal: 22, marginBottom: 14 }]}
        >
          {busy ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>{step === steps.length - 1 ? 'Start learning' : 'Continue'}</Text><Ionicons name={step === steps.length - 1 ? 'checkmark' : 'arrow-forward'} color="#FFF" size={19} /></>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({
  theme,
  userName,
  language,
  focusSubjects,
  recentMaterials,
  nextTask,
  onOpenChat,
  onOpenActions,
  onOpenSummary,
  onOpenPractice,
  onOpenPlanner,
  onOpenLibrary,
  onOpenProfile,
}: {
  theme: AppTheme;
  userName: string;
  language: string;
  focusSubjects: string[];
  recentMaterials: StudyMaterial[];
  nextTask?: PlannerItem;
  onOpenChat: () => void;
  onOpenActions: () => void;
  onOpenSummary: (material: StudyMaterial) => void;
  onOpenPractice: () => void;
  onOpenPlanner: () => void;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
}) {
  const copy = getInterfaceCopy(language);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const refreshGreeting = () => setCurrentHour(new Date().getHours());
    const interval = setInterval(refreshGreeting, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.homeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textMuted }]}>{copy.greeting(currentHour)}</Text>
          <Text numberOfLines={1} style={[styles.userName, { color: theme.text }]}>{userName || 'Student'}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon="notifications-outline" label="Open planner reminders" theme={theme} onPress={onOpenPlanner} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={onOpenProfile}
            android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true, radius: 22 }}
            style={({ pressed }) => [styles.homeAvatar, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.homeAvatarText, { color: theme.onBrand }]}>{(userName || 'S').charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onOpenChat}
        android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
        style={({ pressed }) => [styles.askBanner, elevation(2, theme.shadow), { backgroundColor: theme.brand, opacity: pressed ? 0.94 : 1 }]}
      >
        <View style={[styles.askIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Ionicons name="sparkles" size={21} color={theme.onBrand} />
        </View>
        <View style={styles.askCopy}>
          <Text style={[styles.askTitle, { color: theme.onBrand }]}>{copy.askTitle}</Text>
          <Text style={[styles.askBody, { color: theme.onBrand }]}>{copy.askBody}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={theme.onBrand} />
      </Pressable>

      {nextTask ? (
        <Pressable
          onPress={onOpenPlanner}
          android_ripple={{ color: `${theme.brand}18` }}
          style={({ pressed }) => [styles.nextTaskCard, { backgroundColor: theme.surfaceContainer, opacity: pressed ? 0.88 : 1 }]}
        >
          <View style={[styles.nextTaskIcon, { backgroundColor: nextTask.type === 'Exam' ? theme.dangerContainer : theme.brandContainer }]}>
            <Ionicons name={nextTask.type === 'Exam' ? 'school' : 'time'} size={20} color={nextTask.type === 'Exam' ? theme.danger : theme.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextTaskLabel, { color: theme.textSubtle }]}>NEXT UP</Text>
            <Text numberOfLines={1} style={[styles.nextTaskTitle, { color: theme.text }]}>{nextTask.title}</Text>
          </View>
          <Text style={[styles.nextTaskTime, { color: theme.brand }]}>{formatPlannerTime(new Date(nextTask.scheduledAt ?? 0))}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.goalCard, { backgroundColor: theme.surfaceContainer }]}>
        <Text style={[styles.goalEyebrow, { color: theme.brand }]}>{copy.studySpace}</Text>
        <Text style={[styles.goalTitle, { color: theme.text }]}>{recentMaterials.length ? copy.learningTitle : copy.emptyStudyTitle}</Text>
        <Text style={[styles.freshStartBody, { color: theme.textMuted }]}>{recentMaterials.length ? copy.learningBody : copy.emptyStudyBody}</Text>
        {focusSubjects.length ? (
          <View style={styles.subjectFocusRow}>
            {focusSubjects.slice(0, 6).map((subject) => (
              <View key={subject} style={[styles.subjectFocusChip, { backgroundColor: theme.brandContainer }]}>
                <Text style={[styles.subjectFocusText, { color: theme.onBrandContainer }]}>{subject}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {recentMaterials[0] ? (
        <View>
          <SectionHeader title={copy.continueStudying} theme={theme} />
          <Pressable
            onPress={() => onOpenSummary(recentMaterials[0]!)}
            android_ripple={{ color: `${theme.brand}18` }}
            style={({ pressed }) => [styles.continueCard, { backgroundColor: theme.surfaceContainer, opacity: pressed ? 0.88 : 1 }]}
          >
            <View style={[styles.continueIcon, { backgroundColor: theme.violetContainer }]}>
              <Ionicons name="document-text" color={theme.violet} size={23} />
            </View>
            <View style={styles.continueCopy}>
              <Pill theme={theme} color={theme.violetContainer} textColor={theme.violet}>{recentMaterials[0]!.subject}</Pill>
              <Text numberOfLines={1} style={[styles.continueTitle, { color: theme.text }]}>{recentMaterials[0]!.title}</Text>
              <Text numberOfLines={1} style={[styles.continueMeta, { color: theme.textMuted }]}>Summaries, flashcards, and questions are ready</Text>
            </View>
            <Ionicons name="play-circle" color={theme.brand} size={34} />
          </Pressable>
        </View>
      ) : null}

      <View>
        <SectionHeader title={copy.quickActions} theme={theme} />
        <View style={styles.quickGrid}>
          <QuickAction icon="cloud-upload-outline" label={copy.upload} color={theme.brand} container={theme.brandContainer} theme={theme} onPress={onOpenActions} />
          <QuickAction icon="albums-outline" label={copy.flashcards} color={theme.amber} container={theme.amberContainer} theme={theme} onPress={onOpenPractice} />
          <QuickAction icon="help-circle-outline" label={copy.takeQuiz} color={theme.teal} container={theme.tealContainer} theme={theme} onPress={onOpenPractice} />
          <QuickAction icon="calendar-outline" label={copy.planStudy} color={theme.violet} container={theme.violetContainer} theme={theme} onPress={onOpenPlanner} />
        </View>
      </View>

      <View>
        <SectionHeader title={copy.recentMaterials} action={copy.viewLibrary} onAction={onOpenLibrary} theme={theme} />
        <View style={styles.listGap}>
          {recentMaterials.length
            ? recentMaterials.slice(0, 3).map((material) => <MaterialRow key={material.id} material={material} theme={theme} onPress={() => onOpenSummary(material)} />)
            : <EmptyState icon="folder-open-outline" title={copy.noMaterials} description={copy.noMaterialsBody} theme={theme} action="Upload a file" onAction={onOpenActions} />}
        </View>
      </View>
    </ScrollView>
  );
}

function LibraryScreen({
  theme,
  materials,
  focusSubjects,
  onUpload,
  onOpenSummary,
  onDelete,
}: {
  theme: AppTheme;
  materials: StudyMaterial[];
  focusSubjects: string[];
  onUpload: () => void;
  onOpenSummary: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [materialToDelete, setMaterialToDelete] = useState<StudyMaterial | null>(null);
  const filters = ['All', ...Array.from(new Set([...focusSubjects, ...materials.map((material) => material.subject)]))];
  const visibleMaterials = filter === 'All' ? materials : materials.filter((material) => material.subject === filter);
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Your library</Text>
          <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>Everything you need to study, organised.</Text>
        </View>
        <IconButton icon="cloud-upload-outline" label="Upload material" theme={theme} onPress={onUpload} tone="brand" />
      </View>
      <Pressable onPress={onUpload} style={({ pressed }) => [styles.uploadCard, { borderColor: 'transparent', backgroundColor: theme.surfaceContainer, opacity: pressed ? 0.82 : 1 }]}>
        <View style={[styles.uploadIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name="add" size={27} color={theme.brand} /></View>
        <View style={styles.uploadCopy}>
          <Text style={[styles.uploadTitle, { color: theme.text }]}>Add study material</Text>
          <Text style={[styles.uploadBody, { color: theme.textMuted }]}>Upload a study file to create study tools</Text>
        </View>
        <Ionicons name="arrow-forward" size={19} color={theme.brand} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, { backgroundColor: filter === item ? theme.brand : theme.surface, borderColor: filter === item ? theme.brand : theme.line }]}>
            <Text style={[styles.filterText, { color: filter === item ? '#FFF' : theme.textMuted }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.libraryLabel}>
        <Text style={[styles.libraryCount, { color: theme.text }]}>{visibleMaterials.length} materials</Text>
        <Text style={[styles.sortText, { color: theme.textMuted }]}>Recently added <Ionicons name="chevron-down" size={13} /></Text>
      </View>
      {visibleMaterials.length ? <View style={styles.listGap}>{visibleMaterials.map((material) => <MaterialRow key={material.id} material={material} theme={theme} onPress={() => onOpenSummary(material)} onDelete={() => setMaterialToDelete(material)} />)}</View> : <EmptyState icon="folder-open-outline" title="Nothing here yet" description="Upload a material or choose another subject." theme={theme} />}
      {materialToDelete ? <View style={[styles.deleteConfirmCard, { backgroundColor: theme.mode === 'dark' ? '#31242C' : '#FFF2F3', borderColor: theme.mode === 'dark' ? '#5A3A46' : '#FFD9DE' }]}><View style={styles.deleteConfirmCopy}><Ionicons name="trash-outline" color={theme.danger} size={20} /><View style={{ flex: 1 }}><Text style={[styles.deleteConfirmTitle, { color: theme.text }]}>Delete {materialToDelete.title}?</Text><Text style={[styles.deleteConfirmBody, { color: theme.textMuted }]}>This will remove it from your library.</Text></View></View><View style={styles.deleteConfirmActions}><Pressable onPress={() => setMaterialToDelete(null)} style={[styles.deleteCancelButton, { borderColor: theme.line, backgroundColor: theme.surface }]}><Text style={[styles.deleteCancelText, { color: theme.text }]}>Cancel</Text></Pressable><Pressable onPress={() => { onDelete(materialToDelete); setMaterialToDelete(null); }} style={[styles.deleteConfirmButton, { backgroundColor: theme.danger }]}><Text style={styles.deleteConfirmButtonText}>Delete</Text></Pressable></View></View> : null}
    </ScrollView>
  );
}

function PracticeScreen({ theme, focusSubjects, history, onAdd, onOpenQuiz, onOpenSolver }: { theme: AppTheme; focusSubjects: string[]; history: PracticeActivity[]; onAdd: () => void; onOpenQuiz: () => void; onOpenSolver: () => void }) {
  const activityIcons: Record<PracticeActivity['type'], keyof typeof Ionicons.glyphMap> = { Quiz: 'help-circle-outline', Flashcards: 'albums-outline', Solver: 'calculator-outline' };
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}><View style={{ flex: 1 }}><Text style={[styles.screenTitle, { color: theme.text }]}>Practice smarter</Text><Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>Turn your study materials into confidence.</Text></View><IconButton icon="add" label="Add practice material" theme={theme} onPress={onAdd} tone="brand" /></View>
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.practiceAddCard, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent', opacity: pressed ? 0.82 : 1 }]}><View style={[styles.practiceAddIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name="document-attach-outline" size={22} color={theme.brand} /></View><View style={{ flex: 1 }}><Text style={[styles.practiceAddTitle, { color: theme.text }]}>Create from a study file</Text><Text style={[styles.practiceAddBody, { color: theme.textMuted }]}>Upload a file, then choose flashcards or a 30-question quiz.</Text></View><Ionicons name="arrow-forward" size={19} color={theme.brand} /></Pressable>
      <View style={styles.practiceOptions}>
        <Pressable onPress={onOpenQuiz} style={[styles.practiceOption, { backgroundColor: '#6056D9' }]}><Ionicons name="help-circle-outline" size={25} color="#FFF" /><View style={styles.practiceOptionCopy}><Text style={styles.practiceOptionTitle}>AI quiz</Text><Text style={styles.practiceOptionBody}>30 questions at your level</Text></View><Ionicons name="arrow-forward" size={18} color="#FFF" /></Pressable>
        <Pressable onPress={onOpenSolver} style={[styles.practiceOption, { backgroundColor: '#087F6C' }]}><Ionicons name="calculator-outline" size={25} color="#FFF" /><View style={styles.practiceOptionCopy}><Text style={styles.practiceOptionTitle}>Solve a question</Text><Text style={styles.practiceOptionBody}>Text, calculations, or a photo</Text></View><Ionicons name="arrow-forward" size={18} color="#FFF" /></Pressable>
      </View>
      {focusSubjects.length ? <View style={styles.subjectFocusRow}>{focusSubjects.map((subject) => <View key={subject} style={[styles.subjectFocusChip, { backgroundColor: theme.brandSoft }]}><Text style={[styles.subjectFocusText, { color: theme.brand }]}>{subject}</Text></View>)}</View> : null}
      <SectionHeader title="Practice history" theme={theme} />
      {history.length ? <View style={styles.practiceHistoryList}>{history.map((activity) => <View key={activity.id} style={[styles.practiceHistoryCard, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}><View style={[styles.practiceHistoryIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name={activityIcons[activity.type]} color={theme.brand} size={20} /></View><View style={{ flex: 1 }}><View style={styles.practiceHistoryTop}><Text style={[styles.practiceHistoryType, { color: theme.brand }]}>{activity.type}</Text><Text style={[styles.practiceHistoryTime, { color: theme.textMuted }]}>{activity.createdAt}</Text></View><Text numberOfLines={1} style={[styles.practiceHistoryTitle, { color: theme.text }]}>{activity.title}</Text><Text style={[styles.practiceHistoryDetail, { color: theme.textMuted }]}>{activity.subject} · {activity.detail}</Text></View></View>)}</View> : <EmptyState icon="albums-outline" title="No practice history yet" description="Create flashcards, take a quiz, or solve a question. Your work will appear here." theme={theme} />}
    </ScrollView>
  );
}

function formatPlannerDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPlannerTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Month grid for the planner. Days that carry a task show a dot in the task's
 * type colour, and tapping a day filters the schedule list beneath it.
 */
function MonthCalendar({
  theme,
  month,
  selected,
  items,
  onSelect,
  onChangeMonth,
}: {
  theme: AppTheme;
  month: Date;
  selected: Date;
  items: PlannerItem[];
  onSelect: (day: Date) => void;
  onChangeMonth: (delta: number) => void;
}) {
  const today = new Date();
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksOn = (day: Date) => items.filter((item) => isSameDay(new Date(item.scheduledAt ?? 0), day));

  return (
    <View style={[styles.calendarCard, { backgroundColor: theme.surfaceContainer }]}>
      <View style={styles.calendarHeader}>
        <Text style={[styles.calendarMonth, { color: theme.text }]}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <View style={styles.calendarNav}>
          <IconButton icon="chevron-back" label="Previous month" theme={theme} size={38} onPress={() => onChangeMonth(-1)} />
          <IconButton icon="chevron-forward" label="Next month" theme={theme} size={38} onPress={() => onChangeMonth(1)} />
        </View>
      </View>

      <View style={styles.calendarWeekRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <Text key={`${initial}-${index}`} style={[styles.calendarWeekday, { color: theme.textSubtle }]}>{initial}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.calendarCell} />;
          const dayTasks = tasksOn(day);
          const isSelected = isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={`${day.getDate()}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(day)}
              android_ripple={{ color: `${theme.brand}20`, borderless: true, radius: 22 }}
              style={styles.calendarCell}
            >
              <View style={[styles.calendarCellInner, isSelected ? { backgroundColor: theme.brand } : isToday ? { borderWidth: 1.5, borderColor: theme.brand } : null]}>
                <Text style={[styles.calendarCellText, { color: isSelected ? theme.onBrand : isToday ? theme.brand : theme.text, fontWeight: isSelected || isToday ? '700' : '500' }]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.calendarDotRow}>
                {dayTasks.slice(0, 3).map((task) => (
                  <View
                    key={task.id}
                    style={[styles.calendarDot, { backgroundColor: isSelected ? theme.brand : task.type === 'Exam' ? theme.danger : task.type === 'Revision' ? theme.violet : theme.success }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PlannerScreen({
  theme,
  focusSubjects,
  items,
  onChangeItems,
}: {
  theme: AppTheme;
  focusSubjects: string[];
  items: PlannerItem[];
  onChangeItems: (update: (current: PlannerItem[]) => PlannerItem[]) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerItem | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });

  const sortedItems = [...items].sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
  const nextItem = sortedItems.find((item) => new Date(item.scheduledAt ?? 0).getTime() >= Date.now());
  const dayItems = sortedItems.filter((item) => isSameDay(new Date(item.scheduledAt ?? 0), selectedDay));

  const saveItem = async (draft: PlannerItem) => {
    const notificationId = await scheduleStudyTaskNotification({ id: draft.id, title: draft.title, subject: draft.subject, type: draft.type, scheduledAt: draft.scheduledAt! });
    if (editing?.notificationId) await cancelStudyTaskNotification(editing.notificationId);
    const saved = { ...draft, notificationId };
    onChangeItems((current) => editing ? current.map((item) => item.id === editing.id ? saved : item) : [...current, saved]);
    setSelectedDay(new Date(saved.scheduledAt!));
    setEditorOpen(false);
    setEditing(null);
  };

  const deleteItem = async (item: PlannerItem) => {
    await cancelStudyTaskNotification(item.notificationId);
    onChangeItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setEditorOpen(false);
    setEditing(null);
  };

  const openFor = (day?: Date) => {
    setEditing(null);
    if (day) setSelectedDay(day);
    setEditorOpen(true);
  };

  return <>
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Planner</Text>
          <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>Plan your study and get reminded on time.</Text>
        </View>
        <IconButton icon="add" label="Add study task" theme={theme} tone="brand" onPress={() => openFor()} />
      </View>

      <View style={[styles.nextUpCard, { backgroundColor: theme.brandContainer }]}>
        <View style={[styles.nextUpIcon, { backgroundColor: theme.surface }]}>
          <Ionicons name={nextItem?.type === 'Exam' ? 'school' : 'time'} color={theme.brand} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextUpLabel, { color: theme.onBrandContainer }]}>{nextItem ? 'NEXT UP' : 'NOTHING SCHEDULED'}</Text>
          <Text numberOfLines={1} style={[styles.nextUpTitle, { color: theme.onBrandContainer }]}>{nextItem?.title ?? 'Your schedule is clear'}</Text>
          <Text style={[styles.nextUpMeta, { color: theme.onBrandContainer }]}>
            {nextItem ? `${formatPlannerDate(new Date(nextItem.scheduledAt!))} · ${formatPlannerTime(new Date(nextItem.scheduledAt!))}` : 'Tap + to plan your first study session.'}
          </Text>
        </View>
      </View>

      <MonthCalendar
        theme={theme}
        month={month}
        selected={selectedDay}
        items={items}
        onSelect={setSelectedDay}
        onChangeMonth={(delta) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))}
      />

      <SectionHeader
        title={isSameDay(selectedDay, new Date()) ? 'Today' : formatPlannerDate(selectedDay)}
        action="Add task"
        onAction={() => openFor(selectedDay)}
        theme={theme}
        style={{ marginTop: spacing.xxl }}
      />
      {dayItems.length ? (
        <View style={styles.scheduleList}>
          {dayItems.map((item) => (
            <PlannerTaskRow
              key={item.id}
              item={item}
              theme={theme}
              onEdit={() => { setEditing(item); setEditorOpen(true); }}
              onDelete={() => Alert.alert('Delete this task?', `${item.title} and its reminder will be removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteItem(item) }])}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Nothing on this day"
          description="Pick another day on the calendar, or add a study session for this one."
          theme={theme}
          action="Add a task"
          onAction={() => openFor(selectedDay)}
        />
      )}

      {sortedItems.length ? <>
        <SectionHeader title="All upcoming" theme={theme} style={{ marginTop: spacing.xxl }} />
        <View style={styles.scheduleList}>
          {sortedItems.filter((item) => new Date(item.scheduledAt ?? 0).getTime() >= Date.now()).slice(0, 6).map((item) => (
            <PlannerTaskRow
              key={`upcoming-${item.id}`}
              item={item}
              theme={theme}
              onEdit={() => { setEditing(item); setEditorOpen(true); }}
              onDelete={() => Alert.alert('Delete this task?', `${item.title} and its reminder will be removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteItem(item) }])}
            />
          ))}
        </View>
      </> : null}
    </ScrollView>
    <PlannerEditor visible={editorOpen} theme={theme} focusSubjects={focusSubjects} item={editing} initialDate={selectedDay} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={saveItem} onDelete={editing ? () => void deleteItem(editing) : undefined} />
  </>;
}

function PlannerTaskRow({ item, theme, onEdit, onDelete }: { item: PlannerItem; theme: AppTheme; onEdit: () => void; onDelete: () => void }) {
  const color = item.type === 'Exam' ? theme.danger : item.type === 'Revision' ? theme.brand : theme.success;
  const scheduled = new Date(item.scheduledAt ?? 0);
  const past = scheduled.getTime() < Date.now();
  return (
    <Pressable
      onPress={onEdit}
      android_ripple={{ color: `${theme.brand}18` }}
      style={({ pressed }) => [styles.plannerRow, { backgroundColor: theme.surfaceContainer, opacity: past ? 0.6 : pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.planStripe, { backgroundColor: color }]} />
      <View style={styles.planTime}>
        <Text style={[styles.planClock, { color: theme.text }]}>{formatPlannerTime(scheduled)}</Text>
        <Text style={[styles.planDate, { color: theme.textSubtle }]}>{scheduled.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.planTitle, { color: theme.text }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.planMeta, { color: theme.textMuted }]}>{item.subject} · {item.type}{past ? ' · Done' : ''}</Text>
      </View>
      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.title}`}
        onPress={(event) => { event.stopPropagation(); onDelete(); }}
        android_ripple={{ color: `${theme.danger}25`, borderless: true, radius: 19 }}
        style={styles.planDelete}
      >
        <Ionicons name="trash-outline" color={theme.textMuted} size={18} />
      </Pressable>
    </Pressable>
  );
}

function PlannerEditor({ visible, theme, focusSubjects, item, initialDate, onClose, onSave, onDelete }: { visible: boolean; theme: AppTheme; focusSubjects: string[]; item: PlannerItem | null; initialDate?: Date; onClose: () => void; onSave: (item: PlannerItem) => Promise<void>; onDelete?: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlannerItem['type']>('Study session');
  const [subjectChoice, setSubjectChoice] = useState('Other');
  const [customSubject, setCustomSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    // Editing keeps its own time; a new task lands on the day the user tapped,
    // an hour from now if that day is today, otherwise at a sensible 4pm.
    let nextDate: Date;
    if (item?.scheduledAt) {
      nextDate = new Date(item.scheduledAt);
    } else if (initialDate && !isSameDay(initialDate, new Date())) {
      nextDate = new Date(initialDate);
      nextDate.setHours(16, 0, 0, 0);
    } else {
      nextDate = new Date(Date.now() + 60 * 60 * 1000);
    }
    nextDate.setSeconds(0, 0);
    setTitle(item?.title ?? '');
    setType(item?.type ?? 'Study session');
    const knownSubject = Boolean(item?.subject && focusSubjects.includes(item.subject));
    setSubjectChoice(knownSubject ? item!.subject : (focusSubjects[0] ?? 'Other'));
    setCustomSubject(knownSubject ? '' : (item?.subject ?? ''));
    setScheduledAt(nextDate);
    setPicker(null);
    setError('');
  }, [visible, item, focusSubjects, initialDate]);

  const changeDateTime = (_event: DateTimePickerEvent, value?: Date) => {
    const selectedPicker = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (!value || !selectedPicker) return;
    const next = new Date(scheduledAt);
    if (selectedPicker === 'date') next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
    else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    setScheduledAt(next);
  };
  const save = async () => {
    const subject = subjectChoice === 'Other' ? customSubject.trim() : subjectChoice;
    if (!title.trim()) return setError('Add a clear task title.');
    if (!subject) return setError('Choose a subject or enter another subject.');
    if (scheduledAt.getTime() <= Date.now()) return setError('Choose a date and time in the future.');
    setBusy(true); setError('');
    try {
      await onSave({ id: item?.id ?? `plan-${Date.now()}`, title: title.trim(), subject, type, scheduledAt: scheduledAt.toISOString(), date: formatPlannerDate(scheduledAt), time: formatPlannerTime(scheduledAt), notes: item?.notes });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mentra could not schedule this reminder.');
    } finally { setBusy(false); }
  };
  const subjects = [...new Set([...focusSubjects, 'Other'])];

  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><ScrollView contentContainerStyle={styles.plannerEditorContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Text style={[styles.sheetTitle, { color: theme.text }]}>{item ? 'Edit study task' : 'Plan a study task'}</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Choose exactly when Mentra should remind you on this device.</Text><Text style={[styles.plannerFieldLabel, { color: theme.text }]}>Task title</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Revise algebra chapter 3" placeholderTextColor={theme.textMuted} style={[styles.plannerInput, { backgroundColor: theme.surfaceMuted, borderColor: theme.line, color: theme.text }]} /><Text style={[styles.plannerFieldLabel, { color: theme.text }]}>Type</Text><View style={styles.plannerChoiceWrap}>{(['Study session', 'Revision', 'Exam'] as PlannerItem['type'][]).map((value) => <Pressable key={value} onPress={() => setType(value)} style={[styles.plannerChoice, { backgroundColor: type === value ? theme.brandSoft : theme.surfaceMuted, borderColor: type === value ? theme.brand : theme.line }]}><Text style={[styles.plannerChoiceText, { color: type === value ? theme.brand : theme.text }]}>{value}</Text></Pressable>)}</View><Text style={[styles.plannerFieldLabel, { color: theme.text }]}>Subject</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plannerChoiceWrap}>{subjects.map((value) => <Pressable key={value} onPress={() => setSubjectChoice(value)} style={[styles.plannerChoice, { backgroundColor: subjectChoice === value ? theme.brandSoft : theme.surfaceMuted, borderColor: subjectChoice === value ? theme.brand : theme.line }]}><Text style={[styles.plannerChoiceText, { color: subjectChoice === value ? theme.brand : theme.text }]}>{value}</Text></Pressable>)}</ScrollView>{subjectChoice === 'Other' ? <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="Enter another subject" placeholderTextColor={theme.textMuted} style={[styles.plannerInput, { backgroundColor: theme.surfaceMuted, borderColor: theme.line, color: theme.text }]} /> : null}<Text style={[styles.plannerFieldLabel, { color: theme.text }]}>Reminder date and time</Text><View style={styles.plannerDateTimeRow}><Pressable onPress={() => setPicker('date')} style={[styles.plannerDateTimeButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Ionicons name="calendar-outline" color={theme.brand} size={20} /><View><Text style={[styles.plannerDateTimeCaption, { color: theme.textMuted }]}>DATE</Text><Text style={[styles.plannerDateTimeValue, { color: theme.text }]}>{scheduledAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View></Pressable><Pressable onPress={() => setPicker('time')} style={[styles.plannerDateTimeButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Ionicons name="time-outline" color={theme.brand} size={20} /><View><Text style={[styles.plannerDateTimeCaption, { color: theme.textMuted }]}>TIME</Text><Text style={[styles.plannerDateTimeValue, { color: theme.text }]}>{formatPlannerTime(scheduledAt)}</Text></View></Pressable></View>{picker ? <View style={[styles.plannerPickerWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><DateTimePicker value={scheduledAt} mode={picker} display={Platform.OS === 'ios' ? 'spinner' : 'default'} minimumDate={picker === 'date' ? new Date() : undefined} onChange={changeDateTime} themeVariant={theme.mode} /></View> : null}<View style={[styles.plannerNotice, { backgroundColor: theme.brandSoft }]}><Ionicons name="notifications-outline" color={theme.brand} size={20} /><Text style={[styles.plannerNoticeText, { color: theme.text }]}>Saving will request notification access. The alert will arrive at the selected time.</Text></View>{error ? <View style={[styles.authError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.authErrorText, { color: theme.danger }]}>{error}</Text></View> : null}<Pressable disabled={busy} onPress={() => void save()} style={[styles.primaryButton, { backgroundColor: busy ? theme.line : theme.brand }]}>{busy ? <ActivityIndicator color="#FFF" /> : <Ionicons name="notifications" color="#FFF" size={18} />}<Text style={styles.primaryButtonText}>{busy ? 'Scheduling…' : item ? 'Save changes' : 'Create reminder'}</Text></Pressable>{onDelete ? <Pressable onPress={onDelete} style={[styles.plannerDeleteButton, { borderColor: theme.danger }]}><Ionicons name="trash-outline" color={theme.danger} size={18} /><Text style={[styles.plannerDeleteText, { color: theme.danger }]}>Delete task</Text></Pressable> : null}</ScrollView></BottomSheet>;
}

function ProfileScreen({
  theme,
  userName,
  focusSubjects,
  subjectDescriptions,
  onChangeName,
  onChangeSubjects,
  onChangeSubjectDescriptions,
  onBack,
}: {
  theme: AppTheme;
  userName: string;
  focusSubjects: string[];
  subjectDescriptions: Record<string, string>;
  onChangeName: (value: string) => void;
  onChangeSubjects: (subjects: string[]) => void;
  onChangeSubjectDescriptions: (value: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [fullName, setFullName] = useState(userName || 'Student');
  const [school, setSchool] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [subjects, setSubjects] = useState<string[]>(focusSubjects);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(subjectDescriptions);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customSubjectDescription, setCustomSubjectDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const availableSubjects = subjectCatalog;

  useEffect(() => setFullName(userName || 'Student'), [userName]);
  useEffect(() => setSubjects(focusSubjects), [focusSubjects]);
  useEffect(() => setDescriptions(subjectDescriptions), [subjectDescriptions]);
  const toggleSubject = (subject: string) => {
    setSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
    setSaved(false);
  };

  const saveProfile = async () => {
    const nextName = fullName.trim();
    if (!nextName || saving) return;
    setSaving(true);
    try {
      await auth.updateProfile({ fullName: nextName, school: school.trim(), country: country.trim(), subjects, subjectDescriptions: descriptions });
    } catch {
      // Keep the profile editable before a live account is connected.
    } finally {
      onChangeName(nextName);
      onChangeSubjects(subjects);
      onChangeSubjectDescriptions(descriptions);
      setSaved(true);
      setSaving(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profilePageHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={[styles.profileBack, { backgroundColor: theme.surfaceMuted }]}><Ionicons name="arrow-back" size={19} color={theme.text} /></Pressable>
        <View><Text style={[styles.screenTitle, { color: theme.text }]}>Profile</Text><Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>Your study identity and progress.</Text></View>
      </View>
      <View style={[styles.profileHero, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}> 
        <View style={[styles.avatar, { backgroundColor: theme.brand }]}><Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.profileName, { color: theme.text }]}>{userName}</Text><Text style={[styles.profileDetails, { color: theme.textMuted }]}>Your personal study space</Text></View>
      </View>
      <SectionHeader title="Personal details" theme={theme} />
      <View style={[styles.profileForm, { backgroundColor: theme.surfaceContainer }]}>
        <Text style={[styles.profileFieldLabel, { color: theme.textMuted }]}>Full name</Text>
        <TextInput value={fullName} onChangeText={(value) => { setFullName(value); setSaved(false); }} placeholder="Your name" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: theme.line }]} />
        <Text style={[styles.profileFieldLabel, { color: theme.textMuted }]}>School or institution</Text>
        <TextInput value={school} onChangeText={(value) => { setSchool(value); setSaved(false); }} placeholder="e.g. University of Lagos" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: theme.line }]} />
        <Text style={[styles.profileFieldLabel, { color: theme.textMuted }]}>Country</Text>
        <TextInput value={country} onChangeText={(value) => { setCountry(value); setSaved(false); }} placeholder="Country" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: theme.line }]} />
        {saved ? <Text style={[styles.saveNotice, { color: theme.success }]}>Profile changes saved.</Text> : null}
        <Pressable disabled={!fullName.trim() || saving} onPress={saveProfile} style={[styles.primaryButton, { backgroundColor: !fullName.trim() || saving ? theme.line : theme.brand, marginTop: 6 }]}>{saving ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>Save changes</Text><Ionicons name="checkmark" color="#FFF" size={19} /></>}</Pressable>
      </View>
      <SectionHeader title="Your subjects" action="Add subjects" onAction={() => setShowSubjectPicker((value) => !value)} theme={theme} />
      <View style={[styles.profileForm, { backgroundColor: theme.surfaceContainer }]}>
        {subjects.length ? <View style={styles.subjectFocusRow}>{subjects.map((subject) => <Pressable key={subject} onPress={() => toggleSubject(subject)} style={[styles.subjectFocusChip, { backgroundColor: theme.brandSoft }]}><Text style={[styles.subjectFocusText, { color: theme.brand }]}>{subject}  ×</Text></Pressable>)}</View> : <Text style={[styles.profileEmptySubjects, { color: theme.textMuted }]}>Add the subjects you want Mentra to personalise for.</Text>}
        <Pressable onPress={() => setShowSubjectPicker((value) => !value)} style={[styles.addSubjectsButton, { borderColor: theme.brand, backgroundColor: theme.brandSoft }]}><Ionicons name="add" size={18} color={theme.brand} /><Text style={[styles.addSubjectsText, { color: theme.brand }]}>{showSubjectPicker ? 'Done choosing subjects' : 'Add subjects'}</Text></Pressable>
        {showSubjectPicker ? <><View style={styles.optionGrid}>{availableSubjects.map((subject) => { const selected = subjects.includes(subject); return <Pressable key={subject} onPress={() => toggleSubject(subject)} style={[styles.option, { backgroundColor: selected ? theme.brandSoft : theme.surfaceMuted, borderColor: selected ? theme.brand : theme.line }]}><Text style={[styles.optionText, { color: selected ? theme.brand : theme.text }]}>{subject}</Text>{selected ? <Ionicons name="checkmark-circle" color={theme.brand} size={19} /> : null}</Pressable>; })}</View><View style={styles.customSubjectForm}><Text style={[styles.profileFieldLabel, { color: theme.textMuted }]}>Add a custom subject</Text><TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="e.g. Fashion design" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surfaceMuted }]} /><TextInput value={customSubjectDescription} onChangeText={setCustomSubjectDescription} placeholder="Briefly describe this subject for more relevant AI help" placeholderTextColor={theme.textMuted} multiline style={[styles.profileDescriptionInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surfaceMuted }]} /><Pressable onPress={() => { const name = customSubject.trim(); if (!name) return; setSubjects((current) => Array.from(new Set([...current, name]))); if (customSubjectDescription.trim()) setDescriptions((current) => ({ ...current, [name]: customSubjectDescription.trim() })); setCustomSubject(''); setCustomSubjectDescription(''); setSaved(false); }} style={[styles.secondaryButton, { borderColor: theme.brand, backgroundColor: theme.brandSoft }]}><Ionicons name="add" color={theme.brand} size={18} /><Text style={[styles.secondaryButtonText, { color: theme.brand }]}>Add custom subject</Text></Pressable></View></> : null}
        <Pressable disabled={saving || subjects.length === 0} onPress={saveProfile} style={[styles.primaryButton, { backgroundColor: saving || subjects.length === 0 ? theme.line : theme.brand, marginTop: 6 }]}>{saving ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>Save subjects</Text><Ionicons name="checkmark" color="#FFF" size={19} /></>}</Pressable>
      </View>
      <SectionHeader title="Learning insights" theme={theme} />
      <View style={styles.insightGrid}>
        <StatBox icon="time-outline" value="0h" label="This week" theme={theme} color="#6F62E7" />
        <StatBox icon="ribbon-outline" value="0" label="Achievements" theme={theme} color="#E98157" />
        <StatBox icon="trending-up-outline" value="—" label="Quiz average" theme={theme} color="#16A388" />
      </View>
    </ScrollView>
  );
}

function SettingsScreen({
  theme,
  darkMode,
  followsDevice,
  language,
  onChangeMode,
  onFollowDevice,
  onOpenLanguage,
  onOpenPrivacy,
  onOpenProfile,
  onSignOut,
}: {
  theme: AppTheme;
  darkMode: boolean;
  followsDevice: boolean;
  language: string;
  onChangeMode: (value: boolean) => void;
  onFollowDevice: (value: boolean) => void;
  onOpenLanguage: () => void;
  onOpenPrivacy: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View><Text style={[styles.screenTitle, { color: theme.text }]}>Settings</Text><Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>Make Mentra work the way you learn.</Text></View>
      <SectionHeader title="Preferences" theme={theme} />
      <View style={[styles.settingsCard, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}> 
        <SettingRow icon="phone-portrait-outline" title="Use device setting" subtitle={followsDevice ? 'Following your phone’s appearance' : 'Using your Mentra preference'} theme={theme} right={<Switch value={followsDevice} onValueChange={onFollowDevice} trackColor={{ false: theme.line, true: theme.brand }} />} />
        <SettingRow icon="moon-outline" title="Dark mode" theme={theme} right={<Switch value={darkMode} onValueChange={onChangeMode} trackColor={{ false: theme.line, true: theme.brand }} />} />
        <Pressable onPress={onOpenLanguage}><SettingRow icon="language-outline" title="Language" subtitle={language} theme={theme} right={<Ionicons name="chevron-forward" size={18} color={theme.textMuted} />} /></Pressable>
      </View>
      <SectionHeader title="Account" theme={theme} />
      <View style={[styles.settingsCard, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}> 
        <Pressable onPress={onOpenProfile}><SettingRow icon="person-outline" title="My profile" subtitle="Edit your details and learning identity" theme={theme} right={<Ionicons name="chevron-forward" size={18} color={theme.textMuted} />} /></Pressable>
        <Pressable onPress={onOpenPrivacy}><SettingRow icon="shield-checkmark-outline" title="Privacy & data" subtitle="How Mentra uses your data" theme={theme} right={<Ionicons name="chevron-forward" size={18} color={theme.textMuted} />} /></Pressable>
        <Pressable onPress={onSignOut} style={styles.signOut}><Ionicons name="log-out-outline" color={theme.danger} size={20} /><Text style={[styles.signOutText, { color: theme.danger }]}>Sign out</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function ActionSheet({
  visible,
  theme,
  onClose,
  onUpload,
  onChat,
  onSolver,
  onQuiz,
}: {
  visible: boolean;
  theme: AppTheme;
  onClose: () => void;
  onUpload: () => void;
  onChat: () => void;
  onSolver: () => void;
  onQuiz: () => void;
}) {
  const actions = [
    { icon: 'cloud-upload-outline' as const, label: 'Upload a file', copy: 'Summaries and document-aware answers', color: '#6F62E7', action: onUpload },
    { icon: 'chatbubble-ellipses-outline' as const, label: 'Ask Mentra', copy: 'Get a simple explanation', color: theme.brand, action: onChat },
    { icon: 'scan-outline' as const, label: 'Solve a question', copy: 'Scan a math or science problem', color: '#13A58A', action: onSolver },
    { icon: 'help-circle-outline' as const, label: 'Generate a quiz', copy: 'Test what you have learned', color: '#E98157', action: onQuiz },
  ];
  return <BottomSheet visible={visible} theme={theme} onClose={onClose}><Text style={[styles.sheetTitle, styles.actionSheetTitle, { color: theme.text }]}>What would you like to do?</Text><View style={styles.actionList}>{actions.map((item) => <Pressable key={item.label} onPress={item.action} style={[styles.actionRow, { backgroundColor: theme.surfaceMuted }]}><View style={[styles.actionIcon, { backgroundColor: `${item.color}20` }]}><Ionicons name={item.icon} color={item.color} size={21} /></View><View style={{ flex: 1 }}><Text style={[styles.actionTitle, { color: theme.text }]}>{item.label}</Text><Text style={[styles.actionCopy, { color: theme.textMuted }]}>{item.copy}</Text></View><Ionicons name="chevron-forward" color={theme.textMuted} size={18} /></Pressable>)}</View></BottomSheet>;
}

function UploadSheet({ visible, theme, subjects, onClose, onUploaded }: { visible: boolean; theme: AppTheme; subjects: string[]; onClose: () => void; onUploaded: (file: PickedFile, subject: string, subjectDescription?: string) => Promise<void> }) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] ?? 'General study');
  const [customSubject, setCustomSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const subjectOptions = Array.from(new Set([...(subjects.length ? subjects : ['General study']), 'Other subject']));
  const materialSubject = selectedSubject === 'Other subject' ? customSubject.trim() : selectedSubject;

  useEffect(() => {
    if (!visible) return;
    setSelectedName(null);
    setSelectedSubject(subjects[0] ?? 'General study');
    setCustomSubject('');
  }, [visible, subjects]);

  const chooseFile = async () => {
    if (!materialSubject) return;
    try {
      setBusy(true);
      const file = await pickStudyFile();
      if (!file) return;
      await onUploaded(file, materialSubject);
      setSelectedName(file.name);
    } catch (caught) {
      Alert.alert('Could not upload file', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <BottomSheet visible={visible} theme={theme} onClose={onClose}>
    <Text style={[styles.sheetTitle, { color: theme.text }]}>Upload study material</Text>
    {selectedName ? <View style={styles.uploadSuccessGroup}>
      <View style={[styles.uploadComplete, { backgroundColor: theme.accentSoft }]}><Ionicons name="checkmark-circle" color={theme.success} size={28} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.actionTitle, { color: theme.text }]}>{selectedName}</Text><Text style={[styles.actionCopy, { color: theme.success }]}>{materialSubject} · ready for Mentra study tools</Text></View></View>
      <Pressable onPress={() => setSelectedName(null)} style={[styles.secondaryButton, { borderColor: theme.brand, backgroundColor: theme.brandSoft }]}><Ionicons name="add" color={theme.brand} size={18} /><Text style={[styles.secondaryButtonText, { color: theme.brand }]}>Add another material</Text></Pressable>
    </View> : <>
      <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Choose a subject first so Mentra can organise the file and keep its answers relevant.</Text>
      <Text style={[styles.uploadSubjectLabel, { color: theme.text }]}>What subject is this material for?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.uploadSubjectRow}>{subjectOptions.map((subject) => <Pressable key={subject} onPress={() => setSelectedSubject(subject)} style={[styles.uploadSubjectChip, { borderColor: selectedSubject === subject ? theme.brand : theme.line, backgroundColor: selectedSubject === subject ? theme.brandSoft : theme.surfaceMuted }]}><Text style={[styles.uploadSubjectText, { color: selectedSubject === subject ? theme.brand : theme.textMuted }]}>{subject}</Text>{selectedSubject === subject ? <Ionicons name="checkmark-circle" color={theme.brand} size={16} /> : null}</Pressable>)}</ScrollView>
      {selectedSubject === 'Other subject' ? <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="e.g. Government" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surfaceMuted }]} /> : null}
      <Pressable disabled={busy || !materialSubject} onPress={() => void chooseFile()} style={[styles.dropZone, { borderColor: theme.brand, backgroundColor: theme.brandSoft, opacity: materialSubject ? 1 : 0.55 }]}>{busy ? <ActivityIndicator color={theme.brand} /> : <><View style={[styles.dropIcon, { backgroundColor: theme.surface }]}><Ionicons name="cloud-upload-outline" color={theme.brand} size={25} /></View><Text style={[styles.dropTitle, { color: theme.text }]}>Choose a study file</Text><Text style={[styles.dropBody, { color: theme.textMuted }]}>Up to 25 MB · videos are not supported</Text></>}</Pressable>
      <View style={styles.supportedRow}><Pill theme={theme} color={theme.surfaceMuted} textColor={theme.textMuted}>PDF</Pill><Pill theme={theme} color={theme.surfaceMuted} textColor={theme.textMuted}>Office</Pill><Pill theme={theme} color={theme.surfaceMuted} textColor={theme.textMuted}>Text</Pill><Pill theme={theme} color={theme.surfaceMuted} textColor={theme.textMuted}>Images</Pill></View>
    </>}
  </BottomSheet>;
}

function PracticeCreateSheet({ visible, theme, subjects, onClose, onUploaded, onBuildQuiz, onFlashcards }: { visible: boolean; theme: AppTheme; subjects: string[]; onClose: () => void; onUploaded: (file: PickedFile, subject: string) => Promise<string>; onBuildQuiz: (materialId: string) => void; onFlashcards: (cards: GeneratedFlashcard[], title: string, subject: string) => void }) {
  const [subject, setSubject] = useState(subjects[0] ?? 'General study');
  const [customSubject, setCustomSubject] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectOptions = Array.from(new Set([...(subjects.length ? subjects : ['General study']), 'Other subject']));
  const materialSubject = subject === 'Other subject' ? customSubject.trim() : subject;

  useEffect(() => { if (visible) { setSubject(subjects[0] ?? 'General study'); setCustomSubject(''); setFile(null); setMaterialId(null); setBusy(false); setGenerating(false); setError(null); } }, [visible, subjects]);

  const choose = async () => {
    if (!materialSubject) {
      setError('Enter the subject this material is about before uploading it.');
      return;
    }
    try {
      setBusy(true); setError(null);
      const selected = await pickStudyFile();
      if (!selected) return;
      const id = await onUploaded(selected, materialSubject);
      setFile(selected); setMaterialId(id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Mentra could not upload that file.'); }
    finally { setBusy(false); }
  };

  const createCards = async () => {
    if (!materialId || !file) return;
    try {
      setGenerating(true); setError(null);
      const cards = await ai.generateFlashcards(materialId, 20);
      onFlashcards(cards, file.name.replace(/\.[^.]+$/, ''), materialSubject);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Mentra could not create flashcards.'); }
    finally { setGenerating(false); }
  };

  return <BottomSheet visible={visible} theme={theme} onClose={onClose}>
    <Text style={[styles.sheetTitle, { color: theme.text }]}>Create a practice set</Text>
    <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Upload a study file and choose whether Mentra should create flashcards or a full quiz.</Text>
    <Text style={[styles.uploadSubjectLabel, { color: theme.text }]}>Subject</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.uploadSubjectRow}>
      {subjectOptions.map((item) => <Pressable key={item} onPress={() => !materialId && setSubject(item)} style={[styles.uploadSubjectChip, { borderColor: subject === item ? theme.brand : theme.line, backgroundColor: subject === item ? theme.brandSoft : theme.surfaceMuted }]}><Text style={[styles.uploadSubjectText, { color: subject === item ? theme.brand : theme.textMuted }]}>{item}</Text></Pressable>)}
    </ScrollView>
    {subject === 'Other subject' && !materialId ? <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="Enter another subject" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surfaceMuted }]} /> : null}
    {file ? <View style={[styles.practiceFileCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Ionicons name="document-text-outline" color={theme.brand} size={22} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.practiceFileName, { color: theme.text }]}>{file.name}</Text><Text style={[styles.practiceFileMeta, { color: theme.textMuted }]}>{materialSubject} · ready</Text></View><Ionicons name="checkmark-circle" color={theme.success} size={21} /></View> : <Pressable disabled={busy || !materialSubject} onPress={choose} style={[styles.practiceChooseFile, { backgroundColor: theme.surfaceMuted, borderColor: theme.brand, opacity: materialSubject ? 1 : 0.55 }]}>{busy ? <ActivityIndicator color={theme.brand} /> : <><Ionicons name="cloud-upload-outline" color={theme.brand} size={25} /><Text style={[styles.practiceChooseTitle, { color: theme.text }]}>Choose and upload a study file</Text><Text style={[styles.practiceChooseBody, { color: theme.textMuted }]}>Mentra will use the file to build your practice set.</Text></>}</Pressable>}
    {error ? <View style={[styles.aiError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0', marginTop: 12 }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.aiErrorText, { color: theme.danger }]}>{error}</Text></View> : null}
    {materialId ? <View style={styles.practiceBuildOptions}><Pressable disabled={generating} onPress={createCards} style={[styles.practiceBuildCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><View style={[styles.practiceBuildIcon, { backgroundColor: theme.brandSoft }]}>{generating ? <ActivityIndicator color={theme.brand} /> : <Ionicons name="albums-outline" color={theme.brand} size={23} />}</View><View style={{ flex: 1 }}><Text style={[styles.practiceBuildTitle, { color: theme.text }]}>Create 20 flashcards</Text><Text style={[styles.practiceBuildBody, { color: theme.textMuted }]}>Key terms, questions, and clear answers.</Text></View><Ionicons name="arrow-forward" color={theme.brand} size={18} /></Pressable><Pressable disabled={generating} onPress={() => onBuildQuiz(materialId)} style={[styles.practiceBuildCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><View style={[styles.practiceBuildIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name="help-circle-outline" color={theme.brand} size={23} /></View><View style={{ flex: 1 }}><Text style={[styles.practiceBuildTitle, { color: theme.text }]}>Create a 30-question quiz</Text><Text style={[styles.practiceBuildBody, { color: theme.textMuted }]}>Choose difficulty before Mentra generates it.</Text></View><Ionicons name="arrow-forward" color={theme.brand} size={18} /></Pressable></View> : null}
  </BottomSheet>;
}

function FlashcardSheet({ visible, theme, cards, onClose }: { visible: boolean; theme: AppTheme; cards: GeneratedFlashcard[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { if (visible) { setIndex(0); setRevealed(false); } }, [visible]);
  const card = cards[index];
  if (!card) return <BottomSheet visible={visible} theme={theme} onClose={onClose}><EmptyState icon="albums-outline" title="No flashcards yet" description="Create a flashcard set from a study file first." theme={theme} /></BottomSheet>;
  const next = () => { setIndex((current) => (current + 1) % cards.length); setRevealed(false); };
  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><View style={styles.flashcardSheetHeader}><View><Text style={[styles.sheetTitle, { color: theme.text }]}>Flashcards</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>{index + 1} of {cards.length} · {card.subject}</Text></View><Pill theme={theme}>{Math.round(((index + 1) / cards.length) * 100)}%</Pill></View><ProgressBar value={((index + 1) / cards.length) * 100} theme={theme} /><Pressable onPress={() => setRevealed((current) => !current)} style={[styles.generatedFlashcard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><View style={[styles.generatedFlashIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name={revealed ? 'bulb-outline' : 'help-circle-outline'} color={theme.brand} size={24} /></View><Text style={[styles.generatedFlashLabel, { color: theme.brand }]}>{revealed ? 'ANSWER' : 'QUESTION'}</Text><Text style={[styles.generatedFlashText, { color: theme.text }]}>{revealed ? card.back : card.front}</Text><Text style={[styles.generatedFlashHint, { color: theme.textMuted }]}>Tap the card to {revealed ? 'see the question' : 'reveal the answer'}</Text></Pressable><Pressable onPress={next} style={[styles.primaryButton, { backgroundColor: theme.brand, marginTop: 14 }]}><Text style={styles.primaryButtonText}>{index === cards.length - 1 ? 'Review again' : 'Next card'}</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></Pressable></BottomSheet>;
}

/**
 * Renders inline markdown. Anything left over — a stray asterisk, an unmatched
 * backtick — is stripped rather than shown, because a literal `**` on screen
 * reads as a bug to a student.
 */
function InlineMessageText({ value, color, style }: { value: string; color: string; style?: TextProps['style'] }) {
  const parts = value.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<![*\w])\*[^*\n]+\*(?!\*))/g).filter(Boolean);
  return (
    <NativeText style={[styles.messageText, { color }, style]}>
      {parts.map((part, index) => {
        const bold = (part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'));
        const code = part.startsWith('`') && part.endsWith('`') && part.length > 2;
        const italic = !bold && !code && part.startsWith('*') && part.endsWith('*') && part.length > 2;
        const clean = bold || italic || code
          ? part.slice(bold ? 2 : 1, bold ? -2 : -1)
          : part.replace(/\*+/g, '').replace(/`/g, '').replace(/__/g, '');
        return (
          <NativeText key={`${part}-${index}`} style={bold ? styles.messageBold : italic ? styles.messageItalic : code ? styles.messageCode : undefined}>
            {clean}
          </NativeText>
        );
      })}
    </NativeText>
  );
}

function RichMessageText({ value, theme }: { value: string; theme: AppTheme }) {
  const blocks = parseMessageBlocks(value);
  return (
    <View style={styles.richMessage}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'space':
            return <View key={`space-${index}`} style={styles.messageSpacer} />;
          case 'rule':
            return <View key={`rule-${index}`} style={[styles.messageRule, { backgroundColor: theme.line }]} />;
          case 'heading':
            return (
              <InlineMessageText
                key={`heading-${index}`}
                value={block.text}
                color={theme.text}
                style={block.level <= 2 ? styles.messageHeading : styles.messageSubheading}
              />
            );
          case 'bullet':
            return (
              <View key={`bullet-${index}`} style={[styles.messageListRow, { paddingLeft: block.depth * 14 }]}>
                <View style={[styles.messageBullet, { backgroundColor: block.depth ? theme.textSubtle : theme.brand }]} />
                <InlineMessageText value={block.text} color={theme.text} style={styles.messageListText} />
              </View>
            );
          case 'ordered':
            return (
              <View key={`ordered-${index}`} style={styles.messageListRow}>
                <NativeText style={[styles.messageNumber, { color: theme.brand }]}>{block.marker}.</NativeText>
                <InlineMessageText value={block.text} color={theme.text} style={styles.messageListText} />
              </View>
            );
          case 'table':
            return (
              <View key={`table-${index}`} style={[styles.messageTable, { borderColor: theme.line }]}>
                {block.rows.map((row, rowIndex) => (
                  <View
                    key={`row-${rowIndex}`}
                    style={[
                      styles.messageTableRow,
                      { borderTopColor: theme.line, borderTopWidth: rowIndex === 0 ? 0 : StyleSheet.hairlineWidth },
                      rowIndex === 0 ? { backgroundColor: theme.surfaceHigh } : null,
                    ]}
                  >
                    {row.map((cell, cellIndex) => (
                      <View key={`cell-${cellIndex}`} style={styles.messageTableCell}>
                        <InlineMessageText
                          value={cell}
                          color={rowIndex === 0 ? theme.text : theme.textMuted}
                          style={rowIndex === 0 ? styles.messageTableHead : styles.messageTableText}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          default:
            return <InlineMessageText key={`line-${index}`} value={block.text} color={theme.text} />;
        }
      })}
    </View>
  );
}

type ChatAttachment = { id: string; name: string; kind: StudyMaterial['kind']; subject: string };

function ChatSheet({ visible, theme, focusSubjects, subjectDescriptions, language, materialIds, onAttach, onClose }: { visible: boolean; theme: AppTheme; focusSubjects: string[]; subjectDescriptions: Record<string, string>; language: string; materialIds: string[]; onAttach: (file: PickedFile, subject: string, subjectDescription?: string) => Promise<string>; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'intro', role: 'assistant', text: 'Hi! I’m Mentra. Ask about your study materials or any academic topic — I’ll explain it clearly.' }]);

  useEffect(() => { if (!visible) setAttachments([]); }, [visible]);

  const attachFile = async () => {
    if (attaching) return;
    try {
      setAttaching(true);
      setErrorMessage(null);
      const file = await pickChatAttachment();
      if (!file) return;
      const subject = focusSubjects[0] ?? 'General study';
      const id = await onAttach(file, subject, subjectDescriptions[subject]);
      const attachment = { id, name: file.name, kind: materialKindForFile(file), subject };
      setAttachments((current) => [...current.filter((item) => item.id !== id), attachment]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Mentra could not attach that file.');
    } finally {
      setAttaching(false);
    }
  };

  const ask = async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!question || sending) return;
    const attachedMaterialIds = attachments.map((item) => item.id);
    const groundedMaterialIds = [...new Set([...attachedMaterialIds, ...materialIds])];
    setErrorMessage(null);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: question }]);
    setInput('');
    setSending(true);
    try {
      const answer: AiAnswer = await ai.ask(question, groundedMaterialIds, { subjects: focusSubjects, subjectDescriptions, language });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: answer.answer, citations: answer.citations }]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Mentra AI could not answer right now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><View style={styles.chatHeader}><View><Text style={[styles.sheetTitle, { color: theme.text }]}>Ask Mentra</Text><View style={styles.onlineRow}><View style={[styles.onlineDot, { backgroundColor: theme.success }]} /><Text style={[styles.onlineText, { color: theme.textMuted }]}>Ready to help</Text></View></View><Pill theme={theme} color={theme.brandSoft}>AI tutor</Pill></View><ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatMessages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>{messages.map((message) => <View key={message.id} style={[styles.message, { borderColor: message.role === 'user' ? theme.brandDark : theme.line }, message.role === 'user' ? [styles.userMessage, { backgroundColor: theme.brand }] : [styles.aiMessage, { backgroundColor: theme.surfaceMuted }]]}>{message.role === 'user' ? <Text style={[styles.messageText, { color: '#FFF' }]}>{message.text}</Text> : <RichMessageText value={message.text} theme={theme} />}{message.citations?.length ? <View style={[styles.citationList, { borderTopColor: theme.line }]}>{message.citations.slice(0, 3).map((citation) => <View key={citation} style={[styles.citation, { backgroundColor: theme.surface }]}><Ionicons name="document-text-outline" color={theme.brand} size={13} /><Text numberOfLines={1} style={[styles.citationText, { color: theme.brand }]}>{citation}</Text></View>)}</View> : null}</View>)}{sending ? <View style={[styles.typing, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><ActivityIndicator size="small" color={theme.brand} /><Text style={[styles.typingText, { color: theme.textMuted }]}>Mentra is thinking…</Text></View> : null}{errorMessage ? <View style={[styles.aiError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.aiErrorText, { color: theme.danger }]}>{errorMessage}</Text></View> : null}</ScrollView><View style={styles.chatComposer}>{attachments.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.attachmentRow}>{attachments.map((attachment) => <View key={attachment.id} style={[styles.attachmentChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Ionicons name={attachment.kind === 'PDF' ? 'document-text-outline' : attachment.kind === 'Image' ? 'image-outline' : 'document-outline'} color={theme.brand} size={16} /><View style={styles.attachmentCopy}><Text numberOfLines={1} style={[styles.attachmentName, { color: theme.text }]}>{attachment.name}</Text><Text style={[styles.attachmentStatus, { color: theme.textMuted }]}>{attachment.kind === 'PDF' ? 'AI ready' : 'Saved to library'}</Text></View><Pressable hitSlop={8} onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><Ionicons name="close-circle" color={theme.textMuted} size={17} /></Pressable></View>)}</ScrollView> : null}<View style={[styles.chatInput, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Pressable accessibilityRole="button" accessibilityLabel="Attach a study file" disabled={attaching} onPress={attachFile} style={[styles.attachButton, { backgroundColor: theme.surface, borderColor: theme.line }]}>{attaching ? <ActivityIndicator size="small" color={theme.brand} /> : <Ionicons name="attach" size={19} color={theme.brand} />}</Pressable><TextInput value={input} onChangeText={setInput} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180)} placeholder="Ask any academic question..." placeholderTextColor={theme.textMuted} style={[styles.chatTextInput, { color: theme.text }]} multiline /><Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={!input.trim() || sending} onPress={() => ask()} style={[styles.sendButton, { backgroundColor: input.trim() && !sending ? theme.brand : theme.line }]}><Ionicons name="arrow-up" size={18} color="#FFF" /></Pressable></View></View></BottomSheet>;
}

function SolverSheet({ visible, theme, learningLevel, onSolved, onClose }: { visible: boolean; theme: AppTheme; learningLevel: string; onSolved: (question: string) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [solution, setSolution] = useState<StudySolution | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (visible) { setQuestion(''); setImage(null); setSolution(null); setBusy(false); setError(null); } }, [visible]);

  const addPhoto = async () => {
    try { const selected = await pickQuestionImage(); if (selected) { setImage(selected); setSolution(null); setError(null); } }
    catch (caught) { Alert.alert('Photo access needed', caught instanceof Error ? caught.message : 'Please try again.'); }
  };

  const solve = async () => {
    if ((!question.trim() && !image) || busy) return;
    try {
      setBusy(true); setError(null); setSolution(null);
      const result = await ai.solve(question.trim(), image ?? undefined, learningLevel || 'student');
      setSolution(result);
      onSolved(question.trim());
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Mentra could not solve this question.'); }
    finally { setBusy(false); }
  };

  const openVideoHelp = () => {
    const query = solution?.videoQuery?.trim() || `${question.trim()} step by step tutorial`;
    void Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  };

  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><ScrollView style={styles.solverScroll} contentContainerStyle={styles.solverContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Text style={[styles.sheetTitle, { color: theme.text }]}>Solve a question</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Type a maths or science problem, or photograph it. Mentra will read it and show the complete working.</Text><View style={[styles.solveInput, { borderColor: theme.line, backgroundColor: theme.surfaceMuted }]}><TextInput value={question} onChangeText={(value) => { setQuestion(value); setSolution(null); }} placeholder="Type the full question here…" placeholderTextColor={theme.textMuted} multiline style={[styles.solveText, { color: theme.text }]} /><Pressable onPress={addPhoto} style={[styles.photoButton, { backgroundColor: theme.surface, borderColor: theme.line }]}><Ionicons name="camera-outline" color={theme.brand} size={20} /></Pressable></View>{image ? <View style={[styles.solverImageCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Image source={{ uri: image.uri }} style={styles.solverImage} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.solverImageName, { color: theme.text }]}>{image.name}</Text><Text style={[styles.solverImageMeta, { color: theme.textMuted }]}>Mentra will read this image with OCR.</Text></View><Pressable hitSlop={8} onPress={() => { setImage(null); setSolution(null); }}><Ionicons name="close-circle" color={theme.textMuted} size={21} /></Pressable></View> : null}{error ? <View style={[styles.aiError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.aiErrorText, { color: theme.danger }]}>{error}</Text></View> : null}<Pressable disabled={busy || (!question.trim() && !image)} onPress={solve} style={[styles.primaryButton, { backgroundColor: question.trim() || image ? theme.brand : theme.line }]}>{busy ? <><ActivityIndicator color="#FFF" /><Text style={styles.primaryButtonText}>Working through it…</Text></> : <><Text style={styles.primaryButtonText}>Solve step by step</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></>}</Pressable>{solution ? <View style={[styles.solution, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><View style={styles.solutionHeader}><View style={[styles.solutionIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name="sparkles-outline" color={theme.brand} size={20} /></View><View style={{ flex: 1 }}><Text style={[styles.solutionLabel, { color: theme.brand }]}>MENTRA SOLUTION</Text><Text style={[styles.solutionHeading, { color: theme.text }]}>Complete working</Text></View></View><RichMessageText value={solution.answer} theme={theme} /><View style={[styles.solutionDivider, { backgroundColor: theme.line }]} />{solution.steps.map((step, index) => <View key={`${step}-${index}`} style={styles.solutionStep}><View style={[styles.solutionStepNumber, { backgroundColor: theme.brand }]}><Text style={styles.solutionStepNumberText}>{index + 1}</Text></View><View style={styles.solutionStepCopy}><RichMessageText value={step} theme={theme} /></View></View>)}<View style={[styles.finalAnswerCard, { backgroundColor: theme.brandSoft, borderColor: theme.brand }]}><Text style={[styles.finalAnswerLabel, { color: theme.brand }]}>FINAL ANSWER</Text><Text style={[styles.solutionAnswer, { color: theme.text }]}>{solution.finalAnswer}</Text></View>{solution.check ? <View style={[styles.solutionCheck, { borderColor: theme.line }]}><Ionicons name="checkmark-circle-outline" color={theme.success} size={20} /><View style={{ flex: 1 }}><Text style={[styles.solutionCheckTitle, { color: theme.text }]}>Quick check</Text><Text style={[styles.solutionCheckText, { color: theme.textMuted }]}>{solution.check}</Text></View></View> : null}{solution.tips?.length ? <View style={styles.solutionTips}><Text style={[styles.solutionTipsTitle, { color: theme.text }]}>Remember</Text>{solution.tips.map((tip) => <View key={tip} style={styles.solutionTipRow}><Ionicons name="bulb-outline" color={theme.warning} size={17} /><Text style={[styles.solutionTipText, { color: theme.textMuted }]}>{tip}</Text></View>)}</View> : null}<Pressable onPress={openVideoHelp} style={[styles.videoHelpButton, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}><View style={styles.youtubeIcon}><Ionicons name="logo-youtube" color="#FFF" size={18} /></View><View style={{ flex: 1 }}><Text style={[styles.videoHelpTitle, { color: theme.text }]}>Watch a helpful lesson</Text><Text style={[styles.videoHelpBody, { color: theme.textMuted }]}>Open YouTube results for this exact topic.</Text></View><Ionicons name="open-outline" color={theme.brand} size={18} /></Pressable></View> : null}</ScrollView></BottomSheet>;
}

function ReaderSheet({ visible, material, theme, onClose, onOpenStudyTools }: { visible: boolean; material: StudyMaterial; theme: AppTheme; onClose: () => void; onOpenStudyTools: () => void }) {
  const [readerError, setReaderError] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    if (visible) { setReaderError(null); setPages(null); }
  }, [visible, material.id]);

  return (
    <BottomSheet visible={visible} theme={theme} onClose={onClose} tall>
      <View style={styles.readerSheet}>
        <View style={styles.materialHeader}>
          <View style={[styles.fileIconLarge, { backgroundColor: `${material.color}1C` }]}><Ionicons name="document-text" color={material.color} size={23} /></View>
          <View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.sheetTitle, { color: theme.text }]}>{material.title}</Text><Text style={[styles.actionCopy, { color: theme.textMuted }]}>{material.subject} · {pages ? `${pages} pages` : material.kind} · {material.size}</Text></View>
        </View>
        {material.uri ? <View style={[styles.pdfFrame, { borderColor: theme.line, backgroundColor: theme.surfaceMuted }]}>
          <Pdf source={{ uri: material.uri, cache: false }} style={styles.pdfViewer} enablePaging spacing={8} trustAllCerts={false} onLoadComplete={(count) => setPages(count)} onError={() => setReaderError('Mentra could not load this PDF. Please upload the file again.')} />
          {readerError ? <View style={[styles.pdfError, { backgroundColor: theme.surface }]}><Ionicons name="alert-circle-outline" color={theme.danger} size={20} /><Text style={[styles.pdfErrorText, { color: theme.text }]}>{readerError}</Text></View> : null}
        </View> : <View style={[styles.readerInfo, { backgroundColor: theme.surfaceMuted }]}><Ionicons name="alert-circle-outline" color={theme.warning} size={25} /><Text style={[styles.readerCopy, { color: theme.textMuted, flex: 1 }]}>This older library item has no file attached on this device. Upload it again to read it in Mentra.</Text></View>}
        <Pressable onPress={onOpenStudyTools} style={[styles.secondaryButton, { borderColor: theme.brand, backgroundColor: theme.brandSoft, marginTop: 11 }]}><Ionicons name="book-outline" color={theme.brand} size={18} /><Text style={[styles.secondaryButtonText, { color: theme.brand }]}>Study with Mentra AI</Text></Pressable>
      </View>
    </BottomSheet>
  );
}

function SummarySheet({ visible, material, theme, onClose, onChat }: { visible: boolean; material: StudyMaterial; theme: AppTheme; onClose: () => void; onChat: () => void }) {
  const [result, setResult] = useState<StudySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const summarize = async () => { setBusy(true); try { setResult(await ai.summarize(material.id)); } catch (error) { Alert.alert('Could not generate summary', error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); } };
  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><View style={styles.materialHeader}><View style={[styles.fileIconLarge, { backgroundColor: theme.brandSoft }]}><Ionicons name="document-text-outline" color={theme.brand} size={23} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.sheetTitle, { color: theme.text }]}>{material.title}</Text><Text style={[styles.actionCopy, { color: theme.textMuted }]}>{material.subject} · {material.kind} · {material.size}</Text></View></View>{result ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.summaryContent}>
    <Pill theme={theme}>AI summary</Pill>
    <View style={styles.summaryBody}><RichMessageText value={result.answer} theme={theme} /></View>
    {result.examNote ? <View style={[styles.examNotes, { backgroundColor: theme.successContainer }]}><Ionicons name="bookmark-outline" color={theme.success} size={20} /><View style={{ flex: 1 }}><Text style={[styles.notesTitle, { color: theme.text }]}>Exam note</Text><Text style={[styles.notesText, { color: theme.textMuted }]}>{result.examNote}</Text></View></View> : null}
    {result.keyPoints.length ? <><Text style={[styles.keyPointsTitle, { color: theme.text }]}>Key points</Text>{result.keyPoints.map((point: string) => <View style={styles.keyPoint} key={point}><Ionicons name="checkmark-circle" size={17} color={theme.success} /><Text style={[styles.keyPointText, { color: theme.text }]}>{point}</Text></View>)}</> : null}
    <Pill theme={theme} color={theme.surfaceHigh} textColor={theme.textMuted}>{result.citations[0] ?? 'Generated from this material'}</Pill>
    <Pressable onPress={onChat} style={[styles.primaryButton, { backgroundColor: theme.brand, marginTop: 18 }]}><Text style={styles.primaryButtonText}>Ask about this material</Text><Ionicons name="chatbubble-ellipses-outline" color="#FFF" size={18} /></Pressable>
  </ScrollView> : <View style={styles.summaryEmpty}><View style={[styles.summaryArt, { backgroundColor: theme.brandSoft }]}><Ionicons name="document-text-outline" size={31} color={theme.brand} /></View><Text style={[styles.summaryEmptyTitle, { color: theme.text }]}>Make this easier to study</Text><Text style={[styles.summaryEmptyText, { color: theme.textMuted }]}>Create a clear summary, key points and exam notes from this material.</Text><Pressable onPress={summarize} style={[styles.primaryButton, { backgroundColor: theme.brand, marginTop: 20 }]}>{busy ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>Generate study summary</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></>}</Pressable></View>}</BottomSheet>;
}

function LanguageSheet({ visible, theme, language, onClose, onSelect }: { visible: boolean; theme: AppTheme; language: string; onClose: () => void; onSelect: (language: string) => void }) {
  return <BottomSheet visible={visible} theme={theme} onClose={onClose}><Text style={[styles.sheetTitle, { color: theme.text }]}>Study language</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Mentra will use your selection for supported interface text and AI answers. More translated screens are being added progressively.</Text><View style={[styles.optionGrid, { marginTop: 18 }]}>{supportedLanguages.map((item) => { const selected = language === item; return <Pressable key={item} onPress={() => onSelect(item)} style={[styles.option, { backgroundColor: selected ? theme.brandSoft : theme.surfaceMuted, borderColor: selected ? theme.brand : theme.line }]}><Text style={[styles.optionText, { color: selected ? theme.brand : theme.text }]}>{item}</Text>{selected ? <Ionicons name="checkmark-circle" color={theme.brand} size={19} /> : null}</Pressable>; })}</View></BottomSheet>;
}

function PrivacySheet({ visible, theme, onClose }: { visible: boolean; theme: AppTheme; onClose: () => void }) {
  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><Text style={[styles.sheetTitle, { color: theme.text }]}>Privacy & data</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>Effective for the Mentra test app · Last reviewed 21 July 2026</Text><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.privacyContent}>{privacySections.map((section) => <View key={section.title} style={[styles.privacySection, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.privacyTitle, { color: theme.text }]}>{section.title}</Text><Text style={[styles.privacyBody, { color: theme.textMuted }]}>{section.body}</Text></View>)}<View style={[styles.privacyReview, { backgroundColor: theme.mode === 'dark' ? '#3A3020' : '#FFF4DE' }]}><Ionicons name="information-circle-outline" size={19} color={theme.warning} /><Text style={[styles.privacyReviewText, { color: theme.text }]}>{privacyReviewNote}</Text></View></ScrollView></BottomSheet>;
}

function QuizSheet({ visible, theme, focusSubjects, learningLevel, materialId, onComplete, onClose }: { visible: boolean; theme: AppTheme; focusSubjects: string[]; learningLevel: string; materialId: string | null; onComplete: (title: string, subject: string, score: number, total: number) => void; onClose: () => void }) {
  const [subject, setSubject] = useState(focusSubjects[0] ?? '');
  const [customSubject, setCustomSubject] = useState('');
  const [difficulty, setDifficulty] = useState('Class level');
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quizSubjectOptions = Array.from(new Set([...focusSubjects, 'Other subject']));
  const effectiveSubject = subject === 'Other subject' ? customSubject.trim() : subject;
  useEffect(() => { if (subject !== 'Other subject' && !focusSubjects.includes(subject)) setSubject(focusSubjects[0] ?? 'Other subject'); }, [focusSubjects, subject]);
  useEffect(() => { if (visible) { setQuiz(null); setIndex(0); setScore(0); setSelected(null); setSubmitted(false); setCustomSubject(''); setError(null); } }, [visible, materialId]);

  const generate = async () => {
    if ((!effectiveSubject && !materialId) || busy) return;
    try {
      setBusy(true);
      setError(null);
      const generated = materialId ? await ai.generateQuiz(materialId, ['mcq'], difficulty, 30) : await ai.generateSubjectQuiz(effectiveSubject, learningLevel || 'student', difficulty, 30);
      if (!generated) throw new Error('Mentra could not generate this quiz.');
      setQuiz(generated);
      setIndex(0);
      setScore(0);
      setSelected(null);
      setSubmitted(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mentra could not generate a quiz right now.');
    } finally {
      setBusy(false);
    }
  };
  const question = quiz?.questions[index];
  const checkAnswer = () => { if (selected !== null) { if (selected === question?.answer) setScore((current) => current + 1); setSubmitted(true); } };
  const next = () => {
    if (!quiz) return;
    if (index === quiz.questions.length - 1) { onComplete(quiz.title, effectiveSubject || 'Uploaded material', score, quiz.questions.length); Alert.alert('Quiz complete', `You scored ${score} out of ${quiz.questions.length}. Your result is saved in Practice history.`); onClose(); return; }
    setIndex((current) => current + 1); setSelected(null); setSubmitted(false);
  };

  if (!quiz || !question) {
    return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><ScrollView contentContainerStyle={styles.quizSetupContent} showsVerticalScrollIndicator={false}><Text style={[styles.sheetTitle, { color: theme.text }]}>Create a 30-question quiz</Text><Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>{materialId ? 'Mentra will build this quiz from your uploaded material.' : 'Choose a subject and a difficulty that matches how you want to practise.'}</Text>{materialId ? <Pill theme={theme} color={theme.brandSoft}>Uploaded material</Pill> : <><Text style={[styles.quizSetupLabel, { color: theme.text }]}>Subject</Text><View style={styles.quizSubjectList}>{quizSubjectOptions.map((item) => <Pressable key={item} onPress={() => setSubject(item)} style={[styles.quizSubjectOption, { borderColor: subject === item ? theme.brand : theme.line, backgroundColor: subject === item ? theme.brandSoft : theme.surfaceMuted }]}><Text style={[styles.optionText, { color: subject === item ? theme.brand : theme.text }]}>{item}</Text>{subject === item ? <Ionicons name="checkmark-circle" color={theme.brand} size={19} /> : null}</Pressable>)}</View>{subject === 'Other subject' ? <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="Enter another subject" placeholderTextColor={theme.textMuted} style={[styles.profileInput, { borderColor: theme.line, color: theme.text, backgroundColor: theme.surfaceMuted }]} /> : null}</>}<Text style={[styles.quizSetupLabel, { color: theme.text }]}>Difficulty</Text><View style={styles.difficultyList}>{['Foundation', 'Class level', 'Challenge'].map((item) => { const selectedDifficulty = difficulty === item; const description = item === 'Foundation' ? 'Build confidence with easier questions' : item === 'Challenge' ? 'Stretch beyond your current class level' : `Matched to ${learningLevel || 'your current level'}`; return <Pressable key={item} onPress={() => setDifficulty(item)} style={[styles.difficultyOption, { backgroundColor: selectedDifficulty ? theme.brandSoft : theme.surfaceMuted, borderColor: selectedDifficulty ? theme.brand : theme.line }]}><View style={[styles.difficultyIcon, { backgroundColor: selectedDifficulty ? theme.brand : theme.surface }]}><Ionicons name={item === 'Foundation' ? 'leaf-outline' : item === 'Challenge' ? 'trophy-outline' : 'school-outline'} color={selectedDifficulty ? '#FFF' : theme.brand} size={18} /></View><View style={{ flex: 1 }}><Text style={[styles.difficultyTitle, { color: theme.text }]}>{item}</Text><Text style={[styles.difficultyBody, { color: theme.textMuted }]}>{description}</Text></View>{selectedDifficulty ? <Ionicons name="checkmark-circle" color={theme.brand} size={20} /> : null}</Pressable>; })}</View><View style={[styles.quizCountCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Ionicons name="list-outline" color={theme.brand} size={21} /><View style={{ flex: 1 }}><Text style={[styles.quizCountTitle, { color: theme.text }]}>30 questions</Text><Text style={[styles.quizCountBody, { color: theme.textMuted }]}>A broad mix of concepts with explanations.</Text></View></View>{error ? <View style={[styles.authError, { backgroundColor: theme.mode === 'dark' ? '#3A2024' : '#FFF0F0' }]}><Ionicons name="information-circle-outline" size={17} color={theme.danger} /><Text style={[styles.authErrorText, { color: theme.danger }]}>{error}</Text></View> : null}<Pressable disabled={(!effectiveSubject && !materialId) || busy} onPress={generate} style={[styles.primaryButton, { backgroundColor: (effectiveSubject || materialId) && !busy ? theme.brand : theme.line }]}>{busy ? <><ActivityIndicator color="#FFF" /><Text style={styles.primaryButtonText}>Creating 30 questions…</Text></> : <><Text style={styles.primaryButtonText}>Generate quiz</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></>}</Pressable></ScrollView></BottomSheet>;
  }

  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><View style={styles.quizContent}><View style={styles.quizHeader}><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.sheetTitle, { color: theme.text }]}>{quiz.title}</Text><Text style={[styles.actionCopy, { color: theme.textMuted }]}>Question {index + 1} of {quiz.questions.length} · {difficulty} · Score {score}</Text></View><Pill theme={theme}>{Math.round(((index + 1) / quiz.questions.length) * 100)}%</Pill></View><ProgressBar value={((index + 1) / quiz.questions.length) * 100} theme={theme} /><ScrollView style={styles.quizScroll} showsVerticalScrollIndicator={false}><Text style={[styles.questionText, { color: theme.text }]}>{question.prompt}</Text><View style={styles.choiceList}>{question.choices.map((choice, choiceIndex) => { const isSelected = selected === choiceIndex; const correct = choiceIndex === question.answer; const colour = submitted && correct ? theme.success : submitted && isSelected ? theme.danger : isSelected ? theme.brand : theme.line; const bg = submitted && correct ? theme.accentSoft : submitted && isSelected ? (theme.mode === 'dark' ? '#3A2024' : '#FFE9EA') : isSelected ? theme.brandSoft : theme.surface; return <Pressable key={choice} disabled={submitted} onPress={() => setSelected(choiceIndex)} style={[styles.choice, { borderColor: colour, backgroundColor: bg }]}><View style={[styles.choiceLetter, { backgroundColor: isSelected || (submitted && correct) ? colour : theme.surfaceMuted }]}><Text style={[styles.choiceLetterText, { color: isSelected || (submitted && correct) ? '#FFF' : theme.textMuted }]}>{String.fromCharCode(65 + choiceIndex)}</Text></View><Text style={[styles.choiceText, { color: theme.text }]}>{choice}</Text>{submitted && correct ? <Ionicons name="checkmark-circle" color={theme.success} size={20} /> : null}</Pressable>; })}</View>{submitted ? <View style={[styles.explanation, { backgroundColor: theme.surfaceMuted, borderColor: theme.line }]}><Text style={[styles.explanationTitle, { color: theme.success }]}>Explanation</Text><Text style={[styles.explanationText, { color: theme.text }]}>{question.explanation}</Text></View> : null}</ScrollView><Pressable onPress={submitted ? next : checkAnswer} disabled={selected === null && !submitted} style={[styles.primaryButton, { backgroundColor: selected === null && !submitted ? theme.line : theme.brand, marginTop: 12 }]}><Text style={styles.primaryButtonText}>{submitted ? (index === quiz.questions.length - 1 ? 'Finish quiz' : 'Next question') : 'Check answer'}</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></Pressable></View></BottomSheet>;
}

function LegacyQuizSheet({ visible, theme, onClose }: { visible: boolean; theme: AppTheme; onClose: () => void }) {
  const [index, setIndex] = useState(0); const [selected, setSelected] = useState<number | null>(null); const [submitted, setSubmitted] = useState(false);
  const question = quizQuestions[index]!;
  const submit = () => { if (selected !== null) setSubmitted(true); };
  const next = () => { if (index === quizQuestions.length - 1) { setIndex(0); setSelected(null); setSubmitted(false); Alert.alert('Quiz complete', 'Great work! You scored 2 out of 2.'); } else { setIndex((value) => value + 1); setSelected(null); setSubmitted(false); } };
  return <BottomSheet visible={visible} theme={theme} onClose={onClose} tall><View style={styles.quizHeader}><View><Text style={[styles.sheetTitle, { color: theme.text }]}>Organic chemistry quiz</Text><Text style={[styles.actionCopy, { color: theme.textMuted }]}>Question {index + 1} of {quizQuestions.length}</Text></View><Pill theme={theme}>{(index + 1) * 50}%</Pill></View><ProgressBar value={(index + 1) * 50} theme={theme} /><Text style={[styles.questionText, { color: theme.text }]}>{question.prompt}</Text><View style={styles.choiceList}>{question.choices.map((choice, choiceIndex) => { const isSelected = selected === choiceIndex; const correct = choiceIndex === question.answer; const colour = submitted && correct ? theme.success : submitted && isSelected ? theme.danger : isSelected ? theme.brand : theme.line; const bg = submitted && correct ? theme.accentSoft : submitted && isSelected ? '#FFE9EA' : isSelected ? theme.brandSoft : theme.surface; return <Pressable key={choice} disabled={submitted} onPress={() => setSelected(choiceIndex)} style={[styles.choice, { borderColor: colour, backgroundColor: bg }]}><View style={[styles.choiceLetter, { backgroundColor: isSelected || (submitted && correct) ? colour : theme.surfaceMuted }]}><Text style={[styles.choiceLetterText, { color: isSelected || (submitted && correct) ? '#FFF' : theme.textMuted }]}>{String.fromCharCode(65 + choiceIndex)}</Text></View><Text style={[styles.choiceText, { color: theme.text }]}>{choice}</Text>{submitted && correct ? <Ionicons name="checkmark-circle" color={theme.success} size={20} /> : null}</Pressable>; })}</View>{submitted ? <View style={[styles.explanation, { backgroundColor: theme.accentSoft }]}><Text style={[styles.explanationTitle, { color: theme.success }]}>Why this is right</Text><Text style={[styles.explanationText, { color: theme.text }]}>{question.explanation}</Text></View> : null}<Pressable onPress={submitted ? next : submit} disabled={selected === null} style={[styles.primaryButton, { backgroundColor: selected === null && !submitted ? theme.line : theme.brand, marginTop: 16 }]}><Text style={styles.primaryButtonText}>{submitted ? (index === quizQuestions.length - 1 ? 'Finish quiz' : 'Next question') : 'Check answer'}</Text><Ionicons name="arrow-forward" color="#FFF" size={18} /></Pressable></BottomSheet>;
}

function BottomSheet({ visible, theme, onClose, children, tall = false }: { visible: boolean; theme: AppTheme; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={onClose} />
          <SafeAreaView
            edges={['bottom']}
            style={[
              styles.sheet,
              elevation(4, theme.shadow),
              { backgroundColor: theme.surfaceLow, borderColor: 'transparent', height: tall ? '88%' : undefined, maxHeight: tall ? '92%' : '82%' },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.line }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              android_ripple={{ color: `${theme.text}18`, borderless: true, radius: 20 }}
              style={[styles.closeSheet, { backgroundColor: theme.surfaceHigh }]}
            >
              <Ionicons name="close" color={theme.textMuted} size={19} />
            </Pressable>
            <View style={[styles.sheetContent, tall ? styles.tallSheetContent : null]}>{children}</View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FeatureLine({ icon, text, theme }: { icon: keyof typeof Ionicons.glyphMap; text: string; theme: AppTheme }) { return <View style={styles.featureLine}><View style={[styles.featureIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name={icon} color={theme.brand} size={16} /></View><Text style={[styles.featureText, { color: theme.textMuted }]}>{text}</Text></View>; }
function QuickAction({ icon, label, color, container, theme, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; container: string; theme: AppTheme; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: `${color}22` }}
      style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.surfaceContainer, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: container }]}>
        <Ionicons name={icon} color={color} size={21} />
      </View>
      <Text numberOfLines={2} style={[styles.quickLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}
function StatBox({ icon, value, label, theme, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; theme: AppTheme; color: string }) { return <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer, borderColor: 'transparent' }]}><Ionicons name={icon} color={color} size={19} /><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text></View>; }
function SettingRow({ icon, title, subtitle, right, theme }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right: React.ReactNode; theme: AppTheme }) { return <View style={styles.settingRow}><View style={[styles.settingIcon, { backgroundColor: theme.surfaceMuted }]}><Ionicons name={icon} color={theme.brand} size={19} /></View><View style={{ flex: 1 }}><Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>{subtitle ? <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}</View>{right}</View>; }

const styles = StyleSheet.create({
  practiceAddCard: { minHeight: 88, borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  practiceAddIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  practiceAddTitle: { fontSize: 15, fontWeight: '700' },
  practiceAddBody: { fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 4 },
  practiceHistoryList: { gap: 10 },
  practiceHistoryCard: { minHeight: 78, borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  practiceHistoryIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  practiceHistoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  practiceHistoryType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  practiceHistoryTime: { fontSize: 11, fontWeight: '600' },
  practiceHistoryTitle: { fontSize: 15, fontWeight: '600', marginTop: 3 },
  practiceHistoryDetail: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  practiceFileCard: { minHeight: 64, borderRadius: 15, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  practiceFileName: { fontSize: 14, fontWeight: '600' },
  practiceFileMeta: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  practiceChooseFile: { minHeight: 132, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 16, alignItems: 'center', justifyContent: 'center', padding: 18 },
  practiceChooseTitle: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  practiceChooseBody: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  practiceBuildOptions: { gap: 10, marginTop: 15 },
  practiceBuildCard: { minHeight: 76, borderRadius: 16, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  practiceBuildIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  practiceBuildTitle: { fontSize: 15, fontWeight: '700' },
  practiceBuildBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  flashcardSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  generatedFlashcard: { flex: 1, minHeight: 330, borderRadius: 22, borderWidth: 1, marginTop: 18, padding: 24, alignItems: 'center', justifyContent: 'center' },
  generatedFlashIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  generatedFlashLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  generatedFlashText: { fontSize: 20, lineHeight: 29, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  generatedFlashHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 22 },
  solverScroll: { flex: 1 },
  solverContent: { paddingBottom: 24, gap: 14 },
  solverImageCard: { minHeight: 68, borderRadius: 15, borderWidth: 1, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  solverImage: { width: 50, height: 50, borderRadius: 11 },
  solverImageName: { fontSize: 14, fontWeight: '600' },
  solverImageMeta: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  solutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  solutionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  solutionHeading: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  solutionDivider: { height: 1, marginVertical: 3 },
  solutionStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  solutionStepNumber: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  solutionStepNumberText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  solutionStepCopy: { flex: 1 },
  finalAnswerCard: { borderRadius: 15, borderWidth: 1, padding: 13, marginTop: 2 },
  finalAnswerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  solutionCheck: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  solutionCheckTitle: { fontSize: 14, fontWeight: '700' },
  solutionCheckText: { fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 3 },
  solutionTips: { gap: 8 },
  solutionTipsTitle: { fontSize: 15, fontWeight: '700' },
  solutionTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  solutionTipText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  videoHelpButton: { minHeight: 70, borderRadius: 16, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  youtubeIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FF0033', alignItems: 'center', justifyContent: 'center' },
  videoHelpTitle: { fontSize: 14, fontWeight: '700' },
  videoHelpBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  quizSetupContent: { paddingBottom: 22, gap: 14 },
  quizSetupLabel: { fontSize: 15, fontWeight: '700', marginTop: 3 },
  difficultyList: { gap: 9 },
  difficultyOption: { minHeight: 68, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  difficultyIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  difficultyTitle: { fontSize: 14, fontWeight: '700' },
  difficultyBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  quizCountCard: { minHeight: 62, borderRadius: 15, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quizCountTitle: { fontSize: 14, fontWeight: '700' },
  quizCountBody: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  readerSheet: { flex: 1, marginHorizontal: 16 },
  pdfFrame: { flex: 1, minHeight: 260, overflow: 'hidden', borderRadius: 18, borderWidth: 1 },
  pdfViewer: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  pdfError: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 22 },
  pdfErrorText: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  safeArea: { flex: 1 }, appShell: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, screenContent: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: BOTTOM_NAV_CLEARANCE + 44, gap: 22 }, authFieldHint: { fontSize: 13, fontWeight: '700', marginTop: -3, marginLeft: 3 }, passwordChecklist: { borderRadius: 12, padding: 12, gap: 7, marginTop: 1 }, passwordChecklistTitle: { fontSize: 14, fontWeight: '600', marginBottom: 1 }, passwordCheck: { flexDirection: 'row', alignItems: 'center', gap: 7 }, passwordCheckText: { fontSize: 13, fontWeight: '600' }, authError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 11 }, authErrorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' }, profilePageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, profileBack: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 1 }, profileForm: { borderRadius: 16, padding: 15, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(128,128,128,0.22)' }, profileEmptySubjects: { fontSize: 14, lineHeight: 20, fontWeight: '600' }, addSubjectsButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 }, addSubjectsText: { fontSize: 14, fontWeight: '700' }, profileFieldLabel: { fontSize: 13, fontWeight: '700', marginTop: 3 }, profileInput: { height: 49, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, fontSize: 15, fontWeight: '500' }, customSubjectForm: { gap: 9, marginTop: 16 }, profileDescriptionInput: { minHeight: 82, height: 82, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingTop: 12, fontSize: 15, fontWeight: '500', textAlignVertical: 'top' }, saveNotice: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  
  authScreen: { padding: 22, paddingTop: 18, paddingBottom: 38 }, authBack: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 34 }, authMark: { width: 74, height: 74, borderRadius: 37, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: '#08143B', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 2 }, authLogo: { width: 74, height: 74, transform: [{ translateY: -8 }] }, authTitle: { fontSize: 30, lineHeight: 44, fontWeight: '700', letterSpacing: -0.8, marginTop: 17 }, authBody: { fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: 10, marginBottom: 22 }, authWarning: { borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 15 }, authWarningText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, authForm: { gap: 10 }, authInput: { height: 54, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, fontSize: 15, fontWeight: '600' }, authNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11 }, verifyHelp: { alignItems: 'center', marginTop: 24, gap: 7 }, verifyHelpText: { fontSize: 14, fontWeight: '700' }, verifyResend: { fontSize: 15, fontWeight: '700' }, authDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 21 }, authRule: { height: 1, flex: 1 }, authDividerText: { fontSize: 13, fontWeight: '700' }, authProvider: { minHeight: 54, borderWidth: 1.5, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, authModeButton: { alignSelf: 'center', paddingVertical: 22 }, authModeText: { fontSize: 15, fontWeight: '600' },
  welcome: { flex: 1, justifyContent: 'space-between' }, welcomeBackground: { width: '100%', height: '100%', resizeMode: 'cover' }, welcomeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' }, welcomeTop: { paddingHorizontal: 24, paddingTop: 26, alignItems: 'center' }, logoCrop: { width: 82, height: 82, borderRadius: 41, overflow: 'hidden', marginBottom: 14, backgroundColor: '#FFFFFF' }, logoImage: { width: 82, height: 82 }, welcomePill: { alignSelf: 'center', marginTop: 2 }, heroTitle: { fontSize: 36, lineHeight: 52, fontWeight: '700', letterSpacing: -1.1, marginTop: 17 }, heroBody: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 315 },
  welcomePanel: { padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 13 }, welcomeTitle: { fontSize: 19, fontWeight: '700', marginBottom: 3 }, featureLine: { flexDirection: 'row', alignItems: 'center', gap: 10 }, featureIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, featureText: { fontSize: 15, fontWeight: '500' }, primaryButton: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 }, primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' }, socialText: { ...type.bodyStrong }, 
  onboarding: { flex: 1 }, onboardingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14 }, wordmark: { fontSize: 21, fontWeight: '700', letterSpacing: -0.7 }, stepCount: { fontSize: 14, fontWeight: '700' }, stepper: { flexDirection: 'row', gap: 5, paddingHorizontal: 22, marginTop: 18 }, stepLine: { height: 4, flex: 1, borderRadius: 5 }, onboardingContent: { padding: 22, paddingTop: 37 }, onboardingTitle: { fontSize: 31, lineHeight: 45, fontWeight: '700', letterSpacing: -0.8, marginTop: 17 }, onboardingBody: { fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 25 }, nameInputWrap: { height: 57, borderRadius: 17, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 12 }, nameInput: { flex: 1, fontSize: 15, fontWeight: '600' }, optionGrid: { gap: 10 }, option: { minHeight: 55, borderRadius: 17, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionText: { fontSize: 15, fontWeight: '600' },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, homeAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, homeAvatarText: { ...type.subtitle, fontWeight: '700' }, greeting: { ...type.caption, fontWeight: '400' }, userName: { ...type.headline, marginTop: 2 }, askBanner: { borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, askIcon: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, askCopy: { flex: 1 }, askTitle: { ...type.subtitle }, askBody: { ...type.caption, fontWeight: '400', opacity: 0.82, marginTop: 3 }, goalCard: { padding: spacing.xl, borderRadius: radius.lg }, freshStartBody: { ...type.caption, fontWeight: '400', lineHeight: 20, marginTop: 8 }, subjectFocusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.lg }, subjectFocusChip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }, subjectFocusText: { ...type.caption, fontWeight: '600' }, goalEyebrow: { ...type.label }, goalTitle: { ...type.title, marginTop: 8 }, continueCard: { borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, continueIcon: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, continueCopy: { flex: 1, gap: 5 }, continueTitle: { ...type.bodyStrong }, continueMeta: { ...type.caption, fontWeight: '400' }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, quickAction: { flexBasis: '47%', flexGrow: 1, minHeight: 96, padding: spacing.lg, borderRadius: radius.md, gap: spacing.md, justifyContent: 'center', overflow: 'hidden' }, quickIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, quickLabel: { ...type.caption, fontWeight: '600' }, listGap: { gap: spacing.sm }, nextTaskCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, padding: spacing.md }, nextTaskIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, nextTaskLabel: { ...type.label }, nextTaskTitle: { ...type.bodyStrong, marginTop: 3 }, nextTaskTime: { ...type.bodyStrong },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, screenTitle: { fontSize: 28, lineHeight: 41, fontWeight: '700', letterSpacing: -0.7 }, screenSubtitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: 5 }, uploadCard: { borderStyle: 'dashed', borderWidth: 1.5, borderRadius: 23, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, uploadIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, uploadCopy: { flex: 1 }, uploadTitle: { fontSize: 15, fontWeight: '700' }, uploadBody: { fontSize: 13, fontWeight: '600', marginTop: 4 }, filterRow: { gap: 8 }, filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }, filterText: { fontSize: 14, fontWeight: '600' }, libraryLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -5 }, libraryCount: { fontSize: 15, fontWeight: '700' }, sortText: { fontSize: 13, fontWeight: '700' }, deleteConfirmCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 14 }, deleteConfirmCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, deleteConfirmTitle: { fontSize: 15, fontWeight: '700' }, deleteConfirmBody: { fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 3 }, deleteConfirmActions: { flexDirection: 'row', gap: 9 }, deleteCancelButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, deleteCancelText: { fontSize: 14, fontWeight: '700' }, deleteConfirmButton: { flex: 1, minHeight: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, deleteConfirmButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  practiceOptions: { gap: 11 }, practiceOption: { minHeight: 77, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, practiceOptionCopy: { flex: 1 }, practiceOptionTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' }, practiceOptionBody: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 3, fontWeight: '600' }, flashcard: { minHeight: 255, borderRadius: 26, borderWidth: 1, overflow: 'hidden' }, 
  calendarCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, calendarMonth: { ...type.subtitle }, calendarNav: { flexDirection: 'row', gap: 4 }, calendarWeekRow: { flexDirection: 'row' }, calendarWeekday: { ...type.label, flex: 1, textAlign: 'center' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }, calendarCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 2, gap: 3 }, calendarCellInner: { height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, calendarCellText: { ...type.caption, fontSize: 15 }, calendarDotRow: { flexDirection: 'row', gap: 3, height: 5 }, calendarDot: { width: 5, height: 5, borderRadius: 2.5 }, scheduleList: { gap: 9 }, plannerRow: { minHeight: 74, borderRadius: radius.md, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }, planStripe: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md }, planTime: { width: 62, alignItems: 'flex-start', justifyContent: 'center', gap: 2, paddingLeft: 10 }, planDate: { ...type.label, letterSpacing: 0.2 }, planClock: { ...type.bodyStrong, fontSize: 15 }, planTitle: { ...type.bodyStrong }, planMeta: { ...type.caption, fontWeight: '400', marginTop: 3 }, nextUpCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg }, nextUpIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, nextUpLabel: { ...type.label, opacity: 0.75 }, nextUpTitle: { ...type.subtitle, marginTop: 4 }, nextUpMeta: { ...type.caption, opacity: 0.8, marginTop: 2 }, planDelete: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, plannerEditorContent: { paddingHorizontal: 12, paddingBottom: 28, gap: 12 }, plannerFieldLabel: { fontSize: 14, fontWeight: '700', marginTop: 5 }, plannerInput: { minHeight: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, fontSize: 15, fontWeight: '600' }, plannerChoiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, plannerChoice: { minHeight: 39, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }, plannerChoiceText: { fontSize: 13, fontWeight: '600' }, plannerDateTimeRow: { flexDirection: 'row', gap: 9 }, plannerDateTimeButton: { flex: 1, minHeight: 65, borderRadius: 15, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, plannerDateTimeCaption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7 }, plannerDateTimeValue: { fontSize: 13, fontWeight: '600', marginTop: 3 }, plannerPickerWrap: { borderRadius: 15, borderWidth: 1, overflow: 'hidden', alignItems: 'center' }, plannerNotice: { borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, plannerNoticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, plannerDeleteButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, plannerDeleteText: { fontSize: 14, fontWeight: '700' },
  profileHero: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 }, avatar: { height: 54, width: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFF', fontSize: 23, fontWeight: '700' }, profileName: { fontSize: 19, fontWeight: '700', marginBottom: 3 }, profileDetails: { fontSize: 13, fontWeight: '500', marginBottom: 6 }, insightGrid: { flexDirection: 'row', gap: 9 }, statBox: { flex: 1, minHeight: 103, borderRadius: 14, padding: 12, justifyContent: 'center', gap: 5, borderWidth: 1 }, statValue: { fontSize: 19, fontWeight: '700' }, statLabel: { fontSize: 12, fontWeight: '600' }, settingsCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 }, settingRow: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, settingIcon: { height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, settingTitle: { fontSize: 15, fontWeight: '700' }, settingSubtitle: { fontSize: 12, marginTop: 3, fontWeight: '500' }, signOut: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF1', minHeight: 59, paddingHorizontal: 17, alignItems: 'center', flexDirection: 'row', gap: 11 }, signOutText: { fontSize: 15, fontWeight: '700' },
  fab: { position: 'absolute', right: 20, width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 5 }, shadowRadius: 10, elevation: 5 }, keyboardAvoider: { flex: 1 }, modalWrap: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFillObject }, sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.md }, sheetContent: { marginHorizontal: 8 }, tallSheetContent: { flex: 1, marginHorizontal: 0 }, handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg }, closeSheet: { position: 'absolute', right: spacing.lg, top: spacing.md, height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, sheetTitle: { ...type.title, paddingRight: 44 }, actionSheetTitle: { marginHorizontal: 0 }, sheetSubtitle: { ...type.body, marginTop: spacing.sm }, actionList: { gap: 9, marginTop: 18, marginHorizontal: 0 }, actionRow: { minHeight: 67, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 }, actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, actionTitle: { fontSize: 15, fontWeight: '700' }, actionCopy: { fontSize: 12, fontWeight: '500', marginTop: 3 }, dropZone: { minHeight: 168, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 19 }, dropIcon: { height: 52, width: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, dropTitle: { fontSize: 15, fontWeight: '700' }, dropBody: { fontSize: 13, fontWeight: '500', marginTop: 4 }, supportedRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 13 }, uploadSubjectLabel: { fontSize: 14, fontWeight: '700', marginTop: 19 }, uploadSubjectRow: { gap: 8, paddingTop: 9, paddingBottom: 2 }, uploadSubjectChip: { minHeight: 37, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 }, uploadSubjectText: { fontSize: 13, fontWeight: '700' }, uploadSuccessGroup: { gap: 12 }, uploadComplete: { minHeight: 78, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 18 }, secondaryButton: { minHeight: 47, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryButtonText: { fontSize: 15, fontWeight: '700' },
  quizContent: { flex: 1, marginHorizontal: 16 }, quizScroll: { flex: 1, minHeight: 0 }, quizSubjectList: { gap: 9, marginTop: 18 }, quizSubjectOption: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 16, marginTop: 4, paddingRight: 39 }, onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }, onlineDot: { height: 6, width: 6, borderRadius: 3 }, onlineText: { fontSize: 12, fontWeight: '700' }, chatScroll: { flex: 1, minHeight: 0, marginTop: 15, marginHorizontal: 16 }, chatMessages: { flexGrow: 1, gap: 11, paddingBottom: 10 }, message: { maxWidth: '90%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1 }, userMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 5 }, aiMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 }, richMessage: { gap: 5 }, messageText: { fontSize: 14, lineHeight: 20, fontWeight: '500' }, messageBold: { fontWeight: '700' }, messageHeading: { fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 2 }, messageSpacer: { height: 3 }, messageListRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, messageBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7 }, messageNumber: { width: 18, fontSize: 14, lineHeight: 20, fontWeight: '700' }, messageListText: { flex: 1 }, messageItalic: { fontStyle: 'italic' }, messageCode: { fontFamily: 'monospace', fontSize: 14 }, messageSubheading: { fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 6 }, messageRule: { height: StyleSheet.hairlineWidth, marginVertical: 8 }, messageTable: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden', marginVertical: 6 }, messageTableRow: { flexDirection: 'row' }, messageTableCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 }, messageTableHead: { fontSize: 13, fontWeight: '700' }, messageTableText: { fontSize: 13 }, summaryContent: { paddingBottom: 8 }, summaryBody: { marginTop: 14, marginBottom: 16 }, citationList: { marginTop: 10, borderTopWidth: 1, paddingTop: 8, gap: 6 }, citation: { maxWidth: '100%', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }, citationText: { flexShrink: 1, fontSize: 11, fontWeight: '600' }, typing: { alignSelf: 'flex-start', borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, typingText: { fontSize: 13, fontWeight: '700' }, aiError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 14 }, aiErrorText: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 22 }, chatComposer: { paddingTop: 7, paddingBottom: 2 }, attachmentRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 }, attachmentChip: { maxWidth: 240, minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, attachmentCopy: { flexShrink: 1, minWidth: 100 }, attachmentName: { fontSize: 12, fontWeight: '600' }, attachmentStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 }, chatInput: { minHeight: 52, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 5, marginHorizontal: 16 }, attachButton: { height: 40, width: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, chatTextInput: { flex: 1, maxHeight: 88, fontSize: 15, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 8 }, sendButton: { height: 40, width: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  solveInput: { minHeight: 105, borderRadius: 20, borderWidth: 1, marginTop: 17, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }, solveText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', minHeight: 72 }, photoButton: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, solution: { marginTop: 14, borderRadius: 19, padding: 15, gap: 10 }, solutionLabel: { fontSize: 12, letterSpacing: 0.8, fontWeight: '700' }, solutionAnswer: { fontSize: 15, fontWeight: '700', marginTop: 3 }, materialHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 19 }, fileIconLarge: { width: 47, height: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, readerInfo: { borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, readerCopy: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 4 }, privacyContent: { gap: 10, paddingTop: 17, paddingBottom: 18 }, privacySection: { borderRadius: 17, padding: 14, gap: 6 }, privacyTitle: { fontSize: 15, fontWeight: '700' }, privacyBody: { fontSize: 14, lineHeight: 20, fontWeight: '600' }, privacyReview: { borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, privacyReviewText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, summaryEmpty: { alignItems: 'center', paddingVertical: 24 }, summaryArt: { height: 75, width: 75, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 17 }, summaryEmptyTitle: { fontSize: 19, fontWeight: '700' }, summaryEmptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '600', maxWidth: 300 }, summaryLead: { marginTop: 13, marginBottom: 15, fontSize: 15, lineHeight: 22, fontWeight: '600' }, examNotes: { borderRadius: 17, padding: 13, flexDirection: 'row', gap: 10, marginBottom: 15 }, notesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 }, notesText: { fontSize: 13, lineHeight: 19, fontWeight: '600' }, keyPointsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 9 }, keyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 }, keyPointText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 13 }, questionText: { fontSize: 19, lineHeight: 28, fontWeight: '700', marginTop: 24, letterSpacing: -0.25 }, choiceList: { gap: 9, marginTop: 18 }, choice: { minHeight: 59, borderRadius: 18, borderWidth: 1.2, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, choiceLetter: { height: 28, width: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, choiceLetterText: { fontSize: 13, fontWeight: '700' }, choiceText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' }, explanation: { borderRadius: 17, padding: 13, marginTop: 13 }, explanationTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 }, explanationText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
