import { create } from 'zustand'
import { db, getUserId, waitForAuth, serverNow } from '../firebase'
import {
  doc, collection, setDoc, updateDoc, getDocs, getDoc, deleteDoc, onSnapshot, query, where, serverTimestamp
} from 'firebase/firestore'
import { TEAM_COLORS, getTeamName } from '../lib/constants'
import { checkAnswer, calculateScore, scoreEstimate, scoreBuzzer, scoreGeo, scoreOrder, scoreMatch } from '../lib/scoring'
import { computeHonors } from '../lib/honors'
import { updateEloRatings, DEFAULT_ELO } from '../lib/elo'

// Save game history summary + update ELO ratings
async function saveHistory(sessionId, session, players) {
  try {
    const sb = session.scoreboard || {}
    const sorted = Object.entries(sb)
      .map(([pid, s]) => ({ pid, name: players[pid]?.name || pid, avatar: players[pid]?.avatar || '?', ...s }))
      .sort((a, b) => b.score - a.score)
    await setDoc(doc(db, 'gameHistory', sessionId), {
      date: new Date().toISOString(),
      quizTitle: session.quiz?.title || 'Quiz',
      questionCount: session.quiz?.questions?.length || 0,
      playerCount: Object.keys(players).length,
      gameMode: session.gameMode || 'normal',
      teamMode: session.teamMode || false,
      winner: sorted[0] || null,
      podium: sorted.slice(0, 3),
      allScores: sorted,
      sessionId,
    })

    // Update ELO ratings (skip if < 2 players)
    if (sorted.length >= 2) {
      try {
        // Load current ELO ratings
        const eloResults = []
        for (const p of sorted) {
          const nameLower = p.name.toLowerCase().trim()
          let currentElo = DEFAULT_ELO
          try {
            const eloDoc = await getDoc(doc(db, 'eloRatings', nameLower))
            if (eloDoc.exists()) currentElo = eloDoc.data().elo || DEFAULT_ELO
          } catch {}
          eloResults.push({ ...p, elo: currentElo, nameKey: nameLower })
        }

        // Compute new ELO
        const updated = updateEloRatings(eloResults)

        // Save new ELO ratings
        for (const p of updated) {
          await setDoc(doc(db, 'eloRatings', p.nameKey), {
            name: p.name,
            avatar: p.avatar,
            elo: p.newElo,
            gamesPlayed: (p.gamesPlayed || 0) + 1,
            lastGame: new Date().toISOString(),
          }, { merge: true })
          // Increment gamesPlayed properly
          try {
            const existing = await getDoc(doc(db, 'eloRatings', p.nameKey))
            if (existing.exists()) {
              await updateDoc(doc(db, 'eloRatings', p.nameKey), {
                gamesPlayed: (existing.data().gamesPlayed || 0) + 1,
              })
            }
          } catch {}
        }

        // Store ELO changes in session for display
        const eloChanges = {}
        updated.forEach(p => {
          eloChanges[p.pid] = { oldElo: p.elo, newElo: p.newElo, delta: p.eloDelta }
        })
        await updateDoc(doc(db, 'sessions', sessionId), { eloChanges })
      } catch (e) { console.warn('ELO update error:', e) }
    }
  } catch (e) { console.warn('History save error:', e) }
}

// Generate 6-digit PIN
const genPIN = () => String(Math.floor(100000 + Math.random() * 900000))

// Helper: get total score for a team
function getTeamTotalScore(sb, teamId, players) {
  let total = 0
  Object.entries(players).forEach(([pid, p]) => {
    if (p.team === teamId) total += (sb[pid]?.score || 0)
  })
  return total
}

// Helper: remove points from a team (proportional from each member)
function removePointsFromTeam(sb, teamId, points, players) {
  const members = Object.entries(players).filter(([_, p]) => p.team === teamId)
  if (members.length === 0) return
  const perMember = Math.floor(points / members.length)
  let remainder = points - perMember * members.length
  members.forEach(([pid]) => {
    if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
    const remove = perMember + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
    sb[pid].score = Math.max(0, sb[pid].score - remove)
  })
}

// Helper: add points to a team (split evenly)
function addPointsToTeam(sb, teamId, points, players) {
  const members = Object.entries(players).filter(([_, p]) => p.team === teamId)
  if (members.length === 0) return
  const perMember = Math.floor(points / members.length)
  let remainder = points - perMember * members.length
  members.forEach(([pid]) => {
    if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
    const add = perMember + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
    sb[pid].score += add
  })
}

// Helper: clean quiz data for Firestore storage
function cleanQuizForFirestore(quiz) {
  const cleanQuiz = JSON.parse(JSON.stringify(quiz, (key, value) => {
    if (value === undefined) return null
    return value
  }))
  if (cleanQuiz.questions) {
    cleanQuiz.questions = cleanQuiz.questions.map(q => {
      if (q.media) {
        if (q.media.url && q.media.url.startsWith('data:')) {
          console.warn(`Question "${q.prompt}" has a base64 media — stripped for Firestore.`)
          return { ...q, media: null }
        }
        if (!q.media.url) return { ...q, media: null }
        return {
          ...q,
          media: {
            type: q.media.type || 'image',
            url: q.media.url || '',
            name: q.media.name || '',
            ...(q.media.startAt ? { startAt: q.media.startAt } : {}),
            ...(q.media.endAt ? { endAt: q.media.endAt } : {}),
            ...(q.media.storagePath ? { storagePath: q.media.storagePath } : {}),
          }
        }
      }
      return q
    })
  }
  return cleanQuiz
}

// Strip all undefined values recursively (Firestore rejects them)
function stripUndefined(obj) {
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  const clean = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue // skip undefined keys entirely
    clean[k] = stripUndefined(v)
  }
  return clean
}

export const useStore = create((set, get) => ({
  // --- State ---
  session: null,       // Firestore session data
  players: {},         // docId -> player data
  answers: {},         // docId -> answer data
  sessionId: null,
  myPlayerId: null,
  myPlayerData: null,
  role: null,          // 'host' | 'player' | 'screen' | null
  theme: 'default',
  teamMode: false,
  teams: {},           // teamId -> { name, color, emoji, playerIds }
  enabledTeams: ['red', 'blue'], // which teams are active
  gameMode: 'normal',  // 'normal' | 'suddenDeath'
  displayMode: 'tv',   // 'tv' (en salle avec écran) | 'online' (tout sur téléphone)

  // Unsub refs (internal)
  _unsubs: [],

  // --- Actions ---

  // Set theme
  setTheme: (theme) => set({ theme }),

  // Toggle team mode
  setTeamMode: (on) => set({ teamMode: on }),
  setEnabledTeams: (teams) => set({ enabledTeams: teams }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setDisplayMode: (mode) => set({ displayMode: mode }),

  // Create a session (Host)
  createSession: async (quiz, settings = {}) => {
    const userId = await waitForAuth()
    if (!userId) throw new Error('Not authenticated')

    const pin = genPIN()
    const sessionId = 'session-' + Date.now()

    const cleanQuiz = cleanQuizForFirestore(quiz)

    // Shuffle questions if setting enabled
    if (settings.shuffleQuestions) {
      const shuffled = [...cleanQuiz.questions]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      cleanQuiz.questions = shuffled
    }

    const sessionData = {
      pin,
      status: 'lobby',
      hostId: userId,
      quizTitle: quiz.title || 'Quiz sans titre',
      quiz: cleanQuiz,
      currentQuestionIndex: -1,
      questionStartTimestamp: null,
      scoreboard: {},
      revealResults: null,
      buzzerLocked: false,
      buzzerWinner: null,
      eliminated: {},
      gameMode: get().gameMode || 'normal',
      teamMode: get().teamMode || false,
      enabledTeams: (get().teamMode && get().enabledTeams) ? get().enabledTeams : [],
      settings: {
        speedBonus: true,
        streakBonus: true,
        wrongPenalty: false,
        basePoints: 1000,
        ...settings,
      },
      theme: get().theme,
      displayMode: get().displayMode || 'tv',
      createdAt: serverTimestamp(),
      // Soirée mode: carry over cumulative scores
      soireeId: settings.soireeId || null,
      soireeScores: settings.soireeScores || {},
      quizNumber: settings.quizNumber || 1,
    }

    try {
      await setDoc(doc(db, 'sessions', sessionId), stripUndefined(sessionData))
    } catch (err) {
      console.error('Firestore setDoc error:', err, '\nData:', JSON.stringify(sessionData).slice(0, 500))
      throw err
    }
    set({ sessionId, session: sessionData, role: 'host' })
    localStorage.setItem('qm_current_session', sessionId)
    get().listen(sessionId)
    return { sessionId, pin }
  },

  // Join a session (Player)
  joinSession: async (pin, name, avatar, teamId = null) => {
    const userId = await waitForAuth()
    if (!userId) throw new Error('Not authenticated')

    // Generate a unique player ID per page load (allows multiple players from same browser)
    // Using in-memory ID - sessionStorage can be copied when duplicating tabs
    if (!window.__qm_tab_id) {
      window.__qm_tab_id = userId + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    }
    const tabPlayerId = window.__qm_tab_id

    // Find session by PIN
    const q = query(collection(db, 'sessions'), where('pin', '==', pin))
    const snap = await getDocs(q)
    let found = null
    snap.forEach(d => {
      const data = d.data()
      if (data.status !== 'ended') found = { id: d.id, data }
    })
    if (!found) throw new Error('Aucune salle trouvée avec ce code')

    const playerData = { playerId: tabPlayerId, name, avatar, joinedAt: Date.now(), team: teamId }
    await setDoc(doc(db, 'sessions', found.id, 'players', tabPlayerId), playerData)

    // Init jokers for this player (only if enabled)
    const jokers = found.data.jokers || {}
    if (!jokers[tabPlayerId] && found.data.settings?.enableJokers !== false) {
      jokers[tabPlayerId] = { x2: 1, fifty: 1, time: 1 }
      await updateDoc(doc(db, 'sessions', found.id), { jokers })
    }

    set({
      sessionId: found.id,
      session: found.data,
      myPlayerId: tabPlayerId,
      myPlayerData: playerData,
      role: 'player',
      theme: found.data.theme || 'default',
    })
    get().listen(found.id)
  },

  // Listen to session (real-time)
  listen: (sessionId) => {
    // Clean up previous listeners
    get()._unsubs.forEach(fn => fn())

    const unsubs = []

    // Session doc — real-time listener
    unsubs.push(onSnapshot(doc(db, 'sessions', sessionId), snap => {
      if (!snap.exists()) return
      set({ session: snap.data() })
    }))

    // Periodic fallback refresh (every 5s) — catches missed snapshots on bad WiFi
    const refreshInterval = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, 'sessions', sessionId))
        if (snap.exists()) {
          const current = get().session
          const fresh = snap.data()
          // Only update if status has actually changed (avoid unnecessary re-renders)
          if (current?.status !== fresh.status || current?.currentQuestionIndex !== fresh.currentQuestionIndex) {
            console.log('🔄 Fallback refresh: status changed', current?.status, '→', fresh.status)
            set({ session: fresh })
          }
        }
      } catch (e) { /* ignore — snapshot listener is primary */ }
    }, 5000)
    unsubs.push(() => clearInterval(refreshInterval))

    // Players subcollection
    unsubs.push(onSnapshot(collection(db, 'sessions', sessionId, 'players'), snap => {
      const players = {}
      snap.forEach(d => { players[d.id] = d.data() })
      set({ players })
    }))

    // Answers subcollection
    unsubs.push(onSnapshot(collection(db, 'sessions', sessionId, 'answers'), snap => {
      const answers = {}
      snap.forEach(d => { answers[d.id] = d.data() })
      set({ answers })
    }))

    set({ _unsubs: unsubs })
  },

  // Launch next question (Host)
  goQuestion: async (qIdx) => {
    const { sessionId, session, players } = get()

    if (qIdx >= session.quiz.questions.length) {
      // === PREDICTION BONUS ===
      const predictions = session.predictions || {}
      const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))
      const totalQ = session.quiz.questions.length
      const predictionResults = {}

      if (session.settings?.enablePrediction && Object.keys(predictions).length > 0) {
        Object.entries(predictions).forEach(([pid, predicted]) => {
          const actual = sb[pid]?.correct || 0
          const diff = Math.abs(predicted - actual)
          let bonus = 0
          let label = ''

          if (diff === 0) {
            bonus = Math.round(totalQ * 200) // Pile poil = gros bonus
            label = '🎯 Pile poil !'
          } else if (diff === 1) {
            bonus = Math.round(totalQ * 100) // À 1 près
            label = '👏 Presque !'
          } else if (diff === 2) {
            bonus = Math.round(totalQ * 50) // À 2 près
            label = '😅 Pas loin'
          } else {
            bonus = 0
            label = '❌ Loupé'
          }

          if (sb[pid]) {
            sb[pid].score += bonus
          }
          predictionResults[pid] = { predicted, actual, diff, bonus, label }
        })
      }

      // Compute honorific titles
      const { answers: allAnswers } = get()
      const honors = computeHonors(players, sb, allAnswers, session.quiz.questions)

      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'ended',
        scoreboard: sb,
        predictionResults,
        honors,
      })
      await saveHistory(sessionId, { ...session, scoreboard: sb, honors }, players)
      return
    }
    const q = session.quiz.questions[qIdx]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    // === ROUND INTRO: detect category change ===
    const prevQ = qIdx > 0 ? session.quiz.questions[qIdx - 1] : null
    const currentCat = q.category || ''
    const prevCat = prevQ?.category || ''
    const isNewRound = currentCat && currentCat !== prevCat

    if (isNewRound) {
      // Compute round number (count distinct categories up to this point)
      const seenCats = new Set()
      for (let i = 0; i <= qIdx; i++) {
        const cat = session.quiz.questions[i].category
        if (cat) seenCats.add(cat)
      }
      const roundNum = seenCats.size

      // Compute round scores (score gained during previous round's questions)
      const roundScores = {}
      if (prevCat && qIdx > 0) {
        // Find start of previous round
        let roundStart = qIdx - 1
        while (roundStart > 0 && (session.quiz.questions[roundStart - 1]?.category || '') === prevCat) {
          roundStart--
        }
        const sb = session.scoreboard || {}
        const sh = session.scoreHistory || {}
        Object.keys(players).forEach(pid => {
          const history = sh[pid] || []
          const scoreAtRoundStart = roundStart > 0 ? (history[roundStart - 1] || 0) : 0
          const scoreAtRoundEnd = history[qIdx - 1] || sb[pid]?.score || 0
          roundScores[pid] = scoreAtRoundEnd - scoreAtRoundStart
        })
      }

      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'roundIntro',
        currentQuestionIndex: qIdx,
        roundIntroData: {
          roundNum,
          category: currentCat,
          prevCategory: prevCat || null,
          roundScores: Object.keys(roundScores).length > 0 ? roundScores : null,
        },
        revealResults: null,
      })

      // After 5 seconds, continue to the normal question flow
      setTimeout(async () => {
        try {
          const { session: cur } = get()
          if (cur?.status !== 'roundIntro') return
          // Re-call goQuestion logic but skip round intro this time
          get()._goQuestionDirect(qIdx)
        } catch (e) { console.error('Round intro transition error:', e) }
      }, 5000)
      return
    }

    // If bet question → go to betting phase first
    if (q.bet) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'betting',
        currentQuestionIndex: qIdx,
        questionStartTimestamp: null,
        revealResults: null,
        buzzerLocked: false,
        buzzerWinner: null,
        buzzerPenalized: [],
        stealData: null,
        stealLog: null,
        bets: {},
        activeJokers: {},
        bonusMultiplier: null, destinyPlayer: null, revealLevel: 0,
        countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return
    }

    // If bonus wheel question → show wheel phase first (only if enabled)
    if (q.bonusWheel && session.settings?.enableBonusWheel !== false) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'bonusWheel',
        currentQuestionIndex: qIdx,
        questionStartTimestamp: null,
        revealResults: null,
        buzzerLocked: false,
        buzzerWinner: null,
        buzzerPenalized: [],
        stealData: null,
        stealLog: null,
        bets: {},
        activeJokers: {},
        bonusMultiplier: null, destinyPlayer: null, revealLevel: 0,
        countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return // Host triggers next step after wheel spin
    }

    // If destiny wheel question → pick random player who answers solo
    if (q.destinyWheel) {
      const playerIds = Object.keys(players)
      const chosenId = playerIds[Math.floor(Math.random() * playerIds.length)]
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'destinyWheel',
        currentQuestionIndex: qIdx,
        questionStartTimestamp: null,
        revealResults: null,
        buzzerLocked: false,
        buzzerWinner: null,
        buzzerPenalized: [],
        stealData: null,
        stealLog: null,
        bets: {},
        activeJokers: {},
        bonusMultiplier: null,
        destinyPlayer: chosenId,
        countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return // Host triggers next step after reveal
    }

    // Go to countdown first (3-2-1-GO), then preMedia or running
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown',
      currentQuestionIndex: qIdx,
      questionStartTimestamp: null,
      revealResults: null,
      buzzerLocked: false,
      buzzerWinner: null,
      buzzerPenalized: [],
      stealData: null,
      stealLog: null,
      bets: {},
      activeJokers: {},
      bonusMultiplier: null, destinyPlayer: null, revealLevel: 0,
      countdownTarget: hasMedia ? 'preMedia' : 'running',
      countdownStartedAt: serverNow(),
    })

    // After 4 seconds (3-2-1-GO), transition to actual state
    setTimeout(async () => {
      try {
        // Re-check status to avoid double transition
        const { session: curSession } = get()
        if (curSession?.status !== 'countdown') return
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Countdown transition error:', e) }
    }, 4000)
  },

  // Direct question launch (skips round intro check, used after roundIntro)
  _goQuestionDirect: async (qIdx) => {
    const { sessionId, session } = get()
    const q = session.quiz.questions[qIdx]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    if (q.bet) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'betting', currentQuestionIndex: qIdx,
        questionStartTimestamp: null, revealResults: null,
        buzzerLocked: false, buzzerWinner: null, buzzerPenalized: [],
        stealData: null, stealLog: null, bets: {}, activeJokers: {},
        bonusMultiplier: null, destinyPlayer: null, revealLevel: 0, countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return
    }

    if (q.bonusWheel && session.settings?.enableBonusWheel !== false) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'bonusWheel', currentQuestionIndex: qIdx,
        questionStartTimestamp: null, revealResults: null,
        buzzerLocked: false, buzzerWinner: null, buzzerPenalized: [],
        stealData: null, stealLog: null, bets: {}, activeJokers: {},
        bonusMultiplier: null, destinyPlayer: null, revealLevel: 0, countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return
    }

    if (q.destinyWheel) {
      const { players } = get()
      const playerIds = Object.keys(players)
      const chosenId = playerIds[Math.floor(Math.random() * playerIds.length)]
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'destinyWheel', currentQuestionIndex: qIdx,
        questionStartTimestamp: null, revealResults: null,
        buzzerLocked: false, buzzerWinner: null, buzzerPenalized: [],
        stealData: null, stealLog: null, bets: {}, activeJokers: {},
        bonusMultiplier: null, destinyPlayer: chosenId,
        countdownTarget: hasMedia ? 'preMedia' : 'running',
      })
      return
    }

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown', currentQuestionIndex: qIdx,
      questionStartTimestamp: null, revealResults: null,
      buzzerLocked: false, buzzerWinner: null, buzzerPenalized: [],
      stealData: null, stealLog: null, bets: {}, activeJokers: {},
      bonusMultiplier: null, destinyPlayer: null, revealLevel: 0, countdownTarget: hasMedia ? 'preMedia' : 'running',
      countdownStartedAt: serverNow(),
    })

    setTimeout(async () => {
      try {
        const { session: curSession } = get()
        if (curSession?.status !== 'countdown') return
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Direct countdown error:', e) }
    }, 4000)
  },

  // Confirm bonus wheel result → store multiplier and go to countdown
  confirmBonusWheel: async (multiplier) => {
    const { sessionId, session } = get()
    const q = session.quiz.questions[session.currentQuestionIndex]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown',
      bonusMultiplier: multiplier,
      countdownTarget: hasMedia ? 'preMedia' : 'running',
    })

    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Bonus wheel countdown error:', e) }
    }, 4000)
  },

  // Confirm destiny wheel → go to countdown with only chosen player active
  confirmDestinyWheel: async () => {
    const { sessionId, session } = get()
    const q = session.quiz.questions[session.currentQuestionIndex]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown',
      countdownTarget: hasMedia ? 'preMedia' : 'running',
      countdownStartedAt: serverNow(),
    })

    setTimeout(async () => {
      try {
        const { session: cur } = get()
        if (cur?.status !== 'countdown') return
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Destiny countdown error:', e) }
    }, 4000)
  },

  // Send emoji reaction (player → session)
  sendReaction: async (emoji) => {
    const { sessionId } = get()
    if (!sessionId) return
    // Write to a volatile field — all clients see it via onSnapshot
    await updateDoc(doc(db, 'sessions', sessionId), {
      lastReaction: { emoji, ts: serverNow(), id: Date.now() + Math.random() },
    })
  },

  // Close betting phase → launch countdown
  closeBets: async () => {
    const { sessionId, session } = get()
    const q = session.quiz.questions[session.currentQuestionIndex]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    // If question also has bonus wheel → go to wheel phase after bets
    if (q.bonusWheel && session.settings?.enableBonusWheel !== false) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'bonusWheel',
      })
      return // confirmBonusWheel will handle the next transition
    }

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown',
      countdownTarget: hasMedia ? 'preMedia' : 'running',
    })

    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Countdown transition error:', e) }
    }, 4000)
  },

  // Submit bet (Player)
  submitBet: async (amount) => {
    const { sessionId, session, myPlayerId } = get()
    const sb = session.scoreboard || {}
    const myScore = sb[myPlayerId]?.score || 0
    // Clamp bet: minimum 100, max = player's current score (or 500 if no score yet)
    const maxBet = Math.max(myScore, 500)
    const bet = Math.min(Math.max(100, amount), maxBet)
    const bets = { ...(session.bets || {}), [myPlayerId]: bet }
    await updateDoc(doc(db, 'sessions', sessionId), { bets })
  },

  // Start media + timer (Host clicks play)
  startMedia: async () => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'running',
      questionStartTimestamp: serverNow(),
    })
  },

  // Trigger a sound on the Screen TV via Firestore
  triggerSound: async (soundId) => {
    const { sessionId } = get()
    if (!sessionId) return
    await updateDoc(doc(db, 'sessions', sessionId), {
      soundTrigger: { id: soundId, ts: Date.now() },
    })
  },

  // === PROGRESSIVE / PIXEL REVEAL ===
  setRevealLevel: async (level) => {
    const { sessionId } = get()
    if (!sessionId) return
    await updateDoc(doc(db, 'sessions', sessionId), {
      revealLevel: level,
    })
  },

  // === PREDICTION: "Je te mets combien ?" ===

  // Start prediction phase (Host, before first question)
  startPrediction: async () => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'prediction',
      predictions: {},
    })
  },

  // Submit prediction (Player)
  submitPrediction: async (count) => {
    const { sessionId, session, myPlayerId } = get()
    const predictions = { ...(session.predictions || {}), [myPlayerId]: count }
    await updateDoc(doc(db, 'sessions', sessionId), { predictions })
  },

  // End prediction phase → go to first question (Host)
  endPrediction: async () => {
    const { sessionId } = get()
    // Just set a flag, then host calls goQuestion(0)
    await updateDoc(doc(db, 'sessions', sessionId), {
      predictionLocked: true,
    })
  },

  // Force countdown to its target state (watchdog recovery)
  forceCountdownEnd: async () => {
    const { sessionId, session } = get()
    if (session?.status !== 'countdown') return
    const target = session.countdownTarget || 'running'
    console.log('⚠️ Watchdog: forcing countdown →', target)
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: target,
      questionStartTimestamp: target === 'running' ? serverNow() : null,
    })
  },

  // === PREDICTION: "Je te mets combien ?" ===
  startPrediction: async () => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'prediction',
      predictions: {},
    })
  },

  submitPrediction: async (count) => {
    const { sessionId, session, myPlayerId } = get()
    const predictions = { ...(session.predictions || {}), [myPlayerId]: count }
    await updateDoc(doc(db, 'sessions', sessionId), { predictions })
  },

  closePredictions: async () => {
    const { sessionId } = get()
    // Move on to question 0
    const { goQuestion } = get()
    await goQuestion(0)
  },

  // Reveal answer (Host)
  reveal: async () => {
    const { sessionId, session, players, answers } = get()
    const qIdx = session.currentQuestionIndex
    const q = session.quiz.questions[qIdx]
    const settings = session.settings || {}
    const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))

    // Answers for this question, keyed by playerId
    const qAns = {}
    Object.values(answers).forEach(a => {
      if (a.questionIndex === qIdx) qAns[a.playerId] = a
    })

    let results = {}

    // Resolve effective type for scoring (blindtest can behave as buzzer or estimate)
    const effectiveType = q.type === 'blindtest' && q.blindtestMode ? q.blindtestMode : q.type

    // Progressive and pixel behave as buzzer for scoring
    // Progressive, pixel, and reverse-buzzer behave as buzzer for scoring
    const isReverseBuzzer = effectiveType === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer')
    const scoringType = (effectiveType === 'progressive' || effectiveType === 'pixel' || isReverseBuzzer) ? 'buzzer'
      : effectiveType === 'reverse' ? (q.reverseAnswerMode === 'qcm' ? 'qcm' : 'text')
      : effectiveType

    // Special handling for estimate
    if (scoringType === 'estimate') {
      results = scoreEstimate(qAns, q.correctAnswer, q.points || 1000)
      Object.entries(results).forEach(([pid, r]) => {
        if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
        sb[pid].score += r.score
        sb[pid].streak = r.isCorrect ? sb[pid].streak + 1 : 0
        sb[pid].correct += r.isCorrect ? 1 : 0
        sb[pid].total += 1
      })
      // Players who didn't answer
      Object.keys(players).forEach(did => {
        if (!results[did]) {
          if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }
          sb[did].streak = 0; sb[did].total += 1
          results[did] = { isCorrect: false, score: 0 }
        }
      })
    }
    // Special handling for geo
    else if (scoringType === 'geo') {
      results = scoreGeo(qAns, q.geoTarget, q.points || 1000)
      Object.entries(results).forEach(([pid, r]) => {
        if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
        sb[pid].score += r.score
        sb[pid].streak = r.isCorrect ? sb[pid].streak + 1 : 0
        sb[pid].correct += r.isCorrect ? 1 : 0
        sb[pid].total += 1
      })
      Object.keys(players).forEach(did => {
        if (!results[did]) {
          if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }
          sb[did].streak = 0; sb[did].total += 1
          results[did] = { isCorrect: false, score: 0 }
        }
      })
    }
    // Special handling for buzzer
    else if (scoringType === 'buzzer') {
      results = scoreBuzzer(qAns, q.correctAnswer, q.points || 1000)
      Object.entries(results).forEach(([pid, r]) => {
        if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
        sb[pid].score += r.score
        sb[pid].streak = r.isCorrect ? sb[pid].streak + 1 : 0
        sb[pid].correct += r.isCorrect ? 1 : 0
        sb[pid].total += 1
      })
      Object.keys(players).forEach(did => {
        if (!results[did]) {
          if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }
          sb[did].streak = 0; sb[did].total += 1
          results[did] = { isCorrect: false, score: 0 }
        }
      })
    }
    // Special handling for order
    else if (scoringType === 'order') {
      Object.entries(players).forEach(([did]) => {
        if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }
        const ans = qAns[did]
        if (ans) {
          const r = scoreOrder(ans.selected, q.orderItems, q.points || 1000, ans.timeElapsed || q.timerSeconds, q.timerSeconds, settings, sb[did].streak)
          sb[did].score += r.score
          sb[did].streak = r.isCorrect ? sb[did].streak + 1 : 0
          sb[did].correct += r.isCorrect ? 1 : 0
          sb[did].total += 1
          results[did] = { isCorrect: r.isCorrect, score: r.score, correctCount: r.correctCount, total: (q.orderItems || []).length }
        } else {
          sb[did].streak = 0; sb[did].total += 1
          results[did] = { isCorrect: false, score: 0 }
        }
      })
    }
    // Special handling for match
    else if (scoringType === 'match') {
      Object.entries(players).forEach(([did]) => {
        if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }
        const ans = qAns[did]
        if (ans) {
          const r = scoreMatch(ans.selected, q.matchPairs, q.points || 1000, ans.timeElapsed || q.timerSeconds, q.timerSeconds, settings, sb[did].streak)
          sb[did].score += r.score
          sb[did].streak = r.isCorrect ? sb[did].streak + 1 : 0
          sb[did].correct += r.isCorrect ? 1 : 0
          sb[did].total += 1
          results[did] = { isCorrect: r.isCorrect, score: r.score, correctCount: r.correctCount, total: (q.matchPairs || []).length }
        } else {
          sb[did].streak = 0; sb[did].total += 1
          results[did] = { isCorrect: false, score: 0 }
        }
      })
    }
    // Standard QCM / multi / truefalse / text / blindtest
    else {
      const activeJokers = session.activeJokers || {}
      const bets = session.bets || {}
      const destinyPid = session.destinyPlayer || null
      Object.entries(players).forEach(([did, player]) => {
        if (!sb[did]) sb[did] = { score: 0, streak: 0, correct: 0, total: 0 }

        // Destiny wheel: only the chosen player is scored
        if (destinyPid && did !== destinyPid) {
          sb[did].total += 1
          results[did] = { isCorrect: false, score: 0, destinySkipped: true }
          return
        }

        const ans = qAns[did]
        const isCorrect = ans ? checkAnswer(q, ans.selected) : false
        const streak = isCorrect ? sb[did].streak + 1 : 0
        let pts = calculateScore(isCorrect, ans?.timeElapsed || q.timerSeconds, q.timerSeconds, q.points || 1000, settings, streak)
        // Apply x2 joker
        const pJokers = activeJokers[did] || {}
        if (pJokers.x2 && isCorrect) {
          pts *= 2
        }
        // Apply mystery x2
        if (q.mystery) {
          pts *= 2
        }
        // Destiny wheel: double or nothing
        if (destinyPid && did === destinyPid) {
          if (isCorrect) {
            pts *= 2 // Double points!
          } else {
            pts = -(q.points || 1000) // Lose points on wrong answer
          }
        }
        // Apply bonus wheel multiplier
        if (session.bonusMultiplier && session.bonusMultiplier > 1) {
          pts *= session.bonusMultiplier
        }
        // Apply bet: if correct → win bet amount, if wrong → lose bet amount
        let betResult = 0
        if (q.bet && bets[did]) {
          const betAmount = bets[did]
          if (isCorrect) {
            betResult = betAmount
          } else {
            betResult = -betAmount
          }
          pts += betResult
        }
        sb[did].score = Math.max(0, sb[did].score + pts) // No negative total
        sb[did].streak = streak
        sb[did].correct += isCorrect ? 1 : 0
        sb[did].total += 1
        results[did] = { isCorrect, score: pts, streak, betResult }
      })
    }

    // === SUDDEN DEATH: eliminate wrong players ===
    const eliminated = JSON.parse(JSON.stringify(session.eliminated || {}))
    if (session.gameMode === 'suddenDeath') {
      Object.entries(results).forEach(([pid, r]) => {
        if (!r.isCorrect && !eliminated[pid]) {
          eliminated[pid] = true
          results[pid].eliminated = true
        }
      })
      // Also eliminate players who didn't answer (no answer = wrong)
      Object.keys(players).forEach(did => {
        if (!results[did] && !eliminated[did]) {
          eliminated[did] = true
          if (!results[did]) results[did] = { isCorrect: false, score: 0 }
          results[did].eliminated = true
        }
      })

      // Check if only 1 (or 0) player remains — end game
      const alive = Object.keys(players).filter(did => !eliminated[did])
      const someoneEliminatedThisRound = Object.values(results).some(r => r.eliminated)
      
      if (alive.length === 0) {
        const honors = computeHonors(players, sb, get().answers, session.quiz.questions)
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'ended',
          scoreboard: sb,
          revealResults: results,
          eliminated,
          suddenDeathWinner: null,
          honors,
        })
        await saveHistory(sessionId, { ...session, scoreboard: sb, honors }, players)
        return
      }
      
      if (alive.length === 1 && someoneEliminatedThisRound) {
        const honors = computeHonors(players, sb, get().answers, session.quiz.questions)
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'ended',
          scoreboard: sb,
          revealResults: results,
          eliminated,
          suddenDeathWinner: alive[0],
          honors,
        })
        await saveHistory(sessionId, { ...session, scoreboard: sb, honors }, players)
        return
      }
      
      // Special case: all remaining players answered correctly — game continues
      // (even with 1 player, game continues until they get one wrong)
    }

    // Track score history for chart
    const scoreHistory = JSON.parse(JSON.stringify(session.scoreHistory || {}))
    Object.keys(players).forEach(pid => {
      if (!scoreHistory[pid]) scoreHistory[pid] = []
      scoreHistory[pid].push(sb[pid]?.score || 0)
    })

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'revealing',
      scoreboard: sb,
      revealResults: results,
      eliminated,
      activeJokers: {},
      scoreHistory,
    })
  },

  // Show scoreboard (Host)
  showScoreboard: async () => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'scoreboard' })
  },

  // Start category pick phase — last place player picks the next category
  startCategoryPick: async () => {
    const { sessionId, session, players } = get()
    if (!session) return

    // Find last place player
    const sb = session.scoreboard || {}
    const sorted = Object.entries(players)
      .map(([did, p]) => ({ did, score: sb[did]?.score || 0 }))
      .sort((a, b) => a.score - b.score)
    const lastPlayerId = sorted[0]?.did || null

    // Get available categories from remaining questions
    const nextIdx = (session.currentQuestionIndex ?? -1) + 1
    const remaining = session.quiz.questions.slice(nextIdx)
    const categories = [...new Set(remaining.map(q => q.category).filter(Boolean))]

    if (categories.length < 2 || !lastPlayerId) return // Not enough categories

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'categoryPick',
      categoryPickData: {
        pickerId: lastPlayerId,
        categories,
        chosen: null,
      },
    })
  },

  // Player submits category choice
  submitCategoryPick: async (category) => {
    const { sessionId, session } = get()
    if (!session?.categoryPickData) return

    // Find the next question with this category
    const nextIdx = (session.currentQuestionIndex ?? -1) + 1
    const questions = session.quiz.questions
    let targetIdx = null
    for (let i = nextIdx; i < questions.length; i++) {
      if (questions[i].category === category) {
        targetIdx = i
        break
      }
    }

    if (targetIdx !== null && targetIdx !== nextIdx) {
      // Swap the next question with the chosen category question
      const updatedQuestions = [...questions]
      ;[updatedQuestions[nextIdx], updatedQuestions[targetIdx]] = [updatedQuestions[targetIdx], updatedQuestions[nextIdx]]
      await updateDoc(doc(db, 'sessions', sessionId), {
        'quiz.questions': updatedQuestions,
        'categoryPickData.chosen': category,
      })
    } else {
      await updateDoc(doc(db, 'sessions', sessionId), {
        'categoryPickData.chosen': category,
      })
    }
  },

  // Submit answer (Player) — with offline retry
  submitAnswer: async (selected) => {
    const { sessionId, session, myPlayerId } = get()
    const qIdx = session.currentQuestionIndex
    const elapsed = (serverNow() - session.questionStartTimestamp) / 1000
    const answerId = `${myPlayerId}_q${qIdx}`

    const answerData = {
      playerId: myPlayerId,
      questionIndex: qIdx,
      selected,
      timeElapsed: elapsed,
      timestamp: serverNow(),
    }

    const doSubmit = async () => {
      await setDoc(doc(db, 'sessions', sessionId, 'answers', answerId), answerData)
    }

    try {
      await doSubmit()
    } catch (e) {
      console.warn('⚠️ Answer submit failed (offline?), queuing for retry...', e)
      // Retry every 3 seconds until success
      const retryInterval = setInterval(async () => {
        try {
          await doSubmit()
          clearInterval(retryInterval)
          console.log('✅ Queued answer submitted successfully')
        } catch (e2) { /* still offline, keep retrying */ }
      }, 3000)
      // Stop retrying after 60 seconds
      setTimeout(() => clearInterval(retryInterval), 60000)
    }
  },

  // Buzzer press (Player)
  pressBuzzer: async () => {
    const { sessionId, session, myPlayerId } = get()
    if (session.buzzerLocked) return false

    // Try to lock buzzer
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        buzzerLocked: true,
        buzzerWinner: myPlayerId,
      })
      return true
    } catch (e) {
      return false
    }
  },

  // End game
  endGame: async () => {
    const { sessionId, role } = get()
    // If Host ends the game, notify all players via Firestore
    if (role === 'host' && sessionId) {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), { status: 'ended' })
      } catch (e) { console.error('endGame update error:', e) }
    }
    get()._unsubs.forEach(fn => fn())
    set({
      session: null, players: {}, answers: {},
      sessionId: null, myPlayerId: null, myPlayerData: null,
      role: null, _unsubs: [],
    })
  },

  // Get sorted players with scores
  getSorted: () => {
    const { players, session } = get()
    const sb = session?.scoreboard || {}
    return Object.entries(players)
      .map(([did, p]) => ({
        ...p, did,
        score: sb[did]?.score || 0,
        correct: sb[did]?.correct || 0,
        total: sb[did]?.total || 0,
        streak: sb[did]?.streak || 0,
      }))
      .sort((a, b) => b.score - a.score)
  },

  // Get answer count for current question
  getAnswerCount: () => {
    const { session, answers } = get()
    if (!session) return 0
    const qIdx = session.currentQuestionIndex
    let count = 0
    Object.values(answers).forEach(a => { if (a.questionIndex === qIdx) count++ })
    return count
  },

  // Check if player already answered current question
  hasAnswered: () => {
    const { session, answers, myPlayerId } = get()
    if (!session || !myPlayerId) return false
    const qIdx = session.currentQuestionIndex
    return Object.values(answers).some(a => a.questionIndex === qIdx && a.playerId === myPlayerId)
  },

  // Check if a player is eliminated (sudden death)
  isEliminated: (pid) => {
    const { session } = get()
    return session?.eliminated?.[pid || get().myPlayerId] || false
  },

  // Get alive players count
  getAliveCount: () => {
    const { session, players } = get()
    if (!session || session.gameMode !== 'suddenDeath') return Object.keys(players).length
    const eliminated = session.eliminated || {}
    return Object.keys(players).filter(did => !eliminated[did]).length
  },

  // Get team scores (aggregate player scores by team)
  getTeamScores: () => {
    const { session, players } = get()
    if (!session?.teamMode) return []
    const sb = session?.scoreboard || {}
    const enabledTeams = session?.enabledTeams || []

    const teamMap = {}
    enabledTeams.forEach(tid => {
      const tc = TEAM_COLORS.find(t => t.id === tid)
      if (tc) teamMap[tid] = { ...tc, name: getTeamName(tid, session), totalScore: 0, correct: 0, total: 0, playerCount: 0, players: [] }
    })

    Object.entries(players).forEach(([did, p]) => {
      if (p.team && teamMap[p.team]) {
        const ps = sb[did] || { score: 0, correct: 0, total: 0 }
        teamMap[p.team].totalScore += ps.score || 0
        teamMap[p.team].correct += ps.correct || 0
        teamMap[p.team].total += ps.total || 0
        teamMap[p.team].playerCount++
        teamMap[p.team].players.push({ ...p, did, score: ps.score || 0 })
      }
    })

    // Score = average per player (fair regardless of team size)
    return Object.values(teamMap).map(t => ({
      ...t,
      score: t.playerCount > 0 ? Math.round(t.totalScore / t.playerCount) : 0,
    })).sort((a, b) => b.score - a.score)
  },

  // Assign player to team (Host action)
  assignTeam: async (playerId, teamId) => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId, 'players', playerId), { team: teamId })
  },

  // Auto-assign teams (balance players across teams)
  autoAssignTeams: async () => {
    const { sessionId, session, players } = get()
    const enabledTeams = session?.enabledTeams || []
    if (enabledTeams.length === 0) return

    const playerIds = Object.keys(players)
    // Shuffle
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]]
    }
    // Assign round-robin
    const promises = playerIds.map((pid, idx) => {
      const teamId = enabledTeams[idx % enabledTeams.length]
      return updateDoc(doc(db, 'sessions', sessionId, 'players', pid), { team: teamId })
    })
    await Promise.all(promises)
  },

  // Set custom team name
  setTeamName: async (teamId, name) => {
    const { sessionId, session } = get()
    const teamNames = { ...(session?.teamNames || {}), [teamId]: name }
    await updateDoc(doc(db, 'sessions', sessionId), { teamNames })
  },

  // ========= STEAL MODE =========

  // After reveal on a "steal" question, transition to stealing phase
  // Called by Host after seeing reveal results
  startStealPhase: async () => {
    const { sessionId, session, players } = get()
    if (!session) return

    const q = session.quiz.questions[session.currentQuestionIndex]
    if (!q.steal) return

    const results = session.revealResults || {}
    const sb = session.scoreboard || {}

    // Determine which teams answered correctly (sorted by fastest avg time)
    const teamResults = {}
    Object.entries(players).forEach(([pid, p]) => {
      if (!p.team) return
      if (!teamResults[p.team]) teamResults[p.team] = { correct: 0, total: 0, fastestTime: Infinity }
      const r = results[pid]
      if (r?.isCorrect) {
        teamResults[p.team].correct++
        if (r.timeElapsed < teamResults[p.team].fastestTime) teamResults[p.team].fastestTime = r.timeElapsed
      }
      teamResults[p.team].total++
    })

    // Teams that got majority correct = winning teams (can steal)
    const winningTeams = []
    const losingTeams = []
    Object.entries(teamResults).forEach(([tid, tr]) => {
      if (tr.correct > tr.total / 2) winningTeams.push({ team: tid, fastestTime: tr.fastestTime })
      else losingTeams.push(tid)
    })
    // Sort winning teams by speed (fastest first = picks first)
    winningTeams.sort((a, b) => a.fastestTime - b.fastestTime)

    const stealPoints = q.stealPoints || q.points || 1000

    // If no losing teams → skip steal phase entirely (nothing to steal!)
    if (losingTeams.length === 0 || winningTeams.length === 0) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'scoreboard',
        stealData: null,
      })
      return
    }

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'stealing',
      stealData: {
        winningTeams: winningTeams.map(w => w.team),
        losingTeams,
        stealPoints,
        currentStealerIndex: 0, // which winning team is choosing
        steals: {}, // teamId -> targetTeamId (choices made)
      }
    })
  },

  // Player/team submits their steal choice (target team)
  submitSteal: async (targetTeamId) => {
    const { sessionId, session, myPlayerData } = get()
    if (!session?.stealData) return
    const myTeam = myPlayerData?.team
    if (!myTeam) return

    // Only winning teams can steal
    if (!session.stealData.winningTeams.includes(myTeam)) return

    // Record steal choice
    const steals = { ...(session.stealData.steals || {}), [myTeam]: targetTeamId }

    // Check if current stealer index should advance
    const winTeams = session.stealData.winningTeams
    let nextIdx = session.stealData.currentStealerIndex
    // Find next team that hasn't chosen yet
    while (nextIdx < winTeams.length && steals[winTeams[nextIdx]]) nextIdx++

    await updateDoc(doc(db, 'sessions', sessionId), {
      'stealData.steals': steals,
      'stealData.currentStealerIndex': nextIdx,
    })
  },

  // Host confirms all steals and applies score changes
  applySteal: async () => {
    const { sessionId, session } = get()
    if (!session?.stealData) return

    const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))
    const { steals, stealPoints, winningTeams } = session.stealData

    // Build steal log for display
    const stealLog = []

    // Apply steals in order (fastest team first)
    winningTeams.forEach(tid => {
      const target = steals[tid]
      if (!target) return

      // Calculate how much can actually be stolen (team score, min 0)
      let targetTeamScore = 0
      Object.entries(sb).forEach(([pid, s]) => {
        // We need players data — approximate from existing scores
        // The steal applies to team aggregate, so we track per team
      })

      // Actually: steal from each player of the target team proportionally
      // Simpler: just transfer stealPoints flat
      const pointsToSteal = Math.min(stealPoints, getTeamTotalScore(sb, target, get().players))

      if (pointsToSteal > 0) {
        // Remove from target team players (proportional)
        removePointsFromTeam(sb, target, pointsToSteal, get().players)
        // Add to stealing team players (split evenly)
        addPointsToTeam(sb, tid, pointsToSteal, get().players)
        stealLog.push({ from: target, to: tid, points: pointsToSteal })
      }
    })

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'stealReveal',
      scoreboard: sb,
      stealLog,
    })
  },

  // After steal reveal animation, go to scoreboard
  finishSteal: async () => {
    const { sessionId } = get()
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'scoreboard',
      stealData: null,
      stealLog: null,
    })
  },

  // === DUEL MODE ===

  // Initialize duel bracket (Host calls after lobby)
  initDuelBracket: (playerIds) => {
    // Shuffle players randomly
    const shuffled = [...playerIds]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Create pairs. If odd number → last player gets a bye (auto-advances)
    const matches = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({ player1: shuffled[i], player2: shuffled[i + 1], winner: null })
      } else {
        matches.push({ player1: shuffled[i], player2: null, winner: shuffled[i] }) // bye
      }
    }

    return {
      rounds: [matches],
      currentRound: 0,
      currentMatch: 0,
      questionPool: 0, // which question index to use next
    }
  },

  // Start duel mode (Host)
  startDuel: async () => {
    const { sessionId, session, players } = get()
    const playerIds = Object.keys(players)
    if (playerIds.length < 2) return

    const bracket = get().initDuelBracket(playerIds)

    // Skip byes in first round
    let firstRealMatch = 0
    while (firstRealMatch < bracket.rounds[0].length && bracket.rounds[0][firstRealMatch].winner) {
      firstRealMatch++
    }

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'duelIntro',
      duel: {
        ...bracket,
        currentMatch: firstRealMatch,
      },
    })
  },

  // Launch the current duel match question
  launchDuelQuestion: async () => {
    const { sessionId, session } = get()
    const duel = session.duel
    if (!duel) return

    const qIdx = duel.questionPool
    if (qIdx >= session.quiz.questions.length) {
      // No more questions — end tournament
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'ended' })
      return
    }

    const q = session.quiz.questions[qIdx]
    const hasMedia = (q.media && q.media.url) || q.type === 'karaoke'

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'countdown',
      currentQuestionIndex: qIdx,
      questionStartTimestamp: null,
      revealResults: null,
      buzzerLocked: false,
      buzzerWinner: null,
      buzzerPenalized: [],
      activeJokers: {},
      countdownTarget: hasMedia ? 'preMedia' : 'running',
    })

    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: hasMedia ? 'preMedia' : 'running',
          questionStartTimestamp: hasMedia ? null : serverNow(),
        })
      } catch (e) { console.error('Duel countdown error:', e) }
    }, 4000)
  },

  // Resolve current duel match after reveal
  resolveDuelMatch: async () => {
    const { sessionId, session, answers } = get()
    const duel = session.duel
    if (!duel) return

    const round = duel.rounds[duel.currentRound]
    const match = round[duel.currentMatch]
    const qIdx = duel.questionPool
    const q = session.quiz.questions[qIdx]

    // Get answers from both duelists
    const a1 = Object.values(answers).find(a => a.playerId === match.player1 && a.questionIndex === qIdx)
    const a2 = Object.values(answers).find(a => a.playerId === match.player2 && a.questionIndex === qIdx)

    const correct1 = a1 ? (q.type === 'multi'
      ? JSON.stringify([...(a1.selected || [])].sort()) === JSON.stringify([...q.correctAnswer].sort())
      : a1.selected === q.correctAnswer) : false
    const correct2 = a2 ? (q.type === 'multi'
      ? JSON.stringify([...(a2.selected || [])].sort()) === JSON.stringify([...q.correctAnswer].sort())
      : a2.selected === q.correctAnswer) : false

    let winner = null
    if (correct1 && !correct2) winner = match.player1
    else if (!correct1 && correct2) winner = match.player2
    else if (correct1 && correct2) {
      // Both correct → fastest wins
      winner = (a1.timeElapsed || 99) <= (a2.timeElapsed || 99) ? match.player1 : match.player2
    } else {
      // Both wrong → fastest answer (or random if neither answered)
      if (a1 && a2) winner = (a1.timeElapsed || 99) <= (a2.timeElapsed || 99) ? match.player1 : match.player2
      else if (a1) winner = match.player1
      else if (a2) winner = match.player2
      else winner = Math.random() < 0.5 ? match.player1 : match.player2 // random tiebreak
    }

    // Update bracket
    const updatedRounds = JSON.parse(JSON.stringify(duel.rounds))
    updatedRounds[duel.currentRound][duel.currentMatch].winner = winner

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'duelResult',
      'duel.rounds': updatedRounds,
      duelMatchResult: {
        player1: match.player1,
        player2: match.player2,
        winner,
        correct1, correct2,
        time1: a1?.timeElapsed || null,
        time2: a2?.timeElapsed || null,
      },
    })
  },

  // Advance to next duel match or next round
  nextDuelMatch: async () => {
    const { sessionId, session } = get()
    const duel = session.duel
    if (!duel) return

    const currentRound = duel.rounds[duel.currentRound]
    let nextMatch = duel.currentMatch + 1

    // Skip byes
    while (nextMatch < currentRound.length && currentRound[nextMatch].winner) {
      nextMatch++
    }

    if (nextMatch < currentRound.length) {
      // More matches in this round
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'duelIntro',
        'duel.currentMatch': nextMatch,
        'duel.questionPool': duel.questionPool + 1,
        duelMatchResult: null,
      })
    } else {
      // Round complete — create next round from winners
      const winners = currentRound.map(m => m.winner).filter(Boolean)

      if (winners.length <= 1) {
        // Tournament over!
        await updateDoc(doc(db, 'sessions', sessionId), {
          status: 'ended',
          duelMatchResult: null,
          duelChampion: winners[0] || null,
        })
        return
      }

      // Create next round pairs
      const nextMatches = []
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          nextMatches.push({ player1: winners[i], player2: winners[i + 1], winner: null })
        } else {
          nextMatches.push({ player1: winners[i], player2: null, winner: winners[i] })
        }
      }

      const updatedRounds = [...duel.rounds, nextMatches]
      let firstRealMatch = 0
      while (firstRealMatch < nextMatches.length && nextMatches[firstRealMatch].winner) {
        firstRealMatch++
      }

      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'duelIntro',
        'duel.rounds': updatedRounds,
        'duel.currentRound': duel.currentRound + 1,
        'duel.currentMatch': firstRealMatch,
        'duel.questionPool': duel.questionPool + 1,
        duelMatchResult: null,
      })
    }
  },

  // Get combined soirée scores (cumulative across all quizzes in the evening)
  getSoireeScores: () => {
    const { session, players } = get()
    if (!session) return []
    const sb = session.scoreboard || {}
    const soireeScores = session.soireeScores || {}

    return Object.entries(players)
      .map(([did, p]) => ({
        ...p, did,
        quizScore: sb[did]?.score || 0,
        soireeScore: (soireeScores[did] || 0) + (sb[did]?.score || 0),
      }))
      .sort((a, b) => b.soireeScore - a.soireeScore)
  },

  // Save current quiz scores into cumulative soirée scores (in session)
  // Called at end of each quiz before loading next
  commitSoireeScores: () => {
    const { session, players } = get()
    if (!session) return {}
    const sb = session.scoreboard || {}
    const prev = session.soireeScores || {}
    const updated = { ...prev }
    Object.entries(players).forEach(([did, p]) => {
      updated[did] = (updated[did] || 0) + (sb[did]?.score || 0)
    })
    return updated
  },

  // Load next quiz into the SAME session (soirée mode)
  // Keeps players, teams, cumulates scores — just swaps the quiz
  loadNextQuiz: async (quiz) => {
    const { sessionId, session } = get()
    if (!sessionId || !session) throw new Error('Pas de session active')

    const cleanQuiz = cleanQuizForFirestore(quiz)

    // Shuffle if setting enabled
    if (session.settings?.shuffleQuestions) {
      const shuffled = [...cleanQuiz.questions]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      cleanQuiz.questions = shuffled
    }

    // Cumulate scores from current quiz into soirée scores
    const soireeScores = get().commitSoireeScores()

    // DELETE all previous answers
    const answersSnap = await getDocs(collection(db, 'sessions', sessionId, 'answers'))
    const deletePromises = []
    answersSnap.forEach(d => {
      deletePromises.push(deleteDoc(doc(db, 'sessions', sessionId, 'answers', d.id)))
    })
    await Promise.all(deletePromises)

    // Reset game state, keep players & teams
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'lobby',
      quiz: cleanQuiz,
      quizTitle: quiz.title || 'Quiz sans titre',
      currentQuestionIndex: -1,
      questionStartTimestamp: null,
      scoreboard: {},
      scoreHistory: {},
      revealResults: null,
      revealLevel: 0,
      buzzerLocked: false,
      buzzerWinner: null,
      buzzerPenalized: [],
      eliminated: {},
      stealData: null,
      stealLog: null,
      activeJokers: {},
      jokers: {},
      soireeScores,
      quizNumber: (session.quizNumber || 1) + 1,
    })

    // Re-init jokers for all current players
    const { players } = get()
    const jokers = {}
    Object.keys(players).forEach(pid => {
      jokers[pid] = { x2: 1, fifty: 1, time: 1 }
    })
    await updateDoc(doc(db, 'sessions', sessionId), { jokers })
  },

  // Save soirée to localStorage (for display/export purposes)
  saveSoireeScores: () => {
    const { session, players } = get()
    if (!session) return null

    // Use commitSoireeScores which uses player IDs
    const cumulative = get().commitSoireeScores()

    // Also save name mapping for display
    const nameMap = {}
    Object.entries(players).forEach(([did, p]) => {
      nameMap[did] = { name: p.name, avatar: p.avatar, team: p.team }
    })

    const soireeData = {
      id: session.soireeId || 'soiree-' + Date.now(),
      scores: cumulative,
      nameMap,
      quizNumber: session.quizNumber || 1,
      teamMode: session.teamMode,
      enabledTeams: session.enabledTeams,
      lastUpdated: Date.now(),
    }
    localStorage.setItem('qm_soiree', JSON.stringify(soireeData))
    return soireeData
  },

  // Load soirée data from localStorage
  loadSoiree: () => {
    try {
      const raw = localStorage.getItem('qm_soiree')
      if (!raw) return null
      const data = JSON.parse(raw)
      // Expire after 12 hours
      if (Date.now() - data.lastUpdated > 12 * 60 * 60 * 1000) {
        localStorage.removeItem('qm_soiree')
        return null
      }
      return data
    } catch { return null }
  },

  // Clear soirée
  clearSoiree: () => {
    localStorage.removeItem('qm_soiree')
  },

  // ========= JOKERS =========

  // Initialize jokers for a player when they join
  // Called during session creation for settings
  getMyJokers: () => {
    const { session, myPlayerId } = get()
    if (!session || !myPlayerId) return { x2: 1, fifty: 1, time: 1 }
    const jokers = session.jokers || {}
    return jokers[myPlayerId] || { x2: 1, fifty: 1, time: 1 }
  },

  // Use a joker (player action)
  useJoker: async (type) => {
    const { sessionId, session, myPlayerId } = get()
    if (!session || !myPlayerId) return null

    const jokers = JSON.parse(JSON.stringify(session.jokers || {}))
    if (!jokers[myPlayerId]) jokers[myPlayerId] = { x2: 1, fifty: 1, time: 1 }
    if (jokers[myPlayerId][type] <= 0) return null

    jokers[myPlayerId][type]--

    const qIdx = session.currentQuestionIndex
    const q = session.quiz.questions[qIdx]

    // Record active joker for scoring
    const activeJokers = { ...(session.activeJokers || {}) }
    if (!activeJokers[myPlayerId]) activeJokers[myPlayerId] = {}
    activeJokers[myPlayerId][type] = true

    const update = { jokers, activeJokers }

    // 50/50: return 2 wrong answers to hide (for this player only — stored in activeJokers)
    if (type === 'fifty' && q.choices) {
      const correct = q.type === 'multi' ? q.correctAnswer : [q.correctAnswer]
      const wrongIndices = q.choices.map((_, i) => i).filter(i => !correct.includes(i))
      // Shuffle and pick 2 to remove (or half of wrong answers)
      const toRemove = wrongIndices.sort(() => Math.random() - 0.5).slice(0, Math.max(2, Math.floor(wrongIndices.length / 2)))
      activeJokers[myPlayerId].fiftyRemoved = toRemove
      update.activeJokers = activeJokers
    }

    // +5sec: add 5 seconds to timer for everyone (simple approach)
    if (type === 'time') {
      update.questionStartTimestamp = session.questionStartTimestamp ? session.questionStartTimestamp + 5000 : null
    }

    await updateDoc(doc(db, 'sessions', sessionId), update)

    return type
  },

  // ========= BUZZER HOST CONTROL =========

  // Host marks buzzer answer as correct (award points)
  buzzerCorrect: async () => {
    const { sessionId, session, players } = get()
    const winner = session?.buzzerWinner
    if (!winner) return

    const q = session.quiz.questions[session.currentQuestionIndex]
    const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))
    if (!sb[winner]) sb[winner] = { score: 0, streak: 0, correct: 0, total: 0 }

    // Calculate points based on reveal level for progressive/pixel modes
    let points = q.points || 1000
    const rl = session.revealLevel || 0
    if (q.type === 'blindtest' && q.blindtestMode === 'progressive') {
      points = [1000, 750, 500, 250][rl] || 250
    } else if (q.type === 'blindtest' && q.blindtestMode === 'pixel') {
      points = [1000, 800, 600, 400, 200][rl] || 200
    } else if (q.type === 'zoom') {
      points = [1000, 800, 600, 400, 200][rl] || 200
    }

    sb[winner].score += points
    sb[winner].streak += 1
    sb[winner].correct += 1
    sb[winner].total += 1

    // Mark all other players as answered (wrong)
    Object.keys(players).forEach(pid => {
      if (pid !== winner) {
        if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
        sb[pid].streak = 0
        sb[pid].total += 1
      }
    })

    const results = {}
    results[winner] = { isCorrect: true, score: points, isBuzzerWinner: true }
    Object.keys(players).forEach(pid => {
      if (pid !== winner) results[pid] = { isCorrect: false, score: 0 }
    })

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'revealing',
      scoreboard: sb,
      revealResults: results,
    })
  },

  // Host marks buzzer answer as wrong (optional penalty)
  buzzerWrong: async (penalty = 0) => {
    const { sessionId, session } = get()
    const loser = session?.buzzerWinner
    if (!loser) return

    const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))
    if (!sb[loser]) sb[loser] = { score: 0, streak: 0, correct: 0, total: 0 }
    sb[loser].score = Math.max(0, sb[loser].score - penalty)
    sb[loser].streak = 0
    sb[loser].total += 1

    // Reset buzzer so others can try (or host can reveal)
    await updateDoc(doc(db, 'sessions', sessionId), {
      buzzerLocked: false,
      buzzerWinner: null,
      buzzerPenalized: [...(session.buzzerPenalized || []), loser],
      scoreboard: sb,
    })
  },

  // Host reveals buzzer answer (no more buzzing)
  buzzerReveal: async () => {
    const { sessionId, session, players } = get()
    const q = session.quiz.questions[session.currentQuestionIndex]
    const sb = JSON.parse(JSON.stringify(session.scoreboard || {}))

    // No one got it right
    Object.keys(players).forEach(pid => {
      if (!sb[pid]) sb[pid] = { score: 0, streak: 0, correct: 0, total: 0 }
      sb[pid].streak = 0
      sb[pid].total += 1
    })

    const results = {}
    Object.keys(players).forEach(pid => {
      results[pid] = { isCorrect: false, score: 0 }
    })

    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'revealing',
      scoreboard: sb,
      revealResults: results,
      buzzerLocked: true,
    })
  },
}))
