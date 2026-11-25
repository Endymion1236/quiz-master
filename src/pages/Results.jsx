import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Podium, Scoreboard, Confetti, Card, Btn, TeamPodium, TeamScoreboard } from '../components/UI'
import { useStore } from '../hooks/useSession'
import Papa from 'papaparse'
import html2canvas from 'html2canvas'

export default function Results({ onNavigate, quizzes = [] }) {
  const { session, role, answers, players, getSorted, endGame, getTeamScores, saveSoireeScores, getSoireeScores, loadNextQuiz } = useStore()
  const sorted = getSorted()
  const teamScores = session?.teamMode ? getTeamScores() : []
  const [soireeSaved, setSoireeSaved] = useState(false)
  const [soireeData, setSoireeData] = useState(null)
  const [showQuizPicker, setShowQuizPicker] = useState(false)
  const [loadingNext, setLoadingNext] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const resultsRef = useRef(null)

  // Auto-save soirée scores on mount
  useEffect(() => {
    if (!soireeSaved) {
      const saved = saveSoireeScores()
      setSoireeData(saved)
      setSoireeSaved(true)
    }
  }, [])

  const soireeScores = getSoireeScores()
  const hasSoiree = soireeData || session?.soireeScores
  const quizNumber = session?.quizNumber || 1

  const handleExportCSV = () => {
    const data = sorted.map((p, i) => ({
      Rang: i + 1,
      Pseudo: p.name,
      Avatar: p.avatar,
      'Score Quiz': p.score,
      'Bonnes réponses': p.correct,
      'Total questions': p.total,
      'Taux': p.total > 0 ? Math.round((p.correct / p.total) * 100) + '%' : '0%',
      'Score Soirée': soireeScores.find(s => s.did === p.did)?.soireeScore || p.score,
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `resultats-${session?.quizTitle || 'quiz'}.csv`
    a.click()
  }

  const handleShareImage = async () => {
    if (!resultsRef.current) return
    try {
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
      })
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      if (navigator.share && blob) {
        await navigator.share({
          title: `Quiz Master — ${session?.quizTitle || 'Résultats'}`,
          files: [new File([blob], 'quiz-results.png', { type: 'image/png' })],
        })
      } else {
        // Fallback: download
        const url = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = `quiz-results-${session?.quizTitle || 'quiz'}.png`
        a.click()
      }
    } catch (e) {
      console.error('Share error:', e)
      // Last fallback
      if (resultsRef.current) {
        const canvas = await html2canvas(resultsRef.current, { backgroundColor: '#0f172a', scale: 2 })
        const url = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = `quiz-results.png`
        a.click()
      }
    }
  }

  const handleLoadNextQuiz = async (quiz) => {
    setLoadingNext(true)
    try {
      await loadNextQuiz(quiz)
      onNavigate('host-lobby')
    } catch (e) {
      console.error('loadNextQuiz error:', e)
    }
    setLoadingNext(false)
  }

  const handleEnd = () => {
    endGame()
    onNavigate('landing')
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[800px] mx-auto text-center">
        <Confetti show />

        <img src="/images/logo.png" alt="" className="w-16 h-16 mx-auto mb-2 object-contain"
          onError={(e) => { e.target.style.display = 'none' }} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-6xl mb-4">
          🏆
        </motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-black mb-2 bg-gradient-to-r from-brand to-accent-pink bg-clip-text text-transparent">
          Résultats — {session?.quizTitle || 'Quiz'}
        </motion.h2>
        {quizNumber > 1 && (
          <div className="text-slate-400 mb-4">Quiz n°{quizNumber} de la soirée</div>
        )}

        {/* Shareable results area */}
        <div ref={resultsRef} className="p-4">
          <div className="text-center mb-4 text-brand font-bold text-lg">🏆 {session?.quizTitle || 'Quiz Master'}</div>

          {/* Team Podium */}
          {session?.teamMode && teamScores.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-6">👥 Classement Équipes</h3>
              <TeamPodium teams={teamScores} />
              <div className="mt-8">
                <TeamScoreboard teams={teamScores} />
              </div>
            </div>
          )}

          <div className="mb-10">
            {session?.teamMode && <h3 className="text-xl font-bold mb-6">🏅 Classement Individuel</h3>}
            <Podium players={sorted} />
          </div>

          {sorted.length > 3 && (
            <Card className="text-left mb-8">
              <h3 className="font-bold mb-4">Classement complet</h3>
              <Scoreboard players={sorted.slice(3)} />
            </Card>
        )}
        </div>{/* end of shareable ref */}

        {/* Stats post-quiz */}
        {role === 'host' && (
          <div className="mb-8 text-center">
            <Btn variant="ghost" size="sm" onClick={() => setShowStats(!showStats)}>
              {showStats ? '📊 Masquer les stats' : '📊 Voir les stats détaillées'}
            </Btn>
          </div>
        )}
        {showStats && session?.quiz && (() => {
          const questions = session.quiz.questions || []
          const allAnswers = Object.values(answers)

          // Compute per-question stats
          const qStats = questions.map((q, qi) => {
            const qAns = allAnswers.filter(a => a.questionIndex === qi)
            const correctCount = qAns.filter(a => {
              if (q.type === 'estimate') return false // estimate doesn't have binary correct
              if (q.type === 'multi') return JSON.stringify([...(a.selected || [])].sort()) === JSON.stringify([...q.correctAnswer].sort())
              if (q.type === 'text' || q.type === 'buzzer') return false
              return a.selected === q.correctAnswer
            }).length
            const totalAns = qAns.length
            const rate = totalAns > 0 ? Math.round((correctCount / totalAns) * 100) : 0
            const avgTime = totalAns > 0 ? (qAns.reduce((s, a) => s + (a.timeElapsed || 0), 0) / totalAns).toFixed(1) : 0
            const fastest = qAns.length > 0 ? qAns.reduce((best, a) => (!best || (a.timeElapsed || 99) < (best.timeElapsed || 99)) ? a : best, null) : null
            return { q, qi, correctCount, totalAns, rate, avgTime, fastest }
          })

          const hardest = [...qStats].sort((a, b) => a.rate - b.rate)[0]
          const easiest = [...qStats].sort((a, b) => b.rate - a.rate)[0]

          // Fastest player overall
          const allTimed = allAnswers.filter(a => a.timeElapsed > 0)
          const fastestPlayer = allTimed.length > 0
            ? allTimed.reduce((best, a) => (!best || a.timeElapsed < best.timeElapsed) ? a : best, null)
            : null
          const fastestPData = fastestPlayer ? players[fastestPlayer.playerId] : null

          return (
            <Card className="mb-8 text-left">
              <h3 className="font-bold mb-4">📊 Statistiques du quiz</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {hardest && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <div className="text-xs text-red-400 font-bold mb-1">💀 + Difficile</div>
                    <div className="text-sm font-semibold text-slate-300 line-clamp-2">{hardest.q.prompt}</div>
                    <div className="text-red-400 font-bold mt-1">{hardest.rate}% réussite</div>
                  </div>
                )}
                {easiest && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                    <div className="text-xs text-green-400 font-bold mb-1">😎 + Facile</div>
                    <div className="text-sm font-semibold text-slate-300 line-clamp-2">{easiest.q.prompt}</div>
                    <div className="text-green-400 font-bold mt-1">{easiest.rate}% réussite</div>
                  </div>
                )}
                {fastestPData && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                    <div className="text-xs text-blue-400 font-bold mb-1">⚡ + Rapide</div>
                    <div className="text-2xl">{fastestPData.avatar}</div>
                    <div className="text-sm font-semibold text-slate-300">{fastestPData.name}</div>
                    <div className="text-blue-400 font-bold mt-1">{fastestPlayer.timeElapsed.toFixed(1)}s</div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {qStats.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 w-8 text-right font-mono">Q{i + 1}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${s.rate}%`,
                        background: s.rate >= 70 ? '#10b981' : s.rate >= 40 ? '#f59e0b' : '#ef4444'
                      }} />
                    </div>
                    <span className="text-slate-400 w-12 text-right font-mono">{s.rate}%</span>
                    <span className="text-slate-500 w-14 text-right text-xs">{s.avgTime}s moy</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })()}

        {/* 🏅 Badges & Achievements */}
        {showStats && session?.quiz && (() => {
          const allAns = Object.values(answers)
          const questions = session.quiz.questions || []
          const sb = session.scoreboard || {}

          // Compute badges
          const badges = []

          // First correct answer
          const firstCorrect = allAns
            .filter(a => {
              const qq = questions[a.questionIndex]
              if (!qq || qq.type === 'estimate' || qq.type === 'buzzer' || qq.type === 'text') return false
              if (qq.type === 'multi') return JSON.stringify([...(a.selected||[])].sort()) === JSON.stringify([...qq.correctAnswer].sort())
              return a.selected === qq.correctAnswer
            })
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0]
          if (firstCorrect && players[firstCorrect.playerId]) {
            badges.push({ icon: '🥇', title: 'Première bonne réponse', player: players[firstCorrect.playerId] })
          }

          // Best streak
          let bestStreakP = null, bestStreak = 0
          Object.entries(sb).forEach(([did, s]) => {
            if ((s.streak || 0) > bestStreak && players[did]) { bestStreak = s.streak; bestStreakP = players[did] }
          })
          if (bestStreakP && bestStreak >= 3) {
            badges.push({ icon: '🔥', title: `Série de ${bestStreak}`, player: bestStreakP })
          }

          // Most questions answered
          const answerCounts = {}
          allAns.forEach(a => { answerCounts[a.playerId] = (answerCounts[a.playerId] || 0) + 1 })
          const mostAnsId = Object.entries(answerCounts).sort(([,a],[,b]) => b - a)[0]?.[0]
          if (mostAnsId && players[mostAnsId]) {
            badges.push({ icon: '📝', title: 'Le plus assidu', player: players[mostAnsId] })
          }

          // Fastest average
          const playerTimes = {}
          allAns.forEach(a => {
            if (a.timeElapsed > 0) {
              if (!playerTimes[a.playerId]) playerTimes[a.playerId] = []
              playerTimes[a.playerId].push(a.timeElapsed)
            }
          })
          let fastestAvgP = null, fastestAvg = 99
          Object.entries(playerTimes).forEach(([pid, times]) => {
            if (times.length >= 3) {
              const avg = times.reduce((s, t) => s + t, 0) / times.length
              if (avg < fastestAvg && players[pid]) { fastestAvg = avg; fastestAvgP = players[pid] }
            }
          })
          if (fastestAvgP) {
            badges.push({ icon: '⚡', title: `Éclair (${fastestAvg.toFixed(1)}s moy)`, player: fastestAvgP })
          }

          // Perfect score (all correct)
          Object.entries(sb).forEach(([did, s]) => {
            if (s.correct > 0 && s.correct === s.total && players[did]) {
              badges.push({ icon: '💎', title: 'Sans faute !', player: players[did] })
            }
          })

          if (badges.length === 0) return null
          return (
            <Card className="mb-8">
              <h3 className="font-bold mb-4">🏅 Badges</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badges.map((b, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
                    className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <span className="text-3xl">{b.icon}</span>
                    <div>
                      <div className="font-bold text-sm">{b.title}</div>
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <span>{b.player.avatar}</span>
                        <span>{b.player.name}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )
        })()}

        {/* Soirée cumulative scores */}
        {hasSoiree && soireeScores.length > 0 && (
          <Card className="mb-8 border-brand/30">
            <h3 className="font-bold mb-1 text-brand">🌙 Classement Soirée</h3>
            <div className="text-slate-400 text-xs mb-4">
              {quizNumber > 1
                ? `Scores cumulés sur ${quizNumber} quiz`
                : 'Scores sauvegardés — lancez un prochain quiz pour cumuler !'}
            </div>
            <div className="space-y-2">
              {soireeScores.slice(0, 10).map((p, i) => (
                <div key={p.did} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-500 w-6">{i + 1}</span>
                    <span>{p.avatar}</span>
                    <span className="font-semibold">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-brand font-mono">{p.soireeScore.toLocaleString()}</span>
                    <span className="text-slate-500 text-xs ml-2">(+{p.quizScore.toLocaleString()})</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 🏅 Honors */}
        {session?.honors && Object.keys(session.honors).length > 0 && (
          <Card className="mb-6">
            <div className="text-center mb-4">
              <span className="text-xl font-black text-amber-400">🏅 Titres Honorifiques</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {Object.entries(session.honors).map(([pid, h]) => (
                <motion.div key={pid} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                  className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 rounded-xl px-4 py-3 border border-amber-500/20 text-center min-w-[140px]">
                  <div className="text-2xl mb-1">{h.icon}</div>
                  <div className="flex items-center gap-1.5 justify-center mb-1">
                    <span>{players[pid]?.avatar}</span>
                    <span className="font-bold text-sm">{players[pid]?.name}</span>
                  </div>
                  <div className="font-black text-amber-400 text-xs">{h.title}</div>
                  <div className="text-xs text-slate-500">{h.desc}</div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center flex-wrap mb-4">
          <Btn onClick={handleExportCSV}>📥 Exporter CSV</Btn>
          <Btn variant="ghost" onClick={handleShareImage}>📱 Partager</Btn>
          {role === 'host' && (
            <Btn onClick={() => setShowQuizPicker(true)} className="!bg-brand">
              🎮 Quiz suivant (même salle)
            </Btn>
          )}
          <Btn variant="ghost" onClick={handleEnd}>🏠 Fin de soirée</Btn>
        </div>

        {/* Quiz Picker (inline) */}
        {showQuizPicker && role === 'host' && (
          <Card className="mb-8 text-left border-brand/30">
            <h3 className="font-bold mb-4 text-brand">🎮 Choisir le prochain quiz</h3>
            <p className="text-slate-400 text-sm mb-4">Les joueurs restent connectés, les scores se cumulent</p>
            {quizzes.length === 0 ? (
              <div className="text-slate-500 text-sm">Aucun quiz disponible. Retournez à l'accueil pour en créer.</div>
            ) : (
              <div className="space-y-3">
                {quizzes.map((q, i) => (
                  <motion.button key={q.quizId || i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLoadNextQuiz(q)}
                    disabled={loadingNext}
                    className="w-full text-left p-4 rounded-xl border border-dark-500 bg-dark-700 hover:border-brand/50 transition-all"
                  >
                    <div className="font-bold">{q.title}</div>
                    <div className="text-slate-400 text-sm">{q.questions.length} questions</div>
                  </motion.button>
                ))}
              </div>
            )}
            <Btn variant="ghost" size="sm" onClick={() => setShowQuizPicker(false)} className="mt-4">
              ← Annuler
            </Btn>
          </Card>
        )}
      </div>
    </div>
  )
}
