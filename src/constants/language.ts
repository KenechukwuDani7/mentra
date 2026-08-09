export type InterfaceCopy = {
  greeting: (hour: number) => string;
  askTitle: string;
  askBody: string;
  studySpace: string;
  learningTitle: string;
  learningBody: string;
  emptyStudyTitle: string;
  emptyStudyBody: string;
  quickActions: string;
  continueStudying: string;
  recentMaterials: string;
  viewLibrary: string;
  noMaterials: string;
  noMaterialsBody: string;
  upload: string;
  flashcards: string;
  takeQuiz: string;
  planStudy: string;
  nav: { Home: string; Library: string; Practice: string; Planner: string; Settings: string };
};

const english: InterfaceCopy = {
  greeting: (hour) => hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,',
  askTitle: 'Ask Mentra anything', askBody: 'Get clear answers from your materials', studySpace: 'YOUR STUDY SPACE',
  learningTitle: 'Your learning is taking shape.', learningBody: 'Your dashboard will grow with every material, quiz, and study session.',
  emptyStudyTitle: 'A clean slate, ready for you.', emptyStudyBody: 'Upload your first study material or ask Mentra a question to begin building progress.',
  quickActions: 'Quick actions', continueStudying: 'Continue studying', recentMaterials: 'Recent materials', viewLibrary: 'View library',
  noMaterials: 'No materials yet', noMaterialsBody: 'Upload your first PDF to start your personal study library.',
  upload: 'Upload', flashcards: 'Flashcards', takeQuiz: 'Take a quiz', planStudy: 'Plan study',
  nav: { Home: 'Home', Library: 'Library', Practice: 'Practice', Planner: 'Planner', Settings: 'Settings' },
};

type CopyOverrides = Omit<Partial<InterfaceCopy>, 'nav'> & { nav?: Partial<InterfaceCopy['nav']> };

function withEnglish(overrides: CopyOverrides): InterfaceCopy {
  return { ...english, ...overrides, nav: { ...english.nav, ...overrides.nav } };
}

const french = withEnglish({
  greeting: (hour) => hour < 12 ? 'Bonjour,' : hour < 18 ? 'Bon apres-midi,' : 'Bonsoir,',
  askTitle: 'Demandez tout a Mentra', askBody: 'Obtenez des reponses claires a partir de vos documents', studySpace: "VOTRE ESPACE D'ETUDE",
  learningTitle: 'Votre apprentissage prend forme.', learningBody: 'Votre tableau de bord grandira avec chaque document, quiz et seance d etude.',
  emptyStudyTitle: 'Une page vierge, prete pour vous.', emptyStudyBody: 'Ajoutez votre premier document ou posez une question a Mentra pour commencer.',
  quickActions: 'Actions rapides', continueStudying: 'Continuer a etudier', recentMaterials: 'Documents recents', viewLibrary: 'Voir la bibliotheque',
  noMaterials: 'Aucun document pour le moment', noMaterialsBody: 'Ajoutez votre premier PDF pour creer votre bibliotheque personnelle.',
  upload: 'Ajouter', flashcards: 'Cartes', takeQuiz: 'Faire un quiz', planStudy: 'Planifier',
  nav: { Home: 'Accueil', Library: 'Bibliotheque', Practice: 'Exercices', Planner: 'Planning', Settings: 'Reglages' },
});

const portuguese = withEnglish({
  greeting: (hour) => hour < 12 ? 'Bom dia,' : hour < 18 ? 'Boa tarde,' : 'Boa noite,',
  askTitle: 'Pergunte qualquer coisa ao Mentra', askBody: 'Obtenha respostas claras dos seus materiais', studySpace: 'O SEU ESPACO DE ESTUDO', learningTitle: 'A sua aprendizagem esta a ganhar forma.', emptyStudyTitle: 'Uma pagina em branco, pronta para si.', quickActions: 'Acoes rapidas', continueStudying: 'Continuar a estudar', recentMaterials: 'Materiais recentes', viewLibrary: 'Ver biblioteca', upload: 'Carregar', flashcards: 'Cartoes', takeQuiz: 'Fazer um quiz', planStudy: 'Planear estudo', nav: { Home: 'Inicio', Library: 'Biblioteca', Practice: 'Praticar', Planner: 'Plano', Settings: 'Definicoes' },
});

const swahili = withEnglish({
  greeting: (hour) => hour < 12 ? 'Habari za asubuhi,' : hour < 18 ? 'Habari za mchana,' : 'Habari za jioni,',
  askTitle: 'Muulize Mentra chochote', askBody: 'Pata majibu wazi kutoka kwenye vifaa vyako', studySpace: 'ENEO LAKO LA MASOMO', learningTitle: 'Masomo yako yanaanza kuchukua sura.', emptyStudyTitle: 'Mwanzo mpya, tayari kwa ajili yako.', quickActions: 'Vitendo vya haraka', continueStudying: 'Endelea kusoma', recentMaterials: 'Vifaa vya karibuni', viewLibrary: 'Tazama maktaba', upload: 'Pakia', flashcards: 'Kadi', takeQuiz: 'Fanya jaribio', planStudy: 'Panga masomo', nav: { Home: 'Mwanzo', Library: 'Maktaba', Practice: 'Mazoezi', Planner: 'Mpango', Settings: 'Mipangilio' },
});

const yoruba = withEnglish({
  greeting: (hour) => hour < 12 ? 'E kaaro,' : hour < 18 ? 'E kaasan,' : 'E kale,',
  askTitle: 'Beere ohunkohun lowo Mentra', askBody: 'Gba idahun ti o ye lati inu awon ohun elo re', studySpace: 'AAAYE EKO RE', learningTitle: 'Eko re n gba irisi.', emptyStudyTitle: 'Ibere tuntun, ti pese fun o.', quickActions: 'Awon ise kiakia', continueStudying: 'Tesiwaju lati ko eko', recentMaterials: 'Awon ohun elo titun', viewLibrary: 'Wo ile-ikawe', upload: 'Fi si inu app', flashcards: 'Kaadi eko', takeQuiz: 'Se idanwo', planStudy: 'Gbero eko', nav: { Home: 'Ile', Library: 'Ile-ikawe', Practice: 'Ise adaṣe', Planner: 'Eto', Settings: 'Eto app' },
});

const hausa = withEnglish({
  greeting: (hour) => hour < 12 ? 'Barka da safiya,' : hour < 18 ? 'Barka da rana,' : 'Barka da yamma,',
  askTitle: 'Tambayi Mentra komai', askBody: 'Samu bayyanannun amsoshi daga kayan karatunka', studySpace: 'WURIN KARATUNKA', learningTitle: 'Karatu naka yana daukar tsari.', emptyStudyTitle: 'Sabon farawa, a shirye domin kai.', quickActions: 'Ayyuka masu sauri', continueStudying: 'Ci gaba da karatu', recentMaterials: 'Sabbin kayan karatu', viewLibrary: 'Duba dakin karatu', upload: 'Dora', flashcards: 'Katunan karatu', takeQuiz: 'Yi tambayoyi', planStudy: 'Tsara karatu', nav: { Home: 'Gida', Library: 'Dakin karatu', Practice: 'Aiki', Planner: 'Tsari', Settings: 'Saituna' },
});

const igbo = withEnglish({
  greeting: (hour) => hour < 12 ? 'Ututu oma,' : hour < 18 ? 'Ehihie oma,' : 'Mgbede oma,',
  askTitle: 'Juo Mentra ihe obula', askBody: 'Nweta aziza doro anya site na ihe omumu gi', studySpace: 'Ebe omumu gi', learningTitle: 'Omumu gi na-enwe oganihu.', emptyStudyTitle: 'Mmalite ohuru, di njikere maka gi.', quickActions: 'Ihe ngwa ngwa', continueStudying: "Gaa n'ihu n'omumu", recentMaterials: 'Ihe omumu nso', viewLibrary: 'Lee ulo akwukwo', upload: 'Bulite', flashcards: 'Kaadi omumu', takeQuiz: 'Mee ule', planStudy: 'Hazie omumu', nav: { Home: 'Ulo', Library: 'Ulo akwukwo', Practice: 'Mmega', Planner: 'Atumatu', Settings: 'Ntọala' },
});

const arabic = withEnglish({
  greeting: (hour) => hour < 12 ? 'صباح الخير،' : 'مساء الخير،',
  askTitle: 'اسأل مينترا أي شيء', askBody: 'احصل على إجابات واضحة من موادك', studySpace: 'مساحة دراستك', learningTitle: 'تعلمك يتشكل.', emptyStudyTitle: 'بداية جديدة جاهزة لك.', quickActions: 'إجراءات سريعة', continueStudying: 'مواصلة الدراسة', recentMaterials: 'المواد الأخيرة', viewLibrary: 'عرض المكتبة', upload: 'رفع', flashcards: 'بطاقات تعليمية', takeQuiz: 'اختبار', planStudy: 'خطة الدراسة', nav: { Home: 'الرئيسية', Library: 'المكتبة', Practice: 'تدريب', Planner: 'الخطة', Settings: 'الإعدادات' },
});

const amharic = withEnglish({
  greeting: (hour) => hour < 12 ? 'እንደምን አደሩ፣' : hour < 18 ? 'እንደምን ዋሉ፣' : 'እንደምን አመሹ፣',
  askTitle: 'ሜንትራን ማንኛውንም ነገር ይጠይቁ', askBody: 'ከትምህርት እቃዎችዎ ግልጽ መልሶችን ያግኙ', studySpace: 'የእርስዎ የትምህርት ቦታ', learningTitle: 'ትምህርትዎ እየተሻሻለ ነው።', emptyStudyTitle: 'አዲስ ጅምር ለእርስዎ ዝግጁ ነው።', quickActions: 'ፈጣን እርምጃዎች', continueStudying: 'ትምህርትን ይቀጥሉ', recentMaterials: 'የቅርብ ጊዜ እቃዎች', viewLibrary: 'ቤተ-መጽሐፍት ይመልከቱ', upload: 'ይጫኑ', flashcards: 'የማስታወሻ ካርዶች', takeQuiz: 'ፈተና ይውሰዱ', planStudy: 'ትምህርት ያቅዱ', nav: { Home: 'መነሻ', Library: 'ቤተ-መጽሐፍት', Practice: 'ልምምድ', Planner: 'እቅድ', Settings: 'ቅንብሮች' },
});

export function getInterfaceCopy(language: string): InterfaceCopy {
  const copies: Record<string, InterfaceCopy> = { English: english, French: french, Portuguese: portuguese, Swahili: swahili, Yoruba: yoruba, Hausa: hausa, Igbo: igbo, Arabic: arabic, Amharic: amharic };
  return copies[language] ?? english;
}
