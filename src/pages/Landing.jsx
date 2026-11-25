import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Btn } from '../components/UI'
import { useHostAuth } from '../components/HostGate'

const STEPS = [
  { icon: '📝', title: 'Créez', desc: 'Créez votre quiz dans l\'éditeur ou importez un JSON généré par IA. QCM, blind test, estimation, karaoké...' },
  { icon: '📲', title: 'Partagez', desc: 'Lancez une session et partagez le code PIN. Les joueurs se connectent depuis leur smartphone.' },
  { icon: '🏆', title: 'Jouez !', desc: 'Les questions s\'affichent sur l\'écran TV, les joueurs répondent en temps réel. Classement en direct !' },
]

const FAQ = [
  { q: 'Combien de joueurs peuvent participer ?', a: 'Jusqu\'à 50 joueurs simultanément. Chaque joueur utilise son propre smartphone pour répondre.' },
  { q: 'Quel matériel est nécessaire ?', a: 'Un ordinateur ou tablette pour l\'animateur (Host), un écran TV ou vidéoprojecteur pour l\'affichage, et un smartphone par joueur. Tout fonctionne via le navigateur web, aucune application à installer.' },
  { q: 'Est-ce que ça marche sans connexion Internet ?', a: 'L\'application nécessite une connexion Internet (WiFi) pour synchroniser les réponses en temps réel entre tous les appareils via Firebase.' },
  { q: 'Quels types de questions sont disponibles ?', a: '12 types de questions ! QCM (4 choix), Vrai/Faux, Réponse libre (texte), Estimation (le plus proche gagne), Buzzer (premier qui buzze), Blind Test (5 modes : QCM, Buzzer, Estimation, Progressif, Image Pixel), Karaoké (compléter les paroles), Question Géo (pointer sur une carte), Ordre (remettre des éléments dans le bon ordre), Association (relier des paires), Photo Mystère (image zoomée x8 qui dézoome progressivement), et Audio Inversé (son joué à l\'envers, deviner l\'original). Modes spéciaux : Progressif (extrait s\'allonge), Pixel (image se dévoile), Chaîné (réponse précédente = indice).' },
  { q: 'Comment créer un quiz rapidement avec l\'IA ?', a: 'FORMAT_JSON' },
  { q: 'Les scores sont-ils sauvegardés entre les soirées ?', a: 'Oui ! Le système ELO calcule un classement permanent. Les joueurs gagnent ou perdent des points selon leur position et le niveau de leurs adversaires.' },
]

const JSON_FORMAT = `{
  "title": "Mon Quiz",
  "emoji": "🎯",
  "description": "Description du quiz",
  "questions": [
    {
      "type": "qcm",
      "prompt": "Question à choix multiples ?",
      "choices": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correctAnswer": 0,
      "category": "Histoire",
      "timerSeconds": 15,
      "points": 1000
    },
    {
      "type": "truefalse",
      "prompt": "Affirmation vraie ou fausse ?",
      "choices": ["Vrai", "Faux"],
      "correctAnswer": 0,
      "category": "Sciences",
      "timerSeconds": 10,
      "points": 1000
    },
    {
      "type": "estimate",
      "prompt": "En quelle année est né Napoléon ?",
      "correctAnswer": 1769,
      "category": "Histoire",
      "timerSeconds": 15,
      "points": 1000
    },
    {
      "type": "text",
      "prompt": "Capitale de l'Australie ?",
      "correctAnswer": "Canberra, canberra",
      "category": "Géographie",
      "timerSeconds": 15,
      "points": 1000
    },
    {
      "type": "buzzer",
      "prompt": "Première personne sur la Lune ?",
      "correctAnswer": "Neil Armstrong",
      "category": "Histoire",
      "timerSeconds": 30,
      "points": 1000
    },
    {
      "type": "blindtest",
      "blindtestMode": "qcm",
      "prompt": "Quel est ce titre ?",
      "choices": ["Titre A", "Titre B", "Titre C", "Titre D"],
      "correctAnswer": 2,
      "media": { "type": "youtube", "url": "https://youtube.com/watch?v=ID" },
      "category": "Musique",
      "timerSeconds": 30,
      "points": 1000
    },
    {
      "type": "blindtest",
      "blindtestMode": "buzzer",
      "prompt": "Devinez ce titre !",
      "correctAnswer": "Bohemian Rhapsody",
      "media": { "type": "youtube", "url": "https://youtube.com/watch?v=ID" },
      "category": "Musique",
      "timerSeconds": 30,
      "points": 1000
    },
    {
      "type": "blindtest",
      "blindtestMode": "estimate",
      "prompt": "Année de sortie de ce titre ?",
      "correctAnswer": 1985,
      "media": { "type": "youtube", "url": "https://youtube.com/watch?v=ID" },
      "category": "Musique",
      "timerSeconds": 20,
      "points": 1000
    },
    {
      "type": "geo",
      "prompt": "Où se trouve la Tour Eiffel ?",
      "geoTarget": { "lat": 48.8584, "lng": 2.2945 },
      "category": "Géographie",
      "timerSeconds": 15,
      "points": 1000
    },
    {
      "type": "order",
      "prompt": "Classez ces planètes de la plus proche à la plus éloignée du Soleil",
      "orderItems": ["Mercure", "Vénus", "Terre", "Mars"],
      "category": "Sciences",
      "timerSeconds": 20,
      "points": 1000
    },
    {
      "type": "match",
      "prompt": "Associez chaque pays à sa capitale",
      "matchPairs": [
        { "left": "France", "right": "Paris" },
        { "left": "Espagne", "right": "Madrid" },
        { "left": "Italie", "right": "Rome" },
        { "left": "Allemagne", "right": "Berlin" }
      ],
      "category": "Géographie",
      "timerSeconds": 25,
      "points": 1000
    },
    {
      "type": "zoom",
      "prompt": "Quel est cet objet/lieu ?",
      "correctAnswer": "Tour Eiffel paris",
      "media": { "type": "image", "url": "https://example.com/image.jpg" },
      "category": "Culture générale",
      "timerSeconds": 30,
      "points": 1000
    },
    {
      "type": "blindtest",
      "blindtestMode": "reverse",
      "prompt": "Devinez ce titre joué à l'envers !",
      "correctAnswer": "Bohemian Rhapsody",
      "media": { "type": "youtube", "url": "https://youtube.com/watch?v=ID" },
      "category": "Musique",
      "timerSeconds": 30,
      "points": 1000
    }
  ]
}`

const AI_PROMPT = `Génère un quiz JSON pour l'application Quiz Master. Format attendu :
- Objet racine : title, emoji, description
- questions : tableau d'objets. Chaque question a : type, prompt, correctAnswer, category, timerSeconds (défaut 15), points (défaut 1000)

TYPES DISPONIBLES :
- "qcm" : choices[] (2 à 6 textes) + correctAnswer (index de la bonne réponse, commence à 0)
- "truefalse" : choices ["Vrai", "Faux"] + correctAnswer (0 pour Vrai, 1 pour Faux)
- "estimate" : correctAnswer (nombre). Le plus proche gagne le plus de points
- "text" : correctAnswer (string, variantes acceptées séparées par virgule)
- "buzzer" : correctAnswer (mots-clés pour l'animateur). Premier joueur à buzzer répond oralement
- "blindtest" : ajouter blindtestMode ("qcm", "buzzer", "estimate" ou "reverse") + media: { type: "youtube", url: "..." }. Si qcm: choices[] + correctAnswer index. Si buzzer/reverse: correctAnswer string. Si estimate: correctAnswer nombre (année). Mode "reverse" = son joué à l'envers
- "geo" : geoTarget: { lat: number, lng: number }. Les joueurs pointent sur une carte du monde
- "order" : orderItems[] (tableau de strings dans le bon ordre, 2 à 8 éléments). Les joueurs les remettent dans l'ordre
- "match" : matchPairs[] (tableau de { left: string, right: string }, 2 à 6 paires). Les joueurs associent gauche et droite
- "zoom" : correctAnswer (mots-clés) + media: { type: "image", url: "..." }. Image zoomée x8 qui dézoome, les joueurs buzzent

CATÉGORIES : Histoire, Géographie, Politique / société, Sciences, Inventions, Cinéma, Séries, Musique, Jeux vidéo, Internet / memes, Sports collectifs, Jeux olympiques, Athlètes, Cuisine, Santé, Voyages, Animaux, Nature

CONSIGNES :
- Thème du quiz : [VOTRE THÈME ICI]
- Nombre de questions : [NOMBRE]
- Mélange les types pour plus de fun (qcm, truefalse, estimate, text, order, match)
- Réponds UNIQUEMENT avec le JSON, sans commentaire ni markdown.`

const FLOAT_EMOJIS = ['🎯', '🏆', '🎪', '⚡', '🎤', '🔔', '🎲', '✨']

function FAQItem({ item, isOpen, onToggle }) {
  const [copiedJSON, setCopiedJSON] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const copyText = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }

  const isJsonFormat = item.a === 'FORMAT_JSON'

  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={onToggle} className="w-full text-left py-4 px-1 flex justify-between items-center gap-4 group">
        <span className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{item.q}</span>
        <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="text-xl text-slate-500 flex-shrink-0">+</motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {isJsonFormat ? (
              <div className="pb-5 px-1 space-y-4">
                <p className="text-slate-400 text-sm leading-relaxed">
                  Demandez à une IA (ChatGPT, Claude, Gemini) de générer un quiz au format JSON, puis importez-le dans 📦 Import. Voici le format attendu et un prompt prêt à copier.
                </p>

                {/* JSON Format */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase">📋 Format JSON</span>
                    <button onClick={() => copyText(JSON_FORMAT, setCopiedJSON)}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1 text-slate-400 transition-all">
                      {copiedJSON ? '✅ Copié !' : '📋 Copier'}
                    </button>
                  </div>
                  <pre className="bg-black/30 border border-white/5 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto max-h-[300px] overflow-y-auto font-mono leading-relaxed">
                    {JSON_FORMAT}
                  </pre>
                </div>

                {/* Types reference */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="text-xs font-bold text-indigo-400 uppercase mb-2">📝 Types disponibles</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-400"><span className="text-white font-mono">"qcm"</span> — choices[] + correctAnswer (index)</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"truefalse"</span> — choices Vrai/Faux + correctAnswer 0 ou 1</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"estimate"</span> — correctAnswer (nombre)</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"text"</span> — correctAnswer (texte, variantes par virgule)</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"buzzer"</span> — correctAnswer (mots-clés)</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"blindtest"</span> — comme qcm + media{'{}'} + blindtestMode optionnel</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"karaoke"</span> — prompt avec ___ + correctAnswer + media{'{}'}</div>
                    <div className="text-slate-400"><span className="text-white font-mono">"geo"</span> — geoTarget: {'{ lat, lng }'}</div>
                  </div>
                  <div className="mt-3 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                    <div className="text-emerald-400 text-xs font-bold mb-1">💡 Astuce : question image</div>
                    <div className="text-slate-400 text-xs">Tout type de question peut avoir un champ <span className="text-white font-mono">media</span> pour afficher une image. Ex: <span className="text-white font-mono">{'{ "type": "image", "url": "https://..." }'}</span></div>
                  </div>
                </div>

                {/* AI Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-pink-400 uppercase">🤖 Prompt à copier-coller dans l'IA</span>
                    <button onClick={() => copyText(AI_PROMPT, setCopiedPrompt)}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1 text-slate-400 transition-all">
                      {copiedPrompt ? '✅ Copié !' : '📋 Copier'}
                    </button>
                  </div>
                  <pre className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto max-h-[200px] overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
                    {AI_PROMPT}
                  </pre>
                  <p className="text-xs text-slate-500 mt-2">Remplacez [VOTRE THÈME ICI] et [NOMBRE] puis collez dans ChatGPT, Claude ou Gemini.</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm pb-4 px-1 leading-relaxed">{item.a}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Landing({ onNavigate }) {
  const [showContent, setShowContent] = useState(false)
  const [openFAQ, setOpenFAQ] = useState(null)
  const { isHost, logout } = useHostAuth()

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 overflow-x-hidden">

      {/* === HERO SECTION === */}
      <div className="relative min-h-[85vh] flex flex-col items-center justify-center p-6 text-center overflow-hidden">

        {/* Animated mesh gradient background */}
        <div className="absolute inset-0">
          <motion.div
            animate={{
              background: [
                'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(79,70,229,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 70%, rgba(236,72,153,0.1) 0%, transparent 60%)',
                'radial-gradient(ellipse 80% 60% at 60% 70%, rgba(6,182,212,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 30% 30%, rgba(245,158,11,0.1) 0%, transparent 60%)',
                'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(79,70,229,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 70%, rgba(236,72,153,0.1) 0%, transparent 60%)',
              ]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        {/* Floating emojis */}
        {FLOAT_EMOJIS.map((e, i) => (
          <motion.div key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.35, 0],
              y: [0, -120 - Math.random() * 100],
              x: [0, (Math.random() - 0.5) * 60],
            }}
            transition={{ duration: 4 + Math.random() * 3, delay: i * 0.8, repeat: Infinity, repeatDelay: Math.random() * 4 }}
            className="absolute text-2xl pointer-events-none select-none"
            style={{ left: `${8 + i * 12}%`, top: `${55 + Math.random() * 25}%` }}
          >
            {e}
          </motion.div>
        ))}

        {/* Content */}
        <AnimatePresence>
          {showContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 max-w-[600px]">

              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, delay: 0.1 }}
              >
                <img src="/images/logo.png" alt="Quiz Master"
                  className="w-24 h-24 mx-auto mb-3 object-contain drop-shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
                />
                <div className="text-6xl mb-3 hidden">🎪</div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[clamp(2.8rem,9vw,5.5rem)] font-black leading-[0.9] tracking-tight mb-3"
              >
                <span className="bg-gradient-to-r from-indigo-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Quiz Master
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-slate-400 text-lg mb-10 max-w-[420px] mx-auto leading-relaxed"
              >
                Animez des quiz interactifs en temps réel.
                <br />
                <span className="text-slate-500">Vos joueurs répondent depuis leur smartphone.</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row gap-3 justify-center mb-6"
              >
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Btn onClick={() => onNavigate('host-setup')} className="px-8 py-3 text-base">
                    🎮 Héberger une partie
                  </Btn>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Btn variant="secondary" onClick={() => onNavigate('player-join')} className="px-8 py-3 text-base">
                    📱 Rejoindre
                  </Btn>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex gap-2 justify-center flex-wrap"
              >
                <Btn variant="ghost" size="sm" onClick={() => onNavigate('editor')}>📝 Éditeur</Btn>
                <Btn variant="ghost" size="sm" onClick={() => onNavigate('import-export')}>📦 Import</Btn>
                <Btn variant="ghost" size="sm" onClick={() => onNavigate('history')}>📋 Historique</Btn>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 2 }, y: { repeat: Infinity, duration: 1.5 } }}
          className="absolute bottom-6 text-slate-600 text-sm flex flex-col items-center gap-1 cursor-pointer"
          onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span>Comment ça marche ?</span>
          <span>↓</span>
        </motion.div>
      </div>

      {/* === 3-STEP TUTORIAL === */}
      <div id="how-it-works" className="relative py-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900 via-dark-800/50 to-dark-900" />
        <div className="relative z-10 max-w-[900px] mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-3xl font-black mb-3"
          >
            Comment ça marche ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-slate-500 mb-14"
          >
            En 3 étapes simples
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-indigo-500/30 to-transparent" />
                )}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-black">
                      {i + 1}
                    </div>
                    <span className="text-3xl">{step.icon}</span>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* === FAQ === */}
      <div className="py-20 px-6">
        <div className="max-w-[650px] mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-3xl font-black mb-3"
          >
            Questions fréquentes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-slate-500 mb-10"
          >
            Tout ce que vous devez savoir
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-6"
          >
            {FAQ.map((item, i) => (
              <FAQItem key={i} item={item} isOpen={openFAQ === i} onToggle={() => setOpenFAQ(openFAQ === i ? null : i)} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* === FOOTER CTA === */}
      <div className="py-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-4xl mb-4">🎪</div>
          <h3 className="text-2xl font-black mb-2">Prêt à animer ?</h3>
          <p className="text-slate-500 mb-6">Créez votre première partie en moins de 2 minutes.</p>
          <Btn onClick={() => onNavigate('host-setup')} className="px-8 py-3">
            🎮 C'est parti !
          </Btn>
        </motion.div>
        <div className="mt-12 text-slate-700 text-xs">
          Quiz Master — Temps réel avec Firebase 🔥
          {isHost && (
            <button onClick={() => { logout(); window.location.reload() }} className="ml-3 text-slate-600 hover:text-red-400 transition">
              🔒 Déconnexion Host
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
