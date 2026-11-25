// Avatars by category
export const AVATAR_CATEGORIES = {
  '🐴 Animaux': ['🐴','🦄','🐎','🦓','🐏','🐐','🐓','🐷','🐰','🦊','🐻','🐼','🦁','🐯','🐸','🦋','🐝','🐞','🦉','🐧','🐬','🦜','🐱','🐶'],
  '😎 Personnages': ['🤠','🥷','🧙','🧛','🦸','🧜','👸','🤴','🎅','🧝','👻','🤖','👽','🧟','🦹','🧞','🧚','💂','🕵️','👩‍🚀'],
  '🏇 Équestre': ['🏇','🐴','🐎','🦄','🎠','🏅','🥇','🏆','🎪','🤠','🧤','🥾','🐴','🪶','🌾'],
  '⚡ Fun': ['🌟','⚡','🔥','💎','🎪','🎯','🎸','🚀','🎲','🏆','💀','🎃','🌈','❄️','☀️','🌙','🍕','🍩','🎵','👑'],
  '🎃 Créatures': ['🐉','🦖','🦕','🐲','🧌','👹','👺','🤡','💩','☠️','🎭','🪲','🦂','🕷️','🦑','🐙'],
}
export const AVATARS = Object.values(AVATAR_CATEGORIES).flat()

// Choice button colors
export const CHOICE_COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899']
export const CHOICE_SHAPES = ['▲','◆','●','■','★','♦']

// Question types
export const QUESTION_TYPES = {
  qcm:       { label: 'QCM',           icon: '🔘', desc: '1 bonne réponse' },
  multi:     { label: 'Multi-réponses', icon: '☑️', desc: 'Plusieurs bonnes réponses' },
  truefalse: { label: 'Vrai / Faux',   icon: '✅', desc: '2 choix' },
  text:      { label: 'Texte libre',    icon: '✏️', desc: 'Réponse tapée' },
  estimate:  { label: 'Estimation',     icon: '🔢', desc: 'Le plus proche gagne' },
  buzzer:    { label: 'Buzzer',         icon: '🔔', desc: 'Premier qui répond' },
  blindtest: { label: 'Blind Test',     icon: '🎵', desc: 'Devinez le titre / artiste' },
  karaoke:   { label: 'Karaoké',        icon: '🎤', desc: 'Complétez les paroles' },
  geo:       { label: 'Géo',            icon: '🗺️', desc: 'Pointez sur la carte' },
  order:     { label: 'Ordre',          icon: '📊', desc: 'Remettez dans l\'ordre' },
  match:     { label: 'Association',    icon: '🔗', desc: 'Reliez les paires' },
  zoom:      { label: 'Photo mystère',  icon: '🔍', desc: 'Devinez l\'image zoomée' },
}

// Quiz format types (top-level filter)
export const QUIZ_FORMATS = {
  multi:     { label: 'Multi-questions', icon: '📝', desc: 'QCM, Vrai/Faux, texte...' },
  blindtest: { label: 'Blind Test',      icon: '🎵', desc: 'Devinez l\'extrait' },
  buzzer:    { label: 'Buzzer',          icon: '🔔', desc: 'Rapidité' },
  mixed:     { label: 'Mixte',           icon: '🎲', desc: 'Plusieurs types' },
}

// Domain categories (Trivial Pursuit style)
export const DOMAIN_CATEGORIES = {
  '📚 Culture générale': ['Histoire', 'Géographie', 'Politique / société', 'Sciences', 'Inventions'],
  '🎬 Culture pop':      ['Cinéma', 'Séries', 'Musique', 'Jeux vidéo', 'Internet / memes'],
  '🏅 Sport':            ['Sports collectifs', 'Jeux olympiques', 'Athlètes', 'Règles sportives'],
  '🍴 Vie quotidienne':  ['Cuisine', 'Santé', 'Voyages', 'Animaux', 'Nature'],
}

// Category cover images (drop files in /public/images/)
export const CATEGORY_IMAGES = {
  '📚 Culture générale': '/images/cat-culture.jpg',
  '🎬 Culture pop':      '/images/cat-pop.jpg',
  '🏅 Sport':            '/images/cat-sport.jpg',
  '🍴 Vie quotidienne':  '/images/cat-vie.jpg',
}

// Format cover images
export const FORMAT_IMAGES = {
  blindtest: '/images/cat-musique.jpg',
  buzzer:    '/images/cat-buzzer.jpg',
}

// Get best cover image for a quiz based on its categories/format
export function getQuizCoverImage(quiz) {
  // 1. Quiz has explicit coverImage
  if (quiz.coverImage) return quiz.coverImage
  
  // 2. Check format-specific images
  const types = (quiz.questions || []).map(q => q.type)
  const unique = [...new Set(types)]
  if (unique.length === 1 && FORMAT_IMAGES[unique[0]]) return FORMAT_IMAGES[unique[0]]
  
  // 3. Check dominant category → parent group image
  const cats = (quiz.questions || []).map(q => q.category).filter(Boolean)
  if (cats.length > 0) {
    // Count occurrences per parent group
    const groupCounts = {}
    for (const cat of cats) {
      const parent = getDomainParent(cat)
      if (parent) groupCounts[parent] = (groupCounts[parent] || 0) + 1
    }
    // Get most common group
    const sorted = Object.entries(groupCounts).sort(([,a],[,b]) => b - a)
    if (sorted.length > 0 && CATEGORY_IMAGES[sorted[0][0]]) {
      return CATEGORY_IMAGES[sorted[0][0]]
    }
  }
  
  return null // fallback to emoji
}

// Flat list of all domain sub-categories
export const ALL_DOMAINS = Object.values(DOMAIN_CATEGORIES).flat()

// Get parent domain for a sub-category
export function getDomainParent(subCat) {
  for (const [parent, subs] of Object.entries(DOMAIN_CATEGORIES)) {
    if (subs.some(s => s.toLowerCase() === subCat.toLowerCase())) return parent
  }
  return null
}

// Game modes (applied to whole session)
export const GAME_MODES = {
  normal:      { label: 'Normal',       icon: '🎮', desc: 'Mode classique' },
  suddenDeath: { label: 'Mort Subite',  icon: '💀', desc: '1 erreur = éliminé' },
  duel:        { label: 'Duel',         icon: '⚔️', desc: 'Tournoi 1 contre 1' },
  speedRun:    { label: 'Speed Run',    icon: '⏱️', desc: 'Questions enchaînées sans pause' },
}

// Supported media types
export const MEDIA_TYPES = {
  image: { label: 'Image', icon: '🖼️', accept: 'image/jpeg,image/png,image/webp', maxSize: 5 * 1024 * 1024 },
  audio: { label: 'Audio', icon: '🎵', accept: 'audio/mpeg,audio/mp3,audio/wav', maxSize: 20 * 1024 * 1024 },
  video: { label: 'Vidéo', icon: '🎬', accept: 'video/mp4,video/webm', maxSize: 50 * 1024 * 1024 },
}

// Themes
export const THEMES = {
  default: {
    name: 'Classique',
    bg: 'linear-gradient(145deg, #0a0e1a 0%, #0f172a 50%, #1a1035 100%)',
    cardBg: '#111827',
    primary: '#f59e0b',
    accent: '#06b6d4',
  },
  equestre: {
    name: '🐴 Équestre',
    bg: 'linear-gradient(145deg, #1a0f00 0%, #2d1b05 50%, #0f1a00 100%)',
    cardBg: '#1f1508',
    primary: '#d97706',
    accent: '#84cc16',
  },
  ocean: {
    name: '🌊 Océan',
    bg: 'linear-gradient(145deg, #001a2e 0%, #00243d 50%, #001025 100%)',
    cardBg: '#0a1929',
    primary: '#06b6d4',
    accent: '#3b82f6',
  },
  neon: {
    name: '🎆 Néon',
    bg: 'linear-gradient(145deg, #0a001a 0%, #1a002e 50%, #0a0020 100%)',
    cardBg: '#120024',
    primary: '#a855f7',
    accent: '#ec4899',
  },
  nature: {
    name: '🌿 Nature',
    bg: 'linear-gradient(145deg, #001a0a 0%, #002e14 50%, #0a1a00 100%)',
    cardBg: '#0a1f0a',
    primary: '#10b981',
    accent: '#84cc16',
  },
  fire: {
    name: '🔥 Feu',
    bg: 'linear-gradient(145deg, #1a0500 0%, #2e0a00 50%, #1a0000 100%)',
    cardBg: '#1f0a05',
    primary: '#ef4444',
    accent: '#f59e0b',
  },
  christmas: {
    name: '🎄 Noël',
    bg: 'linear-gradient(145deg, #0a1a0a 0%, #1a0a0a 50%, #0a0f1a 100%)',
    cardBg: '#0f1a0f',
    primary: '#ef4444',
    accent: '#22c55e',
  },
  halloween: {
    name: '🎃 Halloween',
    bg: 'linear-gradient(145deg, #1a0f00 0%, #1a0a1a 50%, #0a0a0a 100%)',
    cardBg: '#1a0f05',
    primary: '#f97316',
    accent: '#a855f7',
  },
  fluo: {
    name: '💡 Fluo',
    bg: 'linear-gradient(145deg, #001a1a 0%, #0a001a 50%, #1a1a00 100%)',
    cardBg: '#0a1414',
    primary: '#22d3ee',
    accent: '#a3e635',
  },
  candy: {
    name: '🍬 Bonbon',
    bg: 'linear-gradient(145deg, #1a0020 0%, #200a1a 50%, #0a0020 100%)',
    cardBg: '#1a0a1a',
    primary: '#f472b6',
    accent: '#c084fc',
  },
}

// Team colors for team mode
export const TEAM_COLORS = [
  { id: 'red', name: 'Équipe Rouge', emoji: '🔴', color: '#ef4444', bg: '#ef444420' },
  { id: 'blue', name: 'Équipe Bleue', emoji: '🔵', color: '#3b82f6', bg: '#3b82f620' },
  { id: 'green', name: 'Équipe Verte', emoji: '🟢', color: '#10b981', bg: '#10b98120' },
  { id: 'yellow', name: 'Équipe Jaune', emoji: '🟡', color: '#f59e0b', bg: '#f59e0b20' },
  { id: 'purple', name: 'Équipe Violette', emoji: '🟣', color: '#8b5cf6', bg: '#8b5cf620' },
  { id: 'pink', name: 'Équipe Rose', emoji: '🩷', color: '#ec4899', bg: '#ec489920' },
]

// Get team display name (custom or default)
export function getTeamName(teamId, session) {
  const custom = session?.teamNames?.[teamId]
  if (custom) return custom
  const tc = TEAM_COLORS.find(t => t.id === teamId)
  return tc?.name || teamId
}

// Demo quiz
export const DEMO_QUIZ = {
  quizId: 'demo-equestre-1',
  title: '🐴 Quiz Centre Équestre',
  description: 'Testez vos connaissances équestres !',
  tags: ['équitation', 'chevaux', 'poney'],
  version: 1,
  settings: { defaultTimer: 20 },
  questions: [
    { questionId:'q1', type:'qcm', prompt:'Quelle est l\'allure la plus rapide du cheval ?', choices:['Le pas','Le trot','Le galop','L\'amble'], correctAnswer:2, timerSeconds:15, points:1000, media:null },
    { questionId:'q2', type:'truefalse', prompt:'Un poney mesure moins de 1m48 au garrot.', choices:['Vrai','Faux'], correctAnswer:0, timerSeconds:10, points:1000, media:null },
    { questionId:'q3', type:'qcm', prompt:'Combien de Pony Games en compétition officielle ?', choices:['3','5','8','Plus de 10'], correctAnswer:3, timerSeconds:20, points:1000, media:null },
    { questionId:'q4', type:'multi', prompt:'Équipements obligatoires en Pony Games ?', choices:['Bombe/casque','Gilet de protection','Bottes ou mini-chaps','Éperons'], correctAnswer:[0,2], timerSeconds:20, points:1000, media:null },
    { questionId:'q5', type:'qcm', prompt:'Lieu des Championnats de France de Pony Games ?', choices:['Paris','Lamotte-Beuvron','Saumur','Deauville'], correctAnswer:1, timerSeconds:15, points:1000, media:null },
    { questionId:'q6', type:'truefalse', prompt:'Le Kune Kune est un cochon de Nouvelle-Zélande.', choices:['Vrai','Faux'], correctAnswer:0, timerSeconds:10, points:1000, media:null },
    { questionId:'q7', type:'estimate', prompt:'Combien de races de chevaux existent dans le monde ?', choices:[], correctAnswer:350, timerSeconds:20, points:1000, media:null },
    { questionId:'q8', type:'buzzer', prompt:'Citez un animal de la mini-ferme pédagogique !', choices:[], correctAnswer:'poney chèvre poule cochon âne lapin', timerSeconds:15, points:1000, media:null },
    { questionId:'q9', type:'blindtest', prompt:'Quel est ce morceau ?', choices:['Eye of the Tiger','We Will Rock You','The Final Countdown','Born to be Wild'], correctAnswer:0, timerSeconds:30, points:1500, media:{ type:'audio', url:'', name:'Extrait musical' } },
  ]
}
