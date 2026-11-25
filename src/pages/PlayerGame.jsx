import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChoiceButton, TimerBar, Btn, Confetti, MediaPlayer, EliminatedBadge } from '../components/UI'
import { ReactionBar } from '../components/Reactions'
import BonusWheel from '../components/BonusWheel'
import GeoMap from '../components/GeoMap'
import { useStore } from '../hooks/useSession'
import { useTimer } from '../hooks/useTimer'
import { useSound } from '../hooks/useSound'
import { CHOICE_COLORS, CHOICE_SHAPES, TEAM_COLORS, getTeamName } from '../lib/constants'

// Mini countdown for player screen
function CountdownMini() {
  const [step, setStep] = useState(0)
  const items = ['3', '2', '1', '🎯']
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6']
  useEffect(() => {
    if (step < items.length - 1) {
      const t = setTimeout(() => setStep(s => s + 1), 900)
      return () => clearTimeout(t)
    }
  }, [step])
  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={step}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 3, opacity: 0 }}
        transition={{
          enter: { type: 'spring', damping: 10 },
          exit: { duration: 0.3 },
        }}
        className="text-8xl font-black absolute"
        style={{ color: colors[step] }}
      >{items[step]}</motion.div>
    </AnimatePresence>
  )
}

// Joker buttons component
function JokerBar({ jokers, onUse, activeJokers, disabled }) {
  const JOKER_DEFS = [
    { id: 'x2', icon: '✖️2', label: 'Double', color: '#f59e0b', desc: 'Points x2' },
    { id: 'fifty', icon: '50/50', label: '50/50', color: '#3b82f6', desc: 'Retire 2 mauvaises' },
    { id: 'time', icon: '⏱+5', label: '+5 sec', color: '#10b981', desc: '+5 secondes' },
  ]
  return (
    <div className="flex gap-2 justify-center mb-3">
      {JOKER_DEFS.map(j => {
        const count = jokers[j.id] || 0
        const isActive = activeJokers?.[j.id]
        return (
          <motion.button key={j.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => count > 0 && !isActive && !disabled && onUse(j.id)}
            disabled={count <= 0 || isActive || disabled}
            className={`relative px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'ring-2 ring-offset-1 ring-offset-dark-900' : ''} ${count > 0 && !isActive && !disabled ? 'opacity-100 hover:scale-105' : 'opacity-30'}`}
            style={{
              background: isActive ? j.color + '30' : 'rgba(255,255,255,0.05)',
              borderColor: j.color + '40',
              border: `2px solid ${j.color}${isActive ? '' : '40'}`,
              color: j.color,
              ...(isActive ? { ringColor: j.color } : {}),
            }}
          >
            <div className="text-sm">{j.icon}</div>
            {count > 0 && !isActive && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-dark-800 border border-dark-500 flex items-center justify-center text-[9px] text-white font-bold">
                {count}
              </div>
            )}
            {isActive && <div className="text-[9px] mt-0.5">ACTIF ✓</div>}
          </motion.button>
        )
      })}
    </div>
  )
}

export default function PlayerGame({ onNavigate }) {
  const { session, players, answers, myPlayerId, myPlayerData, submitAnswer, pressBuzzer, submitSteal, submitBet, hasAnswered, getSorted, getTeamScores, isEliminated, getAliveCount, endGame, useJoker, getMyJokers, sendReaction, submitCategoryPick, setTeamName } = useStore()

  // Prevent accidental refresh during game
  useEffect(() => {
    const handler = (e) => {
      if (session?.status && session.status !== 'lobby' && session.status !== 'ended') {
        e.preventDefault()
        e.returnValue = 'Quitter maintenant vous fera perdre votre progression !'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [session?.status])

  const goHome = () => {
    endGame()
    onNavigate('landing')
  }
  const sfx = useSound()
  const [multiSel, setMultiSel] = useState([])
  const [textInput, setTextInput] = useState('')
  const [estimateInput, setEstimateInput] = useState('')
  const [geoSelection, setGeoSelection] = useState(null)
  const [teamNameEdit, setTeamNameEdit] = useState(null)
  const [orderState, setOrderState] = useState(null)
  const [matchState, setMatchState] = useState(null)
  const [buzzerPressed, setBuzzerPressed] = useState(false)
  const [lastRevealedQ, setLastRevealedQ] = useState(-1)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [predValue, setPredValue] = useState(5)

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const qIdx = session?.currentQuestionIndex ?? -1
  const quiz = session?.quiz
  const q = qIdx >= 0 ? quiz?.questions[qIdx] : null
  // Resolve effective answer type (blindtest can behave as buzzer or estimate)
  const effectiveType = q?.type === 'blindtest' && q?.blindtestMode ? q.blindtestMode : q?.type
  const status = session?.status
  const sb = session?.scoreboard || {}
  const myScore = sb[myPlayerId]?.score || 0
  const myStreak = sb[myPlayerId]?.streak || 0
  const results = session?.revealResults || {}
  const myResult = results[myPlayerId]
  const answered = hasAnswered()

  // Init prediction value when quiz loads
  useEffect(() => {
    if (quiz?.questions?.length) setPredValue(Math.round(quiz.questions.length / 2))
  }, [quiz?.questions?.length])

  const timer = useTimer(session?.questionStartTimestamp, q?.timerSeconds, status === 'running')

  // Reset selection on new question
  useEffect(() => {
    setMultiSel([])
    setTextInput('')
    setEstimateInput('')
    setGeoSelection(null)
    setOrderState(null)
    setMatchState(null)
    setBuzzerPressed(false)
  }, [qIdx])

  // Reset buzzer state when Host resets buzzer (after wrong answer)
  useEffect(() => {
    if (!session?.buzzerLocked && !session?.buzzerWinner && buzzerPressed) {
      // Only reset if I'm not penalized
      if (!(session?.buzzerPenalized || []).includes(myPlayerId)) {
        setBuzzerPressed(false)
      }
    }
  }, [session?.buzzerLocked, session?.buzzerWinner])

  // Sound on reveal (only once)
  useEffect(() => {
    if (status === 'revealing' && qIdx !== lastRevealedQ) {
      setLastRevealedQ(qIdx)
      if (myResult?.isCorrect) sfx.correct()
      else sfx.wrong()
    }
  }, [status, qIdx])

  // Detect if this is a soirée (multi-quiz session)
  const isSoiree = !!(session?.soireeId || (session?.quizNumber && session.quizNumber > 1) || 
    (session?.soireeScores && Object.keys(session.soireeScores).length > 0))

  // NOTE: We no longer auto-redirect players when status === 'ended'.
  // Players stay on the results screen. They will be redirected when:
  // - Soirée: Host loads next quiz → status goes back to 'lobby' → player sees lobby
  // - No soirée: Player clicks "Quitter" button, or session is deleted by Host

  // If session disappeared (Host cleaned up), redirect immediately
  if (!session && myPlayerId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="text-xl font-bold mb-2">Session terminée</h2>
        <p className="text-slate-400 mb-6">L'animateur a mis fin à la partie</p>
        <Btn onClick={() => { endGame(); onNavigate('landing') }}>🏠 Retour à l'accueil</Btn>
      </div>
    )
  }

  if (!session || !myPlayerData) return null

  const playerCount = Object.keys(players).length

  // === DUEL INTRO ===
  if (status === 'duelIntro' && session?.duel) {
    const duel = session.duel
    const round = duel.rounds[duel.currentRound]
    const match = round[duel.currentMatch]
    const isMyMatch = match.player1 === myPlayerId || match.player2 === myPlayerId
    const p1 = players[match.player1]
    const p2 = match.player2 ? players[match.player2] : null

    // Am I eliminated? (lost in a previous match)
    const amEliminated = duel.rounds.some(r => r.some(m => m.winner && m.winner !== myPlayerId && (m.player1 === myPlayerId || m.player2 === myPlayerId)))

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        {amEliminated ? (
          <>
            <div className="text-5xl mb-3">👀</div>
            <h2 className="text-xl font-bold text-slate-400 mb-4">Spectateur</h2>
          </>
        ) : isMyMatch ? (
          <>
            <div className="text-5xl mb-3">⚔️</div>
            <h2 className="text-xl font-bold text-brand mb-4">C'est votre tour !</h2>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">👀</div>
            <h2 className="text-xl font-bold text-slate-400 mb-4">En attente de votre match</h2>
          </>
        )}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl">{p1?.avatar || '?'}</div>
            <div className={`text-sm font-bold mt-1 ${match.player1 === myPlayerId ? 'text-brand' : ''}`}>{p1?.name}</div>
          </div>
          <div className="text-xl font-black text-brand">⚔️</div>
          <div className="text-center">
            <div className="text-3xl">{p2?.avatar || '👤'}</div>
            <div className={`text-sm font-bold mt-1 ${match.player2 === myPlayerId ? 'text-brand' : ''}`}>{p2?.name || 'Bye'}</div>
          </div>
        </div>
      </div>
    )
  }

  // === DUEL RESULT ===
  if (status === 'duelResult' && session.duelMatchResult) {
    const r = session.duelMatchResult
    const isWinner = r.winner === myPlayerId
    const wasInMatch = r.player1 === myPlayerId || r.player2 === myPlayerId
    const pw = players[r.winner]

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        {wasInMatch ? (
          isWinner ? (
            <>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-6xl mb-3">🎉</motion.div>
              <h2 className="text-2xl font-black text-brand mb-2">Vous avancez !</h2>
            </>
          ) : (
            <>
              <motion.div initial={{ x: -10 }} animate={{ x: [10, -10, 5, -5, 0] }} className="text-6xl mb-3">😔</motion.div>
              <h2 className="text-2xl font-black text-accent-red mb-2">Éliminé !</h2>
            </>
          )
        ) : (
          <>
            <div className="text-4xl mb-3">⚔️</div>
            <h2 className="text-xl font-bold text-brand mb-2">🎉 {pw?.name} gagne !</h2>
          </>
        )}
      </div>
    )
  }

  // === LOBBY ===
  if (status === 'lobby') {
    const myTeam = myPlayerData?.team ? TEAM_COLORS.find(t => t.id === myPlayerData.team) : null
    const qNum = session?.quizNumber || 1
    const mySoireeScore = (session?.soireeScores || {})[myPlayerId] || 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-6xl mb-4">
          {myPlayerData.avatar}
        </motion.div>
        <h2 className="text-2xl font-extrabold mb-2">{myPlayerData.name}</h2>
        {myTeam && (
          <div className="mb-3">
            {teamNameEdit !== null ? (
              <div className="flex items-center gap-2 justify-center">
                <span className="text-xl">{myTeam.emoji}</span>
                <input type="text" value={teamNameEdit} onChange={e => setTeamNameEdit(e.target.value)}
                  maxLength={24} autoFocus
                  className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm font-bold text-center outline-none focus:border-brand"
                  style={{ color: myTeam.color, minWidth: 140 }}
                  onKeyDown={e => { if (e.key === 'Enter' && teamNameEdit.trim()) { setTeamName(myPlayerData.team, teamNameEdit.trim()); setTeamNameEdit(null) } }}
                />
                <button onClick={() => { if (teamNameEdit.trim()) { setTeamName(myPlayerData.team, teamNameEdit.trim()); setTeamNameEdit(null) } }}
                  className="text-emerald-400 text-sm font-bold px-2">✓</button>
                <button onClick={() => setTeamNameEdit(null)} className="text-slate-500 text-sm px-2">✗</button>
              </div>
            ) : (
              <button onClick={() => setTeamNameEdit(getTeamName(myPlayerData.team, session))}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full transition-all hover:scale-105 mx-auto"
                style={{ background: myTeam.bg, border: `1px solid ${myTeam.color}40` }}>
                <span>{myTeam.emoji}</span>
                <span className="font-bold text-sm" style={{ color: myTeam.color }}>{getTeamName(myPlayerData.team, session)}</span>
                <span className="text-xs opacity-50">✏️</span>
              </button>
            )}
          </div>
        )}
        {qNum > 1 ? (
          <>
            <div className="text-brand font-bold mb-1">🌙 Soirée — Quiz n°{qNum} bientôt !</div>
            {mySoireeScore > 0 && (
              <div className="text-slate-400 text-sm mb-4">Score cumulé : <span className="font-bold text-brand">{mySoireeScore.toLocaleString()}</span> pts</div>
            )}
          </>
        ) : (
          <p className="text-slate-400 mb-4">Vous êtes dans la salle !</p>
        )}
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-brand font-semibold text-lg">
          ⏳ En attente du lancement...
        </motion.div>
        <div className="mt-8 text-slate-500 text-sm">{playerCount} joueur{playerCount > 1 ? 's' : ''}</div>
        <Btn variant="ghost" size="sm" onClick={goHome} className="mt-4">🏠 Quitter</Btn>
      </div>
    )
  }

  // === CATEGORY PICK ===
  if (status === 'categoryPick' && session.categoryPickData) {
    const { pickerId, categories, chosen } = session.categoryPickData
    const isMyPick = pickerId === myPlayerId
    const picker = players[pickerId]

    if (chosen) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl mb-3">👑</div>
          <h2 className="text-xl font-bold text-amber-400 mb-2">{picker?.name} a choisi !</h2>
          <div className="text-2xl font-black text-brand">📂 {chosen}</div>
          <div className="text-slate-400 mt-3">Question suivante bientôt...</div>
        </div>
      )
    }

    if (isMyPick) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">👑</div>
          <h2 className="text-xl font-black text-amber-400 mb-2">C'est à vous de choisir !</h2>
          <p className="text-slate-400 mb-6">Vous êtes dernier — choisissez la prochaine catégorie</p>
          <div className="w-full max-w-[300px] space-y-3">
            {categories.map(cat => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => submitCategoryPick(cat)}
                className="w-full px-5 py-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-300 font-bold text-lg hover:bg-amber-500/20 transition-all"
              >
                📂 {cat}
              </motion.button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">👑</div>
        <h2 className="text-xl font-bold text-amber-400 mb-2">{picker?.avatar} {picker?.name} choisit la catégorie...</h2>
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-slate-400 mt-4">
          ⏳ En attente du choix...
        </motion.div>
      </div>
    )
  }

  // === ENDED ===
  if (status === 'ended') {
    const sorted = getSorted()
    const myRank = sorted.findIndex(p => p.did === myPlayerId) + 1
    const isOnlineEnd = session?.displayMode === 'online'
    const teamScores = session?.teamMode ? getTeamScores() : []
    const myTeamData = myPlayerData?.team ? TEAM_COLORS.find(t => t.id === myPlayerData.team) : null

    // Stats for online mode
    const allAnswers = Object.values(answers)
    const questions = session?.quiz?.questions || []
    let hardest = null, easiest = null, fastestPData = null, fastestTime = 0
    if (isOnlineEnd && questions.length > 0) {
      const qStats = questions.map((qq, qi) => {
        const qAns = allAnswers.filter(a => a.questionIndex === qi)
        const correctCount = qAns.filter(a => {
          const effType = qq.type === 'blindtest' && qq.blindtestMode ? qq.blindtestMode : qq.type
          if (effType === 'estimate' || effType === 'text' || effType === 'buzzer') return false
          if (qq.type === 'multi') return JSON.stringify([...(a.selected || [])].sort()) === JSON.stringify([...qq.correctAnswer].sort())
          return a.selected === qq.correctAnswer
        }).length
        const rate = qAns.length > 0 ? Math.round((correctCount / qAns.length) * 100) : 0
        return { q: qq, rate }
      })
      hardest = [...qStats].sort((a, b) => a.rate - b.rate)[0]
      easiest = [...qStats].sort((a, b) => b.rate - a.rate)[0]
      const allTimed = allAnswers.filter(a => a.timeElapsed > 0)
      if (allTimed.length > 0) {
        const f = allTimed.reduce((best, a) => (!best || a.timeElapsed < best.timeElapsed) ? a : best, null)
        fastestPData = f ? players[f.playerId] : null
        fastestTime = f?.timeElapsed || 0
      }
    }

    return (
      <div className="min-h-screen flex flex-col items-center p-6 text-center overflow-y-auto pb-20">
        <Confetti show={myRank <= 3} />

        {/* Animated podium for online mode */}
        {isOnlineEnd && sorted.length >= 2 ? (
          <>
            <h2 className="text-xl font-black mb-4 text-brand">🏆 Résultats</h2>
            <div className="flex items-end gap-3 justify-center mb-6">
              {[1, 0, 2].map(rank => {
                const p = sorted[rank]
                if (!p) return <div key={rank} className="w-20" />
                const heights = [140, 110, 80]
                const medals = ['🥇', '🥈', '🥉']
                const isMe = p.did === myPlayerId
                return (
                  <motion.div key={rank} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: rank * 0.3, type: 'spring' }} className="text-center"
                  >
                    <div className="text-2xl mb-1">{p.avatar}</div>
                    <div className={`text-xs font-bold truncate max-w-[80px] ${isMe ? 'text-brand' : 'text-slate-300'}`}>{p.name}</div>
                    <div className="text-xs font-mono font-bold text-brand">{p.score.toLocaleString()}</div>
                    <div className="rounded-t-xl mt-1 flex items-start justify-center pt-2"
                      style={{
                        width: 70, height: heights[rank],
                        background: isMe ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                        border: isMe ? '2px solid rgba(245,158,11,0.4)' : '2px solid rgba(255,255,255,0.1)',
                        borderBottom: 'none',
                      }}
                    >
                      <span className="text-xl">{medals[rank]}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* My position if not in top 3 */}
            {myRank > 3 && (
              <div className="bg-brand/10 border border-brand/30 rounded-xl px-4 py-3 mb-4">
                <div className="text-slate-400 text-sm">Votre position</div>
                <div className="text-2xl font-black text-brand">{myRank}e / {sorted.length}</div>
                <div className="text-lg font-black text-brand font-mono">{myScore.toLocaleString()} pts</div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">{myRank <= 3 ? '🏆' : '🎮'}</div>
            <h2 className="text-2xl font-black mb-2">{myRank <= 3 ? 'Bravo !' : 'Bien joué !'}</h2>
            <div className="text-4xl font-black text-brand font-mono mb-2">{myScore.toLocaleString()} pts</div>
            <div className="text-slate-400 text-lg">Classement : {myRank}/{sorted.length}</div>
          </>
        )}

        <div className="text-slate-500 text-sm mt-1 mb-4">{sb[myPlayerId]?.correct || 0}/{sb[myPlayerId]?.total || 0} bonnes réponses</div>

        {/* Full results for online mode */}
        {isOnlineEnd && (
          <div className="w-full max-w-[360px]">
            {/* Team results */}
            {teamScores.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🏆 Classement Équipes</h3>
                <div className="space-y-2">
                  {teamScores.map((t, i) => (
                    <div key={t.id}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${myTeamData?.id === t.id ? 'border-brand/40 bg-brand/10' : 'border-white/5 bg-white/5'}`}
                      style={{ borderColor: myTeamData?.id === t.id ? undefined : t.color + '30' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : t.emoji}</span>
                        <span className="font-bold text-sm" style={{ color: t.color }}>{t.name}</span>
                        <span className="text-xs text-slate-500">({t.playerCount}j.)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black font-mono text-sm" style={{ color: t.color }}>{t.score.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 ml-1">pts/j.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual ranking */}
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🏅 Classement</h3>
            <div className="space-y-1.5 mb-6">
              {sorted.map((p, i) => (
                <div key={p.did}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${p.did === myPlayerId ? 'bg-brand/15 border border-brand/30' : 'bg-white/5'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-5">{i + 1}</span>
                    <span>{p.avatar}</span>
                    <span className={`font-semibold ${p.did === myPlayerId ? 'text-brand' : ''}`}>{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-xs">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">📊 Stats</h3>
            <div className="grid grid-cols-1 gap-2 mb-6">
              {hardest && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <div className="text-xs text-red-400 font-bold mb-1">💀 + Difficile</div>
                  <div className="text-sm font-semibold text-slate-300 line-clamp-1">{hardest.q.prompt}</div>
                  <div className="text-red-400 font-bold text-sm mt-1">{hardest.rate}% réussite</div>
                </div>
              )}
              {easiest && easiest !== hardest && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                  <div className="text-xs text-green-400 font-bold mb-1">😎 + Facile</div>
                  <div className="text-sm font-semibold text-slate-300 line-clamp-1">{easiest.q.prompt}</div>
                  <div className="text-green-400 font-bold text-sm mt-1">{easiest.rate}% réussite</div>
                </div>
              )}
              {fastestPData && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                  <div className="text-xs text-blue-400 font-bold mb-1">⚡ + Rapide</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">{fastestPData.avatar}</span>
                    <span className={`font-semibold text-sm ${fastestPData.playerId === myPlayerId ? 'text-brand' : 'text-slate-300'}`}>{fastestPData.name}</span>
                  </div>
                  <div className="text-blue-400 font-bold text-sm mt-1">{fastestTime.toFixed(1)}s</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prediction result */}
        {session.predictionResults?.[myPlayerId] && (() => {
          const pr = session.predictionResults[myPlayerId]
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 w-full max-w-[320px]">
              <div className="text-amber-400 font-bold mb-2">🎯 Je te mets combien ?</div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Prédit :</span>
                <span className="font-bold text-amber-400">{pr.predicted}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Réel :</span>
                <span className="font-bold text-brand">{pr.actual}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{pr.label}</span>
                {pr.bonus > 0 && <span className="font-bold text-emerald-400">+{pr.bonus.toLocaleString()} pts</span>}
              </div>
            </motion.div>
          )
        })()}

        {/* 🏅 Honor title */}
        {session.honors?.[myPlayerId] && (
          <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring', damping: 12 }}
            className="mt-4 bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/25 rounded-2xl px-6 py-5 w-full max-w-[320px] text-center">
            <div className="text-4xl mb-2">{session.honors[myPlayerId].icon}</div>
            <div className="font-black text-amber-400 text-lg">{session.honors[myPlayerId].title}</div>
            <div className="text-sm text-slate-400 mt-1">{session.honors[myPlayerId].desc}</div>
          </motion.div>
        )}

        <Btn variant="ghost" size="sm" onClick={goHome} className="mt-4 mb-8">🏠 Retour à l'accueil</Btn>
        {isSoiree && (
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
            className="text-brand font-semibold text-sm mb-4">
            ⏳ Quiz suivant en préparation... restez connectés !
          </motion.div>
        )}
      </div>
    )
  }

  // === SCOREBOARD ===
  if (status === 'scoreboard') {
    const isOnlineSb = session?.displayMode === 'online'
    const sortedPlayers = getSorted()
    const myRank = sortedPlayers.findIndex(p => p.did === myPlayerId) + 1
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-3xl mb-3">📊</div>
        <div className="text-3xl font-black text-brand font-mono mb-1">{myScore.toLocaleString()} pts</div>
        {myStreak >= 2 && <div className="text-brand font-bold text-sm mb-2">🔥 Série de {myStreak} !</div>}
        {isOnlineSb && (
          <div className="w-full max-w-[320px] mt-4 mb-4">
            <div className="text-slate-400 text-sm mb-3">Vous êtes <span className="font-bold text-brand">{myRank}e</span> sur {sortedPlayers.length}</div>
            <div className="space-y-1.5">
              {sortedPlayers.slice(0, 5).map((p, i) => (
                <div key={p.did}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm ${p.did === myPlayerId ? 'bg-brand/15 border border-brand/30' : 'bg-white/5'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-5">{i + 1}</span>
                    <span>{p.avatar}</span>
                    <span className={`font-semibold ${p.did === myPlayerId ? 'text-brand' : ''}`}>{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-xs">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-slate-400 mt-4">
          Question suivante bientôt...
        </motion.div>
      </div>
    )
  }

  if (!q && status !== 'betting' && status !== 'bonusWheel' && status !== 'prediction' && status !== 'roundIntro' && status !== 'destinyWheel') return null

  // === DESTINY WHEEL PHASE ===
  if (status === 'destinyWheel' && session.destinyPlayer) {
    const isChosen = myPlayerId === session.destinyPlayer
    const chosen = players[session.destinyPlayer]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <div className="text-6xl mb-4">🎰</div>
          {isChosen ? (
            <>
              <h2 className="text-2xl font-black text-red-400 mb-2">C'est vous !</h2>
              <p className="text-slate-400">Vous devez répondre SEUL à la prochaine question !</p>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-amber-400 font-bold mt-4 text-lg">✨ Double ou rien !</motion.div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Roue du Destin !</h2>
              <div className="flex items-center gap-2 justify-center mb-3">
                <span className="text-3xl">{chosen?.avatar}</span>
                <span className="font-black text-lg text-red-400">{chosen?.name}</span>
              </div>
              <p className="text-slate-400 text-sm">doit répondre seul... Regardez !</p>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  // === BONUS WHEEL PHASE ===
  if (status === 'bonusWheel') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-xl font-bold text-cyan-400 mb-6">🎲 Roue Bonus !</div>
        <BonusWheel autoSpin onResult={() => {}} />
        <div className="text-slate-400 text-sm mt-4">Le multiplicateur s'applique à la prochaine question !</div>
      </div>
    )
  }

  // === PREDICTION PHASE — "Je te mets combien ?" ===
  if (status === 'prediction') {
    const hasPredicted = (session.predictions || {})[myPlayerId] !== undefined
    const totalQ = session.quiz?.questions?.length || 0

    if (hasPredicted) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-xl font-bold text-amber-400 mb-2">Prédiction enregistrée !</h2>
            <div className="text-4xl font-black text-brand font-mono mb-2">{session.predictions[myPlayerId]} / {totalQ}</div>
            <p className="text-slate-400 text-sm">En attente du lancement...</p>
          </motion.div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-xl font-bold text-amber-400 mb-1">Je te mets combien ?</h2>
          <p className="text-slate-400 text-sm mb-2">Sur {totalQ} questions, combien de bonnes réponses allez-vous obtenir ?</p>
          <div className="text-6xl font-black text-brand font-mono my-6">{predValue}</div>
          <input
            type="range"
            min={0}
            max={totalQ}
            value={predValue}
            onChange={e => setPredValue(Number(e.target.value))}
            className="w-full max-w-[280px] mb-6 accent-amber-400"
          />
          <div className="flex gap-2 justify-center mb-6">
            {[0, Math.round(totalQ * 0.25), Math.round(totalQ * 0.5), Math.round(totalQ * 0.75), totalQ]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map(v => (
                <button key={v} onClick={() => setPredValue(v)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition ${predValue === v ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                  {v}
                </button>
              ))
            }
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { sfx.tick(); useStore.getState().submitPrediction(predValue) }}
            className="px-8 py-4 rounded-2xl bg-amber-500 text-white font-black text-lg">
            ✅ Je me mets {predValue} !
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // === BETTING PHASE ===
  if (status === 'betting') {
    const hasBet = (session.bets || {})[myPlayerId]
    const myCurrentScore = sb[myPlayerId]?.score || 0
    const maxBet = Math.max(myCurrentScore, 500)
    const betOptions = [100, 200, 500, Math.min(1000, maxBet)]
      .filter((v, i, a) => v <= maxBet && a.indexOf(v) === i)

    if (hasBet) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">🎰</div>
          <h2 className="text-xl font-bold text-emerald-400 mb-2">Pari enregistré !</h2>
          <div className="text-3xl font-black text-brand font-mono">{hasBet.toLocaleString()} pts</div>
          <p className="text-slate-400 text-sm mt-4">En attente des autres joueurs...</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-3">🎰</div>
        <h2 className="text-xl font-bold text-emerald-400 mb-1">Question Pari !</h2>
        <p className="text-slate-400 text-sm mb-2">Misez vos points — gagnez ou perdez votre mise !</p>
        <div className="text-sm text-slate-500 mb-4">Score actuel : <span className="text-brand font-bold">{myCurrentScore.toLocaleString()}</span></div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
          {betOptions.map(amount => (
            <motion.button key={amount} whileTap={{ scale: 0.95 }}
              onClick={() => { sfx.tick(); submitBet(amount) }}
              className="py-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 font-black text-xl hover:bg-emerald-500/25 transition-all"
            >
              {amount.toLocaleString()}
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  // === ROUND INTRO ===
  if (status === 'roundIntro' && session.roundIntroData) {
    const { roundNum, category } = session.roundIntroData
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
          <div className="text-slate-500 text-sm font-bold tracking-[0.3em] uppercase mb-2">ROUND {roundNum}</div>
          <div className="text-4xl font-black bg-gradient-to-r from-amber-400 to-brand bg-clip-text text-transparent mb-4">
            {category}
          </div>
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl">📂</motion.div>
        </motion.div>
      </div>
    )
  }

  // === COUNTDOWN 3-2-1 ===
  if (status === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <CountdownMini />
        <div className="text-slate-400 text-sm mt-4">Préparez-vous !</div>
      </div>
    )
  }

  // === PRE-MEDIA: waiting for Host to play media ===
  if (status === 'preMedia') {
    const icon = q.type === 'karaoke' ? '🎤' : q.type === 'blindtest' ? '🎵' : '📎'
    const msg = q.type === 'karaoke' ? 'Écoutez bien... Les paroles arrivent après !'
      : q.type === 'blindtest' ? 'Écoutez bien l\'extrait...' : 'Un média va être diffusé...'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
          className="text-6xl mb-4">{icon}</motion.div>
        <h2 className="text-xl font-bold mb-2">Préparez-vous !</h2>
        <p className="text-slate-400">{msg}</p>
      </div>
    )
  }

  // If question is loaded but timer hasn't started yet, show waiting screen
  // This prevents players from seeing the question before the TV countdown finishes
  if (status === 'running' && !session?.questionStartTimestamp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <CountdownMini />
        <div className="text-slate-400 text-sm mt-4">Préparez-vous !</div>
      </div>
    )
  }

  // === DUEL: spectator during running ===
  if (session?.gameMode === 'duel' && session.duel && (status === 'running' || status === 'preMedia')) {
    const duel = session.duel
    const round = duel.rounds[duel.currentRound]
    const match = round[duel.currentMatch]
    const isMyMatch = match.player1 === myPlayerId || match.player2 === myPlayerId
    if (!isMyMatch) {
      const p1 = players[match.player1]
      const p2 = match.player2 ? players[match.player2] : null
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl mb-3">👀</div>
          <h2 className="text-lg font-bold text-slate-400 mb-4">Duel en cours</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl">{p1?.avatar}</div>
              <div className="text-sm font-bold">{p1?.name}</div>
            </div>
            <div className="text-lg font-black text-brand">⚔️</div>
            <div className="text-center">
              <div className="text-3xl">{p2?.avatar}</div>
              <div className="text-sm font-bold">{p2?.name}</div>
            </div>
          </div>
          <div className="text-slate-500 text-sm">Regardez l'écran !</div>
        </div>
      )
    }
  }

  // === ELIMINATED (sudden death) ===
  if (isEliminated()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl mb-4">💀</motion.div>
        <h2 className="text-2xl font-black text-accent-red mb-2">Éliminé !</h2>
        <EliminatedBadge />
        <div className="mt-6 text-slate-400">Vous êtes spectateur pour le reste de la partie</div>
        <div className="mt-4 text-slate-500 text-sm">Score final : <span className="font-bold text-brand">{myScore.toLocaleString()}</span></div>
        <div className="mt-2 text-slate-500 text-sm">{getAliveCount()} joueur{getAliveCount() > 1 ? 's' : ''} encore en vie</div>
        <Btn variant="ghost" size="sm" onClick={goHome} className="mt-6">🏠 Retour à l'accueil</Btn>
      </div>
    )
  }

  // === REVEALING ===
  if (status === 'revealing' || status === 'stealReveal') {
    const isOnlineReveal = session?.displayMode === 'online'
    // Build correct answer text for online mode
    let correctText = null
    if (isOnlineReveal && q) {
      if (q.type === 'qcm' || q.type === 'truefalse' || (q.type === 'blindtest' && (!q.blindtestMode || q.blindtestMode === 'qcm'))) {
        correctText = q.choices?.[q.correctAnswer]
      } else if (q.type === 'multi') {
        correctText = (q.correctAnswer || []).map(i => q.choices[i]).join(', ')
      } else if (q.type === 'estimate' || (q.type === 'blindtest' && q.blindtestMode === 'estimate')) {
        correctText = String(q.correctAnswer)
      } else if (q.type === 'text' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer'))))) {
        correctText = String(q.correctAnswer)
      }
    }

    if (myResult?.isCorrect) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-6xl mb-3">🎉</motion.div>
          <h2 className="text-2xl font-black text-accent-green mb-2">Correct !</h2>
          <div className="text-3xl font-black text-brand font-mono">+{myResult.score}</div>
          {myResult.distanceKm !== undefined && <div className="text-slate-400 mt-1">📍 {myResult.distanceKm.toLocaleString()} km du point</div>}
          {myResult.streak >= 2 && <div className="text-brand font-bold mt-2">🔥 Série de {myResult.streak} !</div>}
          {myResult.isBuzzerWinner && <div className="text-accent-cyan font-bold mt-2">⚡ Premier au buzzer !</div>}
          {q?.steal && session?.teamMode && <div className="text-amber-400 font-bold mt-2">🏴‍☠️ Vous pouvez voler des points !</div>}
          <div className="mt-4 text-slate-400">Score : <span className="font-bold text-brand">{myScore.toLocaleString()}</span></div>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ x: -10 }} animate={{ x: [10, -10, 5, -5, 0] }} transition={{ duration: 0.4 }} className="text-6xl mb-3">😔</motion.div>
        <h2 className="text-2xl font-black text-accent-red mb-2">{answered ? 'Raté !' : 'Pas de réponse'}</h2>
        {myResult?.distanceKm !== undefined && <div className="text-slate-400 mb-2">📍 {myResult.distanceKm.toLocaleString()} km du point</div>}
        {isOnlineReveal && correctText && (
          <div className="mt-2 px-4 py-2 bg-accent-green/10 border border-accent-green/30 rounded-xl">
            <span className="text-slate-400 text-sm">Bonne réponse : </span>
            <span className="text-accent-green font-bold">{correctText}</span>
          </div>
        )}
        {myResult?.eliminated && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-3 mt-3">
            <EliminatedBadge />
          </motion.div>
        )}
        <div className="mt-4 text-slate-400">Score : <span className="font-bold text-brand">{myScore.toLocaleString()}</span></div>
      </div>
    )
  }

  // === STEALING PHASE ===
  if (status === 'stealing' && session.stealData) {
    const sd = session.stealData
    const myTeam = myPlayerData?.team
    const isWinningTeam = sd.winningTeams.includes(myTeam)
    const hasChosen = sd.steals?.[myTeam]
    const isMyTurn = isWinningTeam && !hasChosen && sd.winningTeams[sd.currentStealerIndex] === myTeam

    // Winning team chooses target
    if (isMyTurn) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-5xl mb-3">🏴‍☠️</motion.div>
          <h2 className="text-2xl font-black text-amber-400 mb-2">Volez des points !</h2>
          <p className="text-slate-400 mb-6">Choisissez l'équipe à qui voler <span className="font-bold text-amber-400">{sd.stealPoints} pts</span></p>
          <div className="w-full max-w-sm space-y-3">
            {sd.losingTeams.map(tid => {
              const tc = TEAM_COLORS.find(t => t.id === tid)
              if (!tc) return null
              return (
                <motion.button key={tid}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { sfx.buzzer(); submitSteal(tid) }}
                  className="w-full py-5 rounded-2xl text-xl font-black transition-all active:scale-95"
                  style={{ background: tc.bg, border: `3px solid ${tc.color}`, color: tc.color }}
                >
                  {tc.emoji} Voler {getTeamName(tc.id, session)} !
                </motion.button>
              )
            })}
          </div>
        </div>
      )
    }

    // Winning team waiting / already chose
    if (isWinningTeam && hasChosen) {
      const targetTc = TEAM_COLORS.find(t => t.id === hasChosen)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-5xl mb-3">🏴‍☠️</motion.div>
          <h2 className="text-xl font-bold text-amber-400 mb-2">Vol en cours...</h2>
          <p className="text-slate-400">Vous volez <span className="font-bold" style={{ color: targetTc?.color }}>{targetTc?.emoji} {targetTc?.name}</span></p>
        </div>
      )
    }

    if (isWinningTeam) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-5xl mb-3">🏴‍☠️</motion.div>
          <h2 className="text-xl font-bold text-amber-400 mb-2">Phase de Vol</h2>
          <p className="text-slate-400">Une autre équipe choisit sa cible...</p>
        </div>
      )
    }

    // Losing team — just watch
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 0.5 }} className="text-5xl mb-3">😰</motion.div>
        <h2 className="text-xl font-bold text-accent-red mb-2">Attention !</h2>
        <p className="text-slate-400">Les équipes gagnantes choisissent à qui voler des points...</p>
      </div>
    )
  }

  // === DESTINY: non-chosen player spectates ===
  if (session?.destinyPlayer && myPlayerId !== session.destinyPlayer && status === 'running') {
    const chosen = players[session.destinyPlayer]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}
          className="text-5xl mb-4">👀</motion.div>
        <h2 className="text-lg font-bold mb-2">
          {chosen?.avatar} {chosen?.name} répond...
        </h2>
        <p className="text-slate-400 text-sm">Vous regardez ! Double ou rien pour {chosen?.name} !</p>
      </div>
    )
  }

  // === ANSWERED - WAITING ===
  if (answered && status === 'running') {
    const myActiveJokers = (session.activeJokers || {})[myPlayerId] || {}
    const timerExpired = timer.isExpired
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
          className="w-20 h-20 rounded-full bg-accent-green/15 border-[3px] border-accent-green flex items-center justify-center text-3xl mb-5"
        >✓</motion.div>
        <h2 className="text-xl font-bold mb-2">Réponse envoyée !</h2>
        {myActiveJokers.x2 && <div className="text-amber-400 font-bold mb-2">✖️2 Points doublés actifs !</div>}
        {timerExpired ? (
          <div className="text-slate-400">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              ⏳ Synchronisation en cours...
            </motion.div>
            <div className="text-xs text-slate-500 mt-2">Le résultat arrive bientôt</div>
          </div>
        ) : (
          <p className="text-slate-400 mb-4">En attente des autres joueurs...</p>
        )}
        {session?.settings?.enableReactions !== false && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">Réagis !</div>
            <ReactionBar onReact={sendReaction} />
          </div>
        )}
      </div>
    )
  }

  // === ANSWER SCREEN ===
  const handleChoice = (idx) => {
    if (q.type === 'multi') {
      setMultiSel(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])
      return
    }
    sfx.tick()
    submitAnswer(idx)
  }

  const handleTextSubmit = () => {
    if (!textInput.trim()) return
    sfx.tick()
    submitAnswer(textInput.trim())
  }

  const handleEstimateSubmit = () => {
    if (!estimateInput) return
    sfx.tick()
    submitAnswer(Number(estimateInput))
  }

  const handleMultiSubmit = () => {
    if (multiSel.length === 0) return
    sfx.tick()
    submitAnswer([...multiSel])
  }

  const handleBuzzer = async () => {
    if (buzzerPressed) return
    sfx.buzzer()
    setBuzzerPressed(true)
    const won = await pressBuzzer()
    if (won) {
      // Show text input for answer
    }
  }

  const isOnline = session?.displayMode === 'online'

  return (
    <div className="h-[100dvh] flex flex-col p-3 overflow-hidden">
      {/* Offline warning */}
      {isOffline && (
        <motion.div initial={{ y: -40 }} animate={{ y: 0 }}
          className="bg-accent-red/20 border border-accent-red/40 rounded-xl px-3 py-2 mb-2 text-center shrink-0">
          <span className="text-accent-red text-sm font-bold">📡 Connexion perdue — vos réponses seront envoyées dès le retour du WiFi</span>
        </motion.div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center px-2 mb-1 shrink-0">
        <span className="text-slate-400 text-sm">Q{qIdx + 1}/{quiz.questions.length}</span>
        <span className={`font-black text-xl font-mono ${timer.isUrgent ? 'text-accent-red animate-pulse' : 'text-brand'}`}>
          {timer.timeLeft}
        </span>
      </div>
      <div className="px-2 mb-2 shrink-0">
        <TimerBar progress={timer.progress} isUrgent={timer.isUrgent} />
      </div>

      {/* Scrollable question area */}
      <div className="overflow-y-auto shrink-0 max-h-[30vh]">
        {/* Badges */}
        <div className="text-center px-2">
        {q.mystery && (
          <div className="text-purple-400 font-bold text-xs mb-1 bg-purple-500/15 inline-block px-3 py-1 rounded-full">❓ MYSTÈRE — Points x2 !</div>
        )}
        {q.bet && (session.bets || {})[myPlayerId] && (
          <div className="text-emerald-400 font-bold text-xs mb-1 bg-emerald-500/15 inline-block px-3 py-1 rounded-full">🎰 Pari : {(session.bets[myPlayerId]).toLocaleString()} pts</div>
        )}
        {session?.bonusMultiplier > 1 && (
          <div className="text-cyan-400 font-bold text-xs mb-1 bg-cyan-500/15 inline-block px-3 py-1 rounded-full animate-pulse">🎲 BONUS x{session.bonusMultiplier}</div>
        )}
        {isOnline && q.category && (
          <div className="text-slate-300 text-xs mb-1 bg-white/10 inline-block px-3 py-1 rounded-full">📂 {q.category}</div>
        )}
      </div>

      {/* Question — bigger in online mode */}
      <div className={`text-center px-2 py-2 ${isOnline ? 'mb-3' : ''}`}>
        {q.chainHint && qIdx > 0 && (() => {
          const prevQ = session.quiz.questions[qIdx - 1]
          const prevAnswer = prevQ?.type === 'qcm' || prevQ?.type === 'truefalse'
            ? prevQ.choices?.[prevQ.correctAnswer]
            : String(prevQ?.correctAnswer || '')
          return prevAnswer ? (
            <div className="text-xs font-bold text-amber-400 mb-1">🔗 Indice : « {prevAnswer} »</div>
          ) : null
        })()}
        <div className={`font-semibold text-slate-300 ${isOnline ? 'text-lg leading-snug' : 'text-sm'}`}>{q.prompt}</div>
      </div>

      {/* Media — blind mode for blindtest (even online), visible for others */}
      {q.media && q.media.url && (
        <div className="px-3 mb-2">
          {q.type === 'blindtest' && q.blindtestMode === 'pixel' ? (
            <div style={{ filter: `blur(${[30, 20, 12, 5, 0][session.revealLevel || 0]}px)`, transition: 'filter 1s ease-out' }}>
              <MediaPlayer media={q.media} hideForPlayers={false} blindMode={false} autoPlay={false} />
            </div>
          ) : (
            <MediaPlayer
              media={q.media}
              hideForPlayers={!isOnline && q.type === 'blindtest'}
              blindMode={isOnline && q.type === 'blindtest'}
              autoPlay={isOnline}
            />
          )}
        </div>
      )}
      </div>{/* end scrollable question area */}

      {/* Jokers */}
      {q.type !== 'buzzer' && session?.settings?.enableJokers !== false && (
        <JokerBar
          jokers={getMyJokers()}
          activeJokers={(session.activeJokers || {})[myPlayerId] || {}}
          onUse={(type) => { sfx.tick(); useJoker(type) }}
          disabled={answered}
        />
      )}

      {/* QCM / TrueFalse / Multi / Blindtest choices */}
      {(q.type === 'qcm' || q.type === 'truefalse' || q.type === 'multi' || (q.type === 'blindtest' && (!q.blindtestMode || q.blindtestMode === 'qcm'))) && (() => {
        const myActiveJokers = (session.activeJokers || {})[myPlayerId] || {}
        const fiftyRemoved = myActiveJokers.fiftyRemoved || []
        return (
          <>
            <div className={`flex-1 grid ${q.choices.length <= 2 ? 'grid-cols-1' : 'grid-cols-2'} gap-3 px-2 content-center`}>
              {q.choices.map((choice, idx) => {
                if (fiftyRemoved.includes(idx)) {
                  // 50/50 removed — show disabled/crossed out
                  return (
                    <motion.div key={idx} initial={{ opacity: 1 }} animate={{ opacity: 0.2 }}
                      className="rounded-2xl p-4 text-center line-through text-slate-600 border border-dark-500/20"
                      style={{ background: CHOICE_COLORS[idx % CHOICE_COLORS.length] + '08' }}
                    >{choice}</motion.div>
                  )
                }
                return (
                  <ChoiceButton
                    key={idx}
                    index={idx}
                    label={choice}
                    selected={q.type === 'multi' ? multiSel.includes(idx) : false}
                    onClick={() => handleChoice(idx)}
                  />
                )
              })}
            </div>
            {q.type === 'multi' && (
              <div className="px-2 pt-3">
                <Btn onClick={handleMultiSubmit} disabled={multiSel.length === 0} className="w-full">
                  Valider ({multiSel.length} sélectionné{multiSel.length > 1 ? 's' : ''})
                </Btn>
              </div>
            )}
          </>
        )
      })()}

      {/* Text input */}
      {q.type === 'text' && (
        <div className="flex-1 flex flex-col justify-center px-4 gap-4">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Tapez votre réponse..."
            className="w-full text-center text-xl bg-white/5 border border-dark-500 rounded-2xl p-5 text-white outline-none focus:border-brand"
            autoFocus
          />
          <Btn onClick={handleTextSubmit} disabled={!textInput.trim()} className="w-full">
            ✏️ Envoyer
          </Btn>
        </div>
      )}

      {/* Reverse — text input mode */}
      {q.type === 'blindtest' && q.blindtestMode === 'reverse' && q.reverseAnswerMode === 'text' && (
        <div className="flex-1 flex flex-col justify-center px-4 gap-4">
          <div className="text-center text-rose-400 font-bold text-sm">🔄 Audio inversé — Quel est ce titre ?</div>
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Tapez le titre..."
            className="w-full text-center text-xl bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-white outline-none focus:border-rose-400"
            autoFocus
          />
          <Btn onClick={handleTextSubmit} disabled={!textInput.trim()} className="w-full bg-rose-600 hover:bg-rose-500">
            🔄 Envoyer
          </Btn>
        </div>
      )}

      {/* Reverse — QCM mode */}
      {q.type === 'blindtest' && q.blindtestMode === 'reverse' && q.reverseAnswerMode === 'qcm' && q.choices && (
        <div className="flex-1 flex flex-col justify-center px-3 gap-3">
          <div className="text-center text-rose-400 font-bold text-sm mb-1">🔄 Audio inversé — Quel est ce titre ?</div>
          {q.choices.map((choice, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={() => { sfx.tick(); submitAnswer(idx) }}
              className="w-full rounded-2xl py-4 px-5 font-bold text-lg text-left transition-all border"
              style={{
                background: CHOICE_COLORS[idx] + '15',
                borderColor: CHOICE_COLORS[idx] + '40',
                color: CHOICE_COLORS[idx],
              }}
            >
              <span className="mr-3 opacity-60">{CHOICE_SHAPES[idx]}</span>
              {choice}
            </motion.button>
          ))}
        </div>
      )}

      {/* Karaoke input */}
      {/* Karaoke — phase 1: listening (during preMedia) */}
      {q.type === 'karaoke' && status === 'preMedia' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-6xl">🎤</motion.div>
          <div className="text-purple-400 font-bold text-lg">🎵 Écoutez bien...</div>
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
            className="text-slate-500 text-sm">Les paroles arrivent après !</motion.div>
        </div>
      )}

      {/* Karaoke — phase 2: answer input (during running) */}
      {q.type === 'karaoke' && status !== 'preMedia' && (
        <div className="flex-1 flex flex-col justify-center px-4 gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
            className="text-center text-4xl mb-2">🎤</motion.div>
          <div className="text-center text-slate-400 text-sm mb-2">Complétez les paroles !</div>
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Mot(s) manquant(s)..."
            className="w-full text-center text-xl bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5 text-white outline-none focus:border-purple-400"
            autoFocus
          />
          <Btn onClick={handleTextSubmit} disabled={!textInput.trim()} className="w-full bg-purple-600 hover:bg-purple-500">
            🎤 Envoyer
          </Btn>
        </div>
      )}

      {/* Estimate input */}
      {(q.type === 'estimate' || (q.type === 'blindtest' && q.blindtestMode === 'estimate')) && (
        <div className="flex-1 flex flex-col justify-center px-4 gap-4">
          <div className="text-center text-slate-400 text-sm mb-2">Entrez votre estimation (nombre)</div>
          <input
            type="number"
            value={estimateInput}
            onChange={e => setEstimateInput(e.target.value)}
            placeholder="42"
            className="w-full text-center text-4xl font-black font-mono bg-white/5 border border-dark-500 rounded-2xl p-5 text-brand outline-none focus:border-brand"
            autoFocus
          />
          <Btn onClick={handleEstimateSubmit} disabled={!estimateInput} className="w-full">
            🔢 Valider
          </Btn>
        </div>
      )}

      {/* Geo map input */}
      {q.type === 'geo' && (
        <div className="flex-1 flex flex-col px-2 gap-2">
          <div className="text-center text-slate-400 text-xs mb-1">📍 Pointez sur la carte !</div>
          <GeoMap
            selected={geoSelection}
            onSelect={(coords) => setGeoSelection(coords)}
          />
          {geoSelection && (
            <div className="text-center text-xs text-brand font-mono">
              📍 {geoSelection.lat}°, {geoSelection.lng}°
            </div>
          )}
          <Btn onClick={() => { if (geoSelection) { sfx.tick(); submitAnswer(geoSelection) } }} disabled={!geoSelection} className="w-full">
            🗺️ Valider
          </Btn>
        </div>
      )}

      {/* ====== ORDER — drag to reorder ====== */}
      {q.type === 'order' && (() => {
        const items = q.orderItems || []
        // Initialize shuffled order once
        if (!orderState) {
          const shuffled = [...items].map((item, i) => ({ item, origIdx: i }))
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          setOrderState(shuffled)
          return <div className="text-center text-slate-400 py-8">Chargement...</div>
        }
        const moveItem = (fromIdx, toIdx) => {
          if (toIdx < 0 || toIdx >= orderState.length) return
          const newOrder = [...orderState]
          const [moved] = newOrder.splice(fromIdx, 1)
          newOrder.splice(toIdx, 0, moved)
          setOrderState(newOrder)
        }
        return (
          <div className="flex-1 flex flex-col px-3 gap-2 py-2">
            <div className="text-center text-slate-400 text-xs mb-1">📊 Remettez dans le bon ordre !</div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {orderState.map((entry, idx) => (
                <div key={entry.origIdx} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-3">
                  <span className="text-orange-400 font-bold text-sm w-6 text-center">{idx + 1}</span>
                  <span className="flex-1 text-sm font-semibold text-white">{entry.item}</span>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveItem(idx, idx - 1)} disabled={idx === 0}
                      className={`text-xs px-2 py-1 rounded ${idx === 0 ? 'text-slate-600' : 'text-slate-300 bg-white/10 active:bg-white/20'}`}>▲</button>
                    <button onClick={() => moveItem(idx, idx + 1)} disabled={idx === orderState.length - 1}
                      className={`text-xs px-2 py-1 rounded ${idx === orderState.length - 1 ? 'text-slate-600' : 'text-slate-300 bg-white/10 active:bg-white/20'}`}>▼</button>
                  </div>
                </div>
              ))}
            </div>
            <Btn onClick={() => { sfx.tick(); submitAnswer(orderState.map(e => e.item)) }} className="w-full">
              📊 Valider l'ordre
            </Btn>
          </div>
        )
      })()}

      {/* ====== MATCH — connect pairs ====== */}
      {q.type === 'match' && (() => {
        const pairs = q.matchPairs || []
        // Initialize shuffled right column once
        if (!matchState) {
          const rightShuffled = pairs.map((p, i) => ({ text: p.right, origIdx: i }))
          for (let i = rightShuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rightShuffled[i], rightShuffled[j]] = [rightShuffled[j], rightShuffled[i]]
          }
          setMatchState({ right: rightShuffled, selected: {}, activeLeft: null })
          return <div className="text-center text-slate-400 py-8">Chargement...</div>
        }
        const { right, selected, activeLeft } = matchState
        const handleLeftTap = (idx) => {
          setMatchState({ ...matchState, activeLeft: activeLeft === idx ? null : idx })
        }
        const handleRightTap = (rightIdx) => {
          if (activeLeft === null) return
          const actualRightIdx = right[rightIdx].origIdx
          const newSelected = { ...selected, [String(activeLeft)]: actualRightIdx }
          setMatchState({ ...matchState, selected: newSelected, activeLeft: null })
        }
        const allMatched = Object.keys(selected).length === pairs.length
        return (
          <div className="flex-1 flex flex-col px-3 gap-2 py-2">
            <div className="text-center text-slate-400 text-xs mb-1">🔗 Associez chaque paire !</div>
            <div className="text-center text-xs text-slate-500 mb-1">Tapez un élément à gauche, puis son correspondant à droite</div>
            <div className="flex-1 flex gap-3 overflow-y-auto">
              {/* Left column */}
              <div className="flex-1 flex flex-col gap-2">
                {pairs.map((p, idx) => {
                  const isActive = activeLeft === idx
                  const isMatched = selected[String(idx)] !== undefined
                  return (
                    <button key={idx} onClick={() => handleLeftTap(idx)}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold text-left transition-all border ${isActive ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : isMatched ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white'}`}>
                      {p.left} {isMatched && '✓'}
                    </button>
                  )
                })}
              </div>
              {/* Right column */}
              <div className="flex-1 flex flex-col gap-2">
                {right.map((r, idx) => {
                  const isUsed = Object.values(selected).includes(r.origIdx)
                  return (
                    <button key={idx} onClick={() => handleRightTap(idx)}
                      disabled={activeLeft === null}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold text-left transition-all border ${isUsed ? 'bg-green-500/10 border-green-500/30 text-green-400' : activeLeft !== null ? 'bg-white/5 border-cyan-500/30 text-white hover:bg-cyan-500/10' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                      {r.text} {isUsed && '✓'}
                    </button>
                  )
                })}
              </div>
            </div>
            <Btn onClick={() => { sfx.tick(); submitAnswer(selected) }} disabled={!allMatched} className="w-full">
              🔗 Valider les associations
            </Btn>
          </div>
        )
      })()}

      {/* ====== ZOOM — same as buzzer ====== */}
      {q.type === 'zoom' && !buzzerPressed && !(session.buzzerPenalized || []).includes(myPlayerId) && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleBuzzer}
            className="w-48 h-48 rounded-full bg-gradient-to-br from-pink-500 to-pink-800 text-white text-3xl font-black shadow-2xl shadow-pink-500/40 flex items-center justify-center border-4 border-pink-400/30"
          >
            🔍<br/>BUZZ !
          </motion.button>
          <div className="text-slate-400 mt-6 text-sm">Vous reconnaissez ? Buzzez !</div>
        </div>
      )}
      {q.type === 'zoom' && (session.buzzerPenalized || []).includes(myPlayerId) && !buzzerPressed && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-5xl mb-3">🚫</div>
          <div className="text-accent-red font-bold text-lg">Déjà tenté</div>
        </div>
      )}
      {q.type === 'zoom' && buzzerPressed && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-6xl mb-4">⏳</motion.div>
          <div className="text-slate-400 font-semibold">Le Host vérifie votre réponse...</div>
        </div>
      )}

      {/* Buzzer (also for blindtest buzzer mode) */}
      {(q.type === 'buzzer' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer'))))) && !buzzerPressed && !(session.buzzerPenalized || []).includes(myPlayerId) && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleBuzzer}
            className="w-48 h-48 rounded-full bg-gradient-to-br from-accent-red to-red-800 text-white text-3xl font-black shadow-2xl shadow-red-500/40 flex items-center justify-center border-4 border-red-400/30"
          >
            🔔<br/>BUZZ !
          </motion.button>
          <div className="text-slate-400 mt-6 text-sm">Appuyez le premier !</div>
        </div>
      )}

      {/* Buzzer - penalized (already tried and failed) */}
      {(q.type === 'buzzer' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer'))))) && (session.buzzerPenalized || []).includes(myPlayerId) && !buzzerPressed && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-5xl mb-3">🚫</div>
          <div className="text-accent-red font-bold text-lg">Vous avez déjà tenté votre chance</div>
          <div className="text-slate-400 text-sm mt-2">Attendez la prochaine question</div>
        </div>
      )}

      {(q.type === 'buzzer' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer'))))) && buzzerPressed && (
        <div className="flex-1 flex flex-col justify-center px-4 gap-4 items-center text-center">
          {session.buzzerWinner === myPlayerId ? (
            <>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                <div className="text-6xl mb-3">⚡</div>
              </motion.div>
              <div className="text-accent-cyan font-black text-2xl">Vous avez le buzzer !</div>
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-slate-400 text-lg">
                🎤 Répondez à voix haute !
              </motion.div>
              <div className="text-slate-500 text-sm mt-2">L'animateur valide votre réponse...</div>
            </>
          ) : (
            <div className="text-center text-slate-400">
              <div className="text-3xl mb-2">⏳</div>
              {session.buzzerWinner ? (
                <div>
                  <span className="font-bold text-accent-cyan">{players[session.buzzerWinner]?.name}</span> a buzzé...
                  <div className="text-xs text-slate-500 mt-1">En attente du verdict de l'animateur</div>
                </div>
              ) : (
                'Un autre joueur a buzzé en premier...'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
