import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, Btn, TimerBar, Scoreboard, TeamScoreboard, AliveCounter } from '../components/UI'
import MusicPlayer from '../components/MusicPlayer'
import BonusWheel from '../components/BonusWheel'
import Soundboard from '../components/Soundboard'
import { useStore } from '../hooks/useSession'
import { useTimer } from '../hooks/useTimer'
import { useSound } from '../hooks/useSound'
import { QUESTION_TYPES, TEAM_COLORS, getTeamName } from '../lib/constants'

export default function HostGame({ onNavigate, onOpenScreen }) {
  const { session, players, answers, reveal, showScoreboard, goQuestion, endGame, getSorted, getAnswerCount, getTeamScores, getAliveCount, startMedia, startStealPhase, applySteal, finishSteal, buzzerCorrect, buzzerWrong, buzzerReveal, closeBets, confirmBonusWheel, confirmDestinyWheel, launchDuelQuestion, resolveDuelMatch, nextDuelMatch, startCategoryPick, submitCategoryPick } = useStore()
  const sfx = useSound()
  const [penaltyInput, setPenaltyInput] = useState(200)

  const qIdx = session?.currentQuestionIndex ?? -1
  const quiz = session?.quiz
  const q = qIdx >= 0 ? quiz?.questions[qIdx] : null
  const status = session?.status
  const totalQ = quiz?.questions?.length || 0

  const timer = useTimer(session?.questionStartTimestamp, q?.timerSeconds, status === 'running')

  const isSpeedRun = session?.gameMode === 'speedRun'

  // Auto-reveal when timer expires (not for buzzer — Host controls)
  useEffect(() => {
    if (timer.isExpired && status === 'running' && !isBuzzer) {
      reveal()
    }
  }, [timer.isExpired, status])

  // Speed Run: auto-reveal when all players answered
  useEffect(() => {
    if (isSpeedRun && status === 'running' && getAnswerCount() >= Object.keys(players).length && Object.keys(players).length > 0) {
      reveal()
    }
  }, [isSpeedRun, status, Object.keys(answers).length])

  // Speed Run: auto-advance 3 seconds after revealing
  useEffect(() => {
    if (isSpeedRun && status === 'revealing') {
      const t = setTimeout(() => {
        const next = qIdx + 1
        if (next >= totalQ) {
          sfx.podium()
          goQuestion(next)
          onNavigate('results')
        } else {
          goQuestion(next)
        }
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [isSpeedRun, status])

  // Watchdog: if countdown is stuck for more than 6s, force transition
  useEffect(() => {
    if (status !== 'countdown' || !session?.countdownStartedAt) return
    const checkStuck = setInterval(() => {
      const elapsed = (Date.now() - session.countdownStartedAt)
      if (elapsed > 6000) {
        useStore.getState().forceCountdownEnd()
        clearInterval(checkStuck)
      }
    }, 2000)
    return () => clearInterval(checkStuck)
  }, [status, session?.countdownStartedAt])

  if (!session || !quiz) return null

  const sorted = getSorted()
  const answerCount = getAnswerCount()
  const playerCount = Object.keys(players).length
  const qType = QUESTION_TYPES[q?.type] || {}
  const isBuzzer = q?.type === 'buzzer' || q?.type === 'zoom' || (q?.type === 'blindtest' && (q?.blindtestMode === 'buzzer' || q?.blindtestMode === 'progressive' || q?.blindtestMode === 'pixel' || (q?.blindtestMode === 'reverse' && (!q?.reverseAnswerMode || q?.reverseAnswerMode === 'buzzer'))))
  const isProgressive = q?.type === 'blindtest' && q?.blindtestMode === 'progressive'
  const isPixel = q?.type === 'blindtest' && q?.blindtestMode === 'pixel'
  const isZoom = q?.type === 'zoom'
  const revealLevel = session.revealLevel || 0
  const { setRevealLevel } = useStore()
  const buzzerWinner = session.buzzerWinner
  const buzzerPlayer = buzzerWinner ? players[buzzerWinner] : null

  const isDuel = session.gameMode === 'duel'

  const handleNext = async () => {
    sfx.launch()
    if (isDuel) {
      // In duel mode, after scoreboard → go to next match
      await nextDuelMatch()
      return
    }
    const next = qIdx + 1
    if (next >= totalQ) {
      sfx.podium()
      await goQuestion(next)
      onNavigate('results')
      return
    }
    await goQuestion(next)
  }

  const handleEnd = () => {
    endGame()
    onNavigate('landing')
  }

  const handleReveal = async () => {
    if (isDuel) {
      await reveal() // score it normally first
      // Then resolve the duel match
      setTimeout(() => resolveDuelMatch(), 2000) // small delay to show correct answer
      return
    }
    await reveal()
  }

  // After reveal, check if this is a steal question
  const isStealQ = q?.steal && session?.teamMode
  const stealData = session?.stealData

  // Correct answer display
  const correctText = q ? (
    q.type === 'multi' ? q.correctAnswer.map(i => q.choices[i]).join(', ')
    : q.type === 'estimate' ? q.correctAnswer
    : q.type === 'buzzer' ? q.correctAnswer
    : q.type === 'text' ? (Array.isArray(q.correctAnswer) ? q.correctAnswer.join(' / ') : q.correctAnswer)
    : q.choices?.[q.correctAnswer] || '?'
  ) : ''

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[700px] mx-auto">

        {/* === DUEL MODE SCREENS === */}
        {session.gameMode === 'duel' && status === 'duelIntro' && session.duel && (() => {
          const duel = session.duel
          const round = duel.rounds[duel.currentRound]
          const match = round[duel.currentMatch]
          const p1 = players[match.player1]
          const p2 = match.player2 ? players[match.player2] : null
          const roundNames = ['🏟️ Tour 1', '⚔️ Quarts', '🔥 Demis', '🏆 FINALE']
          const roundName = roundNames[Math.min(duel.currentRound, roundNames.length - 1)]
          const totalMatches = round.filter(m => !m.winner || m === match).length

          return (
            <Card className="mb-5 text-center py-8">
              <div className="text-sm text-slate-400 uppercase font-bold mb-2">{roundName} — Match {duel.currentMatch + 1}/{round.length}</div>
              <div className="flex items-center justify-center gap-6 my-6">
                <div className="text-center">
                  <div className="text-5xl mb-2">{p1?.avatar || '?'}</div>
                  <div className="font-bold text-lg">{p1?.name || '?'}</div>
                </div>
                <div className="text-3xl font-black text-brand">⚔️</div>
                <div className="text-center">
                  {p2 ? (
                    <>
                      <div className="text-5xl mb-2">{p2.avatar}</div>
                      <div className="font-bold text-lg">{p2.name}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-2 opacity-30">👤</div>
                      <div className="font-bold text-lg text-slate-500">Bye</div>
                    </>
                  )}
                </div>
              </div>

              {/* Bracket mini preview */}
              <div className="bg-white/5 rounded-xl p-3 mb-6">
                <div className="text-xs text-slate-400 font-bold mb-2">Bracket</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {round.map((m, mi) => {
                    const mp1 = players[m.player1]
                    const mp2 = m.player2 ? players[m.player2] : null
                    const isCurrent = mi === duel.currentMatch
                    return (
                      <div key={mi} className={`text-xs px-2 py-1 rounded-lg ${isCurrent ? 'bg-brand/20 border border-brand/40 text-brand' : m.winner ? 'bg-white/5 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                        {mp1?.name?.slice(0, 6) || '?'} vs {mp2?.name?.slice(0, 6) || 'bye'}
                        {m.winner && !isCurrent && <span className="ml-1">✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Btn onClick={() => { sfx.launch(); launchDuelQuestion() }}>⚔️ Lancer le duel !</Btn>
            </Card>
          )
        })()}

        {session.gameMode === 'duel' && status === 'duelResult' && session.duelMatchResult && (() => {
          const r = session.duelMatchResult
          const pw = players[r.winner]
          const pl = players[r.winner === r.player1 ? r.player2 : r.player1]
          const p1 = players[r.player1]
          const p2 = players[r.player2]
          return (
            <Card className="mb-5 text-center py-8">
              <div className="text-4xl mb-3">⚔️</div>
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className={`text-center ${r.winner === r.player1 ? '' : 'opacity-40'}`}>
                  <div className="text-4xl mb-1">{p1?.avatar}</div>
                  <div className="font-bold">{p1?.name}</div>
                  <div className={`text-sm mt-1 ${r.correct1 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {r.correct1 ? '✅' : '❌'} {r.time1 ? `${r.time1.toFixed(1)}s` : 'Ø'}
                  </div>
                </div>
                <div className="text-2xl font-black text-brand">VS</div>
                <div className={`text-center ${r.winner === r.player2 ? '' : 'opacity-40'}`}>
                  <div className="text-4xl mb-1">{p2?.avatar}</div>
                  <div className="font-bold">{p2?.name}</div>
                  <div className={`text-sm mt-1 ${r.correct2 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {r.correct2 ? '✅' : '❌'} {r.time2 ? `${r.time2.toFixed(1)}s` : 'Ø'}
                  </div>
                </div>
              </div>
              <div className="text-lg font-black text-brand mb-1">🎉 {pw?.name} remporte le duel !</div>
              <div className="text-slate-400 text-sm mb-6">{pl?.name} est éliminé</div>
              <Btn onClick={() => nextDuelMatch()}>➡️ Match suivant</Btn>
            </Card>
          )
        })()}

        {/* Header + game content (hidden during duel intro/result) */}
        {status !== 'duelIntro' && status !== 'duelResult' && (<>
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-slate-400 text-xs">Question</div>
            <div className="font-extrabold text-xl">{qIdx + 1} / {totalQ}</div>
          </div>
          <div className="flex gap-2">
            <MusicPlayer compact />
            {session.displayMode !== 'online' && <Btn variant="ghost" size="sm" onClick={onOpenScreen}>📺</Btn>}
            <Btn variant="danger" size="sm" onClick={handleEnd}>Fin</Btn>
          </div>
        </div>

        {/* Prediction phase — "Je te mets combien ?" */}
        {status === 'prediction' && (
          <Card className="mb-5 text-center py-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
              <div className="text-5xl mb-3">🎯</div>
              <div className="text-xl font-bold text-amber-400 mb-2">Je te mets combien ?</div>
              <div className="text-slate-400 mb-1">
                Chaque joueur prédit son nombre de bonnes réponses
              </div>
              <div className="text-slate-500 text-sm mb-4">
                {session.quiz?.questions?.length} questions au total
              </div>
              <div className="text-2xl font-black text-brand mb-4">
                {Object.keys(session.predictions || {}).length} / {Object.keys(players).length} prédictions
              </div>
              {Object.entries(session.predictions || {}).map(([pid, val]) => (
                <div key={pid} className="inline-flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 m-1 text-sm">
                  <span>{players[pid]?.avatar}</span>
                  <span className="font-semibold">{players[pid]?.name}</span>
                  <span className="text-amber-400 font-bold">→ {val}</span>
                </div>
              ))}
              <div className="mt-4">
                <Btn onClick={() => { sfx.launch(); useStore.getState().closePredictions() }} className="!bg-amber-600">
                  🚀 C'est parti !
                </Btn>
              </div>
            </motion.div>
          </Card>
        )}

        {/* Betting phase */}
        {status === 'betting' && (
          <Card className="mb-5 text-center py-6">
            <div className="text-4xl mb-3">🎰</div>
            <div className="text-xl font-bold text-emerald-400 mb-2">Phase de Paris</div>
            <div className="text-slate-400 mb-4">
              {Object.keys(session.bets || {}).length}/{Object.keys(players).length} paris placés
            </div>
            <Btn onClick={() => { sfx.launch(); closeBets() }} className="!bg-emerald-600">
              🎯 Fermer les paris et lancer !
            </Btn>
          </Card>
        )}

        {/* Bonus Wheel phase */}
        {status === 'bonusWheel' && (
          <Card className="mb-5 text-center py-6">
            <div className="text-xl font-bold text-cyan-400 mb-4">🎲 Roue Bonus !</div>
            <BonusWheel
              autoSpin
              onResult={(mult) => {
                sfx.launch()
                // Auto-confirm after 1.5s delay for dramatic effect
                setTimeout(() => confirmBonusWheel(mult), 1500)
              }}
            />
          </Card>
        )}

        {/* Destiny Wheel phase */}
        {status === 'destinyWheel' && session.destinyPlayer && (
          <Card className="mb-5 text-center py-6">
            <div className="text-4xl mb-3">🎰</div>
            <div className="text-xl font-bold text-red-400 mb-2">Roue du Destin !</div>
            <div className="flex items-center gap-2 justify-center mb-3">
              <span className="text-3xl">{players[session.destinyPlayer]?.avatar}</span>
              <span className="font-black text-lg">{players[session.destinyPlayer]?.name}</span>
            </div>
            <div className="text-slate-400 text-sm mb-4">Ce joueur répond seul ! Double ou rien !</div>
            <Btn onClick={() => { sfx.launch(); confirmDestinyWheel() }}>⚡ Lancer la question !</Btn>
          </Card>
        )}

        {/* Category Pick phase */}
        {status === 'categoryPick' && session.categoryPickData && (() => {
          const picker = players[session.categoryPickData.pickerId]
          const chosen = session.categoryPickData.chosen
          return (
            <Card className="mb-5 text-center py-6">
              <div className="text-4xl mb-3">👑</div>
              <div className="text-xl font-bold text-amber-400 mb-1">
                {picker?.avatar} {picker?.name} choisit !
              </div>
              {chosen ? (
                <>
                  <div className="text-lg text-brand font-bold mt-3">📂 {chosen}</div>
                  <div className="text-slate-400 text-sm mt-1">Catégorie choisie !</div>
                  <Btn className="mt-4" onClick={handleNext}>➡️ Lancer la question</Btn>
                </>
              ) : (
                <div className="text-slate-400 mt-2">En attente du choix...</div>
              )}
            </Card>
          )
        })()}

        {/* Presenter note (shown to Host only when question is active) */}
        {q?.presenterNote && (status === 'running' || status === 'countdown' || status === 'preMedia' || status === 'betting' || status === 'bonusWheel' || status === 'destinyWheel' || status === 'roundIntro') && (
          <Card className="mb-3 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <span className="text-lg">🎙️</span>
              <div>
                <div className="text-xs text-amber-400 font-bold mb-0.5">Note présentateur</div>
                <div className="text-sm text-amber-200">{q.presenterNote}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Round Intro */}
        {status === 'roundIntro' && session.roundIntroData && (
          <Card className="mb-5 text-center py-8">
            <div className="text-slate-500 text-sm font-bold tracking-widest uppercase mb-2">ROUND {session.roundIntroData.roundNum}</div>
            <div className="text-3xl font-black text-brand mb-2">{session.roundIntroData.category}</div>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-4xl my-3">📂</motion.div>
            <div className="text-slate-400 text-sm">L'animation se joue sur le Screen TV...</div>
          </Card>
        )}

        {/* Countdown */}
        {status === 'countdown' && (
          <Card className="mb-5 text-center py-8">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
              className="text-5xl mb-3">⏳</motion.div>
            <div className="text-xl font-bold text-brand">Compte à rebours en cours...</div>
            <div className="text-slate-400 text-sm mt-1">Question {qIdx + 1} — {q?.prompt}</div>
          </Card>
        )}

        {/* Special badges */}
        {isStealQ && (status === 'running' || status === 'preMedia') && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-amber-400 font-bold">🏴‍☠️ QUESTION VOL — {q.stealPoints || q.points} pts à voler !</span>
          </motion.div>
        )}
        {q?.mystery && (status === 'running' || status === 'preMedia') && (
          <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-purple-400 font-bold">❓ QUESTION MYSTÈRE — Tous les points sont doublés !</span>
          </div>
        )}
        {q?.bet && (status === 'running' || status === 'preMedia') && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-emerald-400 font-bold">🎰 QUESTION PARI — {Object.keys(session.bets || {}).length} paris actifs</span>
          </div>
        )}
        {session?.bonusMultiplier > 1 && (status === 'running' || status === 'preMedia') && (
          <div className="bg-cyan-500/15 border border-cyan-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-cyan-400 font-bold">🎲 BONUS x{session.bonusMultiplier} — Tous les points multipliés !</span>
          </div>
        )}

        {/* Destiny player badge */}
        {session?.destinyPlayer && (status === 'running' || status === 'preMedia') && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-red-400 font-bold">🎰 {players[session.destinyPlayer]?.avatar} {players[session.destinyPlayer]?.name} répond SEUL — Double ou rien !</span>
          </div>
        )}

        {/* Question Card */}
        {q && (
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{qType.icon}</span>
              <span className="text-xs text-slate-400 uppercase font-semibold">{qType.label}</span>
              {q.category && <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-lg">📂 {q.category}</span>}
              {isStealQ && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg font-bold">🏴‍☠️ VOL</span>}
            </div>
            <div className="text-lg font-semibold mb-4">{q.prompt}</div>

            {/* Answer count */}
            {!isBuzzer && (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-black text-brand">{answerCount}</span>
                <span className="text-slate-400 text-sm">/ {playerCount} réponses</span>
                {session.gameMode === 'suddenDeath' && (
                  <AliveCounter alive={getAliveCount()} total={playerCount} />
                )}
              </div>
            )}

            {/* Pre-Media */}
            {status === 'preMedia' && (
              <>
                {q.type === 'karaoke' ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5 mb-4 text-center">
                    <div className="text-3xl mb-2">🎤</div>
                    <div className="text-purple-400 font-bold mb-1">Karaoké</div>
                    {q.media?.url ? (
                      <div className="text-slate-400 text-sm">La musique joue... Quand l'extrait est fini, lancez les paroles !</div>
                    ) : (
                      <div className="text-slate-400 text-sm">Lancez les paroles quand vous êtes prêt !</div>
                    )}
                  </motion.div>
                ) : (q.media?.type === 'spotify' || q.media?.url?.includes('spotify.com')) ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-4 text-center">
                    <div className="text-3xl mb-2">🎵</div>
                    <div className="text-green-400 font-bold mb-1">Spotify</div>
                    <div className="text-slate-400 text-sm mb-1">1. Appuyez sur ▶ Play <span className="font-bold text-white">sur l'écran TV</span></div>
                    <div className="text-slate-400 text-sm">2. Puis cliquez le bouton ci-dessous pour lancer le timer</div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-accent-purple/10 border border-accent-purple/30 rounded-xl p-5 mb-4 text-center">
                    <div className="text-3xl mb-2">{q.media?.url?.includes('youtu') ? '🎬' : '🎵'}</div>
                    <div className="text-accent-purple font-bold mb-1">Média prêt</div>
                    <div className="text-slate-400 text-sm">Le média se lancera automatiquement</div>
                  </motion.div>
                )}
                <Btn onClick={() => { sfx.launch(); startMedia() }} className="w-full animate-glow">
                  {q.type === 'karaoke' ? '🎤 Afficher les paroles !' : '⏱️ Lancer le timer !'}
                </Btn>
              </>
            )}

            {/* === BUZZER HOST CONTROL === */}
            {isBuzzer && status === 'running' && (
              <div className="mb-4">
                {/* Progressive / Pixel reveal controls */}
                {(isProgressive || isPixel || isZoom) && !buzzerPlayer && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                    <div className="text-sm font-bold text-purple-400 mb-3">
                      {isProgressive ? '🎵 Dévoilement progressif' : isZoom ? '🔍 Dézoom progressif' : '🖼️ Image progressive'}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {(isProgressive
                        ? [
                            { level: 0, label: '2s', pts: 1000 },
                            { level: 1, label: '5s', pts: 750 },
                            { level: 2, label: '10s', pts: 500 },
                            { level: 3, label: '20s', pts: 250 },
                          ]
                        : isZoom
                        ? [
                            { level: 0, label: '🔬 x8', pts: 1000 },
                            { level: 1, label: '🔍 x5', pts: 800 },
                            { level: 2, label: '👀 x3', pts: 600 },
                            { level: 3, label: '📷 x1.5', pts: 400 },
                            { level: 4, label: '🖼️ Normal', pts: 200 },
                          ]
                        : [
                            { level: 0, label: '💎 Ultra flou', pts: 1000 },
                            { level: 1, label: '🔷 Très flou', pts: 800 },
                            { level: 2, label: '🔶 Flou', pts: 600 },
                            { level: 3, label: '🟡 Léger flou', pts: 400 },
                            { level: 4, label: '✨ Net', pts: 200 },
                          ]
                      ).map(step => (
                        <button
                          key={step.level}
                          onClick={() => setRevealLevel(step.level)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${revealLevel === step.level
                            ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                            : revealLevel > step.level
                              ? 'bg-white/5 border-white/10 text-slate-600 line-through'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:border-purple-500/50'
                          }`}
                        >
                          <div>{step.label}</div>
                          <div className="text-[10px] opacity-70">{step.pts} pts</div>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 text-center">
                      Palier actuel : <span className="text-purple-400 font-bold">
                        {isProgressive
                          ? ['2 secondes — 1000pts', '5 secondes — 750pts', '10 secondes — 500pts', '20 secondes — 250pts'][revealLevel]
                          : isZoom
                          ? ['Zoom x8 — 1000pts', 'Zoom x5 — 800pts', 'Zoom x3 — 600pts', 'Zoom x1.5 — 400pts', 'Normal — 200pts'][revealLevel]
                          : ['Ultra flou — 1000pts', 'Très flou — 800pts', 'Flou — 600pts', 'Léger flou — 400pts', 'Net — 200pts'][revealLevel]
                        }
                      </span>
                    </div>
                  </div>
                )}
                {buzzerPlayer ? (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-xl p-5 mb-4 text-center">
                      <div className="text-5xl mb-2">{buzzerPlayer.avatar}</div>
                      <div className="text-2xl font-black text-accent-cyan mb-1">⚡ {buzzerPlayer.name} a buzzé !</div>
                      {buzzerPlayer.team && (
                        <div className="text-sm text-slate-400">Équipe : {TEAM_COLORS.find(t => t.id === buzzerPlayer.team)?.name || buzzerPlayer.team}</div>
                      )}
                      <div className="text-sm text-slate-400 mt-2">Le joueur répond à voix haute...</div>
                    </div>
                    <div className="flex gap-3 mb-3">
                      <Btn onClick={() => { sfx.correct(); buzzerCorrect() }} className="flex-1 !bg-accent-green hover:!bg-accent-green/80">
                        ✅ Correct ! (+{q.points || 1000} pts)
                      </Btn>
                      <Btn variant="danger" onClick={() => { sfx.wrong(); buzzerWrong(penaltyInput) }} className="flex-1">
                        ❌ Faux !
                      </Btn>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-slate-400">Pénalité si faux :</span>
                      <input type="number" min="0" step="50" value={penaltyInput} onChange={e => setPenaltyInput(Number(e.target.value) || 0)}
                        className="w-24 bg-white/5 border border-dark-500 rounded-lg px-2 py-1 text-sm text-white outline-none" />
                      <span className="text-xs text-slate-400">pts</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-6">
                    <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-6xl mb-3">🔔</motion.div>
                    <div className="text-slate-400 font-semibold">En attente de buzz...</div>
                    {(session.buzzerPenalized || []).length > 0 && (
                      <div className="text-xs text-accent-red mt-2">
                        Éliminés : {session.buzzerPenalized.map(pid => players[pid]?.name || '?').join(', ')}
                      </div>
                    )}
                    <Btn variant="ghost" onClick={buzzerReveal} className="mt-4">
                      🔓 Révéler la réponse (personne n'a trouvé)
                    </Btn>
                  </div>
                )}
              </div>
            )}

            {/* Timer (non-buzzer) */}
            {!isBuzzer && status === 'running' && (
              <>
                <TimerBar progress={timer.progress} isUrgent={timer.isUrgent} />
                <div className={`text-center text-2xl font-black font-mono mt-2 ${timer.isUrgent ? 'text-accent-red animate-pulse' : 'text-brand'}`}>
                  {timer.timeLeft}s
                </div>
                <Btn onClick={handleReveal} className="w-full mt-4">✅ Révéler la réponse</Btn>
              </>
            )}

            {/* Revealing (standard — before steal) */}
            {status === 'revealing' && (
              <>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-4 mb-4">
                  <div className="text-accent-green font-bold mb-1">✅ Bonne réponse</div>
                  <div className="font-semibold">{correctText}</div>
                </motion.div>
                <div className="flex gap-3">
                  {isStealQ ? (
                    <Btn onClick={() => { sfx.buzzer(); startStealPhase() }} className="flex-1 !bg-amber-500 hover:!bg-amber-600 animate-glow">
                      🏴‍☠️ Lancer le Vol !
                    </Btn>
                  ) : (
                    <>
                      <Btn variant="ghost" className="flex-1" onClick={showScoreboard}>📊 Classement</Btn>
                      <Btn className="flex-1" onClick={handleNext}>
                        {qIdx + 1 >= totalQ ? '🏆 Résultats' : '➡️ Suivante'}
                      </Btn>
                    </>
                  )}
                </div>
              </>
            )}

            {/* === STEALING PHASE === */}
            {status === 'stealing' && stealData && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-4 text-center">
                  <div className="text-3xl mb-2">🏴‍☠️</div>
                  <div className="text-amber-400 font-bold text-xl mb-2">Phase de Vol !</div>
                  <div className="text-slate-400 text-sm mb-3">
                    {stealData.stealPoints} points à voler
                  </div>

                  {/* Show which teams can steal */}
                  <div className="space-y-2 mb-3">
                    {stealData.winningTeams.map((tid, i) => {
                      const tc = TEAM_COLORS.find(t => t.id === tid)
                      const choice = stealData.steals?.[tid]
                      const targetTc = choice ? TEAM_COLORS.find(t => t.id === choice) : null
                      const isCurrent = i === stealData.currentStealerIndex
                      return (
                        <div key={tid} className={`flex items-center justify-between px-4 py-2 rounded-xl ${isCurrent ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5'}`}>
                          <div className="flex items-center gap-2">
                            <span>{tc?.emoji}</span>
                            <span className="font-bold" style={{ color: tc?.color }}>{getTeamName(tid, session)}</span>
                          </div>
                          {choice ? (
                            <span className="text-sm">→ vole {targetTc?.emoji} {targetTc?.name}</span>
                          ) : isCurrent ? (
                            <span className="text-amber-400 text-sm animate-pulse">Choisit sa cible...</span>
                          ) : (
                            <span className="text-slate-500 text-sm">En attente</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Losing teams */}
                  <div className="text-xs text-slate-500 mb-2">Équipes vulnérables :</div>
                  <div className="flex justify-center gap-2">
                    {stealData.losingTeams.map(tid => {
                      const tc = TEAM_COLORS.find(t => t.id === tid)
                      return <span key={tid} className="text-sm px-3 py-1 rounded-lg bg-white/5">{tc?.emoji} {getTeamName(tid, session)}</span>
                    })}
                  </div>
                </div>

                {/* All steals submitted? */}
                {stealData.currentStealerIndex >= stealData.winningTeams.length ? (
                  <Btn onClick={() => { sfx.launch(); applySteal() }} className="w-full animate-glow !bg-amber-500">
                    ⚡ Appliquer les vols !
                  </Btn>
                ) : (
                  <div className="text-center text-sm text-slate-400">En attente des choix des équipes sur leurs téléphones...</div>
                )}
              </motion.div>
            )}

            {/* Steal reveal animation */}
            {status === 'stealReveal' && (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-4 text-center">
                  <div className="text-3xl mb-2">🏴‍☠️💰</div>
                  <div className="text-amber-400 font-bold text-xl mb-3">Vol effectué !</div>
                  {(session.stealLog || []).map((s, i) => {
                    const fromTc = TEAM_COLORS.find(t => t.id === s.from)
                    const toTc = TEAM_COLORS.find(t => t.id === s.to)
                    return (
                      <motion.div key={i} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.5 }}
                        className="flex items-center justify-center gap-3 text-lg mb-2">
                        <span style={{ color: toTc?.color }}>{toTc?.emoji} {getTeamName(s.to, session)}</span>
                        <span className="text-amber-400 font-bold">vole {s.points} pts</span>
                        <span>à</span>
                        <span style={{ color: fromTc?.color }}>{fromTc?.emoji} {getTeamName(s.from, session)}</span>
                      </motion.div>
                    )
                  })}
                </motion.div>
                <div className="flex gap-3">
                  <Btn variant="ghost" className="flex-1" onClick={() => { finishSteal(); showScoreboard() }}>📊 Classement</Btn>
                  <Btn className="flex-1" onClick={() => { finishSteal(); handleNext() }}>
                    {qIdx + 1 >= totalQ ? '🏆 Résultats' : '➡️ Suivante'}
                  </Btn>
                </div>
              </>
            )}

            {/* Scoreboard shown */}
            {status === 'scoreboard' && (
              <>
                {/* Last player picks category */}
                {session.settings?.enableCategoryPick !== false && sorted.length > 1 && qIdx + 1 < totalQ && (() => {
                  const lastPlayer = sorted[sorted.length - 1]
                  const nextIdx = qIdx + 1
                  const remaining = quiz.questions.slice(nextIdx)
                  const categories = [...new Set(remaining.map(qq => qq.category).filter(Boolean))]
                  if (categories.length >= 2) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3 text-center">
                        <span className="text-amber-400 font-bold text-sm">
                          👑 {lastPlayer.avatar} {lastPlayer.name} est dernier !
                        </span>
                        <div className="mt-2">
                          <Btn variant="ghost" size="sm" onClick={() => startCategoryPick()}>
                            👑 Laisser choisir la catégorie
                          </Btn>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
                <Btn className="w-full" onClick={handleNext}>
                  {qIdx + 1 >= totalQ ? '🏆 Résultats finaux' : '➡️ Question suivante'}
                </Btn>
              </>
            )}
          </Card>
        )}

        {/* Scoreboard */}
        <Card>
          <h3 className="font-bold mb-4">🏆 Classement</h3>
          {session.teamMode && (
            <div className="mb-4">
              <TeamScoreboard teams={getTeamScores()} compact />
              <div className="border-t border-dark-500 mt-4 pt-4">
                <div className="text-xs text-slate-400 font-semibold mb-2">Joueurs individuels</div>
              </div>
            </div>
          )}
          <Scoreboard players={sorted} compact={session.teamMode} />
        </Card>
        </>)}
      </div>
      <Soundboard />
    </div>
  )
}
