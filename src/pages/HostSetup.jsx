import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Card, Btn } from '../components/UI'
import { useStore } from '../hooks/useSession'
import { THEMES, TEAM_COLORS, GAME_MODES, QUIZ_FORMATS, DOMAIN_CATEGORIES, getDomainParent, getQuizCoverImage } from '../lib/constants'

export default function HostSetup({ quizzes, onNavigate }) {
  const [selIdx, setSelIdx] = useState(-1)
  const [settings, setSettings] = useState({
    speedBonus: true, streakBonus: true, wrongPenalty: false, shuffleQuestions: false,
    enableJokers: true, enableReactions: true, enableBonusWheel: true, enableCategoryPick: true,
    enablePrediction: false,
  })
  const [loading, setLoading] = useState(false)
  const [filterFormat, setFilterFormat] = useState('all')
  const [filterDomain, setFilterDomain] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const { createSession, theme, setTheme, teamMode, setTeamMode, enabledTeams, setEnabledTeams, gameMode, setGameMode, displayMode, setDisplayMode, loadSoiree, clearSoiree } = useStore()

  const soiree = loadSoiree()
  const [continueSoiree, setContinueSoiree] = useState(!!soiree)

  // Detect quiz format
  const getQuizFormat = (q) => {
    const types = (q.questions || []).map(qq => qq.type)
    const unique = [...new Set(types)]
    if (unique.length === 1 && unique[0] === 'blindtest') return 'blindtest'
    if (unique.length === 1 && unique[0] === 'buzzer') return 'buzzer'
    if (unique.length > 1 && (types.includes('blindtest') || types.includes('buzzer'))) return 'mixed'
    return 'multi'
  }

  // Auto-color for quiz cards
  const CARD_COLORS = [
    'from-indigo-500/20 to-purple-600/20 border-indigo-500/30',
    'from-pink-500/20 to-rose-600/20 border-pink-500/30',
    'from-cyan-500/20 to-blue-600/20 border-cyan-500/30',
    'from-amber-500/20 to-orange-600/20 border-amber-500/30',
    'from-emerald-500/20 to-green-600/20 border-emerald-500/30',
    'from-violet-500/20 to-fuchsia-600/20 border-violet-500/30',
    'from-red-500/20 to-rose-600/20 border-red-500/30',
    'from-teal-500/20 to-cyan-600/20 border-teal-500/30',
  ]

  const DEFAULT_EMOJIS = ['🎯', '🧠', '🎵', '⚡', '🌍', '📚', '🏆', '🎪', '🔬', '🎮']

  // Filter & sort
  const filteredQuizzes = quizzes
    .map((q, i) => ({ ...q, _origIdx: i, _format: getQuizFormat(q) }))
    .filter(q => {
      if (filterFormat !== 'all' && q._format !== filterFormat) return false
      if (filterDomain !== 'all') {
        const cats = (q.questions || []).map(qq => (qq.category || '').toLowerCase())
        // Check if filterDomain is a parent group
        const parentSubs = DOMAIN_CATEGORIES[filterDomain]
        if (parentSubs) {
          // Filter by parent: quiz must have at least one sub-category from this group
          if (!parentSubs.some(sub => cats.includes(sub.toLowerCase()))) return false
        } else {
          // Filter by specific sub-category
          if (!cats.includes(filterDomain.toLowerCase())) return false
        }
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'questions') return (b.questions?.length || 0) - (a.questions?.length || 0)
      if (sortBy === 'alpha') return a.title.localeCompare(b.title)
      return (b._origIdx || 0) - (a._origIdx || 0)
    })

  const toggleTeam = (tid) => {
    if (enabledTeams.includes(tid)) {
      if (enabledTeams.length <= 2) return
      setEnabledTeams(enabledTeams.filter(t => t !== tid))
    } else {
      setEnabledTeams([...enabledTeams, tid])
    }
  }

  const handleCreate = async () => {
    if (selIdx < 0) return toast.error('Sélectionnez un quiz !')
    setLoading(true)
    try {
      const sessionSettings = { ...settings }
      if (continueSoiree && soiree) {
        sessionSettings.soireeId = soiree.id
        sessionSettings.soireeScores = soiree.scores
        sessionSettings.quizNumber = soiree.quizNumber + 1
      }
      const { pin } = await createSession(quizzes[selIdx], sessionSettings)
      toast.success(`Salle créée ! PIN: ${pin}`)
      onNavigate('host-lobby')
    } catch (e) {
      toast.error('Erreur: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[900px] mx-auto">
        <Btn variant="ghost" size="sm" onClick={() => onNavigate('landing')}>← Retour</Btn>

        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-extrabold mt-6 mb-2">
          🎮 Créer une partie
        </motion.h2>
        <p className="text-slate-400 mb-6">Sélectionnez un quiz, configurez les règles</p>

        {/* === QUIZ SELECTION — CARD GRID === */}
        <h3 className="text-sm font-semibold text-brand mb-3 uppercase tracking-wide">📋 Choisir un quiz</h3>

        {/* Filters + Sort */}
        <div className="space-y-3 mb-5">
          {/* Format tabs (top-level) */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setFilterFormat('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filterFormat === 'all' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
            >
              🎲 Tous
            </button>
            {Object.entries(QUIZ_FORMATS).map(([id, f]) => (
              <button
                key={id}
                onClick={() => setFilterFormat(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filterFormat === id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          {/* Domain filter + Sort */}
          <div className="flex gap-3 items-center">
            <select
              value={filterDomain}
              onChange={e => setFilterDomain(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer flex-1 max-w-[250px]"
            >
              <option value="all">📂 Toutes les catégories</option>
              {Object.entries(DOMAIN_CATEGORIES).map(([group, subs]) => (
                <optgroup key={group} label={group}>
                  <option value={group}>{group} (tout)</option>
                  {subs.map(sub => (
                    <option key={sub} value={sub}>&nbsp;&nbsp;&nbsp;{sub}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer"
            >
              <option value="recent">Plus récent</option>
              <option value="questions">Plus de questions</option>
              <option value="alpha">A → Z</option>
            </select>
          </div>
        </div>

        {/* Quiz Cards Grid */}
        {filteredQuizzes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <div>Aucun quiz trouvé{filterFormat !== 'all' || filterDomain !== 'all' ? ' pour ces filtres' : ''}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {filteredQuizzes.map((q, fi) => {
              const origIdx = q._origIdx
              const isSelected = selIdx === origIdx
              const colorClass = CARD_COLORS[origIdx % CARD_COLORS.length]
              const emoji = q.emoji || DEFAULT_EMOJIS[origIdx % DEFAULT_EMOJIS.length]
              const questionTypes = [...new Set((q.questions || []).map(qq => qq.type))]
              const categories = [...new Set((q.questions || []).map(qq => qq.category).filter(Boolean))]
              const typeIcons = { qcm: '📝', truefalse: '✅', text: '💬', estimate: '🔢', buzzer: '🔔', blindtest: '🎵', karaoke: '🎤', geo: '🗺️' }
              const fmt = q._format
              const fmtInfo = QUIZ_FORMATS[fmt]
              const coverImg = getQuizCoverImage(q)

              return (
                <motion.div
                  key={q.quizId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: fi * 0.05 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelIdx(origIdx)}
                  className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all border-2 ${isSelected ? 'border-brand ring-2 ring-brand/30' : 'border-transparent hover:border-white/10'}`}
                >
                  {/* Card background */}
                  <div className={`bg-gradient-to-br ${colorClass} p-5 h-full flex flex-col`}>
                    {/* Format badge */}
                    {fmtInfo && (
                      <div className="text-[10px] font-bold bg-black/20 rounded-full px-2 py-0.5 self-start mb-2 text-slate-300">
                        {fmtInfo.icon} {fmtInfo.label}
                      </div>
                    )}
                    {/* Cover image (explicit, category auto, or format auto) or emoji fallback */}
                    {coverImg ? (
                      <div className="w-full h-24 rounded-xl mb-3 overflow-hidden bg-black/20">
                        <img src={coverImg} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentElement.style.display = 'none' }} />
                      </div>
                    ) : (
                      <div className="text-4xl mb-3">{emoji}</div>
                    )}

                    {/* Title */}
                    <h4 className="font-bold text-white text-base leading-tight mb-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.title}</h4>

                    {/* Meta */}
                    <div className="mt-auto">
                      <div className="text-xs text-slate-400 font-semibold mb-1">
                        {q.questions?.length || 0} questions
                      </div>

                      {/* Categories badges */}
                      {categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {categories.slice(0, 3).map(cat => (
                            <span key={cat} className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-slate-400">{cat}</span>
                          ))}
                          {categories.length > 3 && <span className="text-[10px] text-slate-500">+{categories.length - 3}</span>}
                        </div>
                      )}

                      {/* Type icons */}
                      <div className="flex gap-1">
                        {questionTypes.slice(0, 5).map(t => (
                          <span key={t} className="text-xs" title={t}>{typeIcons[t] || '❓'}</span>
                        ))}
                      </div>
                    </div>

                    {/* Selected check */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold shadow-lg"
                      >
                        ✓
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Display Mode */}
        <h3 className="text-sm font-semibold text-accent-cyan mb-4 uppercase tracking-wide">📡 Mode d'affichage</h3>
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setDisplayMode('tv')}
            className={`flex-1 p-4 rounded-2xl text-center transition-all border-2 ${displayMode === 'tv' ? 'border-brand bg-brand/10' : 'border-dark-500 bg-dark-700'}`}
          >
            <div className="text-3xl mb-2">📺</div>
            <div className="font-bold">En salle</div>
            <div className="text-slate-400 text-xs mt-1">Questions sur TV/écran, joueurs répondent sur téléphone</div>
          </button>
          <button
            onClick={() => setDisplayMode('online')}
            className={`flex-1 p-4 rounded-2xl text-center transition-all border-2 ${displayMode === 'online' ? 'border-brand bg-brand/10' : 'border-dark-500 bg-dark-700'}`}
          >
            <div className="text-3xl mb-2">🌐</div>
            <div className="font-bold">En ligne</div>
            <div className="text-slate-400 text-xs mt-1">Tout sur le téléphone du joueur (pas besoin d'écran)</div>
          </button>
        </div>

        {/* Theme */}
        <h3 className="text-sm font-semibold text-accent-cyan mb-4 uppercase tracking-wide">🎨 Thème visuel</h3>
        <div className="flex gap-2 flex-wrap mb-8">
          {Object.entries(THEMES).map(([id, t]) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${theme === id ? 'bg-brand/20 border-brand text-brand' : 'bg-white/5 border-white/10 text-slate-300'} border`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Game Mode */}
        <h3 className="text-sm font-semibold text-accent-cyan mb-4 uppercase tracking-wide">💀 Mode de jeu</h3>
        <div className="flex gap-2 flex-wrap mb-8">
          {Object.entries(GAME_MODES).map(([id, mode]) => (
            <button
              key={id}
              onClick={() => setGameMode(id)}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${gameMode === id ? 'border-brand bg-brand/10 text-brand' : 'border-dark-500 bg-dark-700 text-slate-300'}`}
            >
              <span className="text-lg mr-1">{mode.icon}</span> {mode.label}
              <span className="block text-xs text-slate-400 font-normal mt-0.5">{mode.desc}</span>
            </button>
          ))}
        </div>

        {/* Team Mode */}
        <Card className="mb-6">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">👥 Mode Équipe</div>
              <div className="text-slate-400 text-sm">Les joueurs sont répartis en équipes</div>
            </div>
            <input type="checkbox" checked={teamMode} onChange={e => setTeamMode(e.target.checked)} className="w-5 h-5 accent-brand" />
          </label>
          {teamMode && (
            <div className="mt-4">
              <div className="text-xs text-slate-400 font-semibold mb-2">Choisissez les équipes (min. 2) :</div>
              <div className="flex gap-2 flex-wrap">
                {TEAM_COLORS.map(t => {
                  const active = enabledTeams.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTeam(t.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${active ? '' : 'opacity-40 border-transparent'}`}
                      style={{ background: active ? t.bg : 'transparent', color: t.color, borderColor: active ? t.color + '60' : 'transparent' }}
                    >
                      {t.emoji} {t.name.replace('Équipe ', '')}
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-slate-500 mt-2">Les joueurs choisiront leur équipe en rejoignant, ou vous pourrez les répartir automatiquement</div>
            </div>
          )}
        </Card>

        {/* Settings */}
        <h3 className="text-sm font-semibold text-accent-cyan mb-4 uppercase tracking-wide">⚙️ Règles de jeu</h3>
        <Card className="mb-8 space-y-4">
          {[
            { key: 'speedBonus', label: 'Bonus vitesse', desc: 'Les réponses rapides rapportent plus' },
            { key: 'streakBonus', label: 'Bonus série', desc: 'Bonnes réponses consécutives = bonus' },
            { key: 'wrongPenalty', label: 'Malus erreur', desc: 'Mauvaise réponse = perte de points' },
            { key: 'shuffleQuestions', label: '🔀 Ordre aléatoire', desc: 'Mélanger l\'ordre des questions' },
          ].map(s => (
            <label key={s.key} className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-semibold">{s.label}</div>
                <div className="text-slate-400 text-sm">{s.desc}</div>
              </div>
              <input type="checkbox" checked={settings[s.key]} onChange={() => setSettings(p => ({ ...p, [s.key]: !p[s.key] }))} className="w-5 h-5 accent-brand" />
            </label>
          ))}
        </Card>

        <h3 className="text-sm font-semibold text-accent-cyan mb-4 uppercase tracking-wide">🎁 Bonus & Options fun</h3>
        <Card className="mb-8 space-y-4">
          {[
            { key: 'enableJokers', label: '🃏 Jokers', desc: 'x2, 50/50, +5 secondes' },
            { key: 'enableReactions', label: '💬 Réactions emoji', desc: 'Les joueurs envoient des emojis en live' },
            { key: 'enableBonusWheel', label: '🎲 Roue Bonus', desc: 'Multiplicateur aléatoire x1→x5 (si activé sur la question)' },
            { key: 'enableCategoryPick', label: '👑 Dernier choisit', desc: 'Le dernier du classement choisit la catégorie' },
            { key: 'enablePrediction', label: '🎯 Je te mets combien ?', desc: 'Chaque joueur prédit son nombre de bonnes réponses — bonus si correct !' },
          ].map(s => (
            <label key={s.key} className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-semibold">{s.label}</div>
                <div className="text-slate-400 text-sm">{s.desc}</div>
              </div>
              <input type="checkbox" checked={settings[s.key]} onChange={() => setSettings(p => ({ ...p, [s.key]: !p[s.key] }))} className="w-5 h-5 accent-brand" />
            </label>
          ))}
        </Card>

        {/* Soirée Mode */}
        {soiree && (
          <Card className="mb-6 border-brand/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-brand">🌙 Soirée en cours</div>
                <div className="text-slate-400 text-sm">Quiz n°{soiree.quizNumber} terminé — {Object.keys(soiree.scores).length} joueurs</div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-slate-400">Continuer</span>
                <input type="checkbox" checked={continueSoiree} onChange={e => setContinueSoiree(e.target.checked)} className="w-5 h-5 accent-brand" />
              </label>
            </div>
            {continueSoiree && (
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <div className="text-xs text-slate-400 font-semibold mb-2">Scores cumulés :</div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(soiree.scores).sort(([,a],[,b]) => b - a).slice(0, 8).map(([name, score]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="text-slate-300">{name}</span>
                      <span className="font-mono text-brand font-bold">{score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {Object.keys(soiree.scores).length > 8 && (
                  <div className="text-xs text-slate-500 mt-1">+{Object.keys(soiree.scores).length - 8} autres</div>
                )}
              </div>
            )}
            <button onClick={() => { clearSoiree(); setContinueSoiree(false) }}
              className="text-xs text-accent-red hover:underline">
              Terminer la soirée (remettre à zéro)
            </button>
          </Card>
        )}

        <Btn onClick={handleCreate} disabled={selIdx < 0 || loading} className="w-full">
          {loading ? '⏳ Création...' : continueSoiree && soiree ? `🚀 Lancer le Quiz n°${soiree.quizNumber + 1}` : '🚀 Créer la salle'}
        </Btn>
      </div>
    </div>
  )
}
