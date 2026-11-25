/**
 * Calculate score for a player's answer
 */
export function calculateScore(isCorrect, timeElapsed, totalTime, basePoints, settings, streak) {
  if (!isCorrect) {
    return settings.wrongPenalty ? -Math.round(basePoints * 0.25) : 0
  }

  let score = basePoints

  // Speed bonus: faster = more points
  if (settings.speedBonus) {
    const timeRatio = Math.max(0, 1 - (timeElapsed / totalTime))
    score = Math.round(basePoints * (0.5 + 0.5 * timeRatio))
  }

  // Streak bonus: consecutive correct answers
  if (settings.streakBonus && streak >= 2) {
    score += Math.min(streak - 1, 5) * 100
  }

  return score
}

/**
 * Check if an answer is correct based on question type
 */
export function checkAnswer(question, selected) {
  const { type, correctAnswer } = question

  switch (type) {
    case 'qcm':
    case 'truefalse':
      return selected === correctAnswer

    case 'multi': {
      const sel = Array.isArray(selected) ? [...selected].sort((a,b) => a-b) : []
      const cor = Array.isArray(correctAnswer) ? [...correctAnswer].sort((a,b) => a-b) : []
      return JSON.stringify(sel) === JSON.stringify(cor)
    }

    case 'text': {
      // Normalize: trim, lowercase, remove accents
      const normalize = (s) => String(s).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const answer = normalize(selected)
      if (!answer) return false
      // Build list of accepted answers
      let accepted = []
      if (Array.isArray(correctAnswer)) {
        accepted = correctAnswer.map(normalize)
      } else {
        // Support comma-separated string: "Paris, paris, PARIS"
        accepted = String(correctAnswer).split(',').map(normalize)
      }
      return accepted.some(a => a && a === answer)
    }

    case 'estimate': {
      // For estimate, we don't return true/false here
      // Scoring is handled separately (closest wins)
      return null // Special handling
    }

    case 'buzzer': {
      // Host validates manually, or auto-check against keywords
      const answer = String(selected).trim().toLowerCase()
      const keywords = String(correctAnswer).toLowerCase().split(/\s+/)
      return keywords.some(kw => answer.includes(kw))
    }

    case 'blindtest': {
      // Same as QCM if choices are provided, or text match if no choices
      if (question.choices && question.choices.length > 0) {
        return selected === correctAnswer
      }
      // Text-based blind test
      const ans = String(selected).trim().toLowerCase()
      if (Array.isArray(correctAnswer)) {
        return correctAnswer.some(a => ans.includes(a.toLowerCase().trim()))
      }
      return ans.includes(String(correctAnswer).toLowerCase().trim())
    }

    case 'karaoke': {
      // Same as text: normalize and compare
      const normalize = (s) => String(s).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const answer = normalize(selected)
      if (!answer) return false
      let accepted = []
      if (Array.isArray(correctAnswer)) {
        accepted = correctAnswer.map(normalize)
      } else {
        accepted = String(correctAnswer).split(',').map(normalize)
      }
      return accepted.some(a => a && a === answer)
    }

    case 'order': {
      // selected is an array of items in player's order
      // correctAnswer is the correct order (orderItems)
      const correct = question.orderItems || []
      if (!Array.isArray(selected) || selected.length !== correct.length) return false
      return selected.every((item, i) => item === correct[i])
    }

    case 'match': {
      // selected is an object { 0: 2, 1: 0, 2: 3, 3: 1 } mapping left index to right index
      // Correct is when each left[i] maps to right[i] (identity)
      const pairs = question.matchPairs || []
      if (!selected || typeof selected !== 'object') return false
      return pairs.every((_, i) => selected[String(i)] === i)
    }

    case 'zoom': {
      // Same as buzzer — host validates orally
      return null // Manual validation by host
    }

    default:
      return selected === correctAnswer
  }
}

/**
 * Score estimation question - closest to correct answer gets most points
 */
export function scoreEstimate(playerAnswers, correctAnswer, basePoints) {
  const results = {}
  const entries = Object.entries(playerAnswers)

  if (entries.length === 0) return results

  // Calculate distances
  const distances = entries.map(([pid, ans]) => ({
    pid,
    value: Number(ans.selected) || 0,
    distance: Math.abs((Number(ans.selected) || 0) - correctAnswer),
    timeElapsed: ans.timeElapsed,
  }))

  // Sort by distance (closest first), then by time (fastest first)
  distances.sort((a, b) => a.distance - b.distance || a.timeElapsed - b.timeElapsed)

  const maxDist = Math.max(...distances.map(d => d.distance), 1)

  distances.forEach((d, rank) => {
    const accuracy = Math.max(0, 1 - (d.distance / maxDist))
    const pts = Math.round(basePoints * accuracy * (rank === 0 ? 1 : 0.8))
    results[d.pid] = {
      isCorrect: rank === 0, // "Winner" is the closest
      score: Math.max(pts, rank < 3 ? 100 : 0), // Top 3 always get some points
      value: d.value,
      distance: d.distance,
    }
  })

  return results
}

/**
 * Score geo question - closest to target coordinates gets most points
 */
export function scoreGeo(playerAnswers, geoTarget, basePoints) {
  const results = {}
  const entries = Object.entries(playerAnswers)
  if (entries.length === 0 || !geoTarget) return results

  const R = 6371 // km
  const dist = (lat1, lng1, lat2, lng2) => {
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const distances = entries.map(([pid, ans]) => {
    const sel = ans.selected || {}
    const km = dist(sel.lat || 0, sel.lng || 0, geoTarget.lat, geoTarget.lng)
    return { pid, km, lat: sel.lat, lng: sel.lng, timeElapsed: ans.timeElapsed }
  })

  distances.sort((a, b) => a.km - b.km || a.timeElapsed - b.timeElapsed)
  const maxDist = Math.max(...distances.map(d => d.km), 1)

  distances.forEach((d, rank) => {
    const accuracy = Math.max(0, 1 - (d.km / maxDist))
    const pts = Math.round(basePoints * accuracy * (rank === 0 ? 1 : 0.8))
    results[d.pid] = {
      isCorrect: rank === 0,
      score: Math.max(pts, rank < 3 ? 100 : 0),
      distanceKm: Math.round(d.km),
      lat: d.lat,
      lng: d.lng,
    }
  })

  return results
}

/**
 * Score buzzer question - first correct answer wins
 */
export function scoreBuzzer(playerAnswers, correctAnswer, basePoints) {
  const results = {}
  const entries = Object.entries(playerAnswers)

  // Sort by timestamp (earliest first)
  const sorted = entries
    .map(([pid, ans]) => ({ pid, ...ans }))
    .sort((a, b) => a.timestamp - b.timestamp)

  let winnerFound = false
  sorted.forEach(ans => {
    const answer = String(ans.selected).trim().toLowerCase()
    const keywords = String(correctAnswer).toLowerCase().split(/\s+/)
    const isCorrect = keywords.some(kw => answer.includes(kw))

    if (isCorrect && !winnerFound) {
      winnerFound = true
      results[ans.pid] = { isCorrect: true, score: basePoints, isBuzzerWinner: true }
    } else {
      results[ans.pid] = { isCorrect: false, score: 0, isBuzzerWinner: false }
    }
  })

  return results
}

/**
 * Score order question — partial credit based on items in correct position
 */
export function scoreOrder(selected, correctOrder, basePoints, timeElapsed, totalTime, settings, streak) {
  if (!Array.isArray(selected) || selected.length !== correctOrder.length) {
    return { isCorrect: false, score: 0, correctCount: 0 }
  }
  let correctCount = 0
  selected.forEach((item, i) => {
    if (item === correctOrder[i]) correctCount++
  })
  const isCorrect = correctCount === correctOrder.length
  const ratio = correctCount / correctOrder.length
  let score = Math.round(basePoints * ratio)

  // Speed bonus on the partial score
  if (settings?.speedBonus && score > 0) {
    const timeRatio = Math.max(0, 1 - (timeElapsed / totalTime))
    score = Math.round(score * (0.5 + 0.5 * timeRatio))
  }
  // Streak bonus only for perfect order
  if (settings?.streakBonus && isCorrect && streak >= 2) {
    score += Math.min(streak - 1, 5) * 100
  }
  return { isCorrect, score, correctCount }
}

/**
 * Score match question — partial credit based on correct pairs
 */
export function scoreMatch(selected, matchPairs, basePoints, timeElapsed, totalTime, settings, streak) {
  if (!selected || typeof selected !== 'object') {
    return { isCorrect: false, score: 0, correctCount: 0 }
  }
  let correctCount = 0
  matchPairs.forEach((_, i) => {
    if (selected[String(i)] === i) correctCount++
  })
  const isCorrect = correctCount === matchPairs.length
  const ratio = correctCount / matchPairs.length
  let score = Math.round(basePoints * ratio)

  if (settings?.speedBonus && score > 0) {
    const timeRatio = Math.max(0, 1 - (timeElapsed / totalTime))
    score = Math.round(score * (0.5 + 0.5 * timeRatio))
  }
  if (settings?.streakBonus && isCorrect && streak >= 2) {
    score += Math.min(streak - 1, 5) * 100
  }
  return { isCorrect, score, correctCount }
}
