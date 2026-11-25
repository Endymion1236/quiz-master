// Compute honorific titles for each player at end of quiz
// Returns: { [playerId]: { title, icon, description } }

export function computeHonors(players, scoreboard, answers, questions) {
  const honors = {}
  const playerIds = Object.keys(players)
  if (playerIds.length === 0 || !questions?.length) return honors

  // Gather stats per player
  const stats = {}
  playerIds.forEach(pid => {
    const sb = scoreboard[pid] || { score: 0, streak: 0, correct: 0, total: 0 }
    const myAnswers = Object.values(answers).filter(a => a.playerId === pid)
    const times = myAnswers.filter(a => a.timeElapsed > 0).map(a => a.timeElapsed)
    const avgTime = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : Infinity
    const fastestTime = times.length > 0 ? Math.min(...times) : Infinity
    const slowestTime = times.length > 0 ? Math.max(...times) : 0

    // Compute max streak from answer history
    let maxStreak = 0, currentStreak = 0
    for (let qi = 0; qi < questions.length; qi++) {
      const qAns = myAnswers.find(a => a.questionIndex === qi)
      const q = questions[qi]
      if (!qAns || !q) { currentStreak = 0; continue }

      let isCorrect = false
      if (q.type === 'qcm' || q.type === 'truefalse' || q.type === 'blindtest') {
        isCorrect = qAns.selected === q.correctAnswer
      } else if (q.type === 'multi') {
        isCorrect = JSON.stringify([...(qAns.selected || [])].sort()) === JSON.stringify([...(q.correctAnswer || [])].sort())
      } else if (q.type === 'text' || q.type === 'karaoke') {
        const normalize = (s) => (s || '').toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const variants = Array.isArray(q.correctAnswer) ? q.correctAnswer : (q.correctAnswer || '').split(',')
        isCorrect = variants.some(v => normalize(v) === normalize(qAns.selected))
      }
      // estimate & buzzer: check from scoreboard streak
      if (isCorrect) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
      else currentStreak = 0
    }

    // Count last 3 questions correct (clutch)
    let lastCorrect = 0
    const last3Start = Math.max(0, questions.length - 3)
    for (let qi = last3Start; qi < questions.length; qi++) {
      const qAns = myAnswers.find(a => a.questionIndex === qi)
      const q = questions[qi]
      if (!qAns || !q) continue
      if (q.type === 'qcm' || q.type === 'truefalse' || q.type === 'blindtest') {
        if (qAns.selected === q.correctAnswer) lastCorrect++
      } else if (q.type === 'multi') {
        if (JSON.stringify([...(qAns.selected || [])].sort()) === JSON.stringify([...(q.correctAnswer || [])].sort())) lastCorrect++
      }
    }

    // First question answered correctly?
    const firstAns = myAnswers.find(a => a.questionIndex === 0)
    let firstCorrect = false
    if (firstAns && questions[0]) {
      const q0 = questions[0]
      if (q0.type === 'qcm' || q0.type === 'truefalse' || q0.type === 'blindtest') {
        firstCorrect = firstAns.selected === q0.correctAnswer
      }
    }

    stats[pid] = {
      ...sb,
      avgTime,
      fastestTime,
      slowestTime,
      maxStreak,
      lastCorrect,
      firstCorrect,
      answerCount: myAnswers.length,
      totalQuestions: questions.length,
      accuracy: sb.total > 0 ? sb.correct / sb.total : 0,
    }
  })

  // === ASSIGN TITLES ===
  // Each player gets exactly ONE title (their most notable achievement)
  // Priority: unique achievements first, then fallbacks
  const assigned = new Set()

  // Helper: find best player for a stat (not yet assigned)
  const bestFor = (statKey, higher = true) => {
    let best = null, bestVal = higher ? -Infinity : Infinity
    playerIds.forEach(pid => {
      if (assigned.has(pid)) return
      const val = stats[pid][statKey]
      if (higher ? val > bestVal : val < bestVal) {
        bestVal = val
        best = pid
      }
    })
    return best
  }

  // Title definitions in priority order
  const titleChecks = [
    // Perfect score
    () => {
      const pid = playerIds.find(p => !assigned.has(p) && stats[p].correct === stats[p].totalQuestions && stats[p].totalQuestions > 0)
      return pid ? { pid, title: 'Le Parfait', icon: '💎', desc: `${stats[pid].correct}/${stats[pid].totalQuestions} sans faute` } : null
    },
    // Speed demon (fastest average, min 3 answers)
    () => {
      const pid = playerIds.filter(p => !assigned.has(p) && stats[p].avgTime < Infinity && stats[p].answerCount >= 3)
        .sort((a, b) => stats[a].avgTime - stats[b].avgTime)[0]
      return pid ? { pid, title: 'L\'Éclair', icon: '⚡', desc: `${stats[pid].avgTime.toFixed(1)}s de moyenne` } : null
    },
    // Best streak
    () => {
      const pid = playerIds.filter(p => !assigned.has(p) && stats[p].maxStreak >= 3)
        .sort((a, b) => stats[b].maxStreak - stats[a].maxStreak)[0]
      return pid ? { pid, title: 'L\'Inarrêtable', icon: '🔥', desc: `Série de ${stats[pid].maxStreak}` } : null
    },
    // Clutch player (last 3 correct)
    () => {
      const pid = playerIds.find(p => !assigned.has(p) && stats[p].lastCorrect === 3 && questions.length >= 3)
      return pid ? { pid, title: 'Le Clutch', icon: '🎯', desc: '3 dernières questions réussies' } : null
    },
    // Most correct overall (if > 50% and not already titled)
    () => {
      const pid = playerIds.filter(p => !assigned.has(p) && stats[p].correct > 0)
        .sort((a, b) => stats[b].correct - stats[a].correct)[0]
      return pid && stats[pid].accuracy >= 0.5 ? { pid, title: 'Le Savant', icon: '🧠', desc: `${stats[pid].correct} bonnes réponses` } : null
    },
    // Early bird (first question correct + fastest on Q1)
    () => {
      const pid = playerIds.find(p => !assigned.has(p) && stats[p].firstCorrect)
      return pid ? { pid, title: 'Le Starter', icon: '🚀', desc: 'Bon dès la première question' } : null
    },
    // Slowest but correct (turtle)
    () => {
      const pid = playerIds.filter(p => !assigned.has(p) && stats[p].correct > 0 && stats[p].avgTime < Infinity)
        .sort((a, b) => stats[b].avgTime - stats[a].avgTime)[0]
      return pid && stats[pid].avgTime > 5 ? { pid, title: 'Le Réfléchi', icon: '🐢', desc: `${stats[pid].avgTime.toFixed(1)}s de réflexion` } : null
    },
    // Lowest score but participated
    () => {
      const pid = playerIds.filter(p => !assigned.has(p) && stats[p].answerCount > 0)
        .sort((a, b) => stats[a].score - stats[b].score)[0]
      return pid ? { pid, title: 'Le Courageux', icon: '💪', desc: 'A tenté sa chance' } : null
    },
    // Zero correct
    () => {
      const pid = playerIds.find(p => !assigned.has(p) && stats[p].correct === 0 && stats[p].answerCount > 0)
      return pid ? { pid, title: 'Le Chanceux', icon: '🍀', desc: 'La prochaine sera la bonne !' } : null
    },
    // Didn't answer much
    () => {
      const pid = playerIds.find(p => !assigned.has(p) && stats[p].answerCount < stats[p].totalQuestions * 0.5)
      return pid ? { pid, title: 'Le Mystérieux', icon: '🎭', desc: 'A gardé le suspense' } : null
    },
  ]

  // Run title assignments
  for (const check of titleChecks) {
    const result = check()
    if (result) {
      honors[result.pid] = { title: result.title, icon: result.icon, desc: result.desc }
      assigned.add(result.pid)
    }
  }

  // Fallback for anyone without a title
  playerIds.forEach(pid => {
    if (!honors[pid]) {
      honors[pid] = { title: 'Le Participant', icon: '⭐', desc: 'Merci d\'avoir joué !' }
    }
  })

  return honors
}
