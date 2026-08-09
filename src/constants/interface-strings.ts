type LanguageStrings = Record<string, string>;

const french: LanguageStrings = {
  'Welcome to Mentra': 'Bienvenue sur Mentra', 'One more step': 'Encore une etape', 'Continue your learning journey.': 'Continuez votre parcours d apprentissage.', 'Create your Mentra account.': 'Creez votre compte Mentra.', 'Study smarter with an AI tutor that understands your goals.': 'Etudiez mieux avec un tuteur IA qui comprend vos objectifs.',
  'Email address': 'Adresse e-mail', 'Password': 'Mot de passe', 'Full name': 'Nom complet', 'Create a password': 'Creez un mot de passe', 'Sign in with email': 'Se connecter par e-mail', 'Create account': 'Creer un compte', 'or continue with': 'ou continuer avec', 'New here? Create an account': 'Nouveau ? Creez un compte', 'Already have an account? Sign in': 'Vous avez deja un compte ? Connectez-vous', 'Confirm your email': 'Confirmez votre e-mail', 'Send a new link': 'Envoyer un nouveau lien',
  'Your library': 'Votre bibliotheque', 'Everything you need to study, organised.': 'Tout ce dont vous avez besoin pour etudier, organise.', 'Add study material': 'Ajouter un document', 'Upload a PDF to create study tools': 'Ajoutez un PDF pour creer des outils d etude', 'Recently added': 'Ajoute recemment', 'Nothing here yet': 'Rien ici pour le moment', 'Upload a material or choose another subject.': 'Ajoutez un document ou choisissez une autre matiere.', 'Delete': 'Supprimer', 'Cancel': 'Annuler',
  'Practice smarter': 'Exercez-vous mieux', 'Turn your study materials into confidence.': 'Transformez vos documents en confiance.', 'Study planner': 'Planificateur d etude', 'Small, focused steps add up.': 'De petites etapes ciblees font la difference.', 'Your schedule': 'Votre programme',
  'Profile': 'Profil', 'Your study identity and progress.': 'Votre identite et vos progres d etude.', 'Personal details': 'Informations personnelles', 'School or institution': 'Ecole ou etablissement', 'Country': 'Pays', 'Save changes': 'Enregistrer les modifications', 'Your subjects': 'Vos matieres', 'Add subjects': 'Ajouter des matieres', 'Save subjects': 'Enregistrer les matieres', 'Learning insights': 'Apercu des apprentissages',
  'Settings': 'Reglages', 'Make Mentra work the way you learn.': 'Adaptez Mentra a votre facon d apprendre.', 'Preferences': 'Preferences', 'Use device setting': 'Utiliser le reglage de l appareil', 'Dark mode': 'Mode sombre', 'Study reminders': 'Rappels d etude', 'Language': 'Langue', 'Account': 'Compte', 'My profile': 'Mon profil', 'Privacy & data': 'Confidentialite et donnees', 'Sign out': 'Se deconnecter',
  'What would you like to do?': 'Que voulez-vous faire ?', 'Upload PDF': 'Ajouter un PDF', 'Ask Mentra': 'Demander a Mentra', 'Solve a question': 'Resoudre une question', 'Generate a quiz': 'Generer un quiz',
  'Upload a PDF': 'Ajouter un PDF', 'What subject is this material for?': 'Pour quelle matiere est ce document ?', 'Choose a PDF': 'Choisir un PDF', 'PDF documents only for now': 'Documents PDF uniquement pour le moment', 'Add another PDF': 'Ajouter un autre PDF',
  'Ready to help': 'Pret a aider', 'AI tutor': 'Tuteur IA', 'Ask any academic question...': 'Posez une question scolaire...',
  'Type or upload a math or science problem. Mentra will show the working.': 'Saisissez ou ajoutez un exercice de maths ou de sciences. Mentra montrera les etapes.', 'Show step-by-step solution': 'Afficher la solution etape par etape',
  'Study with Mentra AI': 'Etudier avec Mentra IA', 'Make this easier to study': 'Rendez ce document plus simple a etudier', 'Generate study summary': 'Generer un resume d etude', 'Ask about this material': 'Poser une question sur ce document',
  'Study language': 'Langue d etude', 'Create a quiz': 'Creer un quiz', 'Choose one of your subjects and Mentra will make questions at your level.': 'Choisissez une matiere et Mentra creera des questions adaptees a votre niveau.', 'Generate quiz': 'Generer le quiz', 'Check answer': 'Verifier la reponse', 'Next question': 'Question suivante', 'Finish quiz': 'Terminer le quiz', 'Explanation': 'Explication',
};

const catalogues: Record<string, LanguageStrings> = { French: french };

export function translateInterfaceText(language: string, text: string) {
  return catalogues[language]?.[text] ?? text;
}
